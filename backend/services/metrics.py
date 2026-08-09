from typing import Any

import pandas as pd


def format_number(value: float) -> str:
    if abs(value) >= 1_000_000:
        return f"{value:,.0f}"
    if float(value).is_integer():
        return f"{int(value):,}"
    return f"{value:,.2f}"


def compute_metrics(df: pd.DataFrame, column_types: dict[str, str]) -> list[dict[str, Any]]:
    metrics: list[dict[str, Any]] = [
        {
            "label": "数据行数",
            "value": format_number(len(df)),
            "description": "有效记录总数",
        }
    ]

    missing_cells = int(df.isna().sum().sum())
    if missing_cells > 0:
        metrics.append(
            {
                "label": "缺失值",
                "value": format_number(missing_cells),
                "description": "全表空值单元格数量",
            }
        )

    numeric_cols = [col for col, kind in column_types.items() if kind == "number"]
    for col in numeric_cols[:3]:
        series = df[col].dropna()
        if series.empty:
            continue

        metrics.append(
            {
                "label": f"{col} 合计",
                "value": format_number(float(series.sum())),
                "description": f"{col} 的总和",
            }
        )
        metrics.append(
            {
                "label": f"{col} 平均值",
                "value": format_number(float(series.mean())),
                "description": f"{col} 的均值",
            }
        )

    categorical_cols = [col for col, kind in column_types.items() if kind == "text"]
    for col in categorical_cols[:2]:
        series = df[col].dropna().astype(str)
        if series.empty:
            continue

        top_value = series.value_counts().idxmax()
        metrics.append(
            {
                "label": f"{col} 最常见",
                "value": str(top_value),
                "description": f"出现次数最多的 {col}",
            }
        )

    return metrics[:8]
