from __future__ import annotations

import json
import re
from typing import Any

import pandas as pd

MAX_METRICS = 8
MAX_CHARTS = 3
ALLOWED_METRIC_OPS = {
    "sum",
    "mean",
    "count",
    "min",
    "max",
    "median",
    "nunique",
    "top_category",
    "missing",
    "row_count",
}
ALLOWED_CHART_TYPES = {"line", "bar", "histogram"}
ALLOWED_AGGS = {"sum", "mean", "count", "min", "max", "median"}
ALLOWED_GRAINS = {"day", "week", "month"}
ALLOWED_TRANSFORM_OPS = {"multiply", "divide", "add", "subtract"}
MAX_TRANSFORMS = 12


def extract_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def resolve_column(df: pd.DataFrame, name: Any) -> str | None:
    if name is None:
        return None
    target = str(name).strip()
    if not target:
        return None
    columns = [str(col) for col in df.columns]
    if target in columns:
        return target

    lowered = {col.lower(): col for col in columns}
    if target.lower() in lowered:
        return lowered[target.lower()]

    compact = {re.sub(r"\s+", "", col.lower()): col for col in columns}
    key = re.sub(r"\s+", "", target.lower())
    return compact.get(key)


def validate_transforms(
    transforms: Any,
    df: pd.DataFrame,
) -> list[dict[str, Any]]:
    if not isinstance(transforms, list):
        return []

    sanitized: list[dict[str, Any]] = []
    for item in transforms[:MAX_TRANSFORMS]:
        if not isinstance(item, dict):
            continue
        column = resolve_column(df, item.get("column"))
        op = str(item.get("op") or "").strip().lower()
        if not column or op not in ALLOWED_TRANSFORM_OPS:
            continue
        try:
            factor = float(item.get("factor"))
        except (TypeError, ValueError):
            continue
        if op == "divide" and factor == 0:
            continue
        reason = str(item.get("reason") or "").strip()[:160]
        sanitized.append(
            {
                "column": column,
                "op": op,
                "factor": factor,
                "reason": reason,
            }
        )
    return sanitized


def infer_transforms_from_preferences(
    preferences: list[dict[str, Any]] | None,
    df: pd.DataFrame,
) -> list[dict[str, Any]]:
    """Best-effort parse of free-text rules like『订单数按80%计算』."""
    if not preferences:
        return []

    percent_pattern = re.compile(
        r"([A-Za-z0-9_\u4e00-\u9fff]+)\s*按\s*(\d+(?:\.\d+)?)\s*%",
        re.IGNORECASE,
    )
    factor_pattern = re.compile(
        r"([A-Za-z0-9_\u4e00-\u9fff]+)\s*(?:乘以|×|\*)\s*(\d+(?:\.\d+)?)",
        re.IGNORECASE,
    )

    found: list[dict[str, Any]] = []
    seen: set[str] = set()

    def _add(column_name: str, factor: float, raw: str) -> None:
        column = resolve_column(df, column_name)
        if not column or column in seen:
            return
        seen.add(column)
        found.append(
            {
                "column": column,
                "op": "multiply",
                "factor": factor,
                "reason": f"从偏好文本解析：{raw}",
            }
        )

    for item in preferences:
        text = f"{item.get('title', '')} {item.get('content', '')}"
        for match in percent_pattern.finditer(text):
            _add(match.group(1), float(match.group(2)) / 100.0, match.group(0))
        for match in factor_pattern.finditer(text):
            # 避免和「按80%」重复匹配同一片段
            if "按" in match.group(0):
                continue
            _add(match.group(1), float(match.group(2)), match.group(0))

    return found


def apply_transforms(
    df: pd.DataFrame,
    transforms: list[dict[str, Any]],
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    if not transforms:
        return df.copy(), []

    working = df.copy()
    applied: list[dict[str, Any]] = []
    for item in transforms:
        column = item["column"]
        op = item["op"]
        factor = float(item["factor"])
        if column not in working.columns:
            continue
        numeric = pd.to_numeric(working[column], errors="coerce")
        if op == "multiply":
            working[column] = numeric * factor
            label = f"{column} × {factor}"
        elif op == "divide":
            working[column] = numeric / factor
            label = f"{column} ÷ {factor}"
        elif op == "add":
            working[column] = numeric + factor
            label = f"{column} + {factor}"
        else:
            working[column] = numeric - factor
            label = f"{column} - {factor}"

        applied.append(
            {
                "column": column,
                "op": op,
                "factor": factor,
                "reason": item.get("reason") or "",
                "label": label,
            }
        )
    return working, applied


def validate_plan(
    plan: dict[str, Any] | None,
    df: pd.DataFrame,
) -> dict[str, Any] | None:
    if not isinstance(plan, dict):
        return None

    transforms = validate_transforms(plan.get("transforms"), df)

    metrics: list[dict[str, Any]] = []
    for item in plan.get("metrics") or []:
        if not isinstance(item, dict):
            continue
        sanitized = _sanitize_metric(item, df)
        if sanitized:
            metrics.append(sanitized)
        if len(metrics) >= MAX_METRICS:
            break

    charts: list[dict[str, Any]] = []
    for item in plan.get("charts") or []:
        if not isinstance(item, dict):
            continue
        sanitized = _sanitize_chart(item, df)
        if sanitized:
            charts.append(sanitized)
        if len(charts) >= MAX_CHARTS:
            break

    if not metrics and not charts:
        return None

    focus = plan.get("focus") or []
    if not isinstance(focus, list):
        focus = []

    return {
        "scenario": str(plan.get("scenario") or "").strip()[:120],
        "focus": [str(item).strip()[:80] for item in focus if str(item).strip()][:6],
        "transforms": transforms,
        "metrics": metrics,
        "charts": charts,
    }


def _sanitize_metric(item: dict[str, Any], df: pd.DataFrame) -> dict[str, Any] | None:
    op = str(item.get("op") or "").strip().lower()
    if op not in ALLOWED_METRIC_OPS:
        return None

    label = str(item.get("label") or "").strip()[:80]
    metric_id = str(item.get("id") or label or op).strip()[:80]

    if op == "row_count":
        return {
            "id": metric_id or "row_count",
            "label": label or "数据行数",
            "op": op,
        }

    if op == "missing":
        column = resolve_column(df, item.get("column"))
        return {
            "id": metric_id or "missing",
            "label": label or ("缺失值" if not column else f"{column} 缺失"),
            "op": op,
            "column": column,
        }

    if op == "top_category":
        category_column = resolve_column(df, item.get("category_column") or item.get("column"))
        if not category_column:
            return None
        value_column = resolve_column(df, item.get("value_column"))
        return {
            "id": metric_id or f"top_{category_column}",
            "label": label or f"{category_column} 最常见",
            "op": op,
            "category_column": category_column,
            "value_column": value_column,
        }

    column = resolve_column(df, item.get("column"))
    if not column:
        return None
    return {
        "id": metric_id or f"{column}_{op}",
        "label": label or f"{column} {op}",
        "op": op,
        "column": column,
    }


def _sanitize_chart(item: dict[str, Any], df: pd.DataFrame) -> dict[str, Any] | None:
    chart_type = str(item.get("type") or "").strip().lower()
    if chart_type not in ALLOWED_CHART_TYPES:
        return None

    title = str(item.get("title") or "").strip()[:100]
    agg = str(item.get("agg") or "sum").strip().lower()
    if agg not in ALLOWED_AGGS:
        agg = "sum"
    top_n = item.get("top_n", 10)
    try:
        top_n = max(1, min(30, int(top_n)))
    except (TypeError, ValueError):
        top_n = 10

    if chart_type == "histogram":
        y = resolve_column(df, item.get("y") or item.get("column"))
        if not y:
            return None
        return {
            "type": "histogram",
            "title": title or f"{y} 分布",
            "y": y,
        }

    if chart_type == "line":
        x = resolve_column(df, item.get("x"))
        y = resolve_column(df, item.get("y"))
        if not x or not y:
            return None
        grain = str(item.get("grain") or "month").strip().lower()
        if grain not in ALLOWED_GRAINS:
            grain = "month"
        return {
            "type": "line",
            "title": title or f"{y} 趋势",
            "x": x,
            "y": y,
            "grain": grain,
            "agg": agg,
        }

    # bar
    x = resolve_column(df, item.get("x") or item.get("category_column"))
    y = resolve_column(df, item.get("y") or item.get("value_column"))
    if not x or not y:
        return None
    return {
        "type": "bar",
        "title": title or f"各{x}的{y}",
        "x": x,
        "y": y,
        "agg": agg,
        "top_n": top_n,
    }
