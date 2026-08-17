from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "app.db"


def _database_url() -> str:
    configured = os.getenv("DATABASE_URL", "").strip()
    if configured:
        # Railway sometimes provides postgres://
        if configured.startswith("postgres://"):
            return configured.replace("postgres://", "postgresql://", 1)
        return configured

    DEFAULT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{DEFAULT_DB_PATH}"


DATABASE_URL = _database_url()
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from services import models  # noqa: F401
    from sqlalchemy import inspect, text

    Base.metadata.create_all(bind=engine)

    # Soft-migrate preference_bundles for dual preference scopes.
    try:
        inspector = inspect(engine)
        if "preference_bundles" not in inspector.get_table_names():
            return
        columns = {col["name"] for col in inspector.get_columns("preference_bundles")}
        statements: list[str] = []
        if "query_preferences_json" not in columns:
            statements.append(
                "ALTER TABLE preference_bundles "
                "ADD COLUMN query_preferences_json TEXT DEFAULT '[]'"
            )
        if "query_groups_json" not in columns:
            statements.append(
                "ALTER TABLE preference_bundles "
                "ADD COLUMN query_groups_json TEXT DEFAULT '[]'"
            )
        if statements:
            with engine.begin() as conn:
                for statement in statements:
                    conn.execute(text(statement))
    except Exception:
        # Prefer app startup over migration hard-fail in local/dev.
        pass
