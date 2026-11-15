# Chrome Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten the top bar, make the path plain text that shows only with the editor, restyle Save, Reload, and the arrows, and keep the whole icon rail visible during Hide UI.

**Architecture:** App decides what the bar renders. The path, Save, Reload, and the arrows render only while the editor is on screen and Hide UI is off. The status text stays in the bar during the file tree and is hidden with the bar during Hide UI. The column follows `columnMode` even while Hide UI is on. The gear stays in the rail; nothing is portaled.

**Tech Stack:** React 19, TypeScript, existing CSS. `npm --prefix frontend run build` (`tsc -b && vite build`). No component test runner.

**Spec:** `docs/superpowers/specs/2026-11-15-chrome-bar-design.md`

## Global Constraints

- The path is text, not a button. Its label is `formatPageRouteCrumb(pageTitleTrail(...))` for the page loaded in the editor. An empty label reads "No page" in the muted color.
- The path, Save, Reload, and both arrows render only while the column is showing the editor and Hide UI is off.
- In the file tree the status text stays, right-aligned. It is every string from `editorStatusMessage`. The bar keeps its height when the status is empty. Hide UI hides the status with the rest of the bar.
- Arrows use `adjacentPageIdsInTreeOrder` from the loaded editor page. An arrow is disabled only when that direction has no page.
- The tree icon, while the tree is open, shows the loaded editor page. Its accessible name is "Show the open page". It is disabled while the tree is open and no page is loaded. A row click only highlights. A double-click still opens.
- Header padding is `0.35rem` top and `0.3rem` bottom.
- Save and Reload: padding `4px 10px`, font size `0.72rem`, font weight `500`, `1px` muted border, transparent background, muted text, radius `6px`, disabled opacity `0.45`. Save's label is "Save" or "Saving…". Reload's label and tooltip are "Reload from markdown".
- Arrows are bare chevrons, muted, centered on the button line. Hover uses the body text color. Names stay "Previous page" and "Next page".
- Rail order stays tree, gear, pin. Each hit target is `2rem` square and centered. The gear has no `summary::after` chevron. Its panel opens to the right of the icon.
- The tree icon is a folder with two lines beneath it, `18px`, the same stroke weight as the chevrons.
- Hide UI hides the top bar and the duplicate-id notice. The rail stays visible and usable. The gear is not portaled and not fixed. The column follows `columnMode`. ⌘K works during Hide UI. An open pin preview still closes when Hide UI turns on.
- Shift+Cmd+Enter still saves while the tree is showing. The writing column's measure does not change.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

---

### Task 1: Editor chrome

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css` (cluster alignment only)

**Interfaces:**
- Consumes: `editorStatusMessage`, `formatPageRouteCrumb`, `pageTitleTrail`, `adjacentPageIdsInTreeOrder`, `openPage`, `resolvedSelectedId`
- Produces: the path, Save, Reload, and the arrows render only for `showEditorChrome`. The tree icon returns to `resolvedSelectedId`. `CrumbJumpMenu` is no longer imported.

- [ ] **Step 1: Drop the jump-menu state**

Delete the `CrumbJumpMenu` import. Delete `crumbMenuOpen`, `setCrumbMenuOpen`, and `crumbButtonRef`. Delete `closeCrumbMenu`. Delete every `setCrumbMenuOpen(...)` call inside `openPage`, `showTree`, and the ⌘K effect.

Replace the path id and the arrow ids. The arrows always come from the loaded page:

```tsx
const showEditorChrome = columnMode === "page" && !hideUi;
const crumbText = formatPageRouteCrumb(
  pageTitleTrail(pages, resolvedSelectedId),
);
const { prevId, nextId } = resolvedSelectedId
  ? adjacentPageIdsInTreeOrder(pages, resolvedSelectedId)
  : { prevId: null, nextId: null };
```

Delete `pathPageId`. Leave `treeVisible` as `columnMode === "tree" && !hideUi` until Task 4.

- [ ] **Step 2: Return to the loaded page**

```tsx
const onTreeIcon = useCallback(() => {
  if (columnMode === "tree") {
    if (resolvedSelectedId) {
      openPage(resolvedSelectedId);
    }
    return;
  }
  showTree();
}, [columnMode, openPage, resolvedSelectedId, showTree]);
```

On the tree button, set `aria-label` to `columnMode === "tree" ? "Show the open page" : "Show file tree"` and `disabled={columnMode === "tree" && !resolvedSelectedId}`.

- [ ] **Step 3: Render the path as text**

Replace the inside of `wit-app-header-clip`:

```tsx
{showEditorChrome ? (
  <div className="wit-crumb">
    <span
      className="wit-crumb-button"
      data-empty={crumbText.length === 0 ? "true" : "false"}
    >
      {crumbText.length === 0 ? "No page" : crumbText}
    </span>
  </div>
) : null}
<div className="wit-crumb-cluster">
  {statusText ? (
    <small className="wit-muted wit-crumb-status">{statusText}</small>
  ) : null}
  {showEditorChrome ? (
    <>
      <button
        type="button"
        className="wit-crumb-action"
        disabled={!canSave}
        title="Save (Shift+Cmd+Enter)"
        onClick={() => void editorRef.current?.save()}
      >
        {editorHeader.saving ? "Saving…" : "Save"}
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
        onClick={() => goArrow(prevId, "previous")}
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        className="wit-crumb-arrow"
        disabled={!nextId}
        aria-label="Next page"
        onClick={() => goArrow(nextId, "next")}
      >
        <ChevronRightIcon />
      </button>
    </>
  ) : null}
</div>
```

The Reload label stays "Reload" until Task 3. The header clip stays `inert={hideUi}`.

- [ ] **Step 4: Keep the status on the right**

In `frontend/src/index.css`, add `margin-left: auto` to `.wit-crumb-cluster`. Add:

```css
.wit-crumb-button[data-empty="true"] {
  color: var(--pico-muted-color);
}
```

- [ ] **Step 5: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 6: Hand off the commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "Show the path and page actions only in the editor."
```

---

### Task 2: Remove the jump menu

**Files:**
- Delete: `frontend/src/components/CrumbJumpMenu.tsx`
- Modify: `frontend/src/components/SidebarTree.tsx`
- Modify: `frontend/src/components/ColumnTree.tsx` (drop `interaction="manage"`)
- Modify: `frontend/src/index.css` (delete `.wit-crumb-menu` and the `.wit-crumb-menu .wit-tree-wrap` rules)

**Interfaces:**
- Consumes: nothing
- Produces: `SidebarTree` has no `interaction` prop. `onOpen` stays. Double-click calls `onOpen` when it is passed, and otherwise renames.

- [ ] **Step 1: Delete the menu**

Delete `frontend/src/components/CrumbJumpMenu.tsx`. Delete the `.wit-crumb-menu` rule. In the grouped selector, delete the two `.wit-crumb-menu ...` lines and keep the `.wit-column-tree` lines.

- [ ] **Step 2: Remove the jump interaction**

In `SidebarTree.tsx`, delete the `interaction` and its default. Keep `onOpen`. Row double-click:

```tsx
onDoubleClick={(e) => {
  e.stopPropagation()
  if (onOpen) {
    onOpen(node.id)
    return
  }
  setRenameForId(node.id)
}}
```

Render the rename, add-child, and delete buttons unconditionally. Render `wit-sidebar-tree-actions` unconditionally. The `useCallback` dependency list loses `interaction` and keeps `onOpen` and `onSelect`.

On `<Tree>`, delete `disableDrag`, `disableDrop`, and `onActivate`. `onSelect` loses the jump check:

```tsx
onSelect={(nodes) => {
  const id = nodes[0]?.id
  if (!id || id === selectedId) {
    return
  }
  if (onSelect(id) === false && selectedId) {
    queueMicrotask(() => treeRef.current?.select(selectedId, { focus: false }))
  }
}}
```

In `ColumnTree.tsx`, delete `interaction="manage"`.

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 4: Hand off the commit**

```bash
git add frontend/src/components/CrumbJumpMenu.tsx frontend/src/components/SidebarTree.tsx frontend/src/components/ColumnTree.tsx frontend/src/index.css
git commit -m "Remove the page jump menu."
```

`git add` of the deleted file stages the deletion.

---

### Task 3: Bar and rail styling

**Files:**
- Modify: `frontend/src/App.tsx` (Reload label, `TreeIcon`)
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: the markup from Task 1
- Produces: the compact buttons, bare arrows, shorter bar, centered gear, and folder icon described in the spec

- [ ] **Step 1: Change the Reload label and the tree icon**

The Reload button text becomes `Reload from markdown`. The `title` stays `Reload from markdown`.

Replace `TreeIcon`:

```tsx
function TreeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5h6l2 2h10v6H3V5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 17h18M3 21h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Shorten the bar and restyle the controls**

Set `.wit-app-header` padding to `0.35rem` top and `0.3rem` bottom.

Replace `.wit-crumb-action` with:

```css
.wit-crumb-action {
  margin: 0;
  padding: 4px 10px;
  min-height: 0;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  border: 1px solid var(--pico-muted-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--pico-muted-color);
  box-shadow: none;
}

.wit-crumb-action:disabled {
  opacity: 0.45;
}
```

Remove `.wit-crumb-action.secondary` from the blue-fill selector. Reload is outlined, like Save.

Replace `.wit-crumb-arrow` with:

```css
.wit-crumb-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  margin: 0;
  padding: 0 0.15rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--pico-muted-color);
  box-shadow: none;
}

.wit-crumb-arrow:hover:not(:disabled) {
  color: inherit;
}
```

`color: inherit` is the body text. `var(--pico-color)` is white inside a Pico button.

- [ ] **Step 3: Center the gear**

Change `.wit-app-settings-summary` width and height from `2.2rem` to `2rem`. Add:

```css
.wit-app-settings-summary::after {
  display: none;
}
```

Leave `.wit-app-settings--rail .wit-app-settings-panel` as it is (`left: calc(100% + 0.35rem); top: 0; right: auto`).

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 5: Hand off the commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "Tighten the top bar and the rail icons."
```

---

### Task 4: Hide UI keeps the rail

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/WitSettingsMenu.tsx`
- Modify: `frontend/src/components/PageSearch.tsx`
- Modify: `frontend/src/components/ColumnTree.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `columnMode`, `hideUi`, `showEditorChrome` from Task 1
- Produces: a rail that stays visible during Hide UI, a column that follows `columnMode`, and ⌘K that works while Hide UI is on

- [ ] **Step 1: Let the column follow the mode**

In `App.tsx`:

```tsx
const treeVisible = columnMode === "tree";
```

Remove `inert={hideUi}` from `.wit-sidebar-collapse-rail`.

On `.wit-column-tree-slot`, delete `data-hidden`. The slot only mounts when `columnMode === "tree"`.

In the focus-search effect, delete the `hideUi` check and drop `hideUi` from the dependency array.

In the ⌘K effect, delete the `if (hideUi) return` guard and drop `hideUi` from the dependency array.

- [ ] **Step 2: Let search work during Hide UI**

In `PageSearch.tsx`, delete the effect that calls `setOpen(false)` when `hideUi` is true. Delete `hideUi` from the props type and the destructure.

In `ColumnTree.tsx`, delete the `hideUi` prop and stop passing it to `PageSearch`. In `App.tsx`, stop passing `hideUi` to `ColumnTree`.

- [ ] **Step 3: Keep the gear in the rail**

In `WitSettingsMenu.tsx`, delete the `createPortal` import and the `useLayoutEffect` import. Delete the `place` effect. The `<details>` class is always `wit-app-settings wit-app-settings--rail`. Return `menu` directly. The outside-click effect no longer depends on a portal remount; its dependency array is `[]`. Keep the `hideUi` prop for the checkbox.

- [ ] **Step 4: Stop hiding the rail**

Delete these rules:

```css
html[data-hide-ui="on"] .wit-sidebar-collapse-rail {
  opacity: 0;
  pointer-events: none;
}
```

```css
html[data-hide-ui="on"] .wit-app-settings {
  position: fixed;
  z-index: 40;
  margin: 0;
}
```

Leave the header collapse, the duplicate-id collapse, and the `prefers-reduced-motion` list. Leave the effect that closes `previewPin` when `hideUi` becomes true.

- [ ] **Step 5: Build and run the existing tests**

Run: `npm --prefix frontend run build`

Expected: exit 0.

Run: `node --experimental-strip-types --test frontend/test/editorStatus.test.ts frontend/test/hideUi.test.ts`

Expected: PASS.

- [ ] **Step 6: Check the running app**

With `npm --prefix frontend run dev` already running, confirm:

- The bar is shorter. In the editor, the path is text, Save and Reload are compact outlined buttons with `6px` corners, Reload reads "Reload from markdown", and the arrows are bare icons on the same line.
- Opening the tree hides the path, Save, Reload, and both arrows. A status message, when there is one, stays on the right. Highlighting a row does not bring the buttons back.
- The tree icon returns to the page that was loaded, not the highlighted row. A double-click still opens the highlighted row. The icon is disabled in the tree when no page is loaded.
- The gear has no chevron. The tree icon, gear, and pin sit on one center line. The gear panel opens to the right.
- Hide UI hides the top bar and leaves the rail. The gear stays in the rail and its panel opens to the right. A tree that was open stays open. ⌘K opens the tree and focuses search. The column measure is unchanged.

- [ ] **Step 7: Hand off the commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css frontend/src/components/WitSettingsMenu.tsx frontend/src/components/PageSearch.tsx frontend/src/components/ColumnTree.tsx
git commit -m "Keep the icon rail visible while Hide UI is on."
```
