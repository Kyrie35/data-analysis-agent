import io
from typing import Any

import pandas as pd


def infer_column_type(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    if pd.api.types.is_numeric_dtype(series):
        return "number"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    return "text"


def _try_parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    converted = df.copy()
    for col in converted.columns:
        if not pd.api.types.is_object_dtype(converted[col]):
            continue
        parsed = pd.to_datetime(converted[col], errors="coerce")
        valid_ratio = parsed.notna().sum() / max(len(converted), 1)
        if valid_ratio >= 0.8:
            converted[col] = parsed
    return converted


def load_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    lower_name = filename.lower()

    if lower_name.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif lower_name.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise ValueError("仅支持 CSV 或 Excel（.xlsx / .xls）文件")

    if df.empty:
        raise ValueError("文件没有数据行")

    return _try_parse_dates(df)


def _serialize_cell(value: Any) -> Any:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (int, float, str, bool)):
        return value
    return str(value)


def build_overview(filename: str, df: pd.DataFrame) -> dict[str, Any]:
    column_types = {str(col): infer_column_type(df[col]) for col in df.columns}
    preview_records: list[dict[str, Any]] = []

    for row in df.head(5).to_dict(orient="records"):
        preview_records.append(
            {str(key): _serialize_cell(value) for key, value in row.items()}
        )

    return {
        "overview": {
            "filename": filename,
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "column_names": [str(col) for col in df.columns],
            "column_types": column_types,
        },
        "preview": preview_records,
    }


def parse_upload(filename: str, content: bytes) -> dict[str, Any]:
    df = load_dataframe(filename, content)
    return build_overview(filename, df)
