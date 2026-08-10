from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field
from sqlalchemy import select

from services.auth import CurrentUser, DbSession
from services.models import PreferenceBundle

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


class PreferenceSyncPayload(BaseModel):
    preferences: list[dict[str, Any]] = Field(default_factory=list)
    groups: list[dict[str, Any]] = Field(default_factory=list)


@router.get("")
def get_preferences(user: CurrentUser, db: DbSession):
    bundle = db.scalar(
        select(PreferenceBundle).where(PreferenceBundle.user_id == user.id)
    )
    if bundle is None:
        return {"preferences": [], "groups": [], "updated_at": None}
    try:
        preferences = json.loads(bundle.preferences_json or "[]")
        groups = json.loads(bundle.groups_json or "[]")
    except json.JSONDecodeError:
        preferences, groups = [], []
    return {
        "preferences": preferences if isinstance(preferences, list) else [],
        "groups": groups if isinstance(groups, list) else [],
        "updated_at": bundle.updated_at.isoformat() if bundle.updated_at else None,
    }


@router.put("")
def put_preferences(body: PreferenceSyncPayload, user: CurrentUser, db: DbSession):
    bundle = db.scalar(
        select(PreferenceBundle).where(PreferenceBundle.user_id == user.id)
    )
    if bundle is None:
        bundle = PreferenceBundle(user_id=user.id)
        db.add(bundle)

    bundle.preferences_json = json.dumps(body.preferences, ensure_ascii=False)
    bundle.groups_json = json.dumps(body.groups, ensure_ascii=False)
    db.commit()
    db.refresh(bundle)
    return {
        "preferences": body.preferences,
        "groups": body.groups,
        "updated_at": bundle.updated_at.isoformat() if bundle.updated_at else None,
    }
