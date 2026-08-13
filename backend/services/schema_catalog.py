"""Load schema metadata for whitelisted analytics tables."""

from __future__ import annotations

from sqlalchemy import bindparam, text
from sqlalchemy.exc import SQLAlchemyError

from services.analytics_db import get_analytics_engine
from services.nl2sql_config import get_table_whitelist


def _fetch_database_name(conn) -> str:
    return str(conn.execute(text("SELECT DATABASE()")).scalar() or "")


def _fetch_table_rows(conn, schema_name: str, tables: list[str]) -> list[dict]:
    if not tables:
        return []

    sql = text(
        """
        SELECT
          TABLE_NAME AS name,
          COALESCE(TABLE_COMMENT, '') AS table_comment
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = :schema
          AND TABLE_NAME IN :tables
        ORDER BY TABLE_NAME
        """
    ).bindparams(bindparam("tables", expanding=True))
    result = conn.execute(sql, {"schema": schema_name, "tables": tables})
    return [
        {"name": row.name, "comment": row.table_comment or ""}
        for row in result
    ]


def _fetch_column_rows(conn, schema_name: str, tables: list[str]) -> list[dict]:
    if not tables:
        return []

    sql = text(
        """
        SELECT
          TABLE_NAME AS table_name,
          COLUMN_NAME AS name,
          COLUMN_TYPE AS column_type,
          IS_NULLABLE AS is_nullable,
          COLUMN_KEY AS column_key,
          COALESCE(COLUMN_COMMENT, '') AS column_comment,
          ORDINAL_POSITION AS ordinal_position
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = :schema
          AND TABLE_NAME IN :tables
        ORDER BY TABLE_NAME, ORDINAL_POSITION
        """
    ).bindparams(bindparam("tables", expanding=True))
    result = conn.execute(sql, {"schema": schema_name, "tables": tables})
    return [
        {
            "table_name": row.table_name,
            "name": row.name,
            "type": row.column_type,
            "nullable": row.is_nullable == "YES",
            "key": row.column_key or "",
            "comment": row.column_comment or "",
        }
        for row in result
    ]


def list_schema_catalog() -> dict:
    """Return schema catalog limited to the configured whitelist."""
    whitelist = get_table_whitelist()
    try:
        engine = get_analytics_engine()
        with engine.connect() as conn:
            database = _fetch_database_name(conn)
            table_rows = _fetch_table_rows(conn, database, whitelist)
            column_rows = _fetch_column_rows(conn, database, whitelist)
    except RuntimeError:
        raise
    except SQLAlchemyError as exc:
        raise RuntimeError(f"读取 schema 失败：{exc.__class__.__name__}") from exc

    found = {row["name"] for row in table_rows}
    missing = [name for name in whitelist if name not in found]

    columns_by_table: dict[str, list[dict]] = {name: [] for name in found}
    for col in column_rows:
        table_name = col.pop("table_name")
        columns_by_table.setdefault(table_name, []).append(col)

    tables = [
        {
            "name": row["name"],
            "comment": row["comment"],
            "columns": columns_by_table.get(row["name"], []),
        }
        for row in table_rows
    ]

    return {
        "database": database,
        "tables": tables,
        "missing_tables": missing,
        "whitelist": whitelist,
    }


def get_table_schema(table_name: str) -> dict:
    """Return one whitelisted table schema, or raise LookupError / ValueError."""
    whitelist = get_table_whitelist()
    if table_name not in whitelist:
        raise ValueError(f"表「{table_name}」不在白名单中")

    catalog = list_schema_catalog()
    for table in catalog["tables"]:
        if table["name"] == table_name:
            return {
                "database": catalog["database"],
                "table": table,
            }

    raise LookupError(f"白名单表「{table_name}」在业务库中不存在")
