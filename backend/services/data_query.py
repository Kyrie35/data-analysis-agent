from __future__ import annotations

import math
from typing import Any

import pandas as pd

MAX_RESULT_ROWS = 30
ALLOWED_AGGS = {"sum", "mean", "count", "min", "max", "median", "nunique"}


def dataframe_schema(df: pd.DataFrame, column_types: dict[str, str] | None = None) -> dict[str, Any]:
    types = column_types or {}
    columns = []
    for col in df.columns:
        series = df[col]
        info: dict[str, Any] = {
            "name": str(col),
            "dtype": str(series.dtype),
            "type": types.get(str(col), "unknown"),
            "non_null": int(series.notna().sum()),
            "nulls": int(series.isna().sum()),
            "unique": int(series.nunique(dropna=True)),
        }
        if pd.api.types.is_numeric_dtype(series):
            info["min"] = _json_safe(series.min())
            info["max"] = _json_safe(series.max())
        elif pd.api.types.is_datetime64_any_dtype(series):
            info["min"] = str(series.min()) if series.notna().any() else None
            info["max"] = str(series.max()) if series.notna().any() else None
        else:
            top = series.dropna().astype(str).value_counts().head(5)
            info["top_values"] = [
                {"value": str(idx), "count": int(count)} for idx, count in top.items()
            ]
        columns.append(info)

    return {
        "rows": int(len(df)),
        "columns": columns,
        "sample_rows": _records(df.head(5)),
    }


def run_query(df: pd.DataFrame, payload: dict[str, Any]) -> dict[str, Any]:
    operation = str(payload.get("operation", "")).strip()
    if not operation:
        return {"error": "缺少 operation"}

    try:
        if operation == "schema":
            return {"operation": operation, "result": dataframe_schema(df)}

        if operation == "describe":
            cols = _resolve_columns(df, payload.get("columns"))
            target = df[cols] if cols else df.select_dtypes(include="number")
            if target.empty:
                return {"error": "没有可描述的数值列"}
            described = target.describe(include="all").fillna("").astype(object)
            return {
                "operation": operation,
                "result": _records(described.reset_index().rename(columns={"index": "stat"})),
            }

        if operation == "head":
            n = _clamp_int(payload.get("n", 10), 1, MAX_RESULT_ROWS)
            return {"operation": operation, "result": _records(df.head(n))}

        if operation == "value_counts":
            column = _require_column(df, payload.get("column"))
            n = _clamp_int(payload.get("n", 20), 1, MAX_RESULT_ROWS)
            counts = df[column].fillna("(空)").astype(str).value_counts().head(n)
            return {
                "operation": operation,
                "result": [
                    {"value": str(idx), "count": int(count)} for idx, count in counts.items()
                ],
            }

        if operation == "groupby_agg":
            by = _resolve_columns(df, payload.get("by"))
            if not by:
                return {"error": "groupby_agg 需要 by 列"}
            aggregations = payload.get("aggregations") or {}
            if not isinstance(aggregations, dict) or not aggregations:
                return {"error": "groupby_agg 需要 aggregations，如 {\"销售额\": \"sum\"}"}

            agg_map: dict[str, str] = {}
            for col, agg_name in aggregations.items():
                column = _require_column(df, col)
                agg = str(agg_name).strip().lower()
                if agg not in ALLOWED_AGGS:
                    return {"error": f"不支持的聚合：{agg}，允许：{sorted(ALLOWED_AGGS)}"}
                agg_map[column] = agg

            grouped = df.groupby(by, dropna=False).agg(agg_map).reset_index()
            sort_by = payload.get("sort_by")
            if sort_by:
                sort_col = str(sort_by)
                if sort_col in grouped.columns:
                    grouped = grouped.sort_values(
                        sort_col,
                        ascending=bool(payload.get("ascending", False)),
                    )
            grouped = grouped.head(MAX_RESULT_ROWS)
            return {"operation": operation, "result": _records(grouped)}

        if operation == "filter_rows":
            column = _require_column(df, payload.get("column"))
            op = str(payload.get("op", "eq")).strip()
            value = payload.get("value")
            filtered = _apply_filter(df, column, op, value)
            n = _clamp_int(payload.get("n", 20), 1, MAX_RESULT_ROWS)
            return {
                "operation": operation,
                "matched_rows": int(len(filtered)),
                "result": _records(filtered.head(n)),
            }

        if operation == "sort":
            columns = _resolve_columns(df, payload.get("columns") or payload.get("by"))
            if not columns:
                return {"error": "sort 需要 columns"}
            ascending = payload.get("ascending", False)
            if isinstance(ascending, list):
                asc = [bool(item) for item in ascending][: len(columns)]
                if len(asc) < len(columns):
                    asc.extend([False] * (len(columns) - len(asc)))
            else:
                asc = bool(ascending)
            n = _clamp_int(payload.get("n", 20), 1, MAX_RESULT_ROWS)
            sorted_df = df.sort_values(columns, ascending=asc).head(n)
            return {"operation": operation, "result": _records(sorted_df)}

        if operation == "correlation":
            cols = _resolve_columns(df, payload.get("columns"))
            target = df[cols] if cols else df.select_dtypes(include="number")
            numeric = target.select_dtypes(include="number")
            if numeric.shape[1] < 2:
                return {"error": "相关性计算至少需要 2 个数值列"}
            corr = numeric.corr().reset_index().rename(columns={"index": "column"})
            return {"operation": operation, "result": _records(corr)}

        if operation == "missing_summary":
            missing = df.isna().sum()
            result = [
                {
                    "column": str(col),
                    "missing": int(count),
                    "missing_ratio": round(float(count) / max(len(df), 1), 4),
                }
                for col, count in missing.items()
                if int(count) > 0
            ]
            return {"operation": operation, "result": result}

        return {"error": f"不支持的 operation：{operation}"}
    except Exception as exc:
        return {"error": f"查询失败：{exc}"}


def _apply_filter(df: pd.DataFrame, column: str, op: str, value: Any) -> pd.DataFrame:
    series = df[column]
    if op == "eq":
        return df[series.astype(str) == str(value)]
    if op == "ne":
        return df[series.astype(str) != str(value)]
    if op == "contains":
        return df[series.astype(str).str.contains(str(value), case=False, na=False)]
    if op in {"gt", "gte", "lt", "lte"}:
        numeric = pd.to_numeric(series, errors="coerce")
        threshold = float(value)
        if op == "gt":
            return df[numeric > threshold]
        if op == "gte":
            return df[numeric >= threshold]
        if op == "lt":
            return df[numeric < threshold]
        return df[numeric <= threshold]
    raise ValueError(f"不支持的过滤 op：{op}")


def _require_column(df: pd.DataFrame, column: Any) -> str:
    name = str(column or "").strip()
    if not name or name not in df.columns:
        raise ValueError(f"列不存在：{column}；可用列：{list(map(str, df.columns))}")
    return name


def _resolve_columns(df: pd.DataFrame, columns: Any) -> list[str]:
    if columns is None:
        return []
    if isinstance(columns, str):
        columns = [columns]
    if not isinstance(columns, list):
        raise ValueError("columns 必须是字符串或数组")
    resolved = []
    for col in columns:
        resolved.append(_require_column(df, col))
    return resolved


def _clamp_int(value: Any, minimum: int, maximum: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = minimum
    return max(minimum, min(maximum, number))


def _json_safe(value: Any) -> Any:
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    if pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp,)):
        return str(value)
    return value


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    records = []
    for row in df.to_dict(orient="records"):
        records.append({str(key): _json_safe(value) for key, value in row.items()})
    return records
