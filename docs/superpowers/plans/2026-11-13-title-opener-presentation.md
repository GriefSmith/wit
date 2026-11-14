# Title Opener Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A title opening draws a doubled header, hides Previous Page, and stores before/after labels plus an optional palette band in an opener sidecar.

**Architecture:** Pure functions format labels and clean the opener document. The backend stores `{pages_root}/.wit/opener/{id}.json`, merges `labels` and `background` separately, and leaves the markdown and the editor sidecar alone. The title header is a React portal, the same one the page already uses, and it writes the sidecar on confirm without marking the manuscript dirty.

**Tech Stack:** Python 3, FastAPI, pytest. React 19, TypeScript, existing CSS variables. Node 22.6+ built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-title-opener-presentation-design.md`

## Global Constraints

- Title header is `4.5em`. Version and each author line are `2em`. Both are relative to the opener body size, which is the editor body size. The `2em` gap under the heading stays. Book stays `1.5em`. Chapter is unchanged.
- A page whose resolved opener is `title` does not render Previous Page, including when the heading draws nothing and including when the page has a parent. The title heading's right padding matches its left padding (`clamp(0.75rem, 3vw, 2.5rem)`). Next Page stays at the bottom. The outline crumb behavior is unchanged.
- Double-click the version or one author. The popover has Before, the read-only value, and After. Enter confirms. A click outside confirms. Escape cancels. The popover stays open until the write succeeds.
- The renderer trims each label and inserts one space between a non-empty label and the value. Authors join with a comma and a space. The comma is not part of a label. Each side is at most 120 characters after trimming.
- Labels belong to the page on screen. Author keys are the names on screen. A label write sends only names currently shown. Two authors with the same name share one pair. The version pair stays when the version line is hidden.
- File: `{pages_root}/.wit/opener/{id}.json`. A missing file is `{}`. Confirming a label sends `labels` and omits `background`. Choosing a palette sends `background` and omits `labels`. Neither write marks the manuscript dirty or changes the markdown or the editor sidecar.
- Palette menu: None, Forest, Steppe, Mountain, Ocean, Dune, Wasteland. Stored names: `forest`, `steppe`, `mountain`, `ocean`, `dune`, `wasteland`. System is not a choice. The band paints only the title header, using that palette's dark background and dark heading color.
- `GET` drops an unknown `background.kind`, an over-long side, and a non-string side from the response and does not rewrite the file. `PUT` of any `kind` other than `palette`, or a bad palette name, or an over-long side, returns 400 and writes nothing. `background: null` clears the band. An empty document deletes the file.
- Renaming a page moves the opener file. Deleting a page deletes it. Deleting the editor overlay leaves it. A body save leaves it.
- Do not edit `version` or `authors` in the markdown. No texture, no image, no upload. No component test runner.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

## File structure

- `frontend/src/lib/openerSidecar.ts` — types, formatting, cleaning, and the label objects sent to `PUT`. No React.
- `frontend/test/openerSidecar.test.ts` — Node tests for that module.
- `frontend/src/lib/pageStyle.ts` — `showPreviousPage`.
- `backend/app/storage.py` — read, clean, merge, rename, and delete the opener file.
- `backend/app/main.py` — `GET` and `PUT /pages/{id}/opener`.
- `frontend/src/api.ts` — `fetchOpener` and `putOpener`.
- `frontend/src/components/TitleOpener.tsx` — title header, affix popover, palette menu.
- `frontend/src/components/PageEditor.tsx` — load the sidecar and portal `TitleOpener` for a title opening.
- `frontend/src/components/PageNavButtons.tsx` — `showPrevious`.
- `frontend/src/index.css` — sizes, title padding, band, popover, menu.
- `RUNBOOK.md` — the new endpoint and the rename/delete behavior.

---

### Task 1: Opener document functions

**Files:**

- Create: `frontend/src/lib/openerSidecar.ts`
- Create: `frontend/test/openerSidecar.test.ts`
- Modify: `Makefile` (the `test` target, line 41)
- Test: `frontend/test/openerSidecar.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `OPENER_PALETTES`, `OPENER_PALETTE_LABELS`, `OpenerPalette`, `OpenerAffix`, `OpenerLabels`, `OpenerDocument`, `StoredLabels`, `OpenerPutBody`, `emptyAffix()`, `emptyOpenerDocument()`, `formatAffixed(value, affix)`, `formatAuthorLine(authors, authorsAffix)`, `cleanOpenerDocument(raw)`, `withVersionAffix(doc, shownAuthors, next)`, `withAuthorAffix(doc, shownAuthors, name, next)`, `labelsToStored(labels)`.

- [ ] **Step 1: Write the failing test**

Create `frontend/test/openerSidecar.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleanOpenerDocument,
  formatAffixed,
  formatAuthorLine,
  labelsToStored,
  withAuthorAffix,
  withVersionAffix,
} from '../src/lib/openerSidecar.ts'

const empty = { labels: { version: null, authors: {} }, background: null }

test('formatAffixed inserts one space on the sides that have text', () => {
  assert.equal(formatAffixed('2', null), '2')
  assert.equal(formatAffixed('2', { before: 'version so far:', after: '' }), 'version so far: 2')
  assert.equal(formatAffixed('2', { before: '', after: 'so far' }), '2 so far')
  assert.equal(formatAffixed('2', { before: ' draft of ', after: ' so far ' }), 'draft of 2 so far')
})

test('formatAuthorLine keeps the comma between authors', () => {
  assert.equal(
    formatAuthorLine(['Ada', 'Bea'], {
      Ada: { before: 'written by:', after: '' },
      Bea: { before: '', after: 'did the drawings.' },
    }),
    'written by: Ada, Bea did the drawings.',
  )
})

test('cleanOpenerDocument keeps a palette and drops an unknown kind', () => {
  assert.deepEqual(
    cleanOpenerDocument({
      labels: { version: { before: ' version so far: ', after: '' } },
      background: { kind: 'palette', name: 'ocean' },
    }),
    {
      labels: { version: { before: 'version so far:', after: '' }, authors: {} },
      background: { kind: 'palette', name: 'ocean' },
    },
  )
  assert.deepEqual(
    cleanOpenerDocument({ background: { kind: 'texture', name: 'paper' } }),
    empty,
  )
})

test('cleanOpenerDocument drops an over-long side and a non-string side', () => {
  const cleaned = cleanOpenerDocument({
    labels: {
      version: { before: 'x'.repeat(121), after: 'kept' },
      authors: { Ada: { before: 3, after: 'drew' } },
    },
  })
  assert.deepEqual(cleaned.labels.version, { before: '', after: 'kept' })
  assert.deepEqual(cleaned.labels.authors.Ada, { before: '', after: 'drew' })
})

test('cleanOpenerDocument omits a pair whose sides are both empty', () => {
  assert.deepEqual(
    cleanOpenerDocument({
      labels: {
        version: { before: '  ', after: '' },
        authors: { Ada: { before: '', after: ' ' } },
      },
    }),
    empty,
  )
})

test('an author edit keeps the version and drops a name that is not shown', () => {
  const doc = cleanOpenerDocument({
    labels: {
      version: { before: 'version so far:', after: '' },
      authors: {
        Ada: { before: 'written by:', after: '' },
        Old: { before: 'once', after: '' },
      },
    },
  })
  const next = withAuthorAffix(doc, ['Ada', 'Bea'], 'Bea', {
    before: '',
    after: 'did the drawings.',
  })
  assert.deepEqual(labelsToStored(next), {
    version: { before: 'version so far:', after: '' },
    authors: {
      Ada: { before: 'written by:', after: '' },
      Bea: { before: '', after: 'did the drawings.' },
    },
  })
})

test('clearing both sides of the version removes that pair', () => {
  const doc = cleanOpenerDocument({
    labels: { version: { before: 'version so far:', after: '' } },
  })
  const next = withVersionAffix(doc, [], { before: ' ', after: ' ' })
  assert.deepEqual(labelsToStored(next), {})
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test frontend/test/openerSidecar.test.ts`

Expected: FAIL. The module `../src/lib/openerSidecar.ts` cannot be found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/openerSidecar.ts`:

```ts
export const OPENER_PALETTES = [
  'forest',
  'steppe',
  'mountain',
  'ocean',
  'dune',
  'wasteland',
] as const

export type OpenerPalette = (typeof OPENER_PALETTES)[number]

export const OPENER_PALETTE_LABELS: Record<OpenerPalette, string> = {
  forest: 'Forest',
  steppe: 'Steppe',
  mountain: 'Mountain',
  ocean: 'Ocean',
  dune: 'Dune',
  wasteland: 'Wasteland',
}

const LABEL_MAX = 120

export type OpenerAffix = {
  before: string
  after: string
}

export type OpenerLabels = {
  version: OpenerAffix | null
  authors: Record<string, OpenerAffix>
}

export type OpenerDocument = {
  labels: OpenerLabels
  background: { kind: 'palette'; name: OpenerPalette } | null
}

export type StoredLabels = {
  version?: OpenerAffix
  authors?: Record<string, OpenerAffix>
}

export type OpenerPutBody =
  | { labels: StoredLabels }
  | { background: { kind: 'palette'; name: OpenerPalette } | null }

export function emptyAffix(): OpenerAffix {
  return { before: '', after: '' }
}

export function emptyOpenerDocument(): OpenerDocument {
  return { labels: { version: null, authors: {} }, background: null }
}

function trimmedSide(raw: string): string {
  return raw.trim()
}

export function formatAffixed(value: string, affix: OpenerAffix | null): string {
  if (!affix) {
    return value
  }
  const before = trimmedSide(affix.before)
  const after = trimmedSide(affix.after)
  let text = value
  if (before) {
    text = `${before} ${text}`
  }
  if (after) {
    text = `${text} ${after}`
  }
  return text
}

export function formatAuthorLine(
  authors: readonly string[],
  authorsAffix: Record<string, OpenerAffix>,
): string {
  return authors
    .map((name) => formatAffixed(name, authorsAffix[name] ?? null))
    .join(', ')
}

function isPalette(value: unknown): value is OpenerPalette {
  return (
    typeof value === 'string' &&
    (OPENER_PALETTES as readonly string[]).includes(value)
  )
}

function cleanSide(raw: unknown): string {
  if (typeof raw !== 'string') {
    return ''
  }
  const text = raw.trim()
  if (text.length > LABEL_MAX) {
    return ''
  }
  return text
}

function cleanAffix(raw: unknown): OpenerAffix | null {
  if (raw === null || typeof raw !== 'object') {
    return null
  }
  const record = raw as { before?: unknown; after?: unknown }
  const before = cleanSide(record.before)
  const after = cleanSide(record.after)
  if (!before && !after) {
    return null
  }
  return { before, after }
}

export function cleanOpenerDocument(raw: unknown): OpenerDocument {
  const doc = emptyOpenerDocument()
  if (raw === null || typeof raw !== 'object') {
    return doc
  }
  const record = raw as { labels?: unknown; background?: unknown }
  if (record.labels !== null && typeof record.labels === 'object') {
    const labels = record.labels as { version?: unknown; authors?: unknown }
    doc.labels.version = cleanAffix(labels.version)
    if (labels.authors !== null && typeof labels.authors === 'object') {
      for (const [name, value] of Object.entries(labels.authors)) {
        if (name.trim() === '') {
          continue
        }
        const affix = cleanAffix(value)
        if (affix) {
          doc.labels.authors[name] = affix
        }
      }
    }
  }
  if (record.background !== null && typeof record.background === 'object') {
    const background = record.background as { kind?: unknown; name?: unknown }
    if (background.kind === 'palette' && isPalette(background.name)) {
      doc.background = { kind: 'palette', name: background.name }
    }
  }
  return doc
}

function shownAuthors(
  doc: OpenerDocument,
  shown: readonly string[],
): Record<string, OpenerAffix> {
  const authors: Record<string, OpenerAffix> = {}
  for (const name of shown) {
    const affix = doc.labels.authors[name]
    if (!affix) {
      continue
    }
    const before = affix.before.trim()
    const after = affix.after.trim()
    if (!before && !after) {
      continue
    }
    authors[name] = { before, after }
  }
  return authors
}

function normalizeNext(next: OpenerAffix): OpenerAffix | null {
  const before = next.before.trim()
  const after = next.after.trim()
  if (!before && !after) {
    return null
  }
  return { before, after }
}

export function withVersionAffix(
  doc: OpenerDocument,
  shown: readonly string[],
  next: OpenerAffix,
): OpenerLabels {
  return {
    version: normalizeNext(next),
    authors: shownAuthors(doc, shown),
  }
}

export function withAuthorAffix(
  doc: OpenerDocument,
  shown: readonly string[],
  name: string,
  next: OpenerAffix,
): OpenerLabels {
  const authors = shownAuthors(doc, shown)
  const affix = normalizeNext(next)
  if (affix) {
    authors[name] = affix
  } else {
    delete authors[name]
  }
  return { version: doc.labels.version, authors }
}

export function labelsToStored(labels: OpenerLabels): StoredLabels {
  const stored: StoredLabels = {}
  if (labels.version) {
    const before = labels.version.before.trim()
    const after = labels.version.after.trim()
    if (before || after) {
      stored.version = { before, after }
    }
  }
  const authors: Record<string, OpenerAffix> = {}
  for (const [name, affix] of Object.entries(labels.authors)) {
    const before = affix.before.trim()
    const after = affix.after.trim()
    if (before || after) {
      authors[name] = { before, after }
    }
  }
  if (Object.keys(authors).length > 0) {
    stored.authors = authors
  }
  return stored
}
```

In `Makefile`, change the last line of the `test` target from:

```make
	node --experimental-strip-types --test $(FRONTEND_DIR)/test/pageStyle.test.ts
```

to:

```make
	node --experimental-strip-types --test $(FRONTEND_DIR)/test/pageStyle.test.ts $(FRONTEND_DIR)/test/openerSidecar.test.ts
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test frontend/test/openerSidecar.test.ts`

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

Do not run this. Hand it to the human:

```bash
git add frontend/src/lib/openerSidecar.ts frontend/test/openerSidecar.test.ts Makefile
git commit -m "$(cat <<'EOF'
Add pure functions for title-opener labels and palettes.

EOF
)"
```

---

### Task 2: Opener sidecar API

**Files:**

- Modify: `backend/app/storage.py` (constants after line 19, `rename_page_id` around lines 420–427, `delete_page` around line 458)
- Modify: `backend/app/main.py` (imports, and a route pair after `remove_overlay`)
- Modify: `backend/tests/test_api.py` (append tests)
- Modify: `RUNBOOK.md` (endpoint bullets around lines 82–85)
- Test: `backend/tests/test_api.py`

**Interfaces:**

- Consumes: `resolve_path_for_id`, `_atomic_write`, `rename_page_id`, `delete_page`.
- Produces: `opener_get_payload(page_id, root=None) -> dict | None` and `merge_opener_put(page_id, body, root=None) -> str | None`. `None` from the put means saved. `"not_found"` and `"invalid"` are the failures. `GET /pages/{id}/opener` and `PUT /pages/{id}/opener`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_api.py`:

```python
def test_opener_get_missing_is_empty(client: TestClient) -> None:
    r = client.get("/pages/b/opener")
    assert r.status_code == 200
    assert r.json() == {}
    missing = client.get("/pages/nope/opener")
    assert missing.status_code == 404


def test_opener_get_invalid_json_is_empty_and_keeps_the_file(
    client: TestClient, tmp_path: Path
) -> None:
    path = tmp_path / ".wit" / "opener" / "b.json"
    path.parent.mkdir(parents=True)
    path.write_text("{", encoding="utf-8")
    r = client.get("/pages/b/opener")
    assert r.status_code == 200
    assert r.json() == {}
    assert path.read_text(encoding="utf-8") == "{"


def test_opener_get_drops_overlong_and_unknown_kind(
    client: TestClient, tmp_path: Path
) -> None:
    path = tmp_path / ".wit" / "opener" / "b.json"
    path.parent.mkdir(parents=True)
    raw = json.dumps(
        {
            "labels": {
                "version": {"before": "x" * 121, "after": "kept"},
                "authors": {"Ada": {"before": 3, "after": "drew"}},
            },
            "background": {"kind": "texture", "name": "paper"},
        }
    )
    path.write_text(raw, encoding="utf-8")
    body = client.get("/pages/b/opener").json()
    assert body["labels"]["version"] == {"before": "", "after": "kept"}
    assert body["labels"]["authors"]["Ada"] == {"before": "", "after": "drew"}
    assert "background" not in body
    assert path.read_text(encoding="utf-8") == raw


def test_opener_put_labels_keeps_background_and_leaves_manuscript(
    client: TestClient, tmp_path: Path
) -> None:
    client.put(
        "/pages/b",
        json={"editor_overlay": '{"version":2,"document":[]}'},
    )
    opener = tmp_path / ".wit" / "opener" / "b.json"
    opener.parent.mkdir(parents=True)
    opener.write_text(
        json.dumps(
            {
                "background": {"kind": "texture", "name": "paper", "scale": 2},
                "labels": {"version": {"before": "old", "after": ""}},
            }
        ),
        encoding="utf-8",
    )
    md_before = (tmp_path / "b.md").read_text(encoding="utf-8")
    editor_before = (tmp_path / ".wit" / "editor" / "b.json").read_text(encoding="utf-8")
    r = client.put(
        "/pages/b/opener",
        json={"labels": {"version": {"before": " version so far: ", "after": ""}}},
    )
    assert r.status_code == 200
    stored = json.loads(opener.read_text(encoding="utf-8"))
    assert stored["background"] == {"kind": "texture", "name": "paper", "scale": 2}
    # The file is rewritten as pretty JSON. Parsed equality is the check that the
    # background object was not dropped or reinterpreted. A rejected put, below,
    # leaves the file bytes unchanged.
    assert stored["labels"] == {"version": {"before": "version so far:", "after": ""}}
    assert (tmp_path / "b.md").read_text(encoding="utf-8") == md_before
    assert (tmp_path / ".wit" / "editor" / "b.json").read_text(encoding="utf-8") == editor_before


def test_opener_put_palette_leaves_labels(client: TestClient, tmp_path: Path) -> None:
    client.put(
        "/pages/b/opener",
        json={"labels": {"authors": {"Ada": {"before": "written by:", "after": ""}}}},
    )
    r = client.put(
        "/pages/b/opener",
        json={"background": {"kind": "palette", "name": "ocean"}},
    )
    assert r.status_code == 200
    stored = json.loads((tmp_path / ".wit" / "opener" / "b.json").read_text(encoding="utf-8"))
    assert stored["labels"]["authors"]["Ada"]["before"] == "written by:"
    assert stored["background"] == {"kind": "palette", "name": "ocean"}
    cleared = client.put("/pages/b/opener", json={"background": None})
    assert cleared.status_code == 200
    stored = json.loads((tmp_path / ".wit" / "opener" / "b.json").read_text(encoding="utf-8"))
    assert "background" not in stored
    assert "Ada" in stored["labels"]["authors"]


def test_opener_put_rejects_bad_background_and_long_label(
    client: TestClient, tmp_path: Path
) -> None:
    path = tmp_path / ".wit" / "opener" / "b.json"
    path.parent.mkdir(parents=True)
    path.write_text("{}\n", encoding="utf-8")
    before = path.read_text(encoding="utf-8")
    bad_name = client.put(
        "/pages/b/opener",
        json={"background": {"kind": "palette", "name": "system"}},
    )
    bad_kind = client.put(
        "/pages/b/opener",
        json={"background": {"kind": "texture", "name": "paper"}},
    )
    too_long = client.put(
        "/pages/b/opener",
        json={"labels": {"version": {"before": "y" * 121, "after": ""}}},
    )
    assert bad_name.status_code == 400
    assert bad_kind.status_code == 400
    assert too_long.status_code == 400
    assert path.read_text(encoding="utf-8") == before
    missing = client.put("/pages/nope/opener", json={"labels": {}})
    assert missing.status_code == 404


def test_opener_put_deletes_file_when_nothing_remains(
    client: TestClient, tmp_path: Path
) -> None:
    client.put(
        "/pages/b/opener",
        json={"labels": {"version": {"before": "v", "after": ""}}},
    )
    path = tmp_path / ".wit" / "opener" / "b.json"
    assert path.is_file()
    r = client.put(
        "/pages/b/opener",
        json={"labels": {"version": {"before": " ", "after": ""}}},
    )
    assert r.status_code == 200
    assert not path.exists()


def test_opener_rename_delete_and_manuscript_writes_keep_or_move_the_file(
    client: TestClient, tmp_path: Path
) -> None:
    path = tmp_path / ".wit" / "opener" / "b.json"
    path.parent.mkdir(parents=True)
    path.write_text('{"labels": {"version": {"before": "v", "after": ""}}}\n', encoding="utf-8")
    text = path.read_text(encoding="utf-8")
    saved = client.put("/pages/b", json={"markdown_body": "Updated\n"})
    assert saved.status_code == 200
    assert path.read_text(encoding="utf-8") == text
    client.put(
        "/pages/b",
        json={"editor_overlay": '{"version":2,"document":[]}'},
    )
    removed = client.delete("/pages/b/overlay")
    assert removed.status_code == 200
    assert path.read_text(encoding="utf-8") == text
    assert not (tmp_path / ".wit" / "editor" / "b.json").exists()
    renamed = client.patch("/pages/b/meta", json={"new_id": "beta-page"})
    assert renamed.status_code == 200
    moved = tmp_path / ".wit" / "opener" / "beta-page.json"
    assert moved.is_file()
    assert not path.exists()
    deleted = client.delete("/pages/beta-page")
    assert deleted.status_code == 204
    assert not moved.exists()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/pytest backend/tests/test_api.py -k opener -v`

Expected: FAIL. `GET /pages/b/opener` is 404 because the route does not exist, or the assertions about an empty object fail.

- [ ] **Step 3: Write the storage functions**

In `backend/app/storage.py`, after `EDITOR_OVERLAY_SUBDIR = ".wit/editor"`:

```python
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
```

`_atomic_write` is defined later in the same module. A function body may call it. Do not move `_atomic_write`.

In `rename_page_id`, after the editor-sidecar `old_json.replace(new_json)` block, add:

```python
    old_opener = _opener_path(old_id, root)
    new_opener = _opener_path(new_id, root)
    if old_opener.is_file():
        try:
            new_opener.parent.mkdir(parents=True, exist_ok=True)
            old_opener.replace(new_opener)
        except OSError:
            pass
```

In `delete_page`, immediately after `delete_editor_overlay(page_id, root)`:

```python
    delete_opener_sidecar(page_id, root)
```

- [ ] **Step 4: Wire the routes**

In `backend/app/main.py`, add `Body` to the `fastapi` import (`from fastapi import Body, FastAPI, HTTPException`). Add `merge_opener_put` and `opener_get_payload` to the `app.storage` import.

After `remove_overlay`:

```python
@app.get("/pages/{page_id}/opener")
def get_opener(page_id: str) -> dict:
    _require_valid_id(page_id)
    payload = opener_get_payload(page_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="page not found")
    return payload


@app.put("/pages/{page_id}/opener")
def put_opener(page_id: str, body: dict = Body()) -> dict[str, str]:
    _require_valid_id(page_id)
    result = merge_opener_put(page_id, body)
    if result == "not_found":
        raise HTTPException(status_code=404, detail="page not found")
    if result == "invalid":
        raise HTTPException(status_code=400, detail="invalid opener document")
    return {"status": "saved"}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `.venv/bin/pytest backend/tests/test_api.py -k opener -v`

Expected: PASS, 8 tests.

- [ ] **Step 6: Document the endpoint**

In `RUNBOOK.md`, add this bullet after the `GET /pages/{id}` bullet:

```markdown
- **`GET /pages/{id}/opener`** returns the cleaned opener sidecar, or `{}` when the page exists and the file is missing, invalid, or empty. A side longer than 120 characters, a non-string side, and an unknown `background.kind` are omitted from the response. The file is not rewritten. 404 if the page does not exist.
- **`PUT /pages/{id}/opener`** merges. The body may include `labels`, `background`, or both. An absent key stays on disk. `labels` replaces the labels object. `background: null` clears the band. A palette is `{ "kind": "palette", "name": "forest|steppe|mountain|ocean|dune|wasteland" }`. Any other kind, a bad name, a non-string side, or a side longer than 120 characters returns 400 and writes nothing. An empty result deletes the file. This route does not change the markdown or the editor sidecar. 404 if the page does not exist.
```

In the `DELETE /pages/{id}` bullet, replace "also removes the sidecar" with "also removes the editor sidecar and the opener sidecar".

In the `PATCH /pages/{id}/meta` bullet, replace "the sidecar is renamed" with "the editor sidecar and the opener sidecar are renamed".

- [ ] **Step 7: Commit**

Do not run this. Hand it to the human:

```bash
git add backend/app/storage.py backend/app/main.py backend/tests/test_api.py RUNBOOK.md
git commit -m "$(cat <<'EOF'
Store title-opener labels and palette bands in their own sidecar.

EOF
)"
```

---

### Task 3: Title size and no Previous Page

**Files:**

- Modify: `frontend/src/lib/pageStyle.ts` (after `chapterEntrance`)
- Modify: `frontend/test/pageStyle.test.ts`
- Modify: `frontend/src/components/PageNavButtons.tsx` (props, and the previous button around lines 64–76)
- Modify: `frontend/src/components/PageEditor.tsx` (the `PageNavButtons` element around lines 570–575)
- Modify: `frontend/src/index.css` (`.wit-chapter-opener` around lines 1514–1543)
- Test: `frontend/test/pageStyle.test.ts`

**Interfaces:**

- Consumes: `SheetOpener` from `pageStyle.ts`. `PageNavButtons` props as they are today.
- Produces: `showPreviousPage(opener: SheetOpener | null): boolean`. `PageNavButtons` gains `showPrevious?: boolean`, default `true`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/test/pageStyle.test.ts`. Add `showPreviousPage` to the existing import from `../src/lib/pageStyle.ts`.

```ts
test('a title page hides the previous-page control', () => {
  assert.equal(showPreviousPage('title'), false)
  assert.equal(showPreviousPage('book'), true)
  assert.equal(showPreviousPage('chapter'), true)
  assert.equal(showPreviousPage(null), true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: FAIL. `showPreviousPage` is not exported.

- [ ] **Step 3: Implement the rule, the button, and the sizes**

Append to `frontend/src/lib/pageStyle.ts`:

```ts
export function showPreviousPage(opener: SheetOpener | null): boolean {
  return opener !== 'title'
}
```

In `PageNavButtons.tsx`, add `showPrevious?: boolean` to `Props`. Default it to `true` in the function arguments. Render the previous button only when `showPrevious && atTop`. Leave the next button as it is.

In `PageEditor.tsx`, import `showPreviousPage` beside `chapterEntrance`. On `PageNavButtons`, add:

```tsx
showPrevious={showPreviousPage(sheet?.opener ?? null)}
```

In `frontend/src/index.css`, add `position: relative;` to `.wit-chapter-opener`.

Replace the title font rule:

```css
.wit-chapter-opener--title .wit-chapter-opener-title {
  font-size: 4.5em;
}
```

Add immediately after it:

```css
.wit-chapter-opener--title .wit-chapter-opener-meta {
  font-size: 2em;
}

.wit-chapter-opener--title {
  padding-right: clamp(0.75rem, 3vw, 2.5rem);
}
```

Leave `.wit-chapter-opener--book .wit-chapter-opener-title` at `1.5em`. Leave the shared `.wit-chapter-opener` `padding-right: 7.75rem` so a book heading still clears Previous Page.

- [ ] **Step 4: Run the test and the build**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: PASS.

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 5: Commit**

Do not run this. Hand it to the human:

```bash
git add frontend/src/lib/pageStyle.ts frontend/test/pageStyle.test.ts frontend/src/components/PageNavButtons.tsx frontend/src/components/PageEditor.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Double the title opener and hide Previous Page on title pages.

EOF
)"
```

---

### Task 4: Labels and the palette band

**Files:**

- Modify: `frontend/src/api.ts`
- Create: `frontend/src/components/TitleOpener.tsx`
- Modify: `frontend/src/components/PageEditor.tsx` (opener state, and the portal around lines 549–568)
- Modify: `frontend/src/index.css` (the six `html[data-bg-theme='…']` selectors starting at line 269, plus the new opener controls)
- Test: `npm --prefix frontend run build`

**Interfaces:**

- Consumes: `cleanOpenerDocument`, `emptyOpenerDocument`, `emptyAffix`, `formatAffixed`, `labelsToStored`, `withAuthorAffix`, `withVersionAffix`, `OPENER_PALETTES`, `OPENER_PALETTE_LABELS`, `OpenerDocument`, `OpenerPalette`, `OpenerPutBody`, `StoredLabels` from Task 1. `fetch` helpers in `api.ts`.
- Produces: `fetchOpener(id)` and `putOpener(id, body)`. `TitleOpener` renders the title header.

- [ ] **Step 1: Add the client calls**

Append to `frontend/src/api.ts`. Import `OpenerPutBody` as a type from `./lib/openerSidecar`.

```ts
export async function fetchOpener(id: string): Promise<unknown> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}/opener`)
  return parseJson<unknown>(r)
}

export async function putOpener(id: string, body: OpenerPutBody): Promise<void> {
  const r = await fetch(`/pages/${encodeURIComponent(id)}/opener`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(text || r.statusText)
  }
}
```

- [ ] **Step 2: Create the title header**

Create `frontend/src/components/TitleOpener.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, Ref } from "react";

import {
  OPENER_PALETTE_LABELS,
  OPENER_PALETTES,
  emptyAffix,
  formatAffixed,
  labelsToStored,
  withAuthorAffix,
  withVersionAffix,
} from "../lib/openerSidecar";
import type {
  OpenerDocument,
  OpenerPalette,
  StoredLabels,
} from "../lib/openerSidecar";

type Popover = { kind: "version" } | { kind: "author"; name: string };

type Props = {
  ref?: Ref<HTMLElement>;
  title: string;
  version: string;
  authors: string[];
  doc: OpenerDocument;
  onCommitLabels: (labels: StoredLabels) => Promise<void>;
  onCommitBackground: (palette: OpenerPalette | null) => Promise<void>;
};

export function TitleOpener({
  ref,
  title,
  version,
  authors,
  doc,
  onCommitLabels,
  onCommitBackground,
}: Props) {
  const [popover, setPopover] = useState<Popover | null>(null);
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLFormElement | null>(null);
  const commitRef = useRef<() => void>(() => {});
  const beforeId = useId();
  const afterId = useId();
  const valueText = popover?.kind === "author" ? popover.name : version;

  function openPopover(next: Popover, affixBefore: string, affixAfter: string) {
    if (pending) {
      return;
    }
    setBefore(affixBefore);
    setAfter(affixAfter);
    setError(null);
    setPopover(next);
  }

  async function commitLabels() {
    if (!popover || pending) {
      return;
    }
    const next = { before, after };
    const labels =
      popover.kind === "version"
        ? withVersionAffix(doc, authors, next)
        : withAuthorAffix(doc, authors, popover.name, next);
    const stored = labelsToStored(labels);
    const current = labelsToStored(
      popover.kind === "version"
        ? withVersionAffix(
            doc,
            authors,
            doc.labels.version ?? emptyAffix(),
          )
        : withAuthorAffix(
            doc,
            authors,
            popover.name,
            doc.labels.authors[popover.name] ?? emptyAffix(),
          ),
    );
    if (JSON.stringify(stored) === JSON.stringify(current)) {
      setPopover(null);
      setError(null);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCommitLabels(stored);
      setPopover(null);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not save label");
    } finally {
      setPending(false);
    }
  }

  commitRef.current = () => {
    void commitLabels();
  };

  useEffect(() => {
    if (!popover) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || popoverRef.current?.contains(target)) {
        return;
      }
      commitRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [popover]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void commitLabels();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      event.stopPropagation();
      setPopover(null);
      setError(null);
    }
  }

  async function choosePalette(palette: OpenerPalette | null) {
    if (pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onCommitBackground(palette);
      setMenuOpen(false);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Could not save background",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <header
      ref={ref}
      className="wit-chapter-opener wit-chapter-opener--title"
      data-opener-palette={doc.background?.name}
    >
      <div
        className="wit-opener-background"
        data-open={menuOpen ? "true" : undefined}
      >
        <button
          type="button"
          className="wit-opener-background-button"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Background
        </button>
        {menuOpen ? (
          <ul className="wit-opener-background-menu" role="listbox" aria-label="Heading background">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={doc.background === null}
                onClick={() => void choosePalette(null)}
              >
                None
              </button>
            </li>
            {OPENER_PALETTES.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={doc.background?.name === name}
                  onClick={() => void choosePalette(name)}
                >
                  {OPENER_PALETTE_LABELS[name]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {title !== "" ? (
        <span className="wit-chapter-opener-title">{title}</span>
      ) : null}
      {version !== "" ? (
        <span className="wit-chapter-opener-meta">
          <span
            className="wit-opener-value"
            onDoubleClick={() =>
              openPopover(
                { kind: "version" },
                doc.labels.version?.before ?? "",
                doc.labels.version?.after ?? "",
              )
            }
          >
            {formatAffixed(version, doc.labels.version)}
          </span>
        </span>
      ) : null}
      {authors.length > 0 ? (
        <span className="wit-chapter-opener-meta">
          {authors.map((name, index) => (
            <span key={`${name}-${index}`}>
              {index > 0 ? ", " : null}
              <span
                className="wit-opener-value"
                onDoubleClick={() =>
                  openPopover(
                    { kind: "author", name },
                    doc.labels.authors[name]?.before ?? "",
                    doc.labels.authors[name]?.after ?? "",
                  )
                }
              >
                {formatAffixed(name, doc.labels.authors[name] ?? null)}
              </span>
            </span>
          ))}
        </span>
      ) : null}
      {popover ? (
        <form
          ref={popoverRef}
          className="wit-opener-affix"
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
        >
          <label htmlFor={beforeId}>Before</label>
          <input
            id={beforeId}
            maxLength={120}
            value={before}
            disabled={pending}
            onChange={(event) => setBefore(event.target.value)}
          />
          <span className="wit-opener-affix-value">{valueText}</span>
          <label htmlFor={afterId}>After</label>
          <input
            id={afterId}
            maxLength={120}
            value={after}
            disabled={pending}
            onChange={(event) => setAfter(event.target.value)}
          />
          {error ? (
            <p className="wit-opener-affix-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
      {!popover && error ? (
        <p className="wit-opener-affix-error" role="alert">
          {error}
        </p>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 3: Load the sidecar in the editor**

In `PageEditor.tsx`:

Import `fetchOpener` and `putOpener` beside `fetchPage`. Import `TitleOpener` beside `PageNavButtons`. Import `cleanOpenerDocument` and `emptyOpenerDocument` from `../lib/openerSidecar`, and the types `OpenerDocument`, `OpenerPalette`, and `StoredLabels`.

Add state next to `titleHeadingInView`:

```tsx
const [openerDoc, setOpenerDoc] = useState<OpenerDocument>(emptyOpenerDocument);
```

Add this effect after the title-heading intersection effect:

```tsx
useEffect(() => {
  if (openerKind !== "title" || !pageId) {
    setOpenerDoc(emptyOpenerDocument());
    return;
  }
  let cancelled = false;
  void fetchOpener(pageId)
    .then((raw) => {
      if (!cancelled) {
        setOpenerDoc(cleanOpenerDocument(raw));
      }
    })
    .catch(() => {
      if (!cancelled) {
        setOpenerDoc(emptyOpenerDocument());
      }
    });
  return () => {
    cancelled = true;
  };
}, [openerKind, pageId]);
```

A failed fetch leaves an empty document. It must not set `loadError` or `dirty`.

Add these callbacks next to `goToNeighbor`:

```tsx
const commitOpenerLabels = useCallback(
  async (labels: StoredLabels) => {
    if (!pageId) {
      return;
    }
    await putOpener(pageId, { labels });
    setOpenerDoc((prev) => ({
      ...prev,
      labels: {
        version: labels.version ?? null,
        authors: labels.authors ?? {},
      },
    }));
  },
  [pageId],
);

const commitOpenerBackground = useCallback(
  async (palette: OpenerPalette | null) => {
    if (!pageId) {
      return;
    }
    await putOpener(pageId, {
      background: palette ? { kind: "palette", name: palette } : null,
    });
    setOpenerDoc((prev) => ({
      ...prev,
      background: palette ? { kind: "palette", name: palette } : null,
    }));
  },
  [pageId],
);
```

Replace the opener portal. Keep the book branch on the existing header. A title opening uses `TitleOpener`. Pass `ref={titleHeadingShown ? setTitleHeadingEl : undefined}` on both headers, and remove that ref from the old title path by splitting the condition:

```tsx
{showOpener && openerHost && openerKind === "title"
  ? createPortal(
      <TitleOpener
        ref={titleHeadingShown ? setTitleHeadingEl : undefined}
        title={showTitleLine ? openerTitle : ""}
        version={showVersion ? openerVersion : ""}
        authors={showAuthors ? openerAuthors : []}
        doc={openerDoc}
        onCommitLabels={commitOpenerLabels}
        onCommitBackground={commitOpenerBackground}
      />,
      openerHost,
    )
  : null}
{showOpener && openerHost && openerKind !== "title"
  ? createPortal(
      <header
        className={`wit-chapter-opener wit-chapter-opener--${openerKind}`}
      >
        {showTitleLine ? (
          <span className="wit-chapter-opener-title">{openerTitle}</span>
        ) : null}
      </header>,
      openerHost,
    )
  : null}
```

Do not call `setDirty` from either commit callback.

- [ ] **Step 4: Paint the band and the controls**

In `frontend/src/index.css`, extend each named palette selector so the same variables apply on the header. Change these six selectors and leave their declarations as they are:

- `html[data-bg-theme='forest']` becomes `html[data-bg-theme='forest'], .wit-chapter-opener[data-opener-palette='forest']`
- `html[data-bg-theme='steppe']` becomes `html[data-bg-theme='steppe'], .wit-chapter-opener[data-opener-palette='steppe']`
- `html[data-bg-theme='mountain']` becomes `html[data-bg-theme='mountain'], .wit-chapter-opener[data-opener-palette='mountain']`
- `html[data-bg-theme='dune']` becomes `html[data-bg-theme='dune'], .wit-chapter-opener[data-opener-palette='dune']`
- `html[data-bg-theme='wasteland']` becomes `html[data-bg-theme='wasteland'], .wit-chapter-opener[data-opener-palette='wasteland']`
- `html[data-bg-theme='ocean']` becomes `html[data-bg-theme='ocean'], .wit-chapter-opener[data-opener-palette='ocean']`

Append:

```css
.wit-chapter-opener[data-opener-palette] {
  background: var(--wit-dark-bg);
  color: var(--wit-dark-heading-1);
}

.wit-opener-value {
  cursor: text;
}

.wit-opener-background {
  position: absolute;
  top: 0.55rem;
  right: 0.65rem;
  z-index: 2;
  text-align: left;
  opacity: 0;
}

.wit-chapter-opener--title:hover .wit-opener-background,
.wit-chapter-opener--title:focus-within .wit-opener-background,
.wit-opener-background[data-open='true'] {
  opacity: 1;
}

.wit-opener-background-button,
.wit-opener-background-menu button,
.wit-opener-affix input {
  font-family: var(--wit-font-sidebar);
  font-size: 0.72rem;
}

.wit-opener-background-menu {
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0.25rem;
  background: var(--pico-background-color);
  color: var(--pico-color);
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
}

.wit-opener-affix {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin-top: 0.75rem;
  font-family: var(--wit-font-sidebar);
  font-size: 0.85rem;
}

.wit-opener-affix-value {
  font-family: var(--wit-font-editor);
  font-size: 1rem;
}

.wit-opener-affix-error {
  flex-basis: 100%;
  margin: 0;
  color: var(--pico-del-color);
}
```

The header's own font size stays the editor body size. The title span is `4.5em` of that, and the meta lines are `2em`. The affix form is a sibling of those spans, so its `0.85rem` is not multiplied by the title size. The band color is inherited by the title, the version, and the authors.

- [ ] **Step 5: Run the build and the pure tests**

Run: `npm --prefix frontend run build`

Expected: exit 0.

Run: `node --experimental-strip-types --test frontend/test/openerSidecar.test.ts frontend/test/pageStyle.test.ts`

Expected: PASS.

Run: `.venv/bin/pytest backend/tests/test_api.py -k opener -v`

Expected: PASS.

- [ ] **Step 6: Commit**

Do not run this. Hand it to the human:

```bash
git add frontend/src/api.ts frontend/src/components/TitleOpener.tsx frontend/src/components/PageEditor.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Let a title heading label its version and authors and wear a palette band.

EOF
)"
```
