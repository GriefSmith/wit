# Chrome Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `wit` header and the wide pages sidebar with a path bar, a fixed icon rail, a crumb jump menu, and a column file tree that hides the editor without unmounting it.

**Architecture:** `editorStatusMessage` is a pure picker for the one status string. `SidebarTree` gains `interaction: "manage" | "jump"`. App owns `columnMode` (`"page"` or `"tree"`, memory only) and the tree selection. The editor stays mounted and is hidden with `display: none` while the tree is on screen. Save, Reload, and the chapter-slide neighbor navigation keep calling that mounted editor.

**Tech Stack:** React 19, TypeScript, existing CSS, `react-arborist` 3. Node's built-in test runner (`node --experimental-strip-types --test`). No component test runner.

**Spec:** `docs/superpowers/specs/2026-11-15-chrome-layout-design.md`

## Global Constraints

- The top bar is one row while Hide UI is off. The path is one left-aligned button. Its label is `formatPageRouteCrumb(pageTitleTrail(...))`. An empty label reads `No page` and does not open the menu.
- In page mode the path names the editor page. In tree mode it names the selected tree row. The status reports the mounted editor in both modes.
- Right cluster order: Save (`Save` / `Saving…`), Reload (visible label `Reload`, tooltip `Reload from markdown`), previous arrow (`Previous page`), next arrow (`Next page`).
- Save and Reload padding is `0.28rem` vertical and `0.55rem` horizontal, font size `0.78rem`. Shift+Cmd+Enter (Shift+Ctrl+Enter off macOS) still saves, including while the tree is showing.
- Arrows use `adjacentPageIdsInTreeOrder` from the page the path is showing. They are always in the bar. An arrow is disabled only when that direction has no page. Scroll position does not show or hide them. Title openers no longer hide the previous arrow (`showPreviousPage` is not used).
- One status, via `editorStatusMessage`, in this order: save error text, `Markdown file changed outside the editor`, `Unsaved changes`, `Loading…`, the link notice. Empty values are skipped.
- The rail is the current collapse rail, inner width `2rem`, always shown while Hide UI is off. Top to bottom: tree icon, gear, pin control. Search, Save, and Reload are not on the rail.
- `wit-sidebar-open` and `wit-sidebar-width` are not read, written, or deleted.
- `columnMode` is `"page"` or `"tree"` and is not stored. The tree icon and ⌘K set the selection to the editor page when they enter tree mode. Turning Hide UI off while the mode is already `"tree"` keeps the existing selection.
- The editor is `display: none` only when `columnMode` is `"tree"` and Hide UI is off. It stays mounted. The tree mounts when the mode is `"tree"` and is hidden the whole time Hide UI is on.
- Manage tree: click selects, double-click opens, pencil renames, add / delete / drag / New page stay. Create selects the new page and does not change the hidden editor page. Rename follows the existing rename callback and the selection id. A deleted selection falls back to the editor page if it still exists, otherwise the first page.
- Jump menu: `20rem` wide, scrolls inside `min(24rem, 70vh)`, left-aligned under the path. Click opens the page and closes the menu. Escape closes it. An outside pointer event closes it and ignores the path button. No rename, delete, create, New page, or drag.
- `openPage` calls `navigate`. `navigate` already returns true for the loaded page without the leave confirmation, and false when the confirmation is cancelled. A true result sets `columnMode` to `"page"`. A false result stays in the current mode with the same tree selection. Row selection does not call `openPage`.
- Arrows call the editor's `openNeighbor` so a chapter page still slides. They then set `columnMode` to `"page"` only when that returns true.
- Gear rows stay: Typeface, Size Bump, Accent, Background, Hide UI. On the rail the panel uses `left: calc(100% + 0.35rem); top: 0; right: auto`. While Hide UI is on, the gear is fixed with top inset `0.85rem` and the top bar's right padding as the right inset. Placement does not use the right cluster's height. Clicking outside still closes it.
- Hide UI hides the top bar, the rail, the duplicate-id notice, and the jump menu (close it if open). The gear stays. An open pin preview still closes. ⌘K does nothing. 240ms `ease`. `prefers-reduced-motion: reduce` has no duration.
- ⌘K (Ctrl+K otherwise) sets tree mode and focuses `#wit-page-search-input`. When the tree is already showing, it only focuses search.
- The writing column's character measure is unchanged.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

## File structure

- `frontend/src/lib/editorStatus.ts` — `editorStatusMessage`. No React.
- `frontend/test/editorStatus.test.ts` — Node tests for that picker.
- `frontend/src/components/SidebarTree.tsx` — `interaction` and `onOpen`. Same create / rename / delete / drag implementation.
- `frontend/src/components/ColumnTree.tsx` — search field plus a manage tree. Mounted by App.
- `frontend/src/components/CrumbJumpMenu.tsx` — the path popover and a jump tree.
- `frontend/src/components/PageSearch.tsx` — input id. The document shortcut moves to App.
- `frontend/src/components/PageEditor.tsx` — `openNeighbor` on the handle. Page-corner buttons removed.
- `frontend/src/components/PageNavButtons.tsx` — deleted. Nothing else imports it.
- `frontend/src/components/WitSettingsMenu.tsx` — rail class, and Hide UI placement without the cluster offset.
- `frontend/src/App.tsx` — top bar, rail, column mode, menus, shortcut.
- `frontend/src/index.css` — top bar, column panes, jump menu, rail gear, Hide UI, removal of the page-corner padding.
- `docs/superpowers/specs/2026-11-14-hide-ui-design.md` — one pointer at the top. The Hide UI control, storage, and measure text stay.

---

### Task 1: Status message

**Files:**
- Create: `frontend/src/lib/editorStatus.ts`
- Test: `frontend/test/editorStatus.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:

```ts
export type EditorStatusInput = {
  saveError: string | null
  overlayStale: boolean
  dirty: boolean
  loading: boolean
  witLinkNotice: string | null
}

export function editorStatusMessage(input: EditorStatusInput): string | null
```

- [x] **Step 1: Write the failing test**

Create `frontend/test/editorStatus.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { editorStatusMessage, type EditorStatusInput } from '../src/lib/editorStatus.ts'

const clear: EditorStatusInput = {
  saveError: null,
  overlayStale: false,
  dirty: false,
  loading: false,
  witLinkNotice: null,
}

test('editorStatusMessage is empty when every input is clear', () => {
  assert.equal(editorStatusMessage(clear), null)
})

test('editorStatusMessage follows the status priority and skips empties', () => {
  assert.equal(
    editorStatusMessage({ ...clear, saveError: 'disk full', dirty: true, loading: true }),
    'disk full',
  )
  assert.equal(
    editorStatusMessage({ ...clear, saveError: '', overlayStale: true, dirty: true }),
    'Markdown file changed outside the editor',
  )
  assert.equal(
    editorStatusMessage({ ...clear, dirty: true, loading: true, witLinkNotice: 'linked' }),
    'Unsaved changes',
  )
  assert.equal(
    editorStatusMessage({ ...clear, loading: true, witLinkNotice: 'linked' }),
    'Loading…',
  )
  assert.equal(editorStatusMessage({ ...clear, witLinkNotice: 'linked' }), 'linked')
  assert.equal(editorStatusMessage({ ...clear, witLinkNotice: '' }), null)
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test frontend/test/editorStatus.test.ts`

Expected: FAIL, cannot find module `../src/lib/editorStatus.ts`.

- [x] **Step 3: Write the picker**

Create `frontend/src/lib/editorStatus.ts`:

```ts
export type EditorStatusInput = {
  saveError: string | null
  overlayStale: boolean
  dirty: boolean
  loading: boolean
  witLinkNotice: string | null
}

export function editorStatusMessage(input: EditorStatusInput): string | null {
  if (input.saveError) {
    return input.saveError
  }
  if (input.overlayStale) {
    return 'Markdown file changed outside the editor'
  }
  if (input.dirty) {
    return 'Unsaved changes'
  }
  if (input.loading) {
    return 'Loading…'
  }
  if (input.witLinkNotice) {
    return input.witLinkNotice
  }
  return null
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `node --experimental-strip-types --test frontend/test/editorStatus.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Hand off the commit**

Do not run git commit. Give the human:

```bash
git add frontend/src/lib/editorStatus.ts frontend/test/editorStatus.test.ts
git commit -m "Add a single editor status message."
```

---

### Task 2: Tree interaction modes

**Files:**
- Modify: `frontend/src/components/SidebarTree.tsx`

**Interfaces:**
- Consumes: existing `SidebarTree` props (`pages`, `selectedId`, `onSelect`, `onStructureChange`, `onPageCreated`, `onPageRenamed`, `onPageDeleted`, `unsavedPageId`)
- Produces: optional props `interaction?: "manage" | "jump"` (default `"manage"`) and `onOpen?: (id: string) => void`. Existing callers omit both, so the sidebar's current double-click still renames.

- [x] **Step 1: Add the props**

On the `Props` type:

```ts
  /** `manage` edits the tree. `jump` only opens a page. */
  interaction?: 'manage' | 'jump'
  /** Manage mode: double-click opens this page instead of renaming. */
  onOpen?: (id: string) => void
```

Destructure with `interaction = 'manage'` and `onOpen`.

- [x] **Step 2: Change the row**

In the row renderer, label double-click:

```tsx
onDoubleClick={(e) => {
  e.stopPropagation()
  if (interaction === 'jump') {
    onSelect(node.id)
    return
  }
  if (onOpen) {
    onOpen(node.id)
    return
  }
  setRenameForId(node.id)
}}
```

Render the rename, add-child, and delete buttons only when `interaction === 'manage'`. Add `interaction`, `onOpen`, and `onSelect` to that `useCallback` dependency list.

Render the `New page` button (`wit-sidebar-tree-actions`) only when `interaction === 'manage'`.

On `<Tree>`, add:

```tsx
disableDrag={interaction === 'jump'}
disableDrop={interaction === 'jump'}
```

- [x] **Step 3: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0. The current sidebar still renames on double-click because App does not pass `onOpen`.

- [ ] **Step 4: Hand off the commit**

Do not run git commit. Give the human:

```bash
git add frontend/src/components/SidebarTree.tsx
git commit -m "Let the page tree open pages or jump without editing."
```

---

### Task 3: Neighbor navigation on the editor handle

**Files:**
- Modify: `frontend/src/components/PageEditor.tsx` (the handle type, `goToNeighbor`, `useImperativeHandle`)

**Interfaces:**
- Consumes: `onNavigateToPage(pageId: string): boolean` and `ChapterDirection`
- Produces: `PageEditorHandle.openNeighbor(id: string, direction: ChapterDirection): boolean`. The page-corner buttons still call the same function until Task 5 removes them.

- [ ] **Step 1: Return whether navigation happened**

Replace `goToNeighbor` with:

```tsx
const openNeighbor = useCallback(
  (id: string, direction: ChapterDirection): boolean => {
    if (!onNavigateToPage(id)) {
      return false
    }
    entranceRef.current = { pageId: id, direction }
    return true
  },
  [onNavigateToPage],
)
```

Point `PageNavButtons`'s `onNavigate` at `(id, direction) => { openNeighbor(id, direction) }`.

- [ ] **Step 2: Expose it**

Add to `PageEditorHandle`:

```ts
openNeighbor: (id: string, direction: ChapterDirection) => boolean
```

Add `openNeighbor` to the `useImperativeHandle` object and to its dependency array. Import `ChapterDirection` only if it is not already in scope in that file (it is used by the current `goToNeighbor`).

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 4: Hand off the commit**

Do not run git commit. Give the human:

```bash
git add frontend/src/components/PageEditor.tsx
git commit -m "Expose neighbor navigation on the editor handle."
```

---

### Task 4: Search input id

**Files:**
- Modify: `frontend/src/components/PageSearch.tsx` (the search `<input>`)

**Interfaces:**
- Consumes: nothing new
- Produces: the search input's `id` is `wit-page-search-input`. The component's own ⌘K listener stays until Task 5 removes it.

- [ ] **Step 1: Set the id**

On the search `<input>`, add `id="wit-page-search-input"`.

- [ ] **Step 2: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 3: Hand off the commit**

Do not run git commit. Give the human:

```bash
git add frontend/src/components/PageSearch.tsx
git commit -m "Give page search a stable input id."
```

---

### Task 5: Chrome

This task is the layout switch. After it, the running app matches the spec. Do Task 1–4 first.

**Files:**
- Create: `frontend/src/components/ColumnTree.tsx`
- Create: `frontend/src/components/CrumbJumpMenu.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/PageEditor.tsx` (remove `PageNavButtons`)
- Delete: `frontend/src/components/PageNavButtons.tsx`
- Modify: `frontend/src/components/PageSearch.tsx` (remove the document shortcut)
- Modify: `frontend/src/components/WitSettingsMenu.tsx`
- Modify: `frontend/src/index.css`
- Modify: `docs/superpowers/specs/2026-11-14-hide-ui-design.md` (pointer only)

**Interfaces:**
- Consumes: `editorStatusMessage`, `SidebarTree` `interaction` / `onOpen`, `PageEditorHandle.openNeighbor`, `#wit-page-search-input`, `navigate(id): boolean`, `adjacentPageIdsInTreeOrder`, `formatPageRouteCrumb`, `pageTitleTrail`
- Produces: the chrome described in the spec. No new exports for later tasks.

- [ ] **Step 1: Add the column tree**

Create `frontend/src/components/ColumnTree.tsx`:

```tsx
import { PageSearch } from './PageSearch'
import { SidebarTree } from './SidebarTree'
import type { PageMeta } from '../types'

type Props = {
  pages: PageMeta[]
  selectedId: string | null
  hideUi: boolean
  unsavedPageId: string | null
  onSelect: (id: string) => void
  onOpen: (id: string) => void
  onStructureChange: () => void | Promise<void>
  onPageCreated: (id: string) => void
  onPageRenamed: (previousId: string, nextId: string) => void
  onPageDeleted: (deletedId: string) => void
}

export function ColumnTree({
  pages,
  selectedId,
  hideUi,
  unsavedPageId,
  onSelect,
  onOpen,
  onStructureChange,
  onPageCreated,
  onPageRenamed,
  onPageDeleted,
}: Props) {
  return (
    <div className="wit-column-tree">
      <PageSearch pages={pages} onSelect={onSelect} hideUi={hideUi} />
      <SidebarTree
        pages={pages}
        selectedId={selectedId}
        interaction="manage"
        onSelect={onSelect}
        onOpen={onOpen}
        onStructureChange={onStructureChange}
        onPageCreated={onPageCreated}
        onPageRenamed={onPageRenamed}
        onPageDeleted={onPageDeleted}
        unsavedPageId={unsavedPageId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Add the jump menu**

Create `frontend/src/components/CrumbJumpMenu.tsx`:

```tsx
import { useEffect, useRef } from 'react'

import { SidebarTree } from './SidebarTree'
import type { PageMeta } from '../types'

type Props = {
  pages: PageMeta[]
  selectedId: string | null
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onOpen: (id: string) => boolean | void
  onClose: () => void
}

export function CrumbJumpMenu({
  pages,
  selectedId,
  anchorRef,
  onOpen,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Node)) {
        return
      }
      if (menuRef.current?.contains(target)) {
        return
      }
      if (anchorRef.current?.contains(target)) {
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [anchorRef, onClose])

  return (
    <div className="wit-crumb-menu" ref={menuRef} role="menu" aria-label="Pages">
      <SidebarTree
        pages={pages}
        selectedId={selectedId}
        interaction="jump"
        onSelect={(id) => onOpen(id)}
        onStructureChange={() => {}}
      />
    </div>
  )
}
```

Use `import type { RefObject } from 'react'` if the file's React namespace does not include `RefObject`. Match the import style of `PageSearch.tsx` (named type imports).

- [ ] **Step 3: Move ⌘K to App**

In `PageSearch.tsx`, delete the `useEffect` that listens for meta/ctrl+K and focuses the input. Keep the effect that closes the result list when `hideUi` is true. The shortcut hint `<kbd>` stays.

- [ ] **Step 4: Remove the page-corner buttons**

In `PageEditor.tsx`, remove the `PageNavButtons` import and the `<PageNavButtons ... />` element. Remove the `showPreviousPage` import if nothing else in the file uses it. Keep `openNeighbor` on the handle.

Delete `frontend/src/components/PageNavButtons.tsx`.

- [ ] **Step 5: Replace the App chrome**

In `App.tsx`:

Remove `PageSearch` from the header import list and import `ColumnTree`, `CrumbJumpMenu`, `editorStatusMessage`, and `adjacentPageIdsInTreeOrder`. Keep `formatPageRouteCrumb` and `pageTitleTrail`.

Delete `SIDEBAR_OPEN_KEY`, `SIDEBAR_WIDTH_KEY`, the width constants, `readSidebarWidth`, `readSidebarOpen`, `sidebarWidthMax`, and every effect and pointer handler that reads or writes them (`sidebarOpen`, `sidebarWidthPx`, the resize ref, the window resize clamp, the resizer pointer handlers). Delete `ChevronDownIcon`. Add `ChevronLeftIcon` as the mirror of `ChevronRightIcon` (`M15 6l-6 6 6 6`). Add `TreeIcon`:

```tsx
function TreeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18M12 8h7M12 16H5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

Add state:

```tsx
const [columnMode, setColumnMode] = useState<'page' | 'tree'>('page')
const [treeSelectionId, setTreeSelectionId] = useState<string | null>(null)
const [crumbMenuOpen, setCrumbMenuOpen] = useState(false)
const [focusSearch, setFocusSearch] = useState(false)
const crumbButtonRef = useRef<HTMLButtonElement>(null)
```

Delete `collapsedRouteLabel`. The path id and label:

```tsx
const treeVisible = columnMode === 'tree' && !hideUi
const pathPageId = treeVisible ? treeSelectionId : resolvedSelectedId
const crumbText = formatPageRouteCrumb(pageTitleTrail(pages, pathPageId))
const { prevId, nextId } = pathPageId
  ? adjacentPageIdsInTreeOrder(pages, pathPageId)
  : { prevId: null, nextId: null }
const statusText = editorStatusMessage({
  saveError: editorHeader.saveError,
  overlayStale: editorHeader.overlayStale,
  dirty: editorHeader.dirty,
  loading: editorHeader.loading,
  witLinkNotice: editorHeader.witLinkNotice,
})
```

`adjacentPageIdsInTreeOrder` returns `{ prevId, nextId }` (see `frontend/src/lib/tree.ts`). Use those names.

Handlers:

```tsx
const openPage = useCallback(
  (id: string) => {
    if (!navigate(id)) {
      return false
    }
    setColumnMode('page')
    setCrumbMenuOpen(false)
    return true
  },
  [navigate],
)

const showTree = useCallback(() => {
  setTreeSelectionId(resolvedSelectedId)
  setColumnMode('tree')
  setCrumbMenuOpen(false)
}, [resolvedSelectedId])

const onTreeIcon = useCallback(() => {
  if (columnMode === 'tree') {
    if (treeSelectionId) {
      openPage(treeSelectionId)
    }
    return
  }
  showTree()
}, [columnMode, openPage, showTree, treeSelectionId])

const goArrow = useCallback(
  (id: string | null, direction: 'next' | 'previous') => {
    if (!id) {
      return
    }
    const opened = editorRef.current?.openNeighbor(id, direction) ?? navigate(id)
    if (opened) {
      setColumnMode('page')
      setCrumbMenuOpen(false)
    }
  },
  [navigate],
)
```

Create stays in the tree. Replace the `onPageCreated={navigate}` wiring with:

```tsx
const handlePageCreated = useCallback((id: string) => {
  setTreeSelectionId(id)
}, [])
```

Extend `handlePageRenamed` so the selection follows the new id:

```tsx
setTreeSelectionId((current) => (current === previousId ? nextId : current))
```

After a delete, repair a missing selection. Add:

```tsx
useEffect(() => {
  if (columnMode !== 'tree') {
    return
  }
  if (treeSelectionId && pages.some((p) => p.id === treeSelectionId)) {
    return
  }
  const editorStillThere =
    resolvedSelectedId !== null && pages.some((p) => p.id === resolvedSelectedId)
  setTreeSelectionId(editorStillThere ? resolvedSelectedId : (pages[0]?.id ?? null))
}, [columnMode, pages, resolvedSelectedId, treeSelectionId])
```

Close the menu and focus search:

```tsx
useEffect(() => {
  if (hideUi) {
    setCrumbMenuOpen(false)
  }
}, [hideUi])

useEffect(() => {
  if (!focusSearch || columnMode !== 'tree' || hideUi) {
    return
  }
  document.getElementById('wit-page-search-input')?.focus()
  setFocusSearch(false)
}, [columnMode, focusSearch, hideUi])

useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (hideUi) {
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setTreeSelectionId(resolvedSelectedId)
      setColumnMode('tree')
      setCrumbMenuOpen(false)
      setFocusSearch(true)
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [hideUi, resolvedSelectedId])
```

Keep the existing Hide UI effect that sets `data-hide-ui` and the effect that clears `previewPin`. Keep the save shortcut effect.

Replace the `<header>` contents. The header element and `wit-app-header` / `wit-app-header-clip` classes stay, so Hide UI still collapses that row. Inside the clip:

```tsx
<header className="container wit-app-header">
  <div className="wit-app-header-clip" inert={hideUi}>
    <div className="wit-crumb">
      <button
        type="button"
        ref={crumbButtonRef}
        className="wit-crumb-button"
        disabled={crumbText.length === 0}
        aria-expanded={crumbMenuOpen}
        aria-haspopup="menu"
        onClick={() => {
          if (crumbText.length === 0) {
            return
          }
          setCrumbMenuOpen((open) => !open)
        }}
      >
        {crumbText.length === 0 ? 'No page' : crumbText}
      </button>
      {crumbMenuOpen ? (
        <CrumbJumpMenu
          pages={pages}
          selectedId={pathPageId}
          anchorRef={crumbButtonRef}
          onOpen={openPage}
          onClose={() => setCrumbMenuOpen(false)}
        />
      ) : null}
    </div>
    <div className="wit-crumb-cluster">
      {statusText ? (
        <small className="wit-muted wit-crumb-status">{statusText}</small>
      ) : null}
      <button
        type="button"
        className="wit-crumb-action"
        disabled={!canSave}
        title="Save (Shift+Cmd+Enter)"
        onClick={() => void editorRef.current?.save()}
      >
        {editorHeader.saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        className="wit-crumb-action secondary"
        disabled={!canReloadFromMarkdown}
        title="Reload from markdown"
        onClick={() => void editorRef.current?.reloadFromMarkdown()}
      >
        Reload
      </button>
      <button
        type="button"
        className="wit-crumb-arrow"
        disabled={!prevId}
        aria-label="Previous page"
        onClick={() => goArrow(prevId, 'previous')}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="wit-crumb-arrow"
        disabled={!nextId}
        aria-label="Next page"
        onClick={() => goArrow(nextId, 'next')}
      >
        <ChevronRightIcon />
      </button>
    </div>
  </div>
</header>
```

There is no `<h1>wit</h1>` and no header `PageSearch`.

Keep the duplicate-id `<article>` under the header, still `inert={hideUi}`.

Replace the layout body. Delete the `<aside className="wit-sidebar">` and the resizer. The rail is always rendered:

```tsx
<div className="wit-layout-outer">
  <div className="wit-layout">
    <main className="wit-main">
      <div className="wit-sidebar-collapse-rail" aria-label="Sidebar controls" inert={hideUi}>
        <button
          type="button"
          className="wit-sidebar-float-toggle"
          aria-label={columnMode === 'tree' ? 'Open selected page' : 'Show file tree'}
          aria-pressed={columnMode === 'tree'}
          onClick={onTreeIcon}
        >
          <TreeIcon />
        </button>
        <WitSettingsMenu
          accent={accent}
          onAccentChange={setAccent}
          typeface={typeface}
          onTypefaceChange={setTypeface}
          sizeBump={sizeBump}
          onSizeBumpChange={setSizeBump}
          bgTheme={bgTheme}
          onBgThemeChange={setBgTheme}
          hideUi={hideUi}
          onHideUiChange={setHideUi}
        />
        <WitCollapsedPinControl pages={pages} onPreviewPin={openPinPreview} />
      </div>
      <div className="wit-main-body">
        <div
          className="wit-editor-mount"
          data-hidden={columnMode === 'tree' && !hideUi ? 'true' : 'false'}
        >
          <PageEditor
            ref={editorRef}
            pageId={resolvedSelectedId}
            editorSession={editorSession}
            pages={pages}
            sheet={sheet}
            colorScheme={colorScheme}
            onNavigateToPage={navigate}
            onHeaderStateChange={setEditorHeader}
            scrollTarget={scrollTarget}
            onScrollAnchorChange={recordAnchor}
          />
        </div>
        {columnMode === 'tree' ? (
          <div className="wit-column-tree-slot" data-hidden={hideUi ? 'true' : 'false'}>
            <ColumnTree
              pages={pages}
              selectedId={treeSelectionId}
              hideUi={hideUi}
              unsavedPageId={editorHeader.dirty ? resolvedSelectedId : null}
              onSelect={setTreeSelectionId}
              onOpen={openPage}
              onStructureChange={handleStructureChange}
              onPageCreated={handlePageCreated}
              onPageRenamed={handlePageRenamed}
              onPageDeleted={handlePageDeleted}
            />
          </div>
        ) : null}
      </div>
    </main>
    <PinnedBlockPreviewModal
      pin={previewPin}
      pages={pages}
      colorScheme={colorScheme}
      onClose={closePinPreview}
      onOpenInPage={openPinInPage}
    />
  </div>
</div>
```

`onSelect={setTreeSelectionId}` matches `(id: string) => void`. `SidebarTree`'s `onSelect` may return `boolean | void`; returning void leaves the new row selected.

- [ ] **Step 6: Place the gear**

In `WitSettingsMenu.tsx`, set the `<details>` class to `wit-app-settings wit-app-settings--rail` when `hideUi` is false, and `wit-app-settings` when `hideUi` is true (the portaled gear).

In the Hide UI `place` function, delete the `centerOffset` measurement. Set:

```ts
el.style.top = '0.85rem'
el.style.right = `${Math.max(0, window.innerWidth - rect.right + pad)}px`
```

Keep measuring `.wit-app-header` for `rect` and its right padding. The header is the top bar, including while Hide UI has collapsed its height.

- [ ] **Step 7: CSS**

Add to `frontend/src/index.css`:

```css
.wit-crumb {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.wit-crumb-button {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.2rem 0;
  border: none;
  background: transparent;
  box-shadow: none;
  text-align: left;
  font: inherit;
  font-family: var(--wit-font-sidebar);
  color: var(--pico-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.wit-crumb-button:disabled {
  cursor: default;
  color: var(--pico-muted-color);
}

.wit-crumb-cluster {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem;
  flex: 0 0 auto;
  min-width: 0;
}

.wit-crumb-status {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.78rem;
  line-height: 1.2;
}

.wit-crumb-action {
  margin: 0;
  padding: 0.28rem 0.55rem;
  min-height: 0;
  font-size: 0.78rem;
  line-height: 1.2;
}

.wit-crumb-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin: 0;
  padding: 0;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
  background: transparent;
  color: var(--pico-muted-color);
  box-shadow: none;
}

.wit-crumb-menu {
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.35rem);
  left: 0;
  width: 20rem;
  max-height: min(24rem, 70vh);
  overflow: auto;
  padding: 0.4rem;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
  background: var(--pico-dropdown-background-color, var(--pico-background-color));
}

.wit-editor-mount,
.wit-column-tree-slot {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.wit-editor-mount[data-hidden='true'],
.wit-column-tree-slot[data-hidden='true'] {
  display: none;
}

.wit-column-tree {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 1rem 1rem;
}

.wit-column-tree .wit-page-search {
  flex: 0 0 auto;
  max-width: 28rem;
  margin: 0 0 0.75rem;
}

.wit-column-tree .wit-tree-wrap,
.wit-column-tree .wit-tree-viewport,
.wit-crumb-menu .wit-tree-wrap,
.wit-crumb-menu .wit-tree-viewport {
  flex: 1 1 auto;
  min-height: 0;
}

.wit-app-settings--rail .wit-app-settings-panel {
  left: calc(100% + 0.35rem);
  top: 0;
  right: auto;
}
```

The header clip is already `display: flex; align-items: center; justify-content: space-between`. The crumb grows and the cluster stays on the right.

Delete these, which only served the page-corner buttons:

- `.wit-page-nav` and every `.wit-page-nav-btn` rule, including `html.wit-settings-open .wit-page-nav-btn--prev` and `html[data-hide-ui="on"] .wit-page-nav-btn--prev`
- the `padding-right: 7.75rem` declaration on `.wit-editor-surface .bn-editor`, and the comment above it about reserving space for the page nav chips

Leave the `.wit-sidebar` and `.wit-layout-resizer` rules in the file. Nothing renders them. Do not change the column measure rules (`58ch`, `66ch`, `78ch`).

Hide UI already collapses `.wit-app-header`, fades `.wit-sidebar-collapse-rail`, and hides `.wit-app > article.contrast`. Those selectors still match this layout. The gear's fixed positioning rule stays.

- [ ] **Step 8: Point the Hide UI spec at this one**

Under the title in `docs/superpowers/specs/2026-11-14-hide-ui-design.md`, add:

```markdown
The chrome list and the previous/next placement in this spec are replaced by `docs/superpowers/specs/2026-11-15-chrome-layout-design.md`. The Hide UI control, its storage, and the writing column's measure stay as written here.
```

- [ ] **Step 9: Build and run the status test**

Run: `npm --prefix frontend run build`

Expected: exit 0.

Run: `node --experimental-strip-types --test frontend/test/editorStatus.test.ts frontend/test/hideUi.test.ts`

Expected: PASS.

- [ ] **Step 10: Check the running app**

Start the dev server with `npm --prefix frontend run dev` and confirm:

- The path is visible with the editor open. A long path keeps the first title, `…`, and the last title. `No page` does not open a menu.
- Save and Reload sit on the right of the path, then the two arrows. An arrow is disabled at each end of the tree order. A chapter page still slides when an arrow opens it.
- One status shows, and a save error wins over "Unsaved changes".
- The jump menu opens under the path, opens a page, and closes on Escape and on an outside click. The path button itself toggles once per click.
- The rail is the tree icon, the gear, and the pin control. The gear panel opens to the right of the icon.
- The tree icon shows the tree. A click selects and leaves the tree up. Search does the same and scrolls the row into view. Double-click and the tree icon open the selected page. ⌘K opens the tree and focuses search.
- New page selects the new row and leaves the editor's page loaded until that row is opened. Cancelling the unsaved-changes confirmation stays in the tree with the same selection.
- Hide UI hides the top bar and the rail, shows the editor when the tree was open, and brings that tree back with the same selection. The gear sits at the top-right and its panel opens downward. ⌘K does nothing. The column's character measure is unchanged.
- `localStorage` keys `wit-sidebar-open` and `wit-sidebar-width` are still present after using the new chrome.

- [ ] **Step 11: Hand off the commit**

Do not run git commit. Give the human:

```bash
git add frontend/src/App.tsx frontend/src/index.css frontend/src/components/ColumnTree.tsx frontend/src/components/CrumbJumpMenu.tsx frontend/src/components/PageEditor.tsx frontend/src/components/PageSearch.tsx frontend/src/components/WitSettingsMenu.tsx frontend/src/components/PageNavButtons.tsx docs/superpowers/specs/2026-11-14-hide-ui-design.md
git commit -m "Move page navigation into the path bar and the column tree."
```

`git add` of a deleted `PageNavButtons.tsx` stages the deletion.
