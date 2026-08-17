"""NL2SQL query history persistence (app DB, per user)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from services.models import Nl2sqlHistory, User


def _summary_from_question(question: str, row_count: int, exported: bool) -> str:
    q = " ".join((question or "").split())
    short = q[:80] + ("…" if len(q) > 80 else "")
    parts = [short or "未命名问题", f"{row_count} 行"]
    if exported:
        parts.append("已导出")
    return " · ".join(parts)[:500]


def list_nl2sql_history(db: Session, user: User, limit: int = 50) -> list[Nl2sqlHistory]:
    return list(
        db.scalars(
            select(Nl2sqlHistory)
            .where(Nl2sqlHistory.user_id == user.id)
            .order_by(Nl2sqlHistory.created_at.desc())
            .limit(limit)
        ).all()
    )


def get_nl2sql_history(
    db: Session, user: User, history_id: int
) -> Nl2sqlHistory | None:
    row = db.get(Nl2sqlHistory, history_id)
    if row is None or row.user_id != user.id:
        return None
    return row


def save_nl2sql_history(
    db: Session,
    user: User,
    *,
    question: str,
    sql_text: str,
    explanation: str = "",
    row_count: int = 0,
    truncated: bool = False,
    exported: bool = False,
) -> Nl2sqlHistory:
    row = Nl2sqlHistory(
        user_id=user.id,
        question=(question or "").strip() or "未命名问题",
        sql_text=(sql_text or "").strip(),
        explanation=(explanation or "").strip()[:1000],
        summary=_summary_from_question(question, row_count, exported),
        row_count=max(0, int(row_count)),
        truncated=1 if truncated else 0,
        exported=1 if exported else 0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_nl2sql_history(db: Session, user: User, history_id: int) -> bool:
    row = get_nl2sql_history(db, user, history_id)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def history_to_list_item(row: Nl2sqlHistory) -> dict:
    return {
        "id": row.id,
        "question": row.question,
        "summary": row.summary,
        "row_count": row.row_count,
        "truncated": bool(row.truncated),
        "exported": bool(row.exported),
        "created_at": row.created_at.isoformat() if row.created_at else "",
    }


def history_to_detail(row: Nl2sqlHistory) -> dict:
    return {
        **history_to_list_item(row),
        "sql": row.sql_text,
        "explanation": row.explanation,
    }
