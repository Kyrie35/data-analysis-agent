"""Natural language → SQL generation (P3: generate only, do not execute)."""

from __future__ import annotations

import json
from typing import Any

from services.agent import _call_deepseek
from services.analysis_plan import extract_json_object
from services.nl2sql_config import get_max_rows, get_table_whitelist
from services.schema_catalog import list_schema_catalog
from services.sql_guard import validate_select_sql

NL2SQL_SYSTEM_PROMPT = (
    "你是 MySQL 取数助手。根据给定的表结构，把用户的中文问题转成一条只读 SQL。"
    "只能使用白名单中的表。只输出 JSON，不要输出 Markdown 代码块以外的解释。"
)


def _format_schema_for_prompt(catalog: dict[str, Any]) -> str:
    lines: list[str] = [f"数据库：{catalog.get('database', '')}", "表结构："]
    for table in catalog.get("tables", []):
        comment = table.get("comment") or ""
        header = f"- {table['name']}"
        if comment:
            header += f"（{comment}）"
        lines.append(header)
        for col in table.get("columns", []):
            bits = [col["name"], col.get("type", "")]
            if col.get("key") == "PRI":
                bits.append("PK")
            if col.get("comment"):
                bits.append(col["comment"])
            lines.append("  - " + " | ".join(bit for bit in bits if bit))
    return "\n".join(lines)


def _build_user_prompt(question: str, catalog: dict[str, Any]) -> str:
    whitelist = get_table_whitelist()
    max_rows = get_max_rows()
    schema_text = _format_schema_for_prompt(catalog)

    return f"""请根据 schema 将用户问题转为 MySQL 只读查询。

{schema_text}

允许使用的表（白名单）：{', '.join(whitelist)}

规则：
1. 只能生成单条 SELECT 或 WITH ... SELECT；禁止任何写操作
2. 只能引用白名单表；可用 JOIN
3. 金额/销售额 = order_items.quantity * order_items.unit_price
4. 区域名在 regions.name（华东/华北/华南/西南）
5. 订单状态 orders.status：pending/paid/shipped/completed/cancelled；统计销售时通常排除 cancelled
6. 如问题模糊，不要瞎猜关键过滤条件，返回 status=clarify 并给出 clarifying_question
7. 如问题与库无关或无法用现有表回答，返回 status=refuse
8. 建议对明细查询加合理 LIMIT（不超过 {max_rows}）；聚合可不加
9. 必须输出如下 JSON（不要包裹 ```）：
{{
  "status": "ok" | "clarify" | "refuse",
  "sql": "SQL字符串或null",
  "explanation": "中文说明你如何理解问题",
  "assumptions": ["假设1", "假设2"],
  "clarifying_question": "需要用户补充时的追问，否则空字符串"
}}

用户问题：
{question}
"""


def _normalize_payload(data: dict[str, Any]) -> dict[str, Any]:
    status = str(data.get("status") or "").strip().lower()
    if status not in {"ok", "clarify", "refuse"}:
        status = "refuse"

    sql = data.get("sql")
    if isinstance(sql, str):
        sql = sql.strip() or None
    else:
        sql = None

    explanation = str(data.get("explanation") or "").strip()
    clarifying = str(data.get("clarifying_question") or "").strip()

    assumptions_raw = data.get("assumptions") or []
    assumptions: list[str] = []
    if isinstance(assumptions_raw, list):
        assumptions = [str(item).strip() for item in assumptions_raw if str(item).strip()]

    return {
        "status": status,
        "sql": sql,
        "explanation": explanation,
        "assumptions": assumptions,
        "clarifying_question": clarifying,
    }


def generate_sql_from_question(question: str) -> dict[str, Any]:
    """Generate SQL from natural language. Does not execute the query."""
    cleaned = (question or "").strip()
    if not cleaned:
        return {
            "status": "refuse",
            "sql": None,
            "explanation": "问题为空",
            "assumptions": [],
            "clarifying_question": "",
            "model": None,
            "validation_error": None,
        }

    try:
        catalog = list_schema_catalog()
    except RuntimeError as exc:
        return {
            "status": "error",
            "sql": None,
            "explanation": str(exc),
            "assumptions": [],
            "clarifying_question": "",
            "model": None,
            "validation_error": None,
        }

    result = _call_deepseek(
        [
            {"role": "system", "content": NL2SQL_SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(cleaned, catalog)},
        ]
    )

    if result.get("status") != "success":
        return {
            "status": "error",
            "sql": None,
            "explanation": result.get("message") or "SQL 生成失败",
            "assumptions": [],
            "clarifying_question": "",
            "model": result.get("model"),
            "validation_error": None,
        }

    parsed = extract_json_object(result.get("content") or "")
    if not parsed:
        return {
            "status": "error",
            "sql": None,
            "explanation": "模型未返回可解析的 JSON",
            "assumptions": [],
            "clarifying_question": "",
            "model": result.get("model"),
            "validation_error": None,
            "raw_content": (result.get("content") or "")[:500],
        }

    payload = _normalize_payload(parsed)
    validation_error: str | None = None

    if payload["status"] == "ok":
        if not payload["sql"]:
            payload["status"] = "refuse"
            payload["explanation"] = payload["explanation"] or "模型未给出 SQL"
        else:
            try:
                payload["sql"] = validate_select_sql(
                    payload["sql"], get_table_whitelist()
                )
            except ValueError as exc:
                validation_error = str(exc)
                payload["status"] = "invalid_sql"
                # keep sql for user to inspect/edit

    return {
        **payload,
        "model": result.get("model"),
        "validation_error": validation_error,
    }
