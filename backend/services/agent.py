import json
import os
from typing import Any

import httpx

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"


def _build_prompt(context: dict[str, Any]) -> str:
    return f"""你是一位专业的数据分析师。请根据以下数据摘要，用中文写一份简洁、可执行的分析报告。

要求：
1. 判断这份数据可能属于什么业务场景
2. 总结 2-3 个关键发现（结合指标和图表趋势）
3. 指出 1-2 个值得关注的异常或风险点（如有）
4. 给出 2-3 条可执行建议
5. 语气专业但易懂，总字数控制在 300-500 字
6. 使用 Markdown 格式，包含「数据概览」「关键发现」「关注事项」「行动建议」四个小节

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


def generate_analysis(
    overview: dict[str, Any],
    metrics: list[dict[str, Any]],
    charts: list[dict[str, Any]],
    preview: list[dict[str, Any]],
) -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        return {
            "status": "skipped",
            "content": None,
            "message": "未配置 DEEPSEEK_API_KEY，请在 backend/.env 中设置后重启后端。",
        }

    context = _build_context(overview, metrics, charts, preview)
    prompt = _build_prompt(context)
    model = os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

    try:
        with httpx.Client(trust_env=False, timeout=60.0) as client:
            response = client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "你是严谨的数据分析助手，只基于给定数据做分析，不编造不存在的数据。",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:200]
        return {
            "status": "error",
            "content": None,
            "message": f"DeepSeek API 调用失败（HTTP {exc.response.status_code}）：{detail}",
        }
    except Exception as exc:
        return {
            "status": "error",
            "content": None,
            "message": f"AI 分析失败：{exc}",
        }

    return {
        "status": "success",
        "content": content,
        "message": None,
        "model": model,
    }
