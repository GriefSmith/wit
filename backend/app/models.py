from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PageMeta(BaseModel):
    id: str
    title: str
    parent: str = ""
    order: int = Field(
        default=0,
        description="Sibling order under the same parent (lower = earlier).",
    )
    tags: list[str] = Field(default_factory=list)
    created: str | None = None


class DuplicateIdWarning(BaseModel):
    id: str
    paths: list[str]


class PagesResponse(BaseModel):
    pages: list[PageMeta]
    tags_index: dict[str, list[str]]
    duplicate_warnings: list[DuplicateIdWarning] = Field(default_factory=list)


class PageDetailResponse(BaseModel):
    id: str
    frontmatter: dict[str, Any]
    markdown_body: str
    editor_overlay: str | None = None


class PutPageBody(BaseModel):
    markdown_body: str
    editor_overlay: str | None = Field(
        default=None,
        description="Optional JSON editor overlay ({version:2,document:[...]}). Omit or null to leave unchanged; empty string deletes overlay.",
    )


class PatchPageMetaBody(BaseModel):
    parent: str | None = None
    title: str | None = None
    order: int | None = None
    new_id: str | None = Field(
        default=None,
        description="Rename page id (slug); moves/rewrites markdown file and updates child parent refs.",
    )


class PatchMetaResponse(BaseModel):
    status: str = "updated"
    id: str


class CreatePageBody(BaseModel):
    title: str = Field(min_length=1, description="Display title; used to derive id when id omitted.")
    parent: str = ""
    id: str | None = Field(
        default=None,
        description="Optional explicit id (slug). Must be unique when provided.",
    )


class CreatePageResponse(BaseModel):
    id: str
