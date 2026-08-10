from __future__ import annotations

from typing import Any

ALL_CHART_TYPES = ("line", "bar", "pie", "histogram")
CHART_TYPE_PRIORITY = ("line", "bar", "pie", "histogram")
MAX_CHARTS = 3


def normalize_chart_types(raw: Any) -> list[str]:
    if raw is None:
        return list(ALL_CHART_TYPES)

    if isinstance(raw, str):
        items = [part.strip() for part in raw.split(",") if part.strip()]
    elif isinstance(raw, list):
        items = [str(item).strip().lower() for item in raw]
    else:
        return list(ALL_CHART_TYPES)

    allowed = []
    seen = set()
    for item in items:
        name = item.lower()
        if name in ALL_CHART_TYPES and name not in seen:
            allowed.append(name)
            seen.add(name)

    return allowed or list(ALL_CHART_TYPES)


def filter_charts_by_types(
    charts: list[dict[str, Any]],
    allowed: list[str],
) -> list[dict[str, Any]]:
    allowed_set = set(allowed)
    filtered = [chart for chart in charts if chart.get("type") in allowed_set]

    # histogram 在部分旧路径可能以 bar 输出；若仅勾选 histogram，保留标题含「分布」的 bar
    if "histogram" in allowed_set and "bar" not in allowed_set:
        for chart in charts:
            if chart.get("type") == "bar" and "分布" in str(chart.get("title", "")):
                clone = {**chart, "type": "histogram"}
                if clone not in filtered:
                    filtered.append(clone)

    ordered: list[dict[str, Any]] = []
    for chart_type in CHART_TYPE_PRIORITY:
        if chart_type not in allowed_set:
            continue
        for chart in filtered:
            if chart.get("type") == chart_type and chart not in ordered:
                ordered.append(chart)
            if len(ordered) >= MAX_CHARTS:
                return ordered
    return ordered[:MAX_CHARTS]
