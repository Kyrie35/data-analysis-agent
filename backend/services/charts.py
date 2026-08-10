from typing import Any

import pandas as pd

from services.chart_types import MAX_CHARTS, filter_charts_by_types, normalize_chart_types


def _line_chart(df: pd.DataFrame, date_col: str, value_col: str) -> dict[str, Any]:
    subset = df[[date_col, value_col]].dropna().copy()
    subset["_period"] = subset[date_col].dt.to_period("M").astype(str)
    grouped = (
        subset.groupby("_period", as_index=False)[value_col]
        .sum()
        .sort_values("_period")
    )

    data = [
        {"label": row["_period"], "value": float(row[value_col])}
        for _, row in grouped.iterrows()
    ]

    return {
        "type": "line",
        "title": f"{value_col} 月度趋势",
        "x_key": "label",
        "y_key": "value",
        "data": data,
    }


def _bar_chart(df: pd.DataFrame, category_col: str, value_col: str) -> dict[str, Any]:
    grouped = (
        df[[category_col, value_col]]
        .dropna()
        .groupby(category_col, as_index=False)[value_col]
        .sum()
        .sort_values(value_col, ascending=False)
        .head(10)
    )

    data = [
        {"label": str(row[category_col]), "value": float(row[value_col])}
        for _, row in grouped.iterrows()
    ]

    return {
        "type": "bar",
        "title": f"各{category_col}的{value_col}",
        "x_key": "label",
        "y_key": "value",
        "data": data,
    }


def _pie_chart(df: pd.DataFrame, category_col: str, value_col: str) -> dict[str, Any]:
    chart = _bar_chart(df, category_col, value_col)
    chart["type"] = "pie"
    chart["title"] = f"{category_col}占比（按{value_col}）"
    chart["data"] = chart["data"][:8]
    return chart


def _histogram_chart(df: pd.DataFrame, value_col: str) -> dict[str, Any]:
    series = df[value_col].dropna()
    if series.empty:
        return {}

    counts, bins = pd.cut(series, bins=min(10, max(series.nunique(), 1)), retbins=True)
    grouped = counts.value_counts().sort_index()

    data = []
    for interval, count in grouped.items():
        data.append(
            {
                "label": f"{interval.left:.0f}-{interval.right:.0f}",
                "value": int(count),
            }
        )

    return {
        "type": "histogram",
        "title": f"{value_col} 分布",
        "x_key": "label",
        "y_key": "value",
        "data": data,
    }


def generate_charts(
    df: pd.DataFrame,
    column_types: dict[str, str],
    chart_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    allowed = normalize_chart_types(chart_types)
    charts: list[dict[str, Any]] = []

    date_cols = [col for col, kind in column_types.items() if kind == "date"]
    numeric_cols = [col for col, kind in column_types.items() if kind == "number"]
    text_cols = [col for col, kind in column_types.items() if kind == "text"]

    if "line" in allowed and date_cols and numeric_cols:
        charts.append(_line_chart(df, date_cols[0], numeric_cols[0]))

    if "bar" in allowed and text_cols and numeric_cols:
        charts.append(_bar_chart(df, text_cols[0], numeric_cols[0]))
        if len(text_cols) > 1:
            charts.append(_bar_chart(df, text_cols[1], numeric_cols[0]))

    if "pie" in allowed and text_cols and numeric_cols:
        charts.append(_pie_chart(df, text_cols[0], numeric_cols[0]))

    if "histogram" in allowed and numeric_cols:
        histogram = _histogram_chart(df, numeric_cols[0])
        if histogram:
            charts.append(histogram)

    return filter_charts_by_types(charts, allowed)[:MAX_CHARTS]
