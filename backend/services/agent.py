import json
import os
from typing import Any

import httpx
import pandas as pd

from services.analysis_plan import extract_json_object, validate_plan
from services.data_query import dataframe_schema, run_query
from services.preferences import format_preferences_block, normalize_preferences
from services.session_store import get_session

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"
MAX_HISTORY_MESSAGES = 16
MAX_TOOL_ROUNDS = 4

SYSTEM_PROMPT = (
    "你是严谨的数据分析助手，只基于给定数据做分析，不编造不存在的数据。"
    "若启用了用户分析偏好，将其作为视角与侧重点，但不得据此虚构数字或事实。"
)

CHAT_SYSTEM_PROMPT = (
    "你是严谨的数据分析助手。你可以调用 query_dataframe 工具查询用户上传的原始表格，"
    "再基于查询结果回答。禁止编造数字；需要统计、筛选、排序、分组时必须先调用工具。"
    "若工具结果不足以回答，请说明还缺什么信息。"
    "若启用了用户分析偏好，将其作为视角与侧重点，但不得据此虚构数字或事实。"
    "最终用中文简洁回答。"
)

QUERY_TOOL = {
    "type": "function",
    "function": {
        "name": "query_dataframe",
        "description": (
            "对用户上传的原始 DataFrame 执行安全查询。"
            "支持 schema / describe / head / value_counts / groupby_agg / "
            "filter_rows / sort / correlation / missing_summary。"
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "operation": {
                    "type": "string",
                    "enum": [
                        "schema",
                        "describe",
                        "head",
                        "value_counts",
                        "groupby_agg",
                        "filter_rows",
                        "sort",
                        "correlation",
                        "missing_summary",
                    ],
                },
                "column": {"type": "string", "description": "单列操作时的列名"},
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "多列操作时的列名列表",
                },
                "by": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "groupby 分组列",
                },
                "aggregations": {
                    "type": "object",
                    "description": "groupby 聚合，如 {\"销售额\": \"sum\"}",
                    "additionalProperties": {"type": "string"},
                },
                "sort_by": {"type": "string"},
                "ascending": {
                    "description": "排序方向，bool 或 bool 数组",
                },
                "op": {
                    "type": "string",
                    "enum": ["eq", "ne", "contains", "gt", "gte", "lt", "lte"],
                    "description": "filter_rows 比较符",
                },
                "value": {
                    "description": "filter_rows 比较值",
                },
                "n": {
                    "type": "integer",
                    "description": "返回行数上限，最大 30",
                },
            },
            "required": ["operation"],
        },
    },
}


def _build_prompt(context: dict[str, Any], preferences_block: str) -> str:
    preference_section = f"\n\n{preferences_block}\n" if preferences_block else "\n"
    plan_section = ""
    if context.get("analysis_plan"):
        plan_section = f"""
分析上下文（指标与图表已在「偏好约束变换后的数据」上计算完成）：
{json.dumps(context.get("analysis_plan"), ensure_ascii=False, indent=2)}
"""

    return f"""你是一位专业的数据分析师。请根据以下「已按用户偏好约束处理后的」指标与图表，用中文写一份简洁、可执行的分析报告。
{preference_section}{plan_section}
要求：
1. 若存在已应用的偏好变换（如某列按 80%/120% 计算），报告必须明确说明，并只使用变换后的数字
2. 判断这份数据可能属于什么业务场景
3. 总结 2-3 个关键发现（必须结合下方真实指标和图表趋势，不要提出未计算的图表）
4. 指出 1-2 个值得关注的异常或风险点（如有）
5. 给出 2-3 条可执行建议
6. 语气专业但易懂，总字数控制在 300-500 字
7. 使用 Markdown 格式，包含「数据概览」「关键发现」「关注事项」「行动建议」四个小节
8. 不要编造下方摘要中不存在的数字，也不要回退到未变换的原始口径

数据摘要（JSON）：
{json.dumps(context, ensure_ascii=False, indent=2)}
"""


def _build_context(
    overview: dict[str, Any],
    metrics: list[dict[str, Any]],
    charts: list[dict[str, Any]],
    preview: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "filename": overview.get("filename"),
        "rows": overview.get("rows"),
        "columns": overview.get("columns"),
        "column_types": overview.get("column_types"),
        "metrics": metrics,
        "charts": [
            {
                "title": chart.get("title"),
                "type": chart.get("type"),
                "data": chart.get("data", [])[:8],
            }
            for chart in charts
        ],
        "preview": preview[:3],
    }


def _missing_api_key_result() -> dict[str, Any]:
    return {
        "status": "skipped",
        "content": None,
        "message": "未配置 DEEPSEEK_API_KEY，请在 backend/.env 中设置后重启后端。",
        "model": None,
    }


def _call_deepseek_raw(payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        return {"ok": False, "result": _missing_api_key_result()}

    model = os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    body = {**payload, "model": model}

    try:
        with httpx.Client(trust_env=False, timeout=90.0) as client:
            response = client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:200]
        return {
            "ok": False,
            "result": {
                "status": "error",
                "content": None,
                "message": f"DeepSeek API 调用失败（HTTP {exc.response.status_code}）：{detail}",
                "model": model,
            },
        }
    except Exception as exc:
        return {
            "ok": False,
            "result": {
                "status": "error",
                "content": None,
                "message": f"AI 分析失败：{exc}",
                "model": model,
            },
        }

    return {"ok": True, "model": model, "data": data}


def _call_deepseek(messages: list[dict[str, str]]) -> dict[str, Any]:
    raw = _call_deepseek_raw(
        {
            "messages": messages,
            "temperature": 0.3,
        }
    )
    if not raw["ok"]:
        return raw["result"]

    content = raw["data"]["choices"][0]["message"].get("content") or ""
    return {
        "status": "success",
        "content": content.strip(),
        "message": None,
        "model": raw["model"],
    }


def generate_analysis_plan(
    df: pd.DataFrame,
    overview: dict[str, Any],
    use_preferences: bool = False,
    preferences: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return {status, plan, message, model, used_preferences}."""
    normalized = normalize_preferences(use_preferences, preferences)
    used_preferences = bool(normalized)
    preferences_block = format_preferences_block(normalized)
    preference_section = f"\n\n{preferences_block}\n" if preferences_block else "\n"

    schema = dataframe_schema(df, overview.get("column_types") or {})
    preference_rules = ""
    if used_preferences:
        preference_rules = """
【最高优先级：用户偏好约束】
1. 你必须先阅读用户偏好，把其中的计算口径写成 transforms（会真正改写数值后再算指标/图）
2. 例：「订单数按 80% 计算」→ {"column":"订单数","op":"multiply","factor":0.8,"reason":"偏好：订单数按80%"}
3. 例：「销售额按 120% 计算」→ {"column":"销售额","op":"multiply","factor":1.2,"reason":"偏好：销售额按120%"}
4. 「按 N% 计算」一律转为 multiply，factor=N/100；禁止只写在文字里却不输出 transforms
5. 后续 metrics/charts 都默认建立在 transforms 之后的数据上
"""
    else:
        preference_rules = "\n未启用偏好时，transforms 必须是空数组 []。\n"

    prompt = f"""请为这份表格制定「偏好约束 + 可视化分析计划」。只输出 JSON，不要 Markdown，不要解释。
{preference_section}
{preference_rules}
可用列必须从 schema.columns[].name 中选择，禁止虚构列名。

JSON 结构：
{{
  "scenario": "业务场景一句话",
  "focus": ["关注点1", "关注点2"],
  "transforms": [
    {{"column": "订单数", "op": "multiply", "factor": 0.8, "reason": "偏好：订单数按80%计算"}},
    {{"column": "销售额", "op": "multiply", "factor": 1.2, "reason": "偏好：销售额按120%计算"}}
  ],
  "metrics": [
    {{"id": "sales_sum", "label": "销售额合计(偏好口径)", "op": "sum", "column": "销售额"}},
    {{"id": "orders_sum", "label": "订单数合计(偏好口径)", "op": "sum", "column": "订单数"}},
    {{"id": "rows", "label": "数据行数", "op": "row_count"}}
  ],
  "charts": [
    {{"type": "line", "title": "销售额月度趋势(偏好口径)", "x": "日期", "y": "销售额", "grain": "month", "agg": "sum"}},
    {{"type": "bar", "title": "各地区销售额(偏好口径)", "x": "地区", "y": "销售额", "agg": "sum", "top_n": 10}}
  ]
}}

约束：
1. transforms.op 仅限：multiply, divide, add, subtract；factor 必须是数字
2. metrics 最多 8 个；charts 最多 3 个
3. metric.op 仅限：sum, mean, count, min, max, median, nunique, top_category, missing, row_count
4. chart.type 仅限：line, bar, histogram
5. line 的 x 尽量选日期列；bar 的 x 选分类列；y 选数值列
6. 启用偏好时，凡涉及百分比/倍率/加减口径的偏好都必须进入 transforms
7. 只输出一个 JSON 对象

文件：{overview.get("filename")}
行数：{overview.get("rows")}
schema：
{json.dumps(schema, ensure_ascii=False, indent=2)}
"""

    result = _call_deepseek(
        [
            {
                "role": "system",
                "content": (
                    "你是数据分析规划助手。必须先消化用户偏好约束，再输出 JSON。"
                    "偏好中的计算口径必须写入 transforms，列名必须来自 schema。"
                ),
            },
            {"role": "user", "content": prompt},
        ]
    )
    result["used_preferences"] = used_preferences
    result["plan"] = None

    if result.get("status") != "success" or not result.get("content"):
        return result

    raw_plan = extract_json_object(result["content"])
    plan = validate_plan(raw_plan, df)
    if plan is None:
        return {
            "status": "error",
            "content": result.get("content"),
            "message": "分析计划无效或引用了不存在的列",
            "model": result.get("model"),
            "used_preferences": used_preferences,
            "plan": None,
        }

    result["plan"] = plan
    return result


def generate_analysis(
    overview: dict[str, Any],
    metrics: list[dict[str, Any]],
    charts: list[dict[str, Any]],
    preview: list[dict[str, Any]],
    use_preferences: bool = False,
    preferences: list[dict[str, Any]] | None = None,
    analysis_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized = normalize_preferences(use_preferences, preferences)
    used_preferences = bool(normalized)
    preferences_block = format_preferences_block(normalized)

    context = _build_context(overview, metrics, charts, preview)
    if analysis_plan:
        context["analysis_plan"] = {
            "scenario": analysis_plan.get("scenario"),
            "focus": analysis_plan.get("focus"),
            "applied_transforms": analysis_plan.get("applied_transforms") or [],
        }
    if context.get("analysis_plan", {}).get("applied_transforms"):
        context["data_basis"] = "preference_adjusted"
    prompt = _build_prompt(context, preferences_block)
    result = _call_deepseek(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
    )
    result["used_preferences"] = used_preferences
    return result


def generate_chat_reply(
    message: str,
    analysis_id: str | None = None,
    context: dict[str, Any] | None = None,
    history: list[dict[str, str]] | None = None,
    use_preferences: bool = False,
    preferences: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    message = (message or "").strip()
    if not message:
        return {
            "status": "error",
            "content": None,
            "message": "问题不能为空",
            "model": None,
            "used_preferences": False,
            "used_raw_data": False,
        }

    session = get_session(analysis_id or "")
    if session is None:
        return {
            "status": "error",
            "content": None,
            "message": "原始数据会话已失效或不存在，请重新上传文件后再追问。",
            "model": None,
            "used_preferences": False,
            "used_raw_data": False,
        }

    return _generate_chat_with_dataframe(
        message=message,
        df=session.df,
        overview=session.overview,
        context=context or {},
        history=history,
        use_preferences=use_preferences,
        preferences=preferences,
    )


def _generate_chat_with_dataframe(
    message: str,
    df: pd.DataFrame,
    overview: dict[str, Any],
    context: dict[str, Any],
    history: list[dict[str, str]] | None,
    use_preferences: bool,
    preferences: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    normalized = normalize_preferences(use_preferences, preferences)
    used_preferences = bool(normalized)
    preferences_block = format_preferences_block(normalized)
    column_types = overview.get("column_types") or {}
    schema = dataframe_schema(df, column_types)

    preference_section = f"\n\n{preferences_block}\n" if preferences_block else "\n"
    analysis_excerpt = str((context or {}).get("analysis_content") or "")[:1200]

    user_prompt = f"""请基于用户上传的原始表格回答问题。需要计算或核对数字时，先调用 query_dataframe。
{preference_section}
文件：{overview.get("filename")}
原始表结构与样例：
{json.dumps(schema, ensure_ascii=False, indent=2)}

上一份 AI 报告摘录（仅供参考，数字以工具查询原表为准）：
{analysis_excerpt or "（无）"}

用户问题：
{message}
"""

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
    ]

    for item in (history or [])[-MAX_HISTORY_MESSAGES:]:
        role = item.get("role")
        content = str(item.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        messages.append({"role": role, "content": content[:2000]})

    messages.append({"role": "user", "content": user_prompt})

    model = os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    queried_raw = False

    for _ in range(MAX_TOOL_ROUNDS):
        raw = _call_deepseek_raw(
            {
                "messages": messages,
                "temperature": 0.2,
                "tools": [QUERY_TOOL],
                "tool_choice": "auto",
            }
        )
        if not raw["ok"]:
            result = raw["result"]
            result["used_preferences"] = used_preferences
            result["used_raw_data"] = queried_raw
            return result

        model = raw["model"]
        choice_message = raw["data"]["choices"][0]["message"]
        tool_calls = choice_message.get("tool_calls") or []

        assistant_message: dict[str, Any] = {
            "role": "assistant",
            "content": choice_message.get("content") or "",
        }
        if tool_calls:
            assistant_message["tool_calls"] = tool_calls
        messages.append(assistant_message)

        if not tool_calls:
            content = (choice_message.get("content") or "").strip()
            if not content:
                return {
                    "status": "error",
                    "content": None,
                    "message": "模型未返回有效回答",
                    "model": model,
                    "used_preferences": used_preferences,
                    "used_raw_data": queried_raw,
                }
            return {
                "status": "success",
                "content": content,
                "message": None,
                "model": model,
                "used_preferences": used_preferences,
                "used_raw_data": True,
            }

        for call in tool_calls:
            queried_raw = True
            function = call.get("function") or {}
            tool_name = function.get("name") or ""
            tool_call_id = call.get("id") or "tool_call"
            try:
                arguments = json.loads(function.get("arguments") or "{}")
            except json.JSONDecodeError:
                arguments = {}

            if tool_name != "query_dataframe":
                tool_result = {"error": f"未知工具：{tool_name}"}
            else:
                tool_result = run_query(df, arguments if isinstance(arguments, dict) else {})

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": json.dumps(tool_result, ensure_ascii=False)[:8000],
                }
            )

    # Final pass without tools if still looping
    raw = _call_deepseek_raw(
        {
            "messages": messages
            + [
                {
                    "role": "user",
                    "content": "请基于已有工具结果给出最终中文回答，不要再调用工具。",
                }
            ],
            "temperature": 0.2,
        }
    )
    if not raw["ok"]:
        result = raw["result"]
        result["used_preferences"] = used_preferences
        result["used_raw_data"] = queried_raw
        return result

    content = (raw["data"]["choices"][0]["message"].get("content") or "").strip()
    return {
        "status": "success" if content else "error",
        "content": content or None,
        "message": None if content else "模型未返回有效回答",
        "model": raw["model"],
        "used_preferences": used_preferences,
        "used_raw_data": True,
    }
