# Opener Title, Book, and Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A page's own `opener` draws a title heading, a book heading, or a chapter slide, and a title heading can show that file's `version` and `authors`.

**Architecture:** The backend cleans `version`, `authors`, and the new opener words onto `GET /pages` and does not rewrite files. The client resolves `measure` and `scene_break` down `parent`, and reads `opener` from the open page only. Previous and Next pass a direction into a pure entrance function. The heading and the slide stay outside the BlockNote document.

**Tech Stack:** Python 3, FastAPI, Pydantic, python-frontmatter, pytest. React 19, TypeScript, BlockNote 0.50, existing CSS variables. Node 22.6+ built-in test runner with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-inherited-style-sheet-design.md`

## Global Constraints

- Opener values, lowercase only: `title`, `book`, `chapter`, `default`. `auto` and `none` are dropped.
- The opener value `book` and the measure value `book` are different fields.
- `default` on `measure` or `scene_break` blocks ancestors and returns that field to app behavior. `default` on `opener` is a plain page.
- Absent or `default` measure: the full column. Absent, `default`, or a dropped opener: no opening. Absent, `rule`, or `default` scene break: BlockNote's horizontal line.
- `opener`, `version`, and `authors` are read from the open page only. A child does not take them from an ancestor.
- `version` is a string, or `null` when missing, blank, or not a string. `authors` is the list of remaining names, or `null` when missing, not a list, or nothing remains. Blank names and non-strings are dropped. Names join with a comma and a space.
- Title heading: page title centered at `2.25em`, then `version`, then `authors`, in the editor body size. `2em` under the whole heading, then the body. An empty title draws no title line. Meta lines still show when present.
- Book heading: page title centered at `1.5em`, with `2em` under it, then the body. No version, no authors, and the outline crumb stays.
- The `em` is `--wit-editor-body-font-size`. The column measure applies to the heading. One scroller. The heading is plain text, is not a block, is not saved, and is not pinnable.
- While any drawn part of a title heading is inside the frame, hide `.wit-main-route-context`. Show it again once the heading has scrolled fully above the top of the frame. That crumb exists only while the sidebar is closed.
- Chapter has no heading. Previous and Next are the sidebar-tree neighbor buttons. Next scrolls to the top, then the page starts fully outside the frame on the left and moves right into place. Previous scrolls to the bottom, then the page starts fully outside the frame on the right and moves left into place. The scroll is in place before the slide. The motion is one 300ms ease-out. A page shorter than the frame has one scroll position. Reduced motion skips the slide and still lands at that top or bottom.
- Sidebar clicks, links, refresh, and browser back and forward do not slide. They keep today's scroll: the top, a linked block, or the saved position.
- `GET /pages` includes cleaned `style`, `version`, and `authors`. `GET /pages/{id}` returns frontmatter as stored. Scan, body save, and metadata patch do not rewrite those fields. New pages omit `style`, `version`, and `authors`.
- Attributes go on `.wit-editor-surface`, never on `<html>`. An empty field sets no attribute. `data-sheet-opener` is `title` or `book` only when that heading is shown. A chapter entrance does not set it. Do not set `data-scene-break` when the resolved value is `rule`.
- Gear keeps typeface, paper, and the size bump. Do not write them into the file. No style form. No control edits `version` or `authors`. No browser suite.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

---

### Task 1: Clean version, authors, and the opener words

**Files:**

- Modify: `backend/app/models.py` (`PageMeta`, around lines 8–18)
- Modify: `backend/app/storage.py` (`_STYLE_VALUES` at lines 43–47, `clean_style` at lines 50–63, `_parse_page_file` at lines 91–99)
- Modify: `backend/tests/test_api.py`
- Modify: `RUNBOOK.md` (the `GET /pages` bullet, line 79)
- Test: `backend/tests/test_api.py`

**Interfaces:**

- Consumes: frontmatter `style`, `version`, and `authors` on `*.md` files.
- Produces: `PageMeta.version: str | None` and `PageMeta.authors: list[str] | None`. `clean_version(raw: object) -> str | None` and `clean_authors(raw: object) -> list[str] | None` in `backend/app/storage.py`. `style.opener` keeps only `title`, `book`, `chapter`, and `default`.

- [ ] **Step 1: Write the failing tests**

In `test_list_returns_cleaned_style`, replace the `a.md` frontmatter and the style assertion. `opener: auto` must be dropped. Add `version` and `authors` to that file:

```python
version: "2"
authors:
  - "Ada"
  - ""
  - 3
  - "Lin"
style:
  typeface: literary
  measure: book
  opener: auto
  scene_break: ornament
```

```python
assert page["style"] == {
    "measure": "book",
    "scene_break": "ornament",
}
assert page["version"] == "2"
assert page["authors"] == ["Ada", "Lin"]
assert child["style"] is None
assert child["version"] is None
assert child["authors"] is None
```

Append:

```python
def test_list_cleans_version_and_authors(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text(
        """---
id: "a"
title: "Alpha"
parent: ""
version: 2
authors: "Ada"
style:
  opener: title
---
Hello
""",
        encoding="utf-8",
    )
    page = next(p for p in client.get("/pages").json()["pages"] if p["id"] == "a")
    assert page["version"] is None
    assert page["authors"] is None
    assert page["style"] == {"opener": "title"}


def test_create_page_omits_style_version_and_authors(
    client: TestClient, tmp_path: Path
) -> None:
    created = client.post("/pages", json={"title": "Gamma"}).json()
    text = (tmp_path / f"{created['id']}.md").read_text(encoding="utf-8")
    assert "style:" not in text
    assert "version:" not in text
    assert "authors:" not in text
```

In `test_body_save_and_meta_patch_leave_style_on_disk`, add these lines under `title` in the `b.md` body:

```python
version: " draft "
authors:
  - "Ada"
```

After the existing style assertions, add:

```python
assert detail["frontmatter"]["version"] == " draft "
assert detail["frontmatter"]["authors"] == ["Ada"]
assert "draft" in text
assert listed["version"] == "draft"
assert listed["authors"] == ["Ada"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest backend/tests/test_api.py::test_list_returns_cleaned_style backend/tests/test_api.py::test_list_cleans_version_and_authors backend/tests/test_api.py::test_create_page_omits_style_version_and_authors backend/tests/test_api.py::test_body_save_and_meta_patch_leave_style_on_disk -v`

Expected: FAIL. The list still returns `opener: auto` and has no `version` or `authors`.

- [ ] **Step 3: Implement the cleaners**

In `backend/app/models.py`, add the two fields to `PageMeta` after `style`:

```python
version: str | None = None
authors: list[str] | None = None
```

In `backend/app/storage.py`, change the opener set and add the cleaners. `create_page` stays without these keys.

```python
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
```

In `_parse_page_file`, pass the new fields into `PageMeta`:

```python
version=clean_version(meta_raw.get("version")),
authors=clean_authors(meta_raw.get("authors")),
```

In `RUNBOOK.md`, replace the `GET /pages` bullet's style sentence with:

```markdown
Each page includes `style`, a cleaned partial map of `measure`, `opener`, and `scene_break`, or `null`. Opener words are `title`, `book`, `chapter`, and `default`. `version` is a trimmed string or `null`. `authors` is the list of trimmed names or `null`. Invalid values are dropped and the file is not rewritten. `GET /pages/{id}` still returns frontmatter as stored.
```

Keep the sentences about duplicate ids and the typeface.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest backend/tests/test_api.py -v`

Expected: PASS.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add backend/app/models.py backend/app/storage.py backend/tests/test_api.py RUNBOOK.md
git commit -m "$(cat <<'EOF'
Clean version, authors, and the opener words onto the page list.

EOF
)"
```

---

### Task 2: Resolve opener on the open page, and decide the chapter entrance

**Files:**

- Modify: `frontend/src/lib/pageStyle.ts`
- Modify: `frontend/test/pageStyle.test.ts`
- Modify: `frontend/src/components/PageEditor.tsx` (the opener imports and the `openerKind` block, so the build still typechecks)
- Test: `frontend/test/pageStyle.test.ts`

**Interfaces:**

- Consumes: `PageMeta.id`, `PageMeta.parent`, and `PageMeta.style` from the page list. `version` and `authors` are not inputs.
- Produces:

```ts
export type SheetOpener = 'title' | 'book' | 'chapter'
export type ResolvedStyle = {
  measure: SheetMeasure | null
  opener: SheetOpener | null
  scene_break: SheetSceneBreak
}
export type ChapterDirection = 'next' | 'previous'
export type ChapterEntrance = {
  slide: 'from-left' | 'from-right' | null
  scroll: 'top' | 'bottom' | null
}
export function resolvePageStyle(pageId: string, pages: readonly StylePage[]): ResolvedStyle
export function chapterEntrance(opener: SheetOpener | null, direction: ChapterDirection | null): ChapterEntrance
```

Delete `openerTreatment` and `pageHasChildren`. Empty opener is `null`, not the string `none`. `PageEditor` compiles against that result. Task 3 replaces the heading contents.

- [ ] **Step 1: Replace the Node tests**

Replace `frontend/test/pageStyle.test.ts` with:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chapterEntrance, resolvePageStyle } from '../src/lib/pageStyle.ts'

const book = {
  id: 'book',
  parent: '',
  style: {
    measure: 'book',
    opener: 'title',
    scene_break: 'ornament',
  },
}
const chapter = { id: 'ch', parent: 'book', style: null }
const gap = { id: 'gap', parent: 'book', style: { scene_break: 'gap' } }
const reset = { id: 'reset', parent: 'book', style: { measure: 'default' } }
const ownChapter = { id: 'own', parent: 'book', style: { opener: 'chapter' } }

test('nothing set returns app behavior', () => {
  assert.deepEqual(resolvePageStyle('solo', [{ id: 'solo', parent: '', style: null }]), {
    measure: null,
    opener: null,
    scene_break: 'rule',
  })
})

test('a child inherits measure and scene break only', () => {
  assert.deepEqual(resolvePageStyle('ch', [book, chapter]), {
    measure: 'book',
    opener: null,
    scene_break: 'ornament',
  })
})

test('a typeface key is not part of the sheet', () => {
  const styled = { id: 'styled', parent: '', style: { typeface: 'literary', measure: 'wide' } }
  assert.deepEqual(resolvePageStyle('styled', [styled]), {
    measure: 'wide',
    opener: null,
    scene_break: 'rule',
  })
})

test('a child overrides one field and keeps its own opener', () => {
  const resolved = resolvePageStyle('gap', [book, gap])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, 'book')
  assert.equal(resolved.opener, null)
})

test('default clears measure and leaves the scene break', () => {
  const resolved = resolvePageStyle('reset', [book, reset])
  assert.equal(resolved.measure, null)
  assert.equal(resolved.scene_break, 'ornament')
  assert.equal(resolved.opener, null)
})

test('the open page keeps its own opener', () => {
  assert.equal(resolvePageStyle('own', [book, ownChapter]).opener, 'chapter')
  assert.equal(resolvePageStyle('book', [book, chapter]).opener, 'title')
})

test('default, auto, and none are no opening', () => {
  for (const opener of ['default', 'auto', 'none']) {
    assert.equal(
      resolvePageStyle('p', [{ id: 'p', parent: '', style: { opener } }]).opener,
      null,
    )
  }
})

test('a bad value is ignored and the parent value shows through', () => {
  const resolved = resolvePageStyle('bad', [
    book,
    { id: 'bad', parent: 'book', style: { measure: 'Book', scene_break: 'Literary' } },
  ])
  assert.equal(resolved.measure, 'book')
  assert.equal(resolved.scene_break, 'ornament')
  assert.equal(resolved.opener, null)
})

test('a cycle stops', () => {
  const resolved = resolvePageStyle('a', [
    { id: 'a', parent: 'b', style: { scene_break: 'gap', opener: 'book' } },
    { id: 'b', parent: 'a', style: { measure: 'wide', opener: 'title' } },
  ])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, 'wide')
  assert.equal(resolved.opener, 'book')
})

test('a missing parent stops the walk', () => {
  const resolved = resolvePageStyle('ch', [
    { id: 'ch', parent: 'gone', style: { scene_break: 'gap' } },
  ])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, null)
  assert.equal(resolved.opener, null)
})

test('chapter entrance follows the button and the destination opener', () => {
  assert.deepEqual(chapterEntrance('chapter', 'next'), {
    slide: 'from-left',
    scroll: 'top',
  })
  assert.deepEqual(chapterEntrance('chapter', 'previous'), {
    slide: 'from-right',
    scroll: 'bottom',
  })
  assert.deepEqual(chapterEntrance('title', 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('book', 'previous'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance(null, 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('chapter', null), { slide: null, scroll: null })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: FAIL. `chapterEntrance` is missing, and the resolver still returns `auto` or `none`.

- [ ] **Step 3: Replace the resolver**

Replace `frontend/src/lib/pageStyle.ts` with:

```ts
export type PageStyle = {
  measure?: string
  opener?: string
  scene_break?: string
}

export type SheetMeasure = 'narrow' | 'book' | 'wide'
export type SheetOpener = 'title' | 'book' | 'chapter'
export type SheetSceneBreak = 'rule' | 'gap' | 'ornament'

export type ResolvedStyle = {
  measure: SheetMeasure | null
  opener: SheetOpener | null
  scene_break: SheetSceneBreak
}

const MEASURES = new Set(['narrow', 'book', 'wide', 'default'])
const OPENERS = new Set(['title', 'book', 'chapter', 'default'])
const SCENE_BREAKS = new Set(['rule', 'gap', 'ornament', 'default'])

type StylePage = {
  id: string
  parent: string
  style?: PageStyle | null
}

function accepted(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== 'string' || !allowed.has(value)) {
    return undefined
  }
  return value
}

function ancestorChain(pageId: string, pages: readonly StylePage[]): StylePage[] {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const seen = new Set<string>()
  const upward: StylePage[] = []
  let current = byId.get(pageId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    upward.push(current)
    const parentId = current.parent.trim()
    if (!parentId) {
      break
    }
    current = byId.get(parentId)
  }
  upward.reverse()
  return upward
}

export function resolvePageStyle(
  pageId: string,
  pages: readonly StylePage[],
): ResolvedStyle {
  const resolved: ResolvedStyle = {
    measure: null,
    opener: null,
    scene_break: 'rule',
  }
  const chain = ancestorChain(pageId, pages)
  for (const page of chain) {
    const style = page.style
    if (!style) {
      continue
    }
    const measure = accepted(style.measure, MEASURES)
    if (measure === 'default') {
      resolved.measure = null
    } else if (measure === 'narrow' || measure === 'book' || measure === 'wide') {
      resolved.measure = measure
    }
    const sceneBreak = accepted(style.scene_break, SCENE_BREAKS)
    if (sceneBreak === 'default' || sceneBreak === 'rule') {
      resolved.scene_break = 'rule'
    } else if (sceneBreak === 'gap' || sceneBreak === 'ornament') {
      resolved.scene_break = sceneBreak
    }
  }
  const own = chain.at(-1)
  if (own?.id === pageId) {
    const opener = accepted(own.style?.opener, OPENERS)
    if (opener === 'title' || opener === 'book' || opener === 'chapter') {
      resolved.opener = opener
    }
  }
  return resolved
}

export type ChapterDirection = 'next' | 'previous'

export type ChapterEntrance = {
  slide: 'from-left' | 'from-right' | null
  scroll: 'top' | 'bottom' | null
}

export function chapterEntrance(
  opener: SheetOpener | null,
  direction: ChapterDirection | null,
): ChapterEntrance {
  if (opener !== 'chapter' || direction === null) {
    return { slide: null, scroll: null }
  }
  if (direction === 'next') {
    return { slide: 'from-left', scroll: 'top' }
  }
  return { slide: 'from-right', scroll: 'bottom' }
}
```

- [ ] **Step 4: Keep PageEditor compiling**

`PageEditor` still imports the deleted functions. Remove those imports. Replace the opener block with a title-or-book heading so `null` and `chapter` draw nothing until Task 3 adds version and authors:

```ts
const openerTitle =
  pages.find((page) => page.id === pageId)?.title.trim() ?? "";
const openerKind =
  sheet?.opener === "title" || sheet?.opener === "book" ? sheet.opener : null;
const showOpener = openerKind !== null && openerTitle !== "";
```

Leave the portal markup. `data-sheet-opener={showOpener ? openerKind : undefined}` still matches, because `openerKind` is `title`, `book`, or `null`.

- [ ] **Step 5: Run the checks**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: PASS, 11 tests, 0 failed.

Run: `npm --prefix frontend run build`

Expected: PASS.

- [ ] **Step 6: Commit (human runs this)**

```bash
git add frontend/src/lib/pageStyle.ts frontend/test/pageStyle.test.ts frontend/src/components/PageEditor.tsx
git commit -m "$(cat <<'EOF'
Resolve opener on the open page and decide the chapter entrance.

EOF
)"
```

---

### Task 3: Draw the title and book headings

**Files:**

- Modify: `frontend/src/types.ts` (`PageMeta`, lines 3–12)
- Modify: `frontend/src/components/PageEditor.tsx`
- Modify: `frontend/src/index.css` (the opener rules around lines 1511–1536)
- Test: `npm --prefix frontend run build`

**Interfaces:**

- Consumes: `ResolvedStyle.opener` as `title`, `book`, `chapter`, or `null`. `PageMeta.title`, `PageMeta.version`, and `PageMeta.authors` for the open page id.
- Produces: a heading portal when `title` or `book` has something to draw. `data-sheet-opener` is that same word only then. `chapter` and a plain page set no opener attribute.

- [ ] **Step 1: Add the list fields**

On `PageMeta` in `frontend/src/types.ts`:

```ts
version: string | null
authors: string[] | null
```

- [ ] **Step 2: Choose the heading lines in PageEditor**

Remove the imports of `openerTreatment` and `pageHasChildren`.

Replace the `openerTitle` / `openerKind` / `showOpener` block with:

```ts
const pageMeta = pages.find((page) => page.id === pageId);
const openerTitle = pageMeta?.title.trim() ?? "";
const openerVersion = pageMeta?.version?.trim() ?? "";
const openerAuthors = (pageMeta?.authors ?? [])
  .map((name) => name.trim())
  .filter((name) => name !== "");
const openerKind = sheet?.opener ?? null;
const showTitleLine =
  (openerKind === "title" || openerKind === "book") && openerTitle !== "";
const showVersion = openerKind === "title" && openerVersion !== "";
const showAuthors = openerKind === "title" && openerAuthors.length > 0;
const showOpener = showTitleLine || showVersion || showAuthors;
```

Read `version` and `authors` from that page only. Do not walk `parent`.

Set the attribute from the shown heading:

```tsx
data-sheet-opener={showOpener ? openerKind ?? undefined : undefined}
```

`chapter` fails `showOpener`, so it sets no attribute.

Replace the portal header contents. Keep the portal, the host, and the `wit-chapter-opener` box. The `2em` margin already on `.wit-chapter-opener` is the gap under the whole heading.

```tsx
<header
  className={`wit-chapter-opener wit-chapter-opener--${openerKind}`}
>
  {showTitleLine ? (
    <span className="wit-chapter-opener-title">{openerTitle}</span>
  ) : null}
  {showVersion ? (
    <span className="wit-chapter-opener-meta">{openerVersion}</span>
  ) : null}
  {showAuthors ? (
    <span className="wit-chapter-opener-meta">{openerAuthors.join(", ")}</span>
  ) : null}
</header>
```

Do not write these strings into the BlockNote document, the markdown, or the sidecar.

- [ ] **Step 3: Point the sizes at title and book**

In `frontend/src/index.css`, replace the `--chapter` title rule with a `--book` rule, and add the meta line. Leave the `2.25em` title rule and the measure caps.

```css
.wit-chapter-opener-meta {
  display: block;
  font-size: 1em;
}

.wit-chapter-opener--book .wit-chapter-opener-title {
  font-size: 1.5em;
}

.wit-chapter-opener--title .wit-chapter-opener-title {
  font-size: 2.25em;
}
```

- [ ] **Step 4: Typecheck**

Run: `npm --prefix frontend run build`

Expected: PASS.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add frontend/src/types.ts frontend/src/components/PageEditor.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Draw title and book headings from the open page.

EOF
)"
```

---

### Task 4: Hide the outline crumb while a title heading is in the frame

**Files:**

- Modify: `frontend/src/components/PageEditor.tsx` (`PageEditorHeaderState`, the header portal, the header-state effect around lines 358–377)
- Modify: `frontend/src/App.tsx` (the initial header state around lines 146–154, and the crumb at lines 591–598)
- Test: `npm --prefix frontend run build`

**Interfaces:**

- Consumes: the title heading element from Task 3, and the editor scroll root.
- Produces: `PageEditorHeaderState.titleHeadingInView: boolean`. `App` renders `.wit-main-route-context` only when the sidebar is closed, the crumb has text, and this flag is false.

- [ ] **Step 1: Report the heading intersection**

Add `titleHeadingInView: boolean` to `PageEditorHeaderState`. In `App.tsx`, initialize it to `false`.

In `PageEditor`, keep a heading element in state. Pass the callback ref only when `openerKind === "title"` and `showOpener` is true. A book heading does not take the ref.

```ts
const [titleHeadingEl, setTitleHeadingEl] = useState<HTMLElement | null>(null);
const [titleHeadingInView, setTitleHeadingInView] = useState(false);
const titleHeadingShown = showOpener && openerKind === "title";
```

```tsx
<header
  ref={titleHeadingShown ? setTitleHeadingEl : undefined}
  className={`wit-chapter-opener wit-chapter-opener--${openerKind}`}
>
```

Reset the flag when the title heading appears or disappears, then let the observer correct it:

```tsx
useEffect(() => {
  setTitleHeadingInView(titleHeadingShown);
}, [titleHeadingShown, pageId]);

useEffect(() => {
  if (!titleHeadingShown || !titleHeadingEl || !scrollRoot) {
    return;
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      setTitleHeadingInView(entry.isIntersecting);
    },
    { root: scrollRoot, threshold: 0 },
  );
  observer.observe(titleHeadingEl);
  return () => observer.disconnect();
}, [titleHeadingShown, titleHeadingEl, scrollRoot]);
```

Include `titleHeadingInView` in the object passed to `onHeaderStateChange` and in that effect's dependency list.

`root` is the editor scroller (`scrollRoot`). Intersection means any drawn part of the heading is still inside that frame. Once the heading is fully above the top, `isIntersecting` is false and the crumb returns.

- [ ] **Step 2: Hide the crumb**

In `App.tsx`, change the crumb condition:

```tsx
{!sidebarOpen && collapsedRouteLabel && !editorHeader.titleHeadingInView ? (
  <nav
    className="wit-main-route-context"
    aria-label="Current page in outline"
  >
    {collapsedRouteLabel}
  </nav>
) : null}
```

Leave the sidebar and the app header alone.

- [ ] **Step 3: Typecheck**

Run: `npm --prefix frontend run build`

Expected: PASS.

- [ ] **Step 4: Commit (human runs this)**

```bash
git add frontend/src/components/PageEditor.tsx frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
Hide the outline crumb while a title heading is in the frame.

EOF
)"
```

---

### Task 5: Slide a chapter in from Previous and Next

**Files:**

- Modify: `frontend/src/components/PageNavButtons.tsx`
- Modify: `frontend/src/components/PageEditor.tsx` (`onNavigateToPage`, `finishLoad` around lines 226–231, the surface class)
- Modify: `frontend/src/index.css`
- Test: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts` and `npm --prefix frontend run build`

**Interfaces:**

- Consumes: `chapterEntrance` from Task 2. `onNavigateToPage` is the existing `navigate` function, which returns `boolean`.
- Produces: a one-shot entrance for the page id that Previous or Next successfully opened. Other navigations pass no direction. The surface class is `wit-chapter-enter-from-left` or `wit-chapter-enter-from-right`.

- [ ] **Step 1: Pass the button direction**

Change the PageEditor prop:

```ts
onNavigateToPage: (pageId: string) => boolean;
```

`App` already passes `navigate`, which returns `boolean`. Call sites that ignore the return can stay.

In `PageNavButtons`, change `onNavigate` to `(pageId: string, direction: "next" | "previous") => void`. `goPrev` calls `onNavigate(prevId, "previous")`. `goNext` calls `onNavigate(nextId, "next")`.

In `PageEditor`, arm a ref only after the navigation succeeds:

```ts
const entranceRef = useRef<{
  pageId: string;
  direction: ChapterDirection;
} | null>(null);

const goToNeighbor = (id: string, direction: ChapterDirection) => {
  if (!onNavigateToPage(id)) {
    return;
  }
  entranceRef.current = { pageId: id, direction };
};
```

Pass `goToNeighbor` to `PageNavButtons`. In the wit-link handler that calls `onNavigateToPage(targetId)`, set `entranceRef.current = null` before that call. Sidebar clicks never touch the ref. `finishLoad` discards a ref whose `pageId` is not the page that just loaded.

- [ ] **Step 2: Land the scroll, then slide**

`scrollTo(null)` holds the top. Previous needs the bottom. `scrollTo` already clamps, so a target past the end holds the bottom while layout settles:

```ts
const BOTTOM_TARGET: ScrollTarget = {
  blockId: null,
  offset: 0,
  top: Number.MAX_SAFE_INTEGER,
};
```

In `finishLoad`, after `applyFetchedDoc` and `loadedEditorRef.current = editor`:

```ts
const pending = entranceRef.current;
entranceRef.current = null;
const entrance = chapterEntrance(
  sheet?.opener ?? null,
  pending?.pageId === pageId ? pending.direction : null,
);
scrollTo(entrance.scroll === "bottom" ? BOTTOM_TARGET : scrollTarget);
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
setChapterSlide(!reduce && entrance.slide ? entrance.slide : null);
```

`finishLoad` is a `useEffectEvent`, so it sees the current `sheet`. Add `const [chapterSlide, setChapterSlide] = useState<"from-left" | "from-right" | null>(null)`.

On the surface:

```tsx
className={
  chapterSlide
    ? `wit-editor-surface wit-chapter-enter-${chapterSlide}`
    : "wit-editor-surface"
}
onAnimationEnd={() => setChapterSlide(null)}
```

The scroll call stays before the class is set, so the page is at the top or the bottom when the motion starts. Next's `scroll: "top"` uses the existing `scrollTarget`, which is `null` for a button navigation and means the top. A short page has no room to scroll, so both landings sit still.

- [ ] **Step 3: Add the 300ms slide**

`.wit-main` already has `overflow: hidden`, so the surface can start fully outside the column. Add:

```css
@keyframes wit-chapter-from-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes wit-chapter-from-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.wit-editor-surface.wit-chapter-enter-from-left {
  animation: wit-chapter-from-left 300ms ease-out;
}

.wit-editor-surface.wit-chapter-enter-from-right {
  animation: wit-chapter-from-right 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .wit-editor-surface.wit-chapter-enter-from-left,
  .wit-editor-surface.wit-chapter-enter-from-right {
    animation: none;
  }
}
```

- [ ] **Step 4: Run the checks**

Run: `node --experimental-strip-types --test frontend/test/pageStyle.test.ts`

Expected: PASS, 11 tests, 0 failed.

Run: `npm --prefix frontend run build`

Expected: PASS.

Run: `make test`

Expected: pytest PASS and the Node file PASS.

- [ ] **Step 5: Commit (human runs this)**

```bash
git add frontend/src/components/PageNavButtons.tsx frontend/src/components/PageEditor.tsx frontend/src/index.css
git commit -m "$(cat <<'EOF'
Slide a chapter page in from Previous and Next.

EOF
)"
```
