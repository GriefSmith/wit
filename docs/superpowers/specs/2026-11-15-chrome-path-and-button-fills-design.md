# Chrome path and button fills

The path uses the route-context muted color. Reload is a steel-blue filled button on every background. Save stays outlined on System and fills with the selected accent on a named background.

This replaces the path color and the Save and Reload fill in `docs/superpowers/specs/2026-11-15-chrome-bar-design.md`. Padding, type size, weight, radius, labels, tooltips, disabled opacity, arrows, status text, and when the controls show stay as that spec describes them.

## Path

`.wit-crumb-path` sets `color` to `var(--pico-muted-color)`, the same value `.wit-main-route-context` uses. That applies when the path names a page and when it reads "No page". The empty-only color rule is removed.

That variable is `#5c574e` on the paper theme, `#8a8580` on the default dark theme, and the active palette's `--wit-dark-muted` on a named background.

## Buttons

Save carries `data-action="save"`. Reload carries `data-action="reload"`. No new state. `data-bg-theme` and `data-accent` on `<html>` already select the colors. System removes `data-bg-theme`. A named background sets it. Named backgrounds force the dark scheme.

Reload, on every background, including System in light and in dark:

- fill and border `#3d5688`
- label `#f7f4eb` (`--wit-paper`)
- enabled hover moves the fill and border to `#4a679c` and leaves the label

Save, while `data-bg-theme` is absent:

- the outlined button from the chrome bar spec: transparent background, a `1px` border in `var(--pico-muted-border-color)`, and a label in `var(--pico-muted-color)`
- no hover fill

Save, under `html[data-bg-theme]`:

- fill and border `var(--pico-primary-background)`
- label `var(--pico-primary-inverse)`
- enabled hover moves the fill and border to `var(--pico-primary-hover-background)` and leaves the label

Those tokens are the dark accent pair. With the Default accent the fill is `#3f4a5c`, the hover fill is `#4b576b`, and the label is white. With Pine the fill is `#1f6a44` and the hover fill is `#287a52`.

The border stays `1px`. Disabled stays opacity `0.45` on both buttons. Hover does not apply while a button is disabled. Focus rings stay as they are.

## What stays

- the arrows, their muted color, and their hover
- the status line
- "Save", "Saving…", and "Reload from markdown", and both tooltips
- the path, Save, Reload, and the arrows show in the editor, and all four are absent in the tree and while Hide UI is on

## Tests

Checked in the running app:

- the path uses `var(--pico-muted-color)` when it names a page and when it reads "No page"
- on System, in light and in dark, Reload's fill and border are `#3d5688` and its label is `#f7f4eb`, and Save stays outlined
- on a named background, Reload is unchanged
- on a named background with the Default accent, Save's fill is `#3f4a5c`, its label is white, and an enabled hover fill is `#4b576b`
- on a named background with Pine, Save's fill is `#1f6a44` and an enabled hover fill is `#287a52`
- an enabled Reload hover moves the fill and border to `#4a679c`
- a disabled Save or Reload stays at opacity `0.45` and does not take the hover fill
- the arrows, the status line, the labels, and the tooltips are unchanged
- the path, Save, Reload, and the arrows are absent in the tree and while Hide UI is on
