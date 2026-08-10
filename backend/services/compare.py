from __future__ import annotations

import re
from typing import Any

import pandas as pd

from services.agent import generate_compare_analysis
from services.analysis_plan import apply_transforms, infer_transforms_from_preferences
from services.chart_types import normalize_chart_types
from services.charts import generate_charts
from services.metrics import compute_metrics, format_number
from services.parser import build_overview, load_dataframe
from services.session_store import create_session


def _parse_metric_number(value: str) -> float | None:
    text = str(value).strip().replace(",", "")
    if not text or text == "-":
        return None
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        if not match:
            return None
        try:
            return float(match.group(0))
        except ValueError:
            return None


def _side_bundle(
    filename: str,
    content: bytes,
    sheet_name: str | None,
    transforms: list[dict[str, Any]],
    chart_types: list[str],
) -> dict[str, Any]:
    raw_df = load_dataframe(filename, content, sheet_name=sheet_name)
    working_df, applied = apply_transforms(raw_df, transforms)
    packed = build_overview(filename, working_df)
    if sheet_name:
        packed["overview"]["sheet_name"] = sheet_name
    column_types = packed["overview"]["column_types"]
    metrics = compute_metrics(working_df, column_types)
    charts = generate_charts(working_df, column_types, chart_types=chart_types)
    analysis_id = create_session(working_df, packed["overview"])
    return {
        "filename": filename,
        "sheet_name": sheet_name,
        "rows": packed["overview"]["rows"],
        "overview": packed["overview"],
        "preview": packed["preview"],
        "metrics": metrics,
        "charts": charts,
        "applied_transforms": applied,
        "analysis_id": analysis_id,
        "df_columns": [str(col) for col in working_df.columns],
        "column_types": column_types,
    }


def _build_deltas(
    left_metrics: list[dict[str, Any]],
    right_metrics: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    right_map = {item["label"]: item for item in right_metrics}
    deltas: list[dict[str, Any]] = []
    for left in left_metrics:
        label = left["label"]
        right = right_map.get(label)
        if not right:
            continue
        left_num = _parse_metric_number(left["value"])
        right_num = _parse_metric_number(right["value"])
        if left_num is None or right_num is None:
            deltas.append(
                {
                    "label": label,
                    "left": left["value"],
                    "right": right["value"],
                    "delta": None,
                    "delta_pct": None,
                    "comparable": False,
                }
            )
            continue
        delta = left_num - right_num
        delta_pct = (delta / right_num * 100.0) if right_num != 0 else None
        deltas.append(
            {
                "label": label,
                "left": left["value"],
                "right": right["value"],
                "delta": format_number(delta),
                "delta_pct": None if delta_pct is None else f"{delta_pct:.1f}%",
                "comparable": True,
            }
        )
    return deltas


def compare_uploads(
    left_filename: str,
    left_content: bytes,
    right_filename: str,
    right_content: bytes,
    left_sheet: str | None = None,
    right_sheet: str | None = None,
    use_preferences: bool = False,
    preferences: list[dict[str, Any]] | None = None,
    chart_types: list[str] | None = None,
) -> dict[str, Any]:
    allowed_charts = normalize_chart_types(chart_types)

    # Probe left columns for transform inference
    probe_df = load_dataframe(left_filename, left_content, sheet_name=left_sheet)
    transforms = (
        infer_transforms_from_preferences(preferences, probe_df)
        if use_preferences and preferences
        else []
    )

    left = _side_bundle(
        left_filename, left_content, left_sheet, transforms, allowed_charts
    )
    right = _side_bundle(
        right_filename, right_content, right_sheet, transforms, allowed_charts
    )

    left_cols = set(left["df_columns"])
    right_cols = set(right["df_columns"])
    common = left_cols & right_cols
    only_left = sorted(left_cols - right_cols)
    only_right = sorted(right_cols - left_cols)

    deltas = _build_deltas(left["metrics"], right["metrics"])
    analysis = generate_compare_analysis(
        {
            "filename": left["filename"],
            "sheet_name": left["sheet_name"],
            "rows": left["rows"],
            "metrics": left["metrics"],
            "applied_transforms": left["applied_transforms"],
        },
        {
            "filename": right["filename"],
            "sheet_name": right["sheet_name"],
            "rows": right["rows"],
            "metrics": right["metrics"],
        },
        deltas,
        use_preferences=use_preferences,
        preferences=preferences,
    )

    return {
        "mode": "compare",
        "alignment": {
            "common_columns": sorted(common),
            "only_left": only_left,
            "only_right": only_right,
            "aligned": len(common) > 0,
        },
        "transforms": left["applied_transforms"],
        "left": {
            "analysis_id": left["analysis_id"],
            "overview": left["overview"],
            "preview": left["preview"],
            "metrics": left["metrics"],
            "charts": left["charts"],
        },
        "right": {
            "analysis_id": right["analysis_id"],
            "overview": right["overview"],
            "preview": right["preview"],
            "metrics": right["metrics"],
            "charts": right["charts"],
        },
        "metric_deltas": deltas,
        "analysis": analysis,
        # Convenience for history/export shaped consumers
        "analysis_id": left["analysis_id"],
    }
