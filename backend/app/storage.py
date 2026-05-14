from __future__ import annotations

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


def apply_editor_overlay_put(
    page_id: str, overlay: str | None, root: Path | None = None
) -> bool:
    """``None`` = leave unchanged; ``''`` = delete; otherwise write to ``.json``."""
    if overlay is None:
        return True
    if overlay == "":
        delete_editor_overlay(page_id, root)
        return resolve_path_for_id(page_id, root) is not None
    if resolve_path_for_id(page_id, root) is None:
        return False
    path = _overlay_path(page_id, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(path, overlay)
    return True


def read_page_detail(
    page_id: str, root: Path | None = None
) -> tuple[dict, str, str | None] | None:
    split = read_page_split(page_id, root)
    if split is None:
        return None
    fm, body = split
    path = _overlay_path(page_id, root)
    overlay = path.read_text(encoding="utf-8") if path.is_file() else None
    return fm, body, overlay


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
