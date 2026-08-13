"""Validate analytics SQL before execution (read-only + table whitelist)."""

from __future__ import annotations

import re

_FORBIDDEN = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|"
    r"GRANT|REVOKE|CALL|EXEC|EXECUTE|LOAD|LOCK|UNLOCK|SET|"
    r"HANDLER|DO|PREPARE|DEALLOCATE|SHUTDOWN|KILL|"
    r"INTO\s+OUTFILE|INTO\s+DUMPFILE|"
    r"INFORMATION_SCHEMA|performance_schema|mysql|sys"
    r")\b",
    re.IGNORECASE,
)

_SLEEP_OR_BENCHMARK = re.compile(
    r"\b(SLEEP|BENCHMARK)\s*\(",
    re.IGNORECASE,
)

_STATEMENT_SPLIT = re.compile(r";")
_LIMIT_RE = re.compile(
    r"\bLIMIT\s+(\d+)(?:\s*,\s*(\d+)|\s+OFFSET\s+(\d+))?\s*$",
    re.IGNORECASE | re.DOTALL,
)
_WITH_CTE = re.compile(
    r"\bWITH\b\s+(RECURSIVE\s+)?(.+?)\bSELECT\b",
    re.IGNORECASE | re.DOTALL,
)
_CTE_NAME = re.compile(
    r"(?:^|,)\s*(`?[A-Za-z_][\w]*`?)\s*(?:\([^)]*\))?\s+AS\s*\(",
    re.IGNORECASE,
)
_TABLE_REF = re.compile(
    r"\b(?:FROM|JOIN)\s+("
    r"`?[A-Za-z_][\w]*`?(?:\s*\.\s*`?[A-Za-z_][\w]*`?)?"
    r")",
    re.IGNORECASE,
)
_SUBQUERY_FROM = re.compile(r"\b(?:FROM|JOIN)\s*\(", re.IGNORECASE)


def _strip_comments(sql: str) -> str:
    without_block = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    lines: list[str] = []
    for line in without_block.splitlines():
        if "--" in line:
            line = line[: line.index("--")]
        lines.append(line)
    return "\n".join(lines)


def _strip_string_literals(sql: str) -> str:
    """Replace quoted strings so keyword scans ignore string contents."""
    no_single = re.sub(r"'(?:''|[^'])*'", "''", sql)
    return re.sub(r'"(?:""|[^"])*"', '""', no_single)


def _split_statements(sql: str) -> list[str]:
    parts = [part.strip() for part in _STATEMENT_SPLIT.split(sql) if part.strip()]
    return parts


def _normalize_ident(name: str) -> str:
    return name.replace("`", "").strip()


def _extract_cte_names(sql: str) -> set[str]:
    match = _WITH_CTE.search(sql)
    if not match:
        return set()
    cte_blob = match.group(2)
    names: set[str] = set()
    for item in _CTE_NAME.finditer(cte_blob):
        names.add(_normalize_ident(item.group(1)).lower())
    return names


def _extract_table_names(sql: str) -> set[str]:
    names: set[str] = set()
    for match in _TABLE_REF.finditer(sql):
        start = match.start()
        # Skip FROM ( subquery
        window = sql[start : match.end() + 1]
        if _SUBQUERY_FROM.match(window):
            continue
        raw = match.group(1)
        parts = [p for p in re.split(r"\s*\.\s*", raw) if p]
        table = _normalize_ident(parts[-1])
        if table:
            names.add(table.lower())
    return names


def ensure_limit(sql: str, max_rows: int) -> tuple[str, int]:
    """Ensure a LIMIT clause capped at max_rows. Returns (sql, effective_limit)."""
    stripped = sql.rstrip().rstrip(";").strip()
    match = _LIMIT_RE.search(stripped)
    if match:
        # LIMIT n  OR  LIMIT offset, n  OR  LIMIT n OFFSET m
        if match.group(2) is not None:
            # LIMIT offset, count
            count = int(match.group(2))
            offset = int(match.group(1))
            capped = min(count, max_rows)
            new_sql = stripped[: match.start()] + f"LIMIT {offset}, {capped}"
            return new_sql, capped
        count = int(match.group(1))
        capped = min(count, max_rows)
        offset_tail = match.group(3)
        if offset_tail is not None:
            new_sql = stripped[: match.start()] + f"LIMIT {capped} OFFSET {offset_tail}"
        else:
            new_sql = stripped[: match.start()] + f"LIMIT {capped}"
        return new_sql, capped

    return f"{stripped}\nLIMIT {max_rows}", max_rows


def validate_select_sql(sql: str, whitelist: list[str]) -> str:
    """
    Validate a single read-only SELECT/WITH query.
    Returns cleaned SQL (without trailing semicolon).
    Raises ValueError on violation.
    """
    if not sql or not sql.strip():
        raise ValueError("SQL 不能为空")

    cleaned = _strip_comments(sql).strip()
    if not cleaned:
        raise ValueError("SQL 不能为空")

    statements = _split_statements(cleaned)
    if len(statements) != 1:
        raise ValueError("仅允许执行单条 SQL 语句")

    statement = statements[0].rstrip(";").strip()
    scan_target = _strip_string_literals(statement)

    if _FORBIDDEN.search(scan_target):
        raise ValueError("仅允许只读查询（禁止写操作或危险语句）")

    if _SLEEP_OR_BENCHMARK.search(scan_target):
        raise ValueError("禁止使用 SLEEP / BENCHMARK 等函数")

    leading = statement.lstrip().split(None, 1)[0].upper()
    if leading not in {"SELECT", "WITH"}:
        raise ValueError("仅允许 SELECT / WITH 查询")

    allowed = {name.lower() for name in whitelist}
    cte_names = _extract_cte_names(statement)
    referenced = _extract_table_names(statement) - cte_names
    unknown = sorted(referenced - allowed)
    if unknown:
        raise ValueError(
            "查询引用了未授权的表："
            + ", ".join(unknown)
            + "。允许的表："
            + ", ".join(whitelist)
        )

    return statement
