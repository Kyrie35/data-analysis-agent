from typing import Any

import pandas as pd

from services.agent import generate_analysis
from services.charts import generate_charts
from services.metrics import compute_metrics
from services.parser import build_overview, load_dataframe


def analyze_upload(filename: str, content: bytes) -> dict[str, Any]:
    df = load_dataframe(filename, content)
    result = build_overview(filename, df)
    column_types = result["overview"]["column_types"]

    result["metrics"] = compute_metrics(df, column_types)
    result["charts"] = generate_charts(df, column_types)
    result["analysis"] = generate_analysis(
        result["overview"],
        result["metrics"],
        result["charts"],
        result["preview"],
    )

    return result
