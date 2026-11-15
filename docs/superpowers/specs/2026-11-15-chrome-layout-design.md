# Chrome layout

The `wit` title leaves the header. The top bar is the page path on the left and a compact cluster on the right. The wide pages sidebar becomes a fixed icon rail. The path opens a jump menu. A tree icon on the rail swaps the column to a file tree for search and for create, rename, delete, and drag. The editor stays mounted while that tree is showing.

This replaces the chrome list and the previous/next placement in `docs/superpowers/specs/2026-11-14-hide-ui-design.md`. The Hide UI control, its storage key, and the writing column's character measure stay as that spec describes them.

## Top bar

The top bar is one row, always visible while Hide UI is off. The path is one button, left aligned. Its label is `formatPageRouteCrumb(pageTitleTrail(...))`, so a long path still keeps the first and last titles and puts `…` in the middle.

In page mode the path names the page loaded in the editor. In tree mode it names the selected tree row. When that label is empty, the button reads "No page" and does not open the menu.

The right cluster, in order:

- **Save.** The label is "Save", or "Saving…" while a save is in flight. Disabled when there is nothing to save. Shift+Cmd+Enter (Shift+Ctrl+Enter off macOS) still saves, including while the tree is showing.
- **Reload.** The visible label is "Reload". The tooltip is "Reload from markdown". Disabled under the same conditions as today.
- **Previous** and **Next** arrows. Icon buttons with the accessible names "Previous page" and "Next page". They use tree order (`adjacentPageIdsInTreeOrder`) from the page the path is showing. An arrow is disabled when that direction has no page. They are always in the bar. Scroll position does not show or hide them.

One muted status sits just left of Save. `editorStatusMessage` picks a single string, in this order: the save error text, "Markdown file changed outside the editor", "Unsaved changes", "Loading…", the link notice. Any empty value is skipped. When none apply, the slot is empty. The path gives up width before the cluster does. The status reports the mounted editor, including while the tree is showing.

The duplicate-id notice stays in its strip under the bar.

Save and Reload use the same actions as today, with tighter padding so they share the row: vertical padding `0.28rem`, horizontal padding `0.55rem`, font size `0.78rem`.

## Rail

The left rail is the current collapse rail, always shown while Hide UI is off. Its inner width stays `2rem`. From the top: the tree icon, the gear, then the pin control. Search, Save, and Reload are not on the rail.

The wide pages panel and its resize handle are gone. `wit-sidebar-open` and `wit-sidebar-width` are left as stored. This layout does not read them, write them, or delete them.

The tree icon is a toggle. Its accessible name is "Show file tree" in page mode and "Open selected page" in tree mode. `aria-pressed` is true while the column is showing the tree.

## Crumb jump menu

Clicking the path button toggles a menu anchored under the button, left-aligned with it. The menu is `20rem` wide and scrolls inside `min(24rem, 70vh)`. An outside pointer event closes the menu and ignores the path button, so that button still toggles once per click.

The menu mounts `SidebarTree` with `interaction="jump"`. Rows are the nested pages, with expand controls. The current path page is the selection. A click opens that page, closes the menu, and returns to the editor. Escape closes the menu. A pointer event outside the menu closes it. The menu has no rename, delete, create, New page, or drag.

## Column tree

App holds `columnMode`, either `"page"` or `"tree"`, in component state only. It is not written to storage. Entering tree mode from the tree icon or from ⌘K sets the selected row to the page loaded in the editor. Turning Hide UI off while the mode is already `"tree"` shows the tree again and keeps the selection it already had.

The editor and the tree occupy the same column. The editor is hidden with `display: none` only when `columnMode` is `"tree"` and Hide UI is off. It stays mounted, so its text, dirty flag, and scroll position remain. Save and Reload call that editor while it is hidden. The tree mounts when the mode is `"tree"`. While Hide UI is on, the tree is hidden too.

The column tree is search on top and `SidebarTree` with `interaction="manage"` under it. Search is the existing page-search field, including its shortcut hint. A hit sets the tree selection. Nodes stay open by default, and the tree scrolls to the selection, which is the behavior it has today.

In manage mode a click changes the selected row and leaves the column in tree mode. Double-clicking a name opens that page. The pencil still renames. Add, delete, drag, and New page stay, and their errors stay inline as they do today. A move that the tree rejects still fails the way it does today.

Create selects the new page and stays in the tree. It does not change the page loaded in the hidden editor. Rename still runs the existing rename callback, and if the selected row's id changes, the selection follows the new id. Delete stays in the tree. When the selected id is no longer in the page list, the selection becomes the editor's page if that page is still there, and otherwise the first page. Deleting the editor's page still lets the navigation hook move the editor to the first remaining page.

⌘K (Ctrl+K otherwise) sets the column mode to `"tree"` and focuses the search input (`id="wit-page-search-input"`). When the tree is already showing, the shortcut only focuses search.

## Opening a page

`openPage(id)` is the shared way back to the editor:

- When `id` is the page already loaded, set the column mode to `"page"` and skip the leave confirmation.
- Otherwise call `navigate(id)`. When that returns true, set the column mode to `"page"`. When it returns false, stay in the current mode with the same tree selection.

These call `openPage`: double-click in the manage tree, the tree icon while the tree is showing, a click in the jump menu, and either arrow. The arrow's id is the neighbor of the page the path is showing.

A click that only selects a row does not call `openPage` and does not ask about unsaved changes.

## Gear

The gear menu keeps its rows: Typeface, Size Bump, Accent, Background, Hide UI. Clicking outside still closes it.

On the rail, the panel opens to the right of the icon, top-aligned with the icon (`left: calc(100% + 0.35rem); top: 0; right: auto`), over the column.

While Hide UI is on, the gear is fixed to the viewport's top-right. The top inset is `0.85rem`. The right inset matches the top bar's right padding. The panel opens downward from that gear. Placement does not use the right cluster's height.

## Hide UI

While Hide UI is on, these are hidden, non-interactive, and out of the tab order:

- the top bar (path, status, Save, Reload, arrows)
- the rail (tree icon, gear slot, pin control)
- the duplicate-id notice
- the jump menu, which closes if it was open

The gear stays, fixed as above.

If the column mode is `"tree"` when Hide UI turns on, the editor is what shows. The mode stays `"tree"`. Turning Hide UI off shows the tree again.

⌘K does nothing while Hide UI is on.

The top bar and rail use the same 240ms `ease` collapse as the header does today. `prefers-reduced-motion: reduce` applies the end state with no duration.

## What leaves

- the `wit` heading
- the header search pill
- the wide pages sidebar and the layout resizer
- the route label that appeared only while the sidebar was closed
- the page-corner Previous Page and Next Page buttons
- the rule that hid the previous-page button while the gear menu was open
- the editor's `7.75rem` right padding that reserved room for those buttons
- the title-in-view check as a reason to hide the path

## Tests

`editorStatusMessage` lives next to the other small pure helpers. A test covers each step of the priority, an empty result when every input is clear, and skipping an empty save error so a lower-priority message can show.

`readStoredHideUi` stays as specified in the Hide UI spec.

The rest is checked in the running app:

- the path is visible with the sidebar storage unread, and a long path still shortens in the middle
- the jump menu opens, opens a page, and closes on Escape and on an outside click
- the tree icon shows the tree, a click selects, a double-click opens, and the icon opens the selection
- search selects a row and leaves the tree open
- ⌘K opens the tree and focuses search, and does nothing while Hide UI is on
- the gear panel opens to the right of the rail, and opens downward from the top-right corner while Hide UI is on
- Hide UI hides the top bar and rail, shows the editor when the tree was open, and restores that tree when Hide UI turns off
- Save works while the tree is showing
- an arrow is disabled at each end of the tree order
- cancelling the unsaved-changes confirmation stays in the tree with the same selection
