from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from services.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    histories: Mapped[list[AnalysisHistory]] = relationship(back_populates="user")
    nl2sql_histories: Mapped[list[Nl2sqlHistory]] = relationship(back_populates="user")
    preference_bundle: Mapped[PreferenceBundle | None] = relationship(
        back_populates="user", uselist=False
    )


class AnalysisHistory(Base):
    __tablename__ = "analysis_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="histories")


class Nl2sqlHistory(Base):
    __tablename__ = "nl2sql_histories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    sql_text: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    summary: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    truncated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    exported: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="nl2sql_histories")


class PreferenceBundle(Base):
    __tablename__ = "preference_bundles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_preference_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    preferences_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    groups_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    query_preferences_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )
    query_groups_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped[User] = relationship(back_populates="preference_bundle")
