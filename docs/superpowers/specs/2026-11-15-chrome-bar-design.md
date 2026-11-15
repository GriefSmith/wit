# Chrome bar

The top bar gets shorter, and its controls get smaller. The path is text again. It shows only while the editor is on screen. Save and Reload become compact outlined buttons, and the page arrows become bare icons. The rail icons line up, the gear loses its chevron, and the tree icon changes.

This replaces the path button, the jump menu, the tree icon's return target, and the Save, Reload, and arrow styling in `docs/superpowers/specs/2026-11-15-chrome-layout-design.md`. It also replaces the Hide UI rail and gear placement in that spec and in `docs/superpowers/specs/2026-11-14-hide-ui-design.md`. The Hide UI control, its storage, the status picker, and the writing column's measure stay as those specs describe them.

## Path

The path is text, not a button. Its label is still `formatPageRouteCrumb(pageTitleTrail(...))` for the page loaded in the editor. An empty label reads "No page" in the muted color.

The path renders only while the column is showing the editor and Hide UI is off. It is absent while the file tree is open. Hide UI still hides the whole top bar, so the path is absent there too.

Save, Reload, and both arrows render with the path. They are absent in the file tree and while Hide UI is on. In the editor they act on the loaded page. The arrows use `adjacentPageIdsInTreeOrder` from that page, and an arrow is disabled only when that direction has no page.

The status text stays visible in the file tree, right-aligned in the bar. It is every string from `editorStatusMessage`: the save error, "Markdown file changed outside the editor", "Unsaved changes", "Loading…", and the link notice. Highlighting a row does not change it. The bar keeps its shorter height when the status is empty. Hide UI hides this text with the rest of the bar.

## Returning from the tree

Clicking the tree icon while the tree is open shows the page loaded in the editor. It does not open the highlighted row. The accessible name in that mode is "Show the open page". While the tree is open and no page is loaded, the icon is disabled.

A single click on a row still only highlights it. A double-click still opens that page. Create, rename, delete, drag, New page, and search stay as they are. Search still highlights a row and leaves the tree open.

The jump menu is gone. `CrumbJumpMenu` is deleted, and `SidebarTree` no longer has a jump interaction. Double-click in the manage tree still opens through `onOpen`.

## Top bar

The header padding is `0.35rem` on top and `0.3rem` on the bottom, down from `0.85rem` and `0.75rem`. The path and the cluster sit on that shorter row.

Save and Reload:

- padding `4px 10px`, font size `0.72rem`, font weight `500`
- a `1px` border in the muted border color, background transparent, text in the muted color
- corner radius `6px`
- disabled rules unchanged, at opacity `0.45`
- Save's label is "Save", or "Saving…" while a save is in flight
- Reload's label is "Reload from markdown", and its tooltip stays "Reload from markdown"

The arrows have no border, no background, and no fixed box. They are the chevrons alone, in the muted color, centered on the same line as the buttons. Hover uses the body text color. Their accessible names stay "Previous page" and "Next page".

In the editor, that status sits just left of Save.

## Rail

The rail order stays: tree icon, gear, pin. Each hit target is `2rem` square, and each icon is centered in the rail.

The gear summary drops the disclosure chevron that Pico draws with `summary::after`. The panel opens to the right of the icon.

The tree icon is a folder with two lines beneath it, drawn at `18px` with the same stroke weight as the chevrons.

## Hide UI

Hide UI hides the top bar and the duplicate-id notice. The icon rail stays visible and usable: the tree icon, the gear, and the pin control. The rail does not fade, and its icons stay in the tab order.

The gear stays in the rail. It is not portaled and not fixed to the top-right. Its panel opens to the right of the icon, the same way it does while Hide UI is off. Clicking outside still closes it.

The column follows `columnMode`. Turning Hide UI on does not swap a tree for the editor, and turning it off does not change the mode. The tree icon and ⌘K (Ctrl+K otherwise) work while Hide UI is on, including opening the tree and focusing its search.

An open pin preview still closes when Hide UI turns on. The pin control stays, so the preview can be opened again.

The header still collapses over 240ms with `ease`, and `prefers-reduced-motion: reduce` applies that end state with no duration. The writing column keeps its character measure and stays beside the rail.

## What stays

- Shift+Cmd+Enter (Shift+Ctrl+Enter off macOS) saves, including while the tree is showing and the Save button is hidden
- ⌘K (Ctrl+K otherwise) opens the tree and focuses search, including while Hide UI is on
- the editor stays mounted while the tree is showing
- the column's character measure

## Tests

Checked in the running app:

- the bar is shorter, and the path and buttons sit close to its top edge
- Save and Reload are compact, outlined, and round-cornered, and Reload reads "Reload from markdown"
- the arrows are bare icons, lined up with those buttons
- the path, Save, Reload, and the arrows show in the editor, and all four are absent in the tree and while Hide UI is on
- a status message stays visible in the tree, and Hide UI hides it
- the tree icon returns to that loaded page, and a double-click still opens the highlighted row
- the gear has no chevron, and the three rail icons share one center line
- Hide UI hides the top bar and keeps the rail, with the gear in that rail and its panel opening to the right
