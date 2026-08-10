from __future__ import annotations

from typing import Any

import pandas as pd

from services.metrics import format_number


def execute_plan(df: pd.DataFrame, plan: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    metrics: list[dict[str, Any]] = []
    for item in plan.get("metrics") or []:
        metric = _execute_metric(df, item)
        if metric:
            metrics.append(metric)

    charts: list[dict[str, Any]] = []
    for item in plan.get("charts") or []:
        chart = _execute_chart(df, item)
        if chart and chart.get("data"):
            charts.append(chart)

    return {"metrics": metrics[:8], "charts": charts[:3]}


def _execute_metric(df: pd.DataFrame, item: dict[str, Any]) -> dict[str, Any] | None:
    op = item.get("op")
    label = str(item.get("label") or op)

    try:
        if op == "row_count":
            return {
                "label": label,
                "value": format_number(len(df)),
                "description": "有效记录总数",
            }

        if op == "missing":
            column = item.get("column")
            if column:
                count = int(df[column].isna().sum())
                return {
                    "label": label,
                    "value": format_number(count),
                    "description": f"{column} 空值数量",
                }
            count = int(df.isna().sum().sum())
            return {
                "label": label,
                "value": format_number(count),
                "description": "全表空值单元格数量",
            }

        if op == "top_category":
            category_column = item["category_column"]
            value_column = item.get("value_column")
            if value_column and value_column in df.columns:
                grouped = (
                    df[[category_column, value_column]]
                    .dropna()
                    .groupby(category_column, as_index=False)[value_column]
                    .sum()
                    .sort_values(value_column, ascending=False)
                )
                if grouped.empty:
                    return None
                top = grouped.iloc[0]
                return {
                    "label": label,
                    "value": str(top[category_column]),
                    "description": f"{value_column} 合计最高的 {category_column}",
                }

            series = df[category_column].dropna().astype(str)
            if series.empty:
                return None
            top_value = series.value_counts().idxmax()
            return {
                "label": label,
                "value": str(top_value),
                "description": f"出现次数最多的 {category_column}",
            }

        column = item.get("column")
        if not column:
            return None
        series = df[column].dropna()
        if series.empty:
            return None

        if op == "count":
            value = float(series.shape[0])
        elif op == "sum":
            value = float(pd.to_numeric(series, errors="coerce").sum())
        elif op == "mean":
            value = float(pd.to_numeric(series, errors="coerce").mean())
        elif op == "min":
            value = float(pd.to_numeric(series, errors="coerce").min())
        elif op == "max":
            value = float(pd.to_numeric(series, errors="coerce").max())
        elif op == "median":
            value = float(pd.to_numeric(series, errors="coerce").median())
        elif op == "nunique":
            value = float(series.nunique())
        else:
            return None

        return {
            "label": label,
            "value": format_number(value),
            "description": f"{column} 的 {op}",
        }
    except Exception:
        return None


def _execute_chart(df: pd.DataFrame, item: dict[str, Any]) -> dict[str, Any] | None:
    chart_type = item.get("type")
    title = str(item.get("title") or "图表")

    try:
        if chart_type == "histogram":
            return _histogram(df, item["y"], title)

        if chart_type == "line":
            return _line(df, item["x"], item["y"], title, item.get("grain", "month"), item.get("agg", "sum"))

        if chart_type == "bar":
            return _bar(
                df,
                item["x"],
                item["y"],
                title,
                item.get("agg", "sum"),
                int(item.get("top_n", 10)),
                chart_type="bar",
            )

        if chart_type == "pie":
            return _bar(
                df,
                item["x"],
                item["y"],
                title,
                item.get("agg", "sum"),
                int(item.get("top_n", 8)),
                chart_type="pie",
            )
    except Exception:
        return None
    return None


def _aggregate_series(series: pd.Series, agg: str) -> float | int:
    numeric = pd.to_numeric(series, errors="coerce")
    if agg == "mean":
        return float(numeric.mean())
    if agg == "count":
        return int(series.notna().sum())
    if agg == "min":
        return float(numeric.min())
    if agg == "max":
        return float(numeric.max())
    if agg == "median":
        return float(numeric.median())
    return float(numeric.sum())


def _line(
    df: pd.DataFrame,
    x: str,
    y: str,
    title: str,
    grain: str,
    agg: str,
) -> dict[str, Any] | None:
    subset = df[[x, y]].dropna().copy()
    if subset.empty:
        return None

    if not pd.api.types.is_datetime64_any_dtype(subset[x]):
        subset[x] = pd.to_datetime(subset[x], errors="coerce")
        subset = subset.dropna(subset=[x])
    if subset.empty:
        return None

    freq = {"day": "D", "week": "W", "month": "M"}.get(grain, "M")
    subset["_period"] = subset[x].dt.to_period(freq).astype(str)

    rows = []
    for period, group in subset.groupby("_period", sort=True):
        rows.append({"label": str(period), "value": _aggregate_series(group[y], agg)})

    if not rows:
        return None
    return {
        "type": "line",
        "title": title,
        "x_key": "label",
        "y_key": "value",
        "data": rows,
    }


def _bar(
    df: pd.DataFrame,
    x: str,
    y: str,
    title: str,
    agg: str,
    top_n: int,
    chart_type: str = "bar",
) -> dict[str, Any] | None:
    subset = df[[x, y]].dropna().copy()
    if subset.empty:
        return None

    rows = []
    for key, group in subset.groupby(x, sort=False):
        rows.append({"label": str(key), "value": _aggregate_series(group[y], agg)})

    rows.sort(key=lambda item: item["value"], reverse=True)
    rows = rows[:top_n]
    if not rows:
        return None
    return {
        "type": chart_type if chart_type in {"bar", "pie"} else "bar",
        "title": title,
        "x_key": "label",
        "y_key": "value",
        "data": rows,
    }


def _histogram(df: pd.DataFrame, y: str, title: str) -> dict[str, Any] | None:
    series = pd.to_numeric(df[y], errors="coerce").dropna()
    if series.empty:
        return None

    bins = min(10, max(int(series.nunique()), 1))
    counts = pd.cut(series, bins=bins)
    grouped = counts.value_counts().sort_index()
    data = []
    for interval, count in grouped.items():
        data.append(
            {
                "label": f"{interval.left:.0f}-{interval.right:.0f}",
                "value": int(count),
            }
        )
    if not data:
        return None
    return {
        "type": "histogram",
        "title": title,
        "x_key": "label",
        "y_key": "value",
        "data": data,
    }
