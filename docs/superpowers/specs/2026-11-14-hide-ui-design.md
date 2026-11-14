# Hide UI

The gear menu gains a Hide UI toggle. While it is on, the app chrome leaves the screen and the writing column eases into the center. The column keeps the measure the open page already resolved (`narrow` 58ch, `book` 66ch, `wide` 78ch, or the uncapped column when no measure is resolved). The page stays editable.

## Control

Hide UI is the last row in the gear menu, under Background. The label is "Hide UI". The control is a checkbox. The row uses the same grid as the other gear rows.

App owns a boolean, read once at startup and written whenever it changes. The storage key is `wit-hide-ui`. The stored value `"1"` means on. `"0"`, a missing key, and any other string mean off.

While the flag is on, `<html>` carries `data-hide-ui="on"`. While it is off, that attribute is absent. The saved sidebar open flag and the saved sidebar width are not changed.

## What leaves

These are hidden, non-interactive, and out of the tab order:

- the header title
- page search (`.wit-page-search`). Its keyboard shortcut does not open search while Hide UI is on
- the save cluster (Save, Reload from markdown, and the status lines)
- the duplicate-id notice
- the pages sidebar and its resize handle, when they are mounted
- the sidebar rail, including the show-pages button and the collapsed pin control
- the route label (`.wit-main-route-context`)

If a pin preview is open when Hide UI turns on, it closes.

The gear stays. It is fixed to the viewport's top-right, in the same corner it occupies in the header, and its menu still opens and closes from there. Choosing Hide UI again is how the chrome comes back. Clicking outside the menu still closes it. While the menu is open, the previous-page button stays hidden, as it does today.

Previous and Next stay on the page. Previous moves down so it sits under the gear instead of sharing that corner. Next stays at the bottom-right.

Typing, block handles, the chapter opener menu, and the stale-markdown notice stay.

## Motion

The sidebar slot and the header height ease together for 240ms with `ease`. The text column is centered in the main area, so it glides toward the middle as the sidebar slot shrinks. Its max width in `ch` does not change.

When the sidebar was open, it stays mounted. Its used width animates from the current pixel width to zero. Overflow is clipped for the whole transition. When Hide UI turns off, that width animates back to the stored pixel width.

When the sidebar was already closed, there is no sideways move. The header and the rail fade, and the column stays where it is.

`prefers-reduced-motion: reduce` applies the same end state with no duration.

## Tests

`readStoredHideUi` is a pure reader next to the other appearance readers. A test covers `"1"` (on), `"0"` (off), a missing key (off), and any other string (off).

The motion and the chrome list are checked in the running app: turn the toggle on and off, reload while it is on, confirm the previous sidebar width returns, and confirm the column's character measure does not change.
