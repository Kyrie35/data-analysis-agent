"""Execute validated analytics SQL with row/time limits."""

from __future__ import annotations

import csv
import io
import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from services.analytics_db import get_analytics_engine
from services.nl2sql_config import (
    get_max_rows,
    get_preview_rows,
    get_query_timeout_seconds,
    get_table_whitelist,
)
from services.sql_guard import ensure_limit, validate_select_sql

logger = logging.getLogger(__name__)


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def _serialize_row(mapping: dict[str, Any]) -> dict[str, Any]:
    return {key: _jsonable(value) for key, value in mapping.items()}


def run_analytics_query(
    sql: str,
    *,
    row_limit: int | None = None,
    purpose: str = "query",
) -> dict[str, Any]:
    """
    Validate + execute SQL.
    Returns columns, rows, counts, executed_sql, truncated flag.
    """
    whitelist = get_table_whitelist()
    max_rows = get_max_rows()
    effective_cap = max_rows if row_limit is None else max(1, min(row_limit, max_rows))

    cleaned = validate_select_sql(sql, whitelist)
    executed_sql, applied_limit = ensure_limit(cleaned, effective_cap)
    timeout = get_query_timeout_seconds()

    try:
        engine = get_analytics_engine()
        with engine.connect() as conn:
            # MySQL: max execution time in milliseconds (best-effort).
            try:
                conn.execute(
                    text(f"SET SESSION MAX_EXECUTION_TIME={int(timeout * 1000)}")
                )
            except SQLAlchemyError:
                pass

            result = conn.execute(text(executed_sql))
            columns = list(result.keys())
            raw_rows = result.fetchmany(applied_limit + 1)
    except ValueError:
        raise
    except SQLAlchemyError as exc:
        logger.warning("nl2sql query failed purpose=%s err=%s", purpose, exc.__class__.__name__)
        message = str(exc)
        lowered = message.lower()
        if "timeout" in lowered or "max_execution_time" in lowered or "interrupted" in lowered:
            raise RuntimeError(
                f"查询超时（超过 {timeout} 秒），请缩小时间范围或减少返回行数后重试。"
            ) from exc
        raise RuntimeError(f"查询执行失败：{exc.__class__.__name__}") from exc

    truncated = len(raw_rows) > applied_limit
    rows = [_serialize_row(dict(row._mapping)) for row in raw_rows[:applied_limit]]

    logger.info(
        "nl2sql query ok purpose=%s rows=%s truncated=%s limit=%s",
        purpose,
        len(rows),
        truncated,
        applied_limit,
    )

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "limit": applied_limit,
        "executed_sql": executed_sql,
    }


def preview_analytics_query(sql: str, preview_limit: int | None = None) -> dict[str, Any]:
    limit = get_preview_rows() if preview_limit is None else preview_limit
    return run_analytics_query(sql, row_limit=limit, purpose="preview")


def rows_to_csv(columns: list[str], rows: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    # UTF-8 BOM helps Excel open Chinese CSV correctly.
    buffer.write("\ufeff")
    writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: "" if row.get(key) is None else row.get(key) for key in columns})
    return buffer.getvalue()


def export_analytics_csv(sql: str) -> tuple[str, dict[str, Any]]:
    result = run_analytics_query(sql, row_limit=get_max_rows(), purpose="csv")
    csv_text = rows_to_csv(result["columns"], result["rows"])
    meta = {
        "row_count": result["row_count"],
        "truncated": result["truncated"],
        "limit": result["limit"],
        "executed_sql": result["executed_sql"],
    }
    return csv_text, meta
