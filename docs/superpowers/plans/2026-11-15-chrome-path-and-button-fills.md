# Chrome Path and Button Fills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color the path with the route-context muted color, fill Reload with steel blue on every background, and fill Save with the selected accent only on a named background.

**Architecture:** Two attributes on the existing buttons, `data-action="save"` and `data-action="reload"`. Color stays in CSS. System is the absence of `data-bg-theme` on `<html>`. A named background sets that attribute and already forces the dark scheme, so Save's fill uses the dark accent tokens.

**Tech Stack:** React 19, TypeScript, existing CSS. `npm --prefix frontend run build` (`tsc -b && vite build`). No component test runner. The spec checks these colors in the running app.

**Spec:** `docs/superpowers/specs/2026-11-15-chrome-path-and-button-fills-design.md`

## Global Constraints

- `.wit-crumb-path` sets `color` to `var(--pico-muted-color)`, the same value `.wit-main-route-context` uses. That applies when the path names a page and when it reads "No page". The empty-only color rule is removed.
- That variable is `#5c574e` on the paper theme, `#8a8580` on the default dark theme, and the active palette's `--wit-dark-muted` on a named background.
- Save carries `data-action="save"`. Reload carries `data-action="reload"`. No new state.
- System removes `data-bg-theme`. A named background sets it. Named backgrounds force the dark scheme.
- Reload, on every background, including System in light and in dark: fill and border `#3d5688`, label `#f7f4eb` (`--wit-paper`). Enabled hover moves the fill and border to `#4a679c` and leaves the label.
- Save, while `data-bg-theme` is absent: transparent background, a `1px` border in `var(--pico-muted-border-color)`, and a label in `var(--pico-muted-color)`. No hover fill.
- Save, under `html[data-bg-theme]`: fill and border `var(--pico-primary-background)`, label `var(--pico-primary-inverse)`. Enabled hover moves the fill and border to `var(--pico-primary-hover-background)` and leaves the label.
- With the Default accent the fill is `#3f4a5c`, the hover fill is `#4b576b`, and the label is white. With Pine the fill is `#1f6a44` and the hover fill is `#287a52`.
- The border stays `1px`. Disabled stays opacity `0.45`. Hover does not apply while a button is disabled. Focus rings stay as they are.
- The arrows, their muted color, and their hover stay. The status line stays. "Save", "Saving…", and "Reload from markdown", and both tooltips, stay.
- The path, Save, Reload, and the arrows show in the editor, and all four are absent in the tree and while Hide UI is on.
- Padding, type size, weight, and radius stay as the chrome bar spec describes them.
- Do not run `git commit` or `git push`. The commit blocks are for the human.

---

### Task 1: Path color

**Files:**
- Modify: `frontend/src/index.css` (`.wit-crumb-path` and `.wit-crumb-path[data-empty="true"]`)

**Interfaces:**
- Consumes: `.wit-main-route-context`'s `color: var(--pico-muted-color)`
- Produces: `.wit-crumb-path` uses that same color for a named page and for "No page". The `data-empty` attribute on the span stays.

- [ ] **Step 1: Use the route-context color for every path**

In `frontend/src/index.css`, replace the path rules with:

```css
.wit-crumb-path {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  text-align: left;
  font: inherit;
  line-height: 1.2;
  font-family: var(--wit-font-sidebar);
  color: var(--pico-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Delete this rule. Do not delete the `data-empty` attribute in `App.tsx`.

```css
.wit-crumb-path[data-empty="true"] {
  color: var(--pico-muted-color);
}
```

Leave `.wit-crumb-action`, `.wit-crumb-arrow`, and the focus rings unchanged in this task.

- [ ] **Step 2: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 3: Check the path in the running app**

With `npm --prefix frontend run dev` already running, open the editor and read the computed `color` on `.wit-crumb-path` and on `.wit-main-route-context`. They match.

- Background System, OS light: `#5c574e`
- Background System, OS dark: `#8a8580`
- A named background, such as Forest: that palette's `--wit-dark-muted` (Forest is `#7d9178`)
- A page path and the "No page" label use the same color
- Save and Reload are still outlined. This task does not fill them.

- [ ] **Step 4: Hand off the commit**

```bash
git add frontend/src/index.css
git commit -m "Use the route-context muted color for the path."
```

---

### Task 2: Save and Reload fills

**Files:**
- Modify: `frontend/src/App.tsx` (the Save and Reload buttons)
- Modify: `frontend/src/index.css` (after `.wit-crumb-action:disabled`)

**Interfaces:**
- Consumes: the outlined `.wit-crumb-action` rule from the chrome bar. `data-bg-theme` is already set in `App.tsx`: removed for System, set for a named background. `data-accent` is removed for Default and set for a named accent. `data-theme` is `dark` whenever the background is named.
- Produces: `data-action="save"` and `data-action="reload"` on the two buttons. Reload is steel blue on every background. Save fills only under `html[data-bg-theme]`.

- [ ] **Step 1: Name the two buttons**

In `frontend/src/App.tsx`, add one attribute to each button. Leave the handlers, labels, titles, and disabled expressions as they are.

```tsx
<button
  type="button"
  className="wit-crumb-action"
  data-action="save"
  disabled={!canSave}
  title="Save (Shift+Cmd+Enter)"
  onClick={() => void editorRef.current?.save()}
>
  {editorHeader.saving ? "Saving…" : "Save"}
</button>
<button
  type="button"
  className="wit-crumb-action"
  data-action="reload"
  disabled={!canReloadFromMarkdown}
  title="Reload from markdown"
  onClick={() => void editorRef.current?.reloadFromMarkdown()}
>
  Reload from markdown
</button>
```

`canSave` is false on a clean page. `canReloadFromMarkdown` is false while loading, saving, or after a load error.

- [ ] **Step 2: Fill Reload, and fill Save only on a named background**

Keep the existing `.wit-crumb-action` and `.wit-crumb-action:disabled` rules. Keep the focus-visible rule. After `.wit-crumb-action:disabled`, add:

```css
.wit-crumb-action[data-action="reload"] {
  background: #3d5688;
  border-color: #3d5688;
  color: var(--wit-paper);
}

.wit-crumb-action[data-action="reload"]:hover:not(:disabled) {
  background: #4a679c;
  border-color: #4a679c;
  color: var(--wit-paper);
}

html[data-bg-theme] .wit-crumb-action[data-action="save"] {
  background: var(--pico-primary-background);
  border-color: var(--pico-primary-background);
  color: var(--pico-primary-inverse);
}

html[data-bg-theme] .wit-crumb-action[data-action="save"]:hover:not(:disabled) {
  background: var(--pico-primary-hover-background);
  border-color: var(--pico-primary-hover-background);
  color: var(--pico-primary-inverse);
}
```

`--wit-paper` is `#f7f4eb`. Do not add a hover rule for outlined Save. Pico's hover only changes custom properties, and the outlined button sets a concrete `background` and `border-color`, so System Save stays outlined on hover.

Do not change `.wit-crumb-arrow` or `.wit-crumb-status`.

- [ ] **Step 3: Build**

Run: `npm --prefix frontend run build`

Expected: exit 0.

- [ ] **Step 4: Check the buttons in the running app**

With `npm --prefix frontend run dev` already running, read computed `background-color`, `border-color`, and `color`.

- Background System, OS light and OS dark: Reload's fill and border are `#3d5688` and its label is `#f7f4eb`. Save's fill is transparent, its border is `var(--pico-muted-border-color)`, and its label is `var(--pico-muted-color)`. Hovering Save does not fill it.
- A named background, Default accent: Reload is unchanged. Save's fill is `#3f4a5c`, its label is `#fff`, and hovering an enabled Save moves the fill to `#4b576b`.
- The same named background, Pine accent: Save's fill is `#1f6a44` and an enabled hover fill is `#287a52`. The label stays white.
- Hovering an enabled Reload moves the fill and border to `#4a679c` and leaves the label `#f7f4eb`.
- On a clean page, Save is disabled: opacity `0.45`, and hovering it does not apply the hover fill. While a save is in flight and the label reads "Saving…", Reload is disabled: opacity `0.45`, and hovering it leaves the fill at `#3d5688`.
- The focus ring on either button is still `2px solid var(--pico-primary, #3d5a4a)`, offset `2px`.
- The path color from Task 1 is unchanged. The arrows, the status line, "Save" / "Saving…", "Reload from markdown", and both tooltips are unchanged.
- Opening the tree hides the path, Save, Reload, and both arrows. Hide UI hides them too.

- [ ] **Step 5: Hand off the commit**

```bash
git add frontend/src/App.tsx frontend/src/index.css
git commit -m "Fill Reload with steel blue and Save with the accent."
```
