from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from collections import defaultdict
from datetime import date
from pathlib import Path

import frontmatter

from app.models import DuplicateIdWarning, PageMeta, PagesResponse

ROOT_PARENT = ""

# JSON editor overlay lives at: `{root}/.wit/editor/{page_id}.json`
EDITOR_OVERLAY_SUBDIR = ".wit/editor"

# Title-opener presentation lives at: `{root}/.wit/opener/{page_id}.json`
OPENER_SUBDIR = ".wit/opener"
OPENER_PALETTES = frozenset(
    {"forest", "steppe", "mountain", "ocean", "dune", "wasteland"}
)
OPENER_LABEL_MAX = 120


class _OpenerPutError(ValueError):
    pass


def _opener_path(page_id: str, root: Path | None = None) -> Path:
    return (root or get_pages_root()) / OPENER_SUBDIR / f"{page_id}.json"


def delete_opener_sidecar(page_id: str, root: Path | None = None) -> None:
    try:
        _opener_path(page_id, root).unlink()
    except OSError:
        pass


def _read_opener_object(page_id: str, root: Path | None = None) -> dict | None:
    """Parsed object, or None when the file is missing or not a JSON object.

    Does not write. Callers must not rewrite the file on a None read.
    """
    path = _opener_path(page_id, root)
    if not path.is_file():
        return None
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(parsed, dict):
        return None
    return parsed


def _clean_get_side(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    text = raw.strip()
    if len(text) > OPENER_LABEL_MAX:
        return ""
    return text


def _clean_get_affix(raw: object) -> dict[str, str] | None:
    if not isinstance(raw, dict):
        return None
    before = _clean_get_side(raw.get("before", ""))
    after = _clean_get_side(raw.get("after", ""))
    if before == "" and after == "":
        return None
    return {"before": before, "after": after}


def _clean_opener_response(raw: dict) -> dict:
    result: dict = {}
    labels = raw.get("labels")
    cleaned: dict = {}
    if isinstance(labels, dict):
        version = _clean_get_affix(labels.get("version"))
        if version is not None:
            cleaned["version"] = version
        authors_raw = labels.get("authors")
        if isinstance(authors_raw, dict):
            authors: dict[str, dict[str, str]] = {}
            for key, value in authors_raw.items():
                if not isinstance(key, str) or key.strip() == "":
                    continue
                affix = _clean_get_affix(value)
                if affix is not None:
                    authors[key] = affix
            if authors:
                cleaned["authors"] = authors
    if cleaned:
        result["labels"] = cleaned
    background = raw.get("background")
    if (
        isinstance(background, dict)
        and background.get("kind") == "palette"
        and isinstance(background.get("name"), str)
        and background.get("name") in OPENER_PALETTES
    ):
        result["background"] = {"kind": "palette", "name": background["name"]}
    return result


def opener_get_payload(page_id: str, root: Path | None = None) -> dict | None:
    """Cleaned opener document, `{}` when there is nothing to show, or None if the page is missing."""
    if resolve_path_for_id(page_id, root) is None:
        return None
    raw = _read_opener_object(page_id, root)
    if raw is None:
        return {}
    return _clean_opener_response(raw)


def _require_put_side(raw: object) -> str:
    if not isinstance(raw, str):
        raise _OpenerPutError
    text = raw.strip()
    if len(text) > OPENER_LABEL_MAX:
        raise _OpenerPutError
    return text


def _affix_for_store(raw: object) -> dict[str, str] | None:
    if not isinstance(raw, dict) or "before" not in raw or "after" not in raw:
        raise _OpenerPutError
    before = _require_put_side(raw["before"])
    after = _require_put_side(raw["after"])
    if before == "" and after == "":
        return None
    return {"before": before, "after": after}


def _labels_for_store(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise _OpenerPutError
    stored: dict = {}
    if "version" in raw and raw["version"] is not None:
        version = _affix_for_store(raw["version"])
        if version is not None:
            stored["version"] = version
    authors_raw = raw.get("authors", {})
    if authors_raw is None:
        authors_raw = {}
    if not isinstance(authors_raw, dict):
        raise _OpenerPutError
    authors: dict[str, dict[str, str]] = {}
    for key, value in authors_raw.items():
        if not isinstance(key, str) or key.strip() == "":
            raise _OpenerPutError
        affix = _affix_for_store(value)
        if affix is not None:
            authors[key] = affix
    if authors:
        stored["authors"] = authors
    return stored


def _background_for_store(raw: object) -> dict | None:
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise _OpenerPutError
    if raw.get("kind") != "palette":
        raise _OpenerPutError
    name = raw.get("name")
    if not isinstance(name, str) or name not in OPENER_PALETTES:
        raise _OpenerPutError
    return {"kind": "palette", "name": name}


def merge_opener_put(
    page_id: str, body: object, root: Path | None = None
) -> str | None:
    """Merge a put. None on success, `not_found` when the page is missing, `invalid` when the body is rejected."""
    if resolve_path_for_id(page_id, root) is None:
        return "not_found"
    if not isinstance(body, dict) or (
        "labels" not in body and "background" not in body
    ):
        return "invalid"
    current = _read_opener_object(page_id, root) or {}
    updated = dict(current)
    try:
        if "labels" in body:
            stored_labels = _labels_for_store(body["labels"])
            if stored_labels:
                updated["labels"] = stored_labels
            else:
                updated.pop("labels", None)
        if "background" in body:
            stored_background = _background_for_store(body["background"])
            if stored_background is None:
                updated.pop("background", None)
            else:
                updated["background"] = stored_background
    except _OpenerPutError:
        return "invalid"
    if not updated:
        delete_opener_sidecar(page_id, root)
        return None
    _atomic_write(
        _opener_path(page_id, root),
        json.dumps(updated, indent=2, ensure_ascii=False) + "\n",
    )
    return None


def _default_pages_root() -> Path:
    """Monorepo layout: backend/app/storage.py → wit/data/pages."""
    wit_root = Path(__file__).resolve().parent.parent.parent
    return wit_root / "data" / "pages"


def get_pages_root() -> Path:
    raw = os.environ.get("WIT_PAGES_ROOT")
    if raw:
        return Path(raw).expanduser().resolve()
    return _default_pages_root().resolve()


def _normalize_parent(value: object) -> str:
    if value is None:
        return ROOT_PARENT
    if isinstance(value, str):
        return value.strip()
    return ROOT_PARENT


_STYLE_VALUES: dict[str, set[str]] = {
    "measure": {"narrow", "book", "wide", "default"},
    "opener": {"title", "book", "chapter", "default"},
    "scene_break": {"rule", "gap", "ornament", "default"},
}


def clean_version(raw: object) -> str | None:
    """Return trimmed text, or None when the value is not a non-blank string."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    return text or None


def clean_authors(raw: object) -> list[str] | None:
    """Return the remaining names, or None when nothing valid remains."""
    if not isinstance(raw, list):
        return None
    names = [item.strip() for item in raw if isinstance(item, str) and item.strip()]
    return names or None


def clean_style(raw: object) -> dict[str, str] | None:
    """Return valid style keys, or None when nothing valid remains.

    A non-mapping and any unknown or misspelled value are dropped. The file
    is not rewritten.
    """
    if not isinstance(raw, dict):
        return None
    cleaned: dict[str, str] = {}
    for key, allowed in _STYLE_VALUES.items():
        value = raw.get(key)
        if isinstance(value, str) and value in allowed:
            cleaned[key] = value
    return cleaned or None


def _parse_page_file(path: Path) -> tuple[PageMeta | None, str | None]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None, f"cannot read {path}"
    post = frontmatter.loads(text)
    meta_raw = post.metadata or {}
    pid = meta_raw.get("id")
    if not pid or not isinstance(pid, str):
        return None, f"missing id in {path}"
    title = meta_raw.get("title")
    if title is None or (isinstance(title, str) and not title.strip()):
        return None, f"missing title in {path}"
    title_str = str(title).strip()
    tags = meta_raw.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    tags = [str(t) for t in tags]
    created = meta_raw.get("created")
    created_str = str(created) if created is not None else None
    raw_order = meta_raw.get("order", 0)
    try:
        order_val = int(raw_order) if raw_order is not None else 0
    except (TypeError, ValueError):
        order_val = 0
    page = PageMeta(
        id=pid.strip(),
        title=title_str,
        parent=_normalize_parent(meta_raw.get("parent")),
        order=order_val,
        tags=tags,
        created=created_str,
        style=clean_style(meta_raw.get("style")),
        version=clean_version(meta_raw.get("version")),
        authors=clean_authors(meta_raw.get("authors")),
    )
    return page, None


def scan_pages(root: Path | None = None) -> PagesResponse:
    root = root or get_pages_root()
    id_to_paths: dict[str, list[Path]] = defaultdict(list)
    path_to_page: dict[Path, PageMeta] = {}

    if not root.exists():
        return PagesResponse(pages=[], tags_index={}, duplicate_warnings=[])

    for path in sorted(root.rglob("*.md")):
        page, err = _parse_page_file(path)
        if err:
            continue
        assert page is not None
        id_to_paths[page.id].append(path)
        path_to_page[path] = page

    duplicates: list[DuplicateIdWarning] = []
    for pid, paths in id_to_paths.items():
        if len(paths) > 1:
            duplicates.append(
                DuplicateIdWarning(id=pid, paths=[str(x) for x in sorted(paths)])
            )

    canonical_pages: list[PageMeta] = []
    for pid, paths in sorted(id_to_paths.items()):
        canonical_path = sorted(paths)[0]
        canonical_pages.append(path_to_page[canonical_path])

    tags_index: dict[str, list[str]] = defaultdict(list)
    for p in canonical_pages:
        for tag in p.tags:
            if tag not in tags_index[tag]:
                tags_index[tag].append(p.id)

    return PagesResponse(
        pages=canonical_pages,
        tags_index=dict(tags_index),
        duplicate_warnings=duplicates,
    )


def resolve_path_for_id(page_id: str, root: Path | None = None) -> Path | None:
    """Resolve filesystem path for an id; if duplicate ids exist, first path wins (sorted)."""
    root = root or get_pages_root()
    if not root.exists():
        return None
    matches: list[Path] = []
    for path in sorted(root.rglob("*.md")):
        page, err = _parse_page_file(path)
        if err or page is None:
            continue
        if page.id == page_id:
            matches.append(path)
    if not matches:
        return None
    return sorted(matches)[0]


def read_page_split(page_id: str, root: Path | None = None) -> tuple[dict, str] | None:
    path = resolve_path_for_id(page_id, root)
    if path is None:
        return None
    text = path.read_text(encoding="utf-8")
    post = frontmatter.loads(text)
    fm = dict(post.metadata or {})
    return fm, post.content or ""


def _overlay_path(page_id: str, root: Path | None = None) -> Path:
    return (root or get_pages_root()) / EDITOR_OVERLAY_SUBDIR / f"{page_id}.json"


def delete_editor_overlay(page_id: str, root: Path | None = None) -> None:
    try:
        _overlay_path(page_id, root).unlink()
    except OSError:
        pass


def markdown_body_hash(body: str) -> str:
    """SHA-256 hex digest of the markdown body as stored on disk."""
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def stamp_overlay_with_markdown_hash(overlay: str, markdown_body: str) -> str:
    """Bind an overlay to the markdown body it was saved with.

    Overlays that are not a JSON object with a ``document`` array are returned
    unchanged so PUT stays backward-compatible with opaque payloads.
    """
    parsed = json.loads(overlay)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("document"), list):
        return overlay
    parsed["version"] = 3
    parsed["markdown_sha256"] = markdown_body_hash(markdown_body)
    return json.dumps(parsed, ensure_ascii=False)


def overlay_is_stale(overlay: str | None, markdown_body: str) -> bool:
    """True when a hashed sidecar no longer matches the current markdown body.

    Overlays without ``markdown_sha256`` (v2 and older) are not treated as stale
    so existing block identities survive until the next editor save.
    """
    if overlay is None or not overlay.strip():
        return False
    try:
        parsed = json.loads(overlay)
    except json.JSONDecodeError:
        return False
    if not isinstance(parsed, dict):
        return False
    stored = parsed.get("markdown_sha256")
    if not isinstance(stored, str) or not stored:
        return False
    return stored != markdown_body_hash(markdown_body)


def apply_editor_overlay_put(
    page_id: str, overlay: str | None, root: Path | None = None
) -> bool:
    """``None`` = leave unchanged; ``''`` = delete; otherwise write to ``.json``."""
    if overlay is None:
        return True
    if overlay == "":
        delete_editor_overlay(page_id, root)
        return resolve_path_for_id(page_id, root) is not None
    split = read_page_split(page_id, root)
    if split is None:
        return False
    _, body = split
    try:
        to_write = stamp_overlay_with_markdown_hash(overlay, body)
    except (json.JSONDecodeError, TypeError, ValueError):
        to_write = overlay
    path = _overlay_path(page_id, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(path, to_write)
    return True


def read_page_detail(
    page_id: str, root: Path | None = None
) -> tuple[dict, str, str | None, bool] | None:
    split = read_page_split(page_id, root)
    if split is None:
        return None
    fm, body = split
    path = _overlay_path(page_id, root)
    overlay = path.read_text(encoding="utf-8") if path.is_file() else None
    stale = overlay_is_stale(overlay, body)
    if stale:
        overlay = None
    return fm, body, overlay, stale


def write_page_body(page_id: str, markdown_body: str, root: Path | None = None) -> bool:
    path = resolve_path_for_id(page_id, root)
    if path is None:
        return False
    text = path.read_text(encoding="utf-8")
    post = frontmatter.loads(text)
    post.content = markdown_body
    new_text = frontmatter.dumps(post)
    _atomic_write(path, new_text)
    return True


_VALID_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$")


def is_valid_page_id(page_id: str) -> bool:
    """Return True if ``page_id`` is a safe slug: ``[a-z0-9-]+``, no leading/trailing hyphens."""
    return bool(_VALID_ID_RE.match(page_id))


def _slugify_id_candidate(raw: str) -> str:
    s = raw.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s or "page"


def _next_unique_id(base: str, taken: set[str]) -> str:
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def create_page(
    title: str,
    *,
    parent: str = "",
    explicit_id: str | None = None,
    root: Path | None = None,
) -> PageMeta | None:
    """Write a new markdown page under ``root``. Returns meta or None if parent is invalid."""
    root = root or get_pages_root()
    root.mkdir(parents=True, exist_ok=True)

    scan = scan_pages(root)
    existing_ids = {p.id for p in scan.pages}

    parent_norm = parent.strip()
    if parent_norm and parent_norm not in existing_ids:
        return None

    if explicit_id is not None:
        cand = _slugify_id_candidate(explicit_id)
        if cand in existing_ids:
            return None
        page_id = cand
    else:
        base = _slugify_id_candidate(title)
        page_id = _next_unique_id(base, existing_ids)

    siblings = [p for p in scan.pages if (p.parent or "").strip() == parent_norm]
    next_order = max((p.order for p in siblings), default=-1) + 1

    created_str = date.today().isoformat()
    title_clean = title.strip()
    post = frontmatter.Post(content="\n")
    post.metadata = {
        "created": created_str,
        "id": page_id,
        "order": next_order,
        "parent": parent_norm,
        "tags": [],
        "title": title_clean,
    }
    path = root / f"{page_id}.md"
    if path.exists():
        return None
    _atomic_write(path, frontmatter.dumps(post))

    return PageMeta(
        id=page_id,
        title=title_clean,
        parent=parent_norm,
        order=next_order,
        tags=[],
        created=created_str,
    )


def rename_page_id(
    old_id: str,
    new_id_raw: str,
    *,
    root: Path | None = None,
) -> str | None:
    """Rename page slug: rewrite ``id`` in frontmatter, move to ``{slug}.md``, fix ``parent`` on children.

    Returns the canonical new id, ``old_id`` if slug unchanged after normalization, or ``None`` on failure.
    """
    root = root or get_pages_root()
    new_id = _slugify_id_candidate(new_id_raw)
    if new_id == old_id:
        return old_id

    scan = scan_pages(root)
    existing_ids = {p.id for p in scan.pages}
    if old_id not in existing_ids:
        return None
    if new_id in existing_ids:
        return None

    old_path = resolve_path_for_id(old_id, root)
    if old_path is None:
        return None

    new_path = (root / f"{new_id}.md").resolve()
    old_resolved = old_path.resolve()
    if new_path.exists() and new_path != old_resolved:
        return None

    text = old_path.read_text(encoding="utf-8")
    post = frontmatter.loads(text)
    fm = dict(post.metadata or {})
    fm["id"] = new_id
    post.metadata = fm
    new_text = frontmatter.dumps(post)

    _atomic_write(new_path, new_text)

    if new_path != old_resolved:
        try:
            old_path.unlink()
        except OSError:
            try:
                if new_path.exists():
                    new_path.unlink()
            except OSError:
                pass
            raise

    old_json = _overlay_path(old_id, root)
    new_json = _overlay_path(new_id, root)
    if old_json.is_file():
        try:
            new_json.parent.mkdir(parents=True, exist_ok=True)
            old_json.replace(new_json)
        except OSError:
            pass

    old_opener = _opener_path(old_id, root)
    new_opener = _opener_path(new_id, root)
    if old_opener.is_file():
        try:
            new_opener.parent.mkdir(parents=True, exist_ok=True)
            old_opener.replace(new_opener)
        except OSError:
            pass

    for path in sorted(root.rglob("*.md")):
        if path.resolve() == new_path.resolve():
            continue
        page, err = _parse_page_file(path)
        if err or page is None:
            continue
        if (page.parent or "").strip() != old_id:
            continue
        patch_page_meta(page.id, parent=new_id, root=root)

    return new_id


def delete_page(page_id: str, *, root: Path | None = None) -> str | None:
    """Remove the markdown file for ``page_id``.

    Returns ``None`` on success, or a reason string: ``not_found``, ``has_children``.
    """
    root = root or get_pages_root()
    scan = scan_pages(root)
    id_set = {p.id for p in scan.pages}
    if page_id not in id_set:
        return "not_found"
    for p in scan.pages:
        if (p.parent or "").strip() == page_id:
            return "has_children"
    path = resolve_path_for_id(page_id, root)
    if path is None:
        return "not_found"
    delete_editor_overlay(page_id, root)
    delete_opener_sidecar(page_id, root)
    try:
        path.unlink()
    except OSError:
        return "not_found"
    return None


def patch_page_meta(
    page_id: str,
    *,
    parent: str | None = None,
    title: str | None = None,
    order: int | None = None,
    root: Path | None = None,
) -> bool:
    path = resolve_path_for_id(page_id, root)
    if path is None:
        return False
    text = path.read_text(encoding="utf-8")
    post = frontmatter.loads(text)
    fm = dict(post.metadata or {})
    if fm.get("id") != page_id:
        fm["id"] = page_id
    if parent is not None:
        fm["parent"] = parent
    if title is not None:
        fm["title"] = title
    if order is not None:
        fm["order"] = order
    post.metadata = fm
    new_text = frontmatter.dumps(post)
    _atomic_write(path, new_text)
    return True


def _atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(
        dir=path.parent, prefix=".wit-", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
