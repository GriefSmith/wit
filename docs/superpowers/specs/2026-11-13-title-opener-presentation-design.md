# Title opener presentation

A `title` opening keeps the page title as a centered header, at twice today's size, with the version line and each author line doubled to match. That page shows no Previous Page control, and the heading uses the width that control used to reserve. A sliders icon on the heading opens a menu styled like the gear menu. The menu sets the heading's background and whether the version line and the authors line are visible. Those choices live in an opener sidecar for the page on screen. The markdown file, its frontmatter, and the editor sidecar stay as they are.

A `book` opening stays the centered title at `1.5em`. A `chapter` opening is unchanged. Neither gains the menu, a band, or a hidden Previous Page control.

## Size and the previous-page control

The title header is `4.5em`. The version line and each author line are `2em`. Both sizes are relative to the opener's body size, which is the editor body size. Today's title header is `2.25em` and those lines are body size, so each is doubled. The `2em` gap under the heading stays.

A page whose resolved opener is `title` does not render Previous Page, including when the heading draws nothing and including when the page has a parent. The heading's right padding matches its left padding. Next Page stays at the bottom of the scroller and still appears when the scroll position is at the bottom. The outline crumb still hides while any drawn part of the title heading is inside the frame.

## Heading menu

The control is a sliders icon at the top right of the title header. It is always visible, and it opens a dropdown with the same rows and selects as the gear menu. A click outside the menu closes it.

The rows are:

- **Background.** None, Forest, Steppe, Mountain, Ocean, Dune, Wasteland. None clears the band. System is not a choice.
- **Version.** Visible or Hidden. The row is there only when the page has a version to show, including one inherited from a title ancestor.
- **Authors.** Visible or Hidden. The row is there only when the page has authors to show, including inherited ones.

A hidden line is not drawn. Hiding a line does not change the version string or the author names in the markdown. The header stays on screen while the page has a title, a version, or authors, so the icon remains reachable after both lines are hidden. A title page with none of those has no header and no menu.

Choosing a value writes the sidecar at once and does not mark the manuscript dirty. The select shows the stored value. A failed write leaves the stored value in place and shows a short error in the menu.

## Sidecar

The file is `{pages_root}/.wit/opener/{id}.json`, beside `{pages_root}/.wit/editor/{id}.json`. A missing file means both lines are visible and there is no band. Visibility belongs to the page on screen: an inherited version or author list can be hidden here without changing the ancestor.

```json
{
  "hidden": { "version": true, "authors": true },
  "background": { "kind": "palette", "name": "ocean" }
}
```

`hidden` lists the lines that are hidden. A line that is visible is omitted, and `hidden` itself is omitted when nothing is hidden. `background` is omitted when the heading has no band. When a write leaves the document empty, the file is deleted.

A visibility change sends `hidden` and omits `background`. A palette choice sends `background` and omits `hidden`. A key that is absent stays on disk, including a key this version does not read. An older file may still contain `labels`; those bytes stay, and nothing draws them.

## Heading background

A chosen palette paints the title header only, the same centered measure column the header already occupies. It uses that palette's dark background and dark heading color for the title, the version, and the authors, including when the page is light. The menu keeps the app's colors. On a band, the sliders icon uses that palette's muted color and lightens on hover. The rest of the page keeps the gear's background.

`background` is a tagged object. This version writes only `{ "kind": "palette", "name": "<one of the six>" }`. A texture or an image would be another `kind` later. This version does not paint or write those kinds.

A `GET` returns a palette it recognizes. An unrecognized `kind` is omitted from the response and left in the file. A visibility write sends `hidden` only, so the server leaves `background` untouched. A palette write sends `background` only, so the server leaves `hidden` untouched. `background: null` clears the band. Any `kind` other than `palette` on a background write is rejected, and the file is not changed.

## API

`GET /pages/{id}/opener` returns the cleaned object. A missing file returns `{}`. A missing page is 404. A file that is not valid JSON is treated as `{}` and is not rewritten or deleted. `hidden` contains only `version` and `authors`, and only where the stored value is `true`. Any other key or value is omitted. An unrecognized `background.kind` is omitted. Keys this version does not read, including `labels`, are omitted. The file is not rewritten.

`PUT /pages/{id}/opener` merges. The body must include `hidden`, `background`, or both. A key that is absent stays as it is on disk. `hidden` replaces the hidden map. Its keys are `version` and `authors`, each with a boolean value, and a `false` entry is dropped. `background` is either `null` or `{ "kind": "palette", "name": "<one of the six, stored in lowercase>" }`. A failed check, including a body that sends only `labels`, writes nothing and returns 400. A missing page is 404.

The stored palette names are `forest`, `steppe`, `mountain`, `ocean`, `dune`, and `wasteland`.

Renaming a page moves the opener file with the same replace the editor sidecar already uses. Deleting a page deletes the opener file. Deleting the editor overlay leaves the opener file in place. A body save leaves it in place.

## Tests

`cleanOpenerDocument` is a pure function. It gets a Node test file, and `make test` runs it with the existing page-style tests. The cases are: a missing or non-object document read as empty, a palette kept, an unknown kind or palette name omitted, a line hidden only for a literal `true`, and leftover `labels` ignored.

Pytest covers: get of a missing file, get dropping an unknown kind and a non-`true` hidden entry while leaving the file bytes unchanged, put of `hidden` leaving the background and any unread keys in place, put of a palette leaving `hidden` in place, `background: null` clearing the band, a rejected palette name, a rejected unknown kind, a rejected hidden key or value, a `labels`-only body writing nothing, an all-visible `hidden` deleting the file, rename moving the file, page delete removing the file, a body save leaving the file, and overlay delete leaving the file. The markdown body and the editor sidecar are unchanged by an opener put.

The screen change is checked with the frontend build. This version adds no component test runner.

## Out of scope

- A texture or an image background, and any upload.
- Editing `version` or `authors` in the markdown.
- A label before or after the version or an author. The first version of this design had those labels; they were removed before any release. An old sidecar may still hold a `labels` object, and it is ignored.
- The menu, a band, or hidden lines on a `book` or `chapter` opening.
- A Previous Page control that returns after the heading scrolls away.
