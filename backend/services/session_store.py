from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any

import pandas as pd

DEFAULT_TTL_SECONDS = 60 * 60  # 1 hour
MAX_SESSIONS = 64


@dataclass
class AnalysisSession:
    analysis_id: str
    df: pd.DataFrame
    overview: dict[str, Any]
    created_at: float
    expires_at: float


_lock = threading.Lock()
_sessions: dict[str, AnalysisSession] = {}


def _purge_expired_unlocked(now: float | None = None) -> None:
    current = now if now is not None else time.time()
    expired = [key for key, session in _sessions.items() if session.expires_at <= current]
    for key in expired:
        del _sessions[key]

    if len(_sessions) <= MAX_SESSIONS:
        return

    ordered = sorted(_sessions.values(), key=lambda item: item.created_at)
    for session in ordered[: max(0, len(_sessions) - MAX_SESSIONS)]:
        _sessions.pop(session.analysis_id, None)


def create_session(
    df: pd.DataFrame,
    overview: dict[str, Any],
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> str:
    analysis_id = str(uuid.uuid4())
    now = time.time()
    session = AnalysisSession(
        analysis_id=analysis_id,
        df=df.copy(),
        overview=overview,
        created_at=now,
        expires_at=now + ttl_seconds,
    )
    with _lock:
        _purge_expired_unlocked(now)
        _sessions[analysis_id] = session
    return analysis_id


def get_session(analysis_id: str) -> AnalysisSession | None:
    if not analysis_id:
        return None
    now = time.time()
    with _lock:
        _purge_expired_unlocked(now)
        session = _sessions.get(analysis_id)
        if session is None:
            return None
        if session.expires_at <= now:
            _sessions.pop(analysis_id, None)
            return None
        return session
