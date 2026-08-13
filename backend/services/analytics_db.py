"""Read-only analytics DB connection (separate from app.db)."""

from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

from services.nl2sql_config import get_analytics_database_url

_engine: Engine | None = None
_engine_url: str | None = None


def _normalize_url(url: str) -> str:
    if url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url


def get_analytics_engine() -> Engine:
    """Return a shared SQLAlchemy engine for the analytics DB."""
    global _engine, _engine_url

    url = get_analytics_database_url()
    if not url:
        raise RuntimeError(
            "未配置 ANALYTICS_DATABASE_URL。请在 backend/.env 中设置业务样例库连接。"
        )

    normalized = _normalize_url(url)
    if _engine is None or _engine_url != normalized:
        if _engine is not None:
            _engine.dispose()
        _engine = create_engine(
            normalized,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
        _engine_url = normalized

    return _engine


def ping_analytics_db() -> tuple[bool, str | None]:
    """Return (ok, error_message)."""
    try:
        engine = get_analytics_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except RuntimeError as exc:
        return False, str(exc)
    except SQLAlchemyError as exc:
        return False, f"业务库连接失败：{exc.__class__.__name__}"
    except Exception as exc:  # noqa: BLE001
        return False, f"业务库连接失败：{exc}"


def reset_analytics_engine() -> None:
    """Dispose cached engine (mainly for tests / config reload)."""
    global _engine, _engine_url
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _engine_url = None
