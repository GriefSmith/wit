from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    CreatePageBody,
    CreatePageResponse,
    PageDetailResponse,
    PagesResponse,
    PatchMetaResponse,
    PatchPageMetaBody,
    PutPageBody,
)
from app.storage import (
    apply_editor_overlay_put,
    create_page,
    delete_page,
    get_pages_root,
    is_valid_page_id,
    patch_page_meta,
    read_page_detail,
    rename_page_id,
    scan_pages,
    write_page_body,
)

app = FastAPI(title="wit", version="0.1.0")

_DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173,"
    "http://localhost:5174,"
    "http://127.0.0.1:5173,"
    "http://127.0.0.1:5174"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("WIT_CORS_ORIGINS", _DEFAULT_CORS_ORIGINS).split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/pages", response_model=PagesResponse)
def list_pages() -> PagesResponse:
    return scan_pages()


@app.post("/pages", response_model=CreatePageResponse)
def create_new_page(body: CreatePageBody) -> CreatePageResponse:
    parent_val = body.parent.strip()
    explicit_id: str | None = None
    if body.id is not None:
        stripped = body.id.strip()
        explicit_id = stripped if stripped else None
    meta = create_page(
        body.title.strip(),
        parent=parent_val,
        explicit_id=explicit_id,
    )
    if meta is None:
        raise HTTPException(
            status_code=400,
            detail="invalid parent, duplicate id, or could not create file",
        )
    return CreatePageResponse(id=meta.id)


def _require_valid_id(page_id: str) -> None:
    if not is_valid_page_id(page_id):
        raise HTTPException(status_code=400, detail="invalid page id")


@app.get("/pages/{page_id}", response_model=PageDetailResponse)
def get_page(page_id: str) -> PageDetailResponse:
    _require_valid_id(page_id)
    data = read_page_detail(page_id)
    if data is None:
        raise HTTPException(status_code=404, detail="page not found")
    fm, md_body, overlay = data
    return PageDetailResponse(
        id=page_id,
        frontmatter=fm,
        markdown_body=md_body,
        editor_overlay=overlay,
    )


@app.put("/pages/{page_id}")
def put_page(page_id: str, body: PutPageBody) -> dict[str, str]:
    _require_valid_id(page_id)
    ok = write_page_body(page_id, body.markdown_body)
    if not ok:
        raise HTTPException(status_code=404, detail="page not found")
    if not apply_editor_overlay_put(page_id, body.editor_overlay):
        raise HTTPException(status_code=404, detail="page not found")
    return {"status": "saved"}


@app.delete("/pages/{page_id}", status_code=204)
def remove_page(page_id: str) -> None:
    _require_valid_id(page_id)
    reason = delete_page(page_id)
    if reason == "not_found":
        raise HTTPException(status_code=404, detail="page not found")
    if reason == "has_children":
        raise HTTPException(
            status_code=409,
            detail="cannot delete a page that still has child pages",
        )


@app.patch("/pages/{page_id}/meta", response_model=PatchMetaResponse)
def patch_meta(page_id: str, body: PatchPageMetaBody) -> PatchMetaResponse:
    _require_valid_id(page_id)
    new_id_stripped = body.new_id.strip() if body.new_id is not None else ""
    if (
        body.parent is None
        and body.title is None
        and body.order is None
        and not new_id_stripped
    ):
        raise HTTPException(status_code=400, detail="no fields to update")

    effective_id = page_id

    if new_id_stripped:
        renamed = rename_page_id(effective_id, new_id_stripped)
        if renamed is None:
            raise HTTPException(
                status_code=400,
                detail="rename failed: invalid id, duplicate, or page not found",
            )
        effective_id = renamed

    parent_val = body.parent
    if parent_val is not None:
        parent_val = parent_val.strip()

    if body.parent is not None or body.title is not None or body.order is not None:
        ok = patch_page_meta(
            effective_id,
            parent=parent_val,
            title=body.title,
            order=body.order,
        )
        if not ok:
            raise HTTPException(status_code=404, detail="page not found")

    return PatchMetaResponse(id=effective_id)


@app.get("/config")
def config() -> dict[str, str]:
    return {"pages_root": str(get_pages_root())}
