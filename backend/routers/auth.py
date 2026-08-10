from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from services.auth import (
    CurrentUser,
    DbSession,
    create_access_token,
    hash_password,
    verify_password,
)
from services.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_\u4e00-\u9fff]{2,32}$")


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    password: str = Field(min_length=6, max_length=72)


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    username: str


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterRequest, db: DbSession):
    username = body.username.strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="用户名需为 2–32 位字母/数字/下划线/中文",
        )
    exists = db.scalar(select(User).where(User.username == username))
    if exists:
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(username=username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.username)
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "username": user.username},
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: DbSession):
    username = body.username.strip()
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    token = create_access_token(user.id, user.username)
    return AuthResponse(
        access_token=token,
        user={"id": user.id, "username": user.username},
    )


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser):
    return UserResponse(id=user.id, username=user.username)
