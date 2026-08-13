"""NL2SQL configuration and module status."""

from __future__ import annotations

import os


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def get_analytics_database_url() -> str | None:
    url = os.getenv("ANALYTICS_DATABASE_URL", "").strip()
    return url or None


def get_table_whitelist() -> list[str]:
    raw = os.getenv(
        "NL2SQL_TABLE_WHITELIST",
        "regions,customers,products,orders,order_items",
    )
    return _split_csv(raw)


def get_max_rows() -> int:
    try:
        return max(1, int(os.getenv("NL2SQL_MAX_ROWS", "1000")))
    except ValueError:
        return 1000


def get_preview_rows() -> int:
    try:
        return max(1, int(os.getenv("NL2SQL_PREVIEW_ROWS", "50")))
    except ValueError:
        return 50


def get_query_timeout_seconds() -> int:
    try:
        return max(1, int(os.getenv("NL2SQL_QUERY_TIMEOUT_SECONDS", "30")))
    except ValueError:
        return 30


def get_nl2sql_status() -> dict:
    from services.analytics_db import ping_analytics_db

    db_url = get_analytics_database_url()
    configured = bool(db_url)
    connected = False
    db_error: str | None = None

    if configured:
        connected, db_error = ping_analytics_db()
    else:
        db_error = "未配置 ANALYTICS_DATABASE_URL"

    if connected:
        message = "主路径已打通：提问 → 生成 SQL → 预览确认 → 导出 CSV。"
        phase = "P4"
        ready = True
    elif configured:
        message = "已配置业务库连接，但当前无法连通。"
        phase = "P1"
        ready = False
    else:
        message = "骨架已就绪；请配置 ANALYTICS_DATABASE_URL。"
        phase = "P0"
        ready = False

    return {
        "module": "nl2sql",
        "phase": phase,
        "ready_for_query": ready,
        "message": message,
        "analytics_db_configured": configured,
        "analytics_db_connected": connected,
        "analytics_db_error": db_error,
        "table_whitelist": get_table_whitelist(),
        "max_rows": get_max_rows(),
        "preview_rows": get_preview_rows(),
        "query_timeout_seconds": get_query_timeout_seconds(),
    }
