# Title opener presentation

A `title` opening keeps the page title as a centered header, at twice today's size, with the version line and each author line doubled to match. That page shows no Previous Page control, and the heading uses the width that control used to reserve. The version and each author can carry a label before the value and a label after it. The heading can wear one of the gear's named background palettes. Labels and the palette live in an opener sidecar for the page on screen. The markdown file, its frontmatter, and the editor sidecar stay as they are.

A `book` opening stays the centered title at `1.5em`. A `chapter` opening is unchanged. Neither gains labels, a band, or a hidden Previous Page control.

## Size and the previous-page control

The title header is `4.5em`. The version line and each author line are `2em`. Both sizes are relative to the opener's body size, which is the editor body size. Today's title header is `2.25em` and those lines are body size, so each is doubled. The `2em` gap under the heading stays.

A page whose resolved opener is `title` does not render Previous Page, including when the heading draws nothing and including when the page has a parent. The heading's right padding matches its left padding. Next Page stays at the bottom of the scroller and still appears when the scroll position is at the bottom. The outline crumb still hides while any drawn part of the title heading is inside the frame.

## Labels

Double-clicking the version, or one author, opens a popover on that value. The popover has a Before field, the value itself (read-only), and an After field. Both fields can hold text. Enter confirms. A click outside the popover confirms. Escape cancels and leaves the stored labels as they were.

The renderer trims each label. A non-empty Before is drawn, then one space, then the value. A non-empty After is drawn after the value, with one space between them. The stored text does not include that space. Authors remain separate values joined by a comma and a space, and the comma is not part of either label.

`written by: Ada, Bea did the drawings.`

Clearing a field removes that side. Clearing both removes the pair. A blank version or a missing author draws no target. Each label is at most 120 characters after trimming. The field stops at 120. A longer value sent to the server is rejected and nothing is written.

Labels belong to the page on screen, including when the version or the authors are inherited. Author labels are keyed by the name on screen. The client sends only names that are currently shown, so a renamed author loses that pair on the next label write. Two authors with the same name share one pair. The version pair is one object, not keyed by the version string. It stays in the file when the version line is hidden, and it shows again when a version is visible.

## Sidecar

The file is `{pages_root}/.wit/opener/{id}.json`, beside `{pages_root}/.wit/editor/{id}.json`. A missing file means no labels and no band.

```json
{
  "labels": {
    "version": { "before": "version so far:", "after": "" },
    "authors": {
      "Ada": { "before": "written by:", "after": "" },
      "Bea": { "before": "", "after": "did the drawings." }
    }
  },
  "background": { "kind": "palette", "name": "ocean" }
}
```

An empty side is stored as `""`. A pair whose sides are both empty is omitted. `background` is omitted when the heading has no band. When a write leaves both `labels` and `background` empty, the file is deleted.

Confirming a label or choosing a palette writes this file at once. A label confirmation sends `labels` and omits `background`. A palette choice sends `background` and omits `labels`. That write does not mark the manuscript dirty and does not change the markdown body or the editor sidecar. The popover stays open until the write succeeds, and then it closes. A failed write keeps the popover open and shows the error there.

## Heading background

The choice sits on the title header: a Background control, available to the pointer while the pointer is over the header or the menu is open, and always reachable by keyboard. The menu is None, Forest, Steppe, Mountain, Ocean, Dune, and Wasteland. System is not in the menu. None clears the band.

A chosen palette paints the title header only, the same centered measure column the header already occupies. It uses that palette's dark background and dark heading color for the title, the version, and the authors, including when the page is light. The rest of the page keeps the gear's background.

`background` is a tagged object. This version writes only `{ "kind": "palette", "name": "<one of the six>" }`. A texture or an image would be another `kind` later. This version does not paint or write those kinds.

A `GET` returns a palette it recognizes. An unrecognized `kind` is omitted from the response and left in the file. A label write sends `labels` only, so the server leaves `background` untouched. A palette write sends `background` only, so the server leaves `labels` untouched. `background: null` clears the band. Any `kind` other than `palette` on a background write is rejected, and the file is not changed.

## API

`GET /pages/{id}/opener` returns the cleaned object. A missing file returns `{}`. A missing page is 404. A file that is not valid JSON is treated as `{}` and is not rewritten or deleted. Sides are trimmed. A side longer than 120 characters, or a side that is not a string, is dropped from the response. The file is not rewritten. Author pairs are returned as stored, including a name the frontmatter does not currently show. The heading uses a pair only when that name is among the authors on screen.

`PUT /pages/{id}/opener` merges. The body may include `labels`, `background`, or both. A key that is absent stays as it is on disk. `labels` replaces the labels object. Each side is a string, trimmed, at most 120 characters. Author keys are non-empty strings. `background` is either `null` or `{ "kind": "palette", "name": "<Forest|Steppe|Mountain|Ocean|Dune|Wasteland, stored in lowercase>" }`. A failed check writes nothing and returns 400. A missing page is 404.

The stored palette names are `forest`, `steppe`, `mountain`, `ocean`, `dune`, and `wasteland`.

Renaming a page moves the opener file with the same replace the editor sidecar already uses. Deleting a page deletes the opener file. Deleting the editor overlay leaves the opener file in place. A body save leaves it in place.

A failed put keeps the heading as it was and shows a short error on the control that issued the write.

## Tests

`formatAffixed` and the document cleaner are pure functions. They get a Node test file, and `make test` runs it with the existing page-style tests. The cases are: Before only, After only, both sides, trimmed labels, the single inserted space, authors joined by a comma and a space, a cleared side, a pair removed when both sides are empty, a palette kept, an unknown kind omitted from the cleaned result, and an over-long or non-string side dropped from the cleaned result.

Pytest covers: get of a missing file, put of labels leaving any existing background byte-for-byte, put of a palette leaving labels in place, `background: null` clearing the band, a rejected palette name, a rejected unknown kind writing nothing, rename moving the file, page delete removing the file, a body save leaving the file, and overlay delete leaving the file. The markdown body and the editor sidecar are unchanged by an opener put.

The screen change is checked with the frontend build. This version adds no component test runner.

## Out of scope

- A texture or an image background, and any upload.
- Editing `version` or `authors` in the markdown.
- Labels or a band on a `book` or `chapter` opening.
- A Previous Page control that returns after the heading scrolls away.
