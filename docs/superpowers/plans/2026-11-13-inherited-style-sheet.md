# Inherited Style Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page's frontmatter `style` map cascades down `parent` and sets the writing column's typeface, measure, chapter opening, and scene breaks.

**Architecture:** The backend cleans `style` onto each page in `GET /pages` and does not rewrite files. The client resolves the cascade from that list with a pure function, then sets attributes on `.wit-editor-surface`. The gear keeps paper and the size bump. The chapter opening is a header outside the BlockNote document, in the same scroller as the blocks.

**Tech Stack:** Python 3, FastAPI, Pydantic, python-frontmatter, pytest. React 19, TypeScript, BlockNote 0.50, existing CSS variables. Node 22.6+ built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-inherited-style-sheet-design.md`

## Global Constraints

- Sheet values, lowercase only: `typeface` is `literary`, `document`, `blog`, or `default`. `measure` is `narrow`, `book`, `wide`, or `default`. `opener` is `auto`, `chapter`, `title`, `none`, or `default`. `scene_break` is `rule`, `gap`, `ornament`, or `default`.
- `default` returns that field to app behavior. It does not select the gear preset named Default.
- Absent or `default` typeface: the gear's typeface. Absent or `default` measure: the full column. Absent, `none`, or `default` opener: no opening. Absent, `rule`, or `default` scene break: BlockNote's horizontal line.
- Column fonts: `literary` is Lora, Palatino Linotype, Palatino, Georgia, Times New Roman. `document` is IBM Plex Sans, Segoe UI, Roboto, Helvetica Neue, Arial, system-ui. `blog` is Source Serif 4, Palatino, Georgia, Times New Roman. Source Serif 4 is already loaded in `frontend/index.html`.
- Measures are max widths: `narrow` 58ch, `book` 66ch, `wide` 78ch.
- Chapter opening is centered at `1.5em` with `2em` below. Title opening is centered at `2.25em` with `2em` below. The `em` is `--wit-editor-body-font-size`.
- A gap hides the divider line and leaves `2em` of blank. An ornament is a centered `* * *` in the column font.
- Gear sentence, exact: `This book sets the typeface.`
- Gear presets stay Default, Literary, Document, and Plain. `plain` is not a sheet value. Do not write the gear's typeface, paper, or size into the file.
- `GET /pages` includes `style` as the cleaned partial map, or `null`. `GET /pages/{id}` returns frontmatter as stored. Scan does not rewrite files.
- Attributes go on `.wit-editor-surface`, never on `<html>`. An empty field sets no attribute. Do not set `data-scene-break` when the resolved value is `rule`.
- The opening is plain text, is not a block, is not saved, and is not pinnable. One scroller.
- No style form, no heading-block styling, no play-syntax styles, no continuous book view, no Typst export, no browser suite, no Vitest.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

---

### Task 1: Clean `style` onto the page list

**Files:**

- Modify: `backend/app/models.py`
- Modify: `backend/app/storage.py` (`_parse_page_file`, around lines 43–76)
- Modify: `backend/tests/test_api.py`
- Modify: `RUNBOOK.md` (the `GET /pages` bullet, around line 79)
- Test: `backend/tests/test_api.py`

**Interfaces:**

- Consumes: frontmatter `style` mapping on `*.md` files.
- Produces: `PageMeta.style: dict[str, str] | None`. JSON keys are `typeface`, `measure`, `opener`, `scene_break`. `null` when nothing valid remains. `clean_style(raw: object) -> dict[str, str] | None` in `backend/app/storage.py`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_api.py`:

```python
def test_list_returns_cleaned_style(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
tags: ["x"]
created: "2026-01-01"
style:
  typeface: literary
  measure: book
  opener: auto
  scene_break: ornament
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] == {
        "typeface": "literary",
        "measure": "book",
        "opener": "auto",
        "scene_break": "ornament",
    }
    child = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "b")
    assert child["style"] is None


def test_list_drops_bad_style_fields(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
style:
  typeface: literary
  scene_break: nope
  plain: plain
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] == {"typeface": "literary"}


def test_list_ignores_non_mapping_style(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
style: literary
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["style"] is None


def test_body_save_and_meta_patch_leave_style_on_disk(
    client: TestClient, tmp_path: Path
) -> None:
    (tmp_path / "b.md").write_text(
        """---
id: "b"
title: "Beta"
parent: "a"
style:
  typeface: blog
  scene_break: nope
---
World
""",
        encoding="utf-8",
    )
    assert client.put("/pages/b", json={"markdown_body": "Updated\n"}).status_code == 200
    assert client.patch("/pages/b/meta", json={"order": 4}).status_code == 200
    text = (tmp_path / "b.md").read_text(encoding="utf-8")
    assert "typeface: blog" in text or 'typeface: "blog"' in text
    assert "nope" in text
    detail = client.get("/pages/b").json()
    assert detail["frontmatter"]["style"]["scene_break"] == "nope"
    listed = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "b")
    assert listed["style"] == {"typeface": "blog"}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/pytest backend/tests/test_api.py::test_list_returns_cleaned_style backend/tests/test_api.py::test_list_drops_bad_style_fields backend/tests/test_api.py::test_list_ignores_non_mapping_style backend/tests/test_api.py::test_body_save_and_meta_patch_leave_style_on_disk -v`

Expected: FAIL. `page["style"]` raises `KeyError` because `PageMeta` does not yet have `style`.

- [ ] **Step 3: Implement the cleaner**

In `backend/app/models.py`, add the field to `PageMeta`:

```python
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
    style: dict[str, str] | None = None
```

In `backend/app/storage.py`, add this above `_parse_page_file`:

```python
_STYLE_VALUES: dict[str, set[str]] = {
    "typeface": {"literary", "document", "blog", "default"},
    "measure": {"narrow", "book", "wide", "default"},
    "opener": {"auto", "chapter", "title", "none", "default"},
    "scene_break": {"rule", "gap", "ornament", "default"},
}


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
```

Pass it into the `PageMeta(...)` call inside `_parse_page_file`:

```python
        style=clean_style(meta_raw.get("style")),
```

Do not change `write_page_body`, `patch_page_meta`, or `create_page`. They already dump the metadata loaded from disk.

In `RUNBOOK.md`, extend the `GET /pages` bullet with: Each page includes `style`, a cleaned partial map of `typeface`, `measure`, `opener`, and `scene_break`, or `null`. Invalid values are dropped and the file is not rewritten. `GET /pages/{id}` still returns frontmatter as stored.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/pytest backend/tests/test_api.py -v`

Expected: PASS, including the four new tests and the existing suite.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add backend/app/models.py backend/app/storage.py backend/tests/test_api.py RUNBOOK.md
git commit -m "$(cat <<'EOF'
Return a cleaned style map on the page list.

EOF
)"
```

---

### Task 2: Resolve the cascade in a pure function

**Files:**

- Create: `frontend/src/lib/pageStyle.ts`
- Create: `frontend/test/pageStyle.test.ts`
- Modify: `frontend/src/types.ts`
- Modify: `Makefile` (the `test` target)
- Test: `frontend/test/pageStyle.test.ts`

**Interfaces:**

- Consumes: `PageMeta.id`, `PageMeta.parent`, and `PageMeta.style` from Task 1. The list is already deduped.
- Produces:

```ts
export type PageStyle = {
  typeface?: string;
  measure?: string;
  opener?: string;
  scene_break?: string;
};

export type ResolvedStyle = {
  typeface: "literary" | "document" | "blog" | null;
  measure: "narrow" | "book" | "wide" | null;
  opener: "auto" | "chapter" | "title" | "none";
  scene_break: "rule" | "gap" | "ornament";
};

export function resolvePageStyle(
  pageId: string,
  pages: readonly { id: string; parent: string; style?: PageStyle | null }[],
): ResolvedStyle;

export function pageHasChildren(
  pageId: string,
  pages: readonly { parent: string }[],
): boolean;

export function openerTreatment(
  opener: ResolvedStyle["opener"],
  hasChildren: boolean,
): "chapter" | "title" | "none";
```

- [ ] **Step 1: Write the failing test**

Create `frontend/test/pageStyle.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  openerTreatment,
  pageHasChildren,
  resolvePageStyle,
} from "../src/lib/pageStyle.ts";

const book = {
  id: "book",
  parent: "",
  style: {
    typeface: "literary",
    measure: "book",
    opener: "auto",
    scene_break: "ornament",
  },
};
const chapter = { id: "ch", parent: "book", style: null };
const gap = { id: "gap", parent: "book", style: { scene_break: "gap" } };
const reset = { id: "reset", parent: "book", style: { typeface: "default" } };

test("nothing set returns app behavior", () => {
  assert.deepEqual(
    resolvePageStyle("solo", [{ id: "solo", parent: "", style: null }]),
    {
      typeface: null,
      measure: null,
      opener: "none",
      scene_break: "rule",
    },
  );
});

test("a child inherits the book", () => {
  assert.deepEqual(resolvePageStyle("ch", [book, chapter]), {
    typeface: "literary",
    measure: "book",
    opener: "auto",
    scene_break: "ornament",
  });
});

test("a child overrides one field", () => {
  const resolved = resolvePageStyle("gap", [book, gap]);
  assert.equal(resolved.scene_break, "gap");
  assert.equal(resolved.typeface, "literary");
  assert.equal(resolved.measure, "book");
  assert.equal(resolved.opener, "auto");
});

test("default clears one field and leaves the rest", () => {
  const resolved = resolvePageStyle("reset", [book, reset]);
  assert.equal(resolved.typeface, null);
  assert.equal(resolved.measure, "book");
  assert.equal(resolved.scene_break, "ornament");
});

test("a bad value is ignored and the parent value shows through", () => {
  const resolved = resolvePageStyle("bad", [
    book,
    {
      id: "bad",
      parent: "book",
      style: { typeface: "plain", scene_break: "Literary" },
    },
  ]);
  assert.equal(resolved.typeface, "literary");
  assert.equal(resolved.scene_break, "ornament");
});

test("a cycle stops", () => {
  const resolved = resolvePageStyle("a", [
    { id: "a", parent: "b", style: { typeface: "document" } },
    { id: "b", parent: "a", style: { measure: "wide" } },
  ]);
  assert.equal(resolved.typeface, "document");
  assert.equal(resolved.measure, "wide");
});

test("a missing parent stops the walk", () => {
  const resolved = resolvePageStyle("ch", [
    { id: "ch", parent: "gone", style: { typeface: "blog" } },
  ]);
  assert.equal(resolved.typeface, "blog");
  assert.equal(resolved.measure, null);
});

test("auto follows whether the page has children", () => {
  const pages = [book, chapter];
  assert.equal(pageHasChildren("book", pages), true);
  assert.equal(pageHasChildren("ch", pages), false);
  assert.equal(openerTreatment("auto", true), "title");
  assert.equal(openerTreatment("auto", false), "chapter");
  assert.equal(openerTreatment("none", true), "none");
  assert.equal(openerTreatment("title", false), "title");
  assert.equal(openerTreatment("chapter", true), "chapter");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `../src/lib/pageStyle.ts`.

- [ ] **Step 3: Write the resolver**

Create `frontend/src/lib/pageStyle.ts`:

```ts
export type PageStyle = {
  typeface?: string;
  measure?: string;
  opener?: string;
  scene_break?: string;
};

export type SheetTypeface = "literary" | "document" | "blog";
export type SheetMeasure = "narrow" | "book" | "wide";
export type SheetOpener = "auto" | "chapter" | "title" | "none";
export type SheetSceneBreak = "rule" | "gap" | "ornament";

export type ResolvedStyle = {
  typeface: SheetTypeface | null;
  measure: SheetMeasure | null;
  opener: SheetOpener;
  scene_break: SheetSceneBreak;
};

const TYPEFACES = new Set(["literary", "document", "blog", "default"]);
const MEASURES = new Set(["narrow", "book", "wide", "default"]);
const OPENERS = new Set(["auto", "chapter", "title", "none", "default"]);
const SCENE_BREAKS = new Set(["rule", "gap", "ornament", "default"]);

type StylePage = {
  id: string;
  parent: string;
  style?: PageStyle | null;
};

function accepted(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== "string" || !allowed.has(value)) {
    return undefined;
  }
  return value;
}

function ancestorChain(
  pageId: string,
  pages: readonly StylePage[],
): StylePage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const seen = new Set<string>();
  const upward: StylePage[] = [];
  let current = byId.get(pageId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    upward.push(current);
    const parentId = current.parent.trim();
    if (!parentId) {
      break;
    }
    current = byId.get(parentId);
  }
  upward.reverse();
  return upward;
}

export function resolvePageStyle(
  pageId: string,
  pages: readonly StylePage[],
): ResolvedStyle {
  const resolved: ResolvedStyle = {
    typeface: null,
    measure: null,
    opener: "none",
    scene_break: "rule",
  };
  for (const page of ancestorChain(pageId, pages)) {
    const style = page.style;
    if (!style) {
      continue;
    }
    const typeface = accepted(style.typeface, TYPEFACES);
    if (typeface === "default") {
      resolved.typeface = null;
    } else if (
      typeface === "literary" ||
      typeface === "document" ||
      typeface === "blog"
    ) {
      resolved.typeface = typeface;
    }
    const measure = accepted(style.measure, MEASURES);
    if (measure === "default") {
      resolved.measure = null;
    } else if (
      measure === "narrow" ||
      measure === "book" ||
      measure === "wide"
    ) {
      resolved.measure = measure;
    }
    const opener = accepted(style.opener, OPENERS);
    if (opener === "default" || opener === "none") {
      resolved.opener = "none";
    } else if (
      opener === "auto" ||
      opener === "chapter" ||
      opener === "title"
    ) {
      resolved.opener = opener;
    }
    const sceneBreak = accepted(style.scene_break, SCENE_BREAKS);
    if (sceneBreak === "default" || sceneBreak === "rule") {
      resolved.scene_break = "rule";
    } else if (sceneBreak === "gap" || sceneBreak === "ornament") {
      resolved.scene_break = sceneBreak;
    }
  }
  return resolved;
}

export function pageHasChildren(
  pageId: string,
  pages: readonly { parent: string }[],
): boolean {
  return pages.some((page) => page.parent.trim() === pageId);
}

export function openerTreatment(
  opener: SheetOpener,
  hasChildren: boolean,
): "chapter" | "title" | "none" {
  if (opener === "chapter" || opener === "title" || opener === "none") {
    return opener;
  }
  return hasChildren ? "title" : "chapter";
}
```

In `frontend/src/types.ts`, import the type and add the field. This file uses no semicolons.

```ts
import type { PageStyle } from "./lib/pageStyle";

export type PageMeta = {
  id: string;
  title: string;
  parent: string;
  /** Sibling order under the same parent (lower = earlier). */
  order: number;
  tags: string[];
  created: string | null;
  style: PageStyle | null;
};
```

`fetchPages` already spreads each row, so `style` passes through. Leave `normalizePageRow` as it is.

In `Makefile`, append the Node test to the `test` target:

```make
test:
	@test -x $(PYTEST) || (echo "Missing $(PYTEST). Run: make install-backend" && exit 1)
	$(PYTEST) $(BACKEND_DIR)/tests/ -v
	node --experimental-strip-types --test $(FRONTEND_DIR)/test/pageStyle.test.ts
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: PASS, 8 tests, 0 failed.

Run: `npm --prefix frontend run build`

Expected: `tsc -b` succeeds. `pageStyle.ts` has no imports, so the app build does not depend on the test file. The test file lives outside `frontend/src` and is not part of `tsconfig.app.json`.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add frontend/src/lib/pageStyle.ts frontend/src/types.ts frontend/test/pageStyle.test.ts Makefile
git commit -m "$(cat <<'EOF'
Resolve inherited page style on the client.

EOF
)"
```

---

### Task 3: Apply typeface, measure, and scene breaks

**Files:**

- Modify: `frontend/src/App.tsx` (imports, `WitSettingsMenu` around line 451, `PageEditor` around line 591)
- Modify: `frontend/src/components/PageEditor.tsx` (props around line 59, surface `div` around line 398)
- Modify: `frontend/src/components/WitSettingsMenu.tsx` (props around line 69, Style `<select>` around line 129)
- Modify: `frontend/src/index.css` (after the font-preset rules ending near line 619, and after `.wit-settings-row` near line 1577)
- Test: `npm --prefix frontend run build`

**Interfaces:**

- Consumes: `resolvePageStyle` and `ResolvedStyle` from Task 2. `pages` from `usePages().data`.
- Produces: `PageEditor` prop `sheet: ResolvedStyle | null`. `WitSettingsMenu` prop `typefaceLocked: boolean`. Surface attributes `data-sheet-typeface`, `data-sheet-measure`, and `data-scene-break`.

- [ ] **Step 1: Wire the resolved sheet from the loaded list**

In `frontend/src/App.tsx`, import `resolvePageStyle` from `./lib/pageStyle`. `App.tsx` uses double quotes and semicolons.

Inside `App`, after `const pages = useMemo(...)`:

```tsx
const sheet = useMemo(() => {
  if (!data || !resolvedSelectedId) {
    return null;
  }
  return resolvePageStyle(resolvedSelectedId, data.pages);
}, [data, resolvedSelectedId]);
```

Place this `useMemo` immediately after the `usePageNavigation(...)` call that binds `resolvedSelectedId` (around line 167). Do not call `setFontPreset` from this memo.

Pass `typefaceLocked={sheet?.typeface != null}` to `WitSettingsMenu`.

Pass `sheet={sheet}` to `PageEditor`.

- [ ] **Step 2: Disable the gear typeface control**

Add `typefaceLocked: boolean` to `WitSettingsMenu`'s `Props` and destructure it. On the Style `<select>`, set `disabled={typefaceLocked}`. Directly after that `<label>`, render:

```tsx
{
  typefaceLocked ? (
    <p className="wit-settings-note">This book sets the typeface.</p>
  ) : null;
}
```

Leave the Page Size, Accent, and Background selects enabled. Do not change `FONT_PRESET_OPTIONS`.

- [ ] **Step 3: Set the surface attributes**

Add `sheet: ResolvedStyle | null` to `PageEditor`'s `Props` and destructure it. Import `ResolvedStyle` from `../lib/pageStyle`.

On the `<div className="wit-editor-surface">`:

```tsx
    <div
      className="wit-editor-surface"
      data-sheet-typeface={sheet?.typeface ?? undefined}
      data-sheet-measure={sheet?.measure ?? undefined}
      data-scene-break={
        sheet && sheet.scene_break !== "rule" ? sheet.scene_break : undefined
      }
      onPointerDownCapture={handleEditorPointerDown}
    >
```

`sheet === null` (list not loaded, or no page selected) sets none of the attributes. Do not read `editor_overlay` for style.

- [ ] **Step 4: Add the column CSS**

Insert after the `html[data-font-preset='plain'] .bn-editor` rule (it ends near line 619). These rules come later in the file so they beat a gear preset of equal specificity. The variable is set on the surface, so the sidebar does not inherit it.

```css
.wit-editor-surface[data-sheet-typeface="literary"] {
  --wit-font-editor:
    "Lora", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
}

.wit-editor-surface[data-sheet-typeface="document"] {
  --wit-font-editor:
    "IBM Plex Sans", "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui,
    sans-serif;
}

.wit-editor-surface[data-sheet-typeface="blog"] {
  --wit-font-editor:
    "Source Serif 4", Palatino, Georgia, "Times New Roman", serif;
}

.wit-editor-surface[data-sheet-typeface] .bn-editor {
  letter-spacing: normal;
}

.wit-editor-surface[data-sheet-typeface="literary"] .bn-editor {
  line-height: 1.72;
}

.wit-editor-surface[data-sheet-typeface="document"] .bn-editor {
  line-height: 1.6;
}

.wit-editor-surface[data-sheet-typeface="blog"] .bn-editor {
  line-height: 1.7;
}

.wit-editor-surface[data-sheet-measure] .bn-editor {
  width: 100%;
  margin-inline: auto;
  box-sizing: border-box;
}

.wit-editor-surface[data-sheet-measure="narrow"] .bn-editor {
  max-width: 58ch;
}

.wit-editor-surface[data-sheet-measure="book"] .bn-editor {
  max-width: 66ch;
}

.wit-editor-surface[data-sheet-measure="wide"] .bn-editor {
  max-width: 78ch;
}

.wit-editor-surface[data-scene-break="gap"] [data-content-type="divider"] hr {
  visibility: hidden;
}

.wit-editor-surface[data-scene-break="gap"] [data-content-type="divider"] {
  min-height: 2em;
}

.wit-editor-surface[data-scene-break="ornament"] [data-content-type="divider"] {
  min-height: 2em;
  text-align: center;
  font-family: var(--wit-font-editor);
}

.wit-editor-surface[data-scene-break="ornament"]
  [data-content-type="divider"]
  hr {
  display: none;
}

.wit-editor-surface[data-scene-break="ornament"]
  [data-content-type="divider"]::after {
  content: "* * *";
}
```

After `.wit-settings-row` (near line 1577), add:

```css
.wit-settings-note {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  line-height: 1.35;
  color: var(--pico-muted-color);
}
```

Do not add rules for heading blocks. Do not change paragraph text.

- [ ] **Step 5: Typecheck**

Run: `npm --prefix frontend run build`

Expected: PASS. `tsc -b` reports no errors. The build is the check this task has. There is no component test and no browser run.

- [ ] **Step 6: Commit (human runs this)**

```bash
git add frontend/src/App.tsx frontend/src/components/PageEditor.tsx frontend/src/components/WitSettingsMenu.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Apply a page style sheet to the writing column.

EOF
)"
```

---

### Task 4: Draw the chapter opening in the block scroller

**Files:**

- Modify: `frontend/src/components/PageEditor.tsx` (scroll-root effect around line 352, surface JSX around line 398)
- Modify: `frontend/src/index.css` (the `.bn-root` / `.bn-editor` rules around lines 1427–1445, plus the measure rules from Task 3)
- Test: `npm --prefix frontend run build` and `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

**Interfaces:**

- Consumes: `sheet` from Task 3. `openerTreatment` and `pageHasChildren` from Task 2. `pages` and `pageId` already on `PageEditor`.
- Produces: `data-sheet-opener="chapter" | "title"` on `.wit-editor-surface` when an opening is shown. A `<header class="wit-chapter-opener">` portaled into `.bn-root`, outside `.bn-editor`.

- [ ] **Step 1: Choose the treatment**

In `PageEditor.tsx`, import `createPortal` from `react-dom`, and import `openerTreatment` and `pageHasChildren` from `../lib/pageStyle`.

After `sheet` is destructured:

```tsx
const openerTitle =
  pages.find((page) => page.id === pageId)?.title.trim() ?? "";
const openerKind =
  sheet === null
    ? "none"
    : openerTreatment(sheet.opener, pageHasChildren(pageId, pages));
const showOpener = openerKind !== "none" && openerTitle !== "";
```

Add `data-sheet-opener={showOpener ? openerKind : undefined}` to the surface `div`.

- [ ] **Step 2: Portal the header into `.bn-root`**

Replace the scroll-root effect so that an opening scrolls with `.bn-root`, and a page with no opening keeps scrolling `.bn-editor`. Track the host for the portal in the same effect:

```tsx
const [openerHost, setOpenerHost] = useState<HTMLElement | null>(null);

/** `.bn-editor` scrolls until an opening needs the same scroller. */
useEffect(() => {
  const editorEl = mountedEditorElement(editor);
  const host = editorEl?.closest(".bn-root");
  const scrollEl = showOpener && host instanceof HTMLElement ? host : editorEl;
  setScrollRoot(scrollEl);
  setOpenerHost(showOpener && host instanceof HTMLElement ? host : null);
  const offMount = editor.onMount(() => {
    const nextEditor = mountedEditorElement(editor);
    const nextHost = nextEditor?.closest(".bn-root");
    const nextScroll =
      showOpener && nextHost instanceof HTMLElement ? nextHost : nextEditor;
    setScrollRoot(nextScroll);
    setOpenerHost(
      showOpener && nextHost instanceof HTMLElement ? nextHost : null,
    );
  });
  const offUnmount = editor.onUnmount(() => {
    setScrollRoot(null);
    setOpenerHost(null);
  });
  return () => {
    offMount();
    offUnmount();
  };
}, [editor, showOpener]);
```

Inside the surface JSX, after the stale banner and before `PageNavButtons`:

```tsx
{
  showOpener && openerHost
    ? createPortal(
        <header
          className={`wit-chapter-opener wit-chapter-opener--${openerKind}`}
        >
          {openerTitle}
        </header>,
        openerHost,
      )
    : null;
}
```

Do not insert a BlockNote block. Do not put the title in the markdown or the sidecar. `save` stays as it is.

- [ ] **Step 3: Keep a single scroller and share the measure**

Add this CSS. When `data-sheet-opener` is set, `.bn-root` is the only scroller and `.bn-editor` grows with its content. Without that attribute, the existing `.bn-editor { overflow: auto }` rules remain.

```css
.wit-editor-surface[data-sheet-opener] .bn-root {
  display: flex;
  flex-direction: column;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.wit-editor-surface[data-sheet-opener] .bn-editor {
  height: auto;
  overflow: visible;
  flex: 1 0 auto;
}

.wit-chapter-opener {
  order: -1;
  flex-shrink: 0;
  margin: 0;
  padding-top: 2.5rem;
  padding-left: clamp(0.75rem, 3vw, 2.5rem);
  padding-right: 7.75rem;
  box-sizing: border-box;
  text-align: center;
  font-family: var(--wit-font-editor);
  color: inherit;
}

.wit-chapter-opener--chapter {
  font-size: calc(var(--wit-editor-body-font-size) * 1.5);
  margin-bottom: calc(var(--wit-editor-body-font-size) * 2);
}

.wit-chapter-opener--title {
  font-size: calc(var(--wit-editor-body-font-size) * 2.25);
  margin-bottom: calc(var(--wit-editor-body-font-size) * 2);
}

.wit-editor-surface[data-sheet-measure="narrow"] .wit-chapter-opener {
  max-width: 58ch;
}

.wit-editor-surface[data-sheet-measure="book"] .wit-chapter-opener {
  max-width: 66ch;
}

.wit-editor-surface[data-sheet-measure="wide"] .wit-chapter-opener {
  max-width: 78ch;
}

.wit-editor-surface[data-sheet-measure] .wit-chapter-opener {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}
```

The shared measure rule sets only `margin-left` and `margin-right`. It does not use the `margin` shorthand, so the `margin-bottom` on `--chapter` and `--title` stays.

- [ ] **Step 4: Typecheck and re-run the resolver tests**

Run: `npm --prefix frontend run build`

Expected: PASS.

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: PASS, 8 tests, 0 failed.

Run: `make test`

Expected: pytest PASS and the Node file PASS.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add frontend/src/components/PageEditor.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Show the page title as a chapter opening.

EOF
)"
```
