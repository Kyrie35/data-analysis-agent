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
    query_preferences: list[dict[str, Any]] = Field(default_factory=list)
    query_groups: list[dict[str, Any]] = Field(default_factory=list)


def _load_json_list(raw: str | None) -> list[Any]:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


@router.get("")
def get_preferences(user: CurrentUser, db: DbSession):
    bundle = db.scalar(
        select(PreferenceBundle).where(PreferenceBundle.user_id == user.id)
    )
    if bundle is None:
        return {
            "preferences": [],
            "groups": [],
            "query_preferences": [],
            "query_groups": [],
            "updated_at": None,
        }
    return {
        "preferences": _load_json_list(bundle.preferences_json),
        "groups": _load_json_list(bundle.groups_json),
        "query_preferences": _load_json_list(
            getattr(bundle, "query_preferences_json", None)
        ),
        "query_groups": _load_json_list(getattr(bundle, "query_groups_json", None)),
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
    bundle.query_preferences_json = json.dumps(
        body.query_preferences, ensure_ascii=False
    )
    bundle.query_groups_json = json.dumps(body.query_groups, ensure_ascii=False)
    db.commit()
    db.refresh(bundle)
    return {
        "preferences": body.preferences,
        "groups": body.groups,
        "query_preferences": body.query_preferences,
        "query_groups": body.query_groups,
        "updated_at": bundle.updated_at.isoformat() if bundle.updated_at else None,
    }
