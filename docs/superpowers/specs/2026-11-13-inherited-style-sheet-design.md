# Inherited style sheet

A page may carry a partial `style` map in its frontmatter, plus `version` and `authors`. Opening a page walks its ancestors and overlays `measure` and `scene_break`. `opener` is read from the open page only. On a `title` page, `version` and `authors` fall back to the nearest `title` ancestor. The sheet owns the column measure, that page's opening, and scene breaks. The gear menu keeps the typeface, paper color, and the size bump, and none of those are written into the file.

Pages with nothing resolved look as they do today.

## The map

You write the map in the file. This version has no style form, and no control edits `version` or `authors`. A body save already keeps frontmatter intact, and it must keep doing so.

```yaml
version: "2"
authors:
  - Ada
  - Lin
style:
  measure: book
  opener: title
  scene_break: ornament
```

| Field | Values | When the key is absent, or the value is `default` |
|---|---|---|
| `measure` | `narrow`, `book`, `wide`, `default` | The full column width the app uses today |
| `opener` | `title`, `book`, `chapter`, `default` | No opening |
| `scene_break` | `rule`, `gap`, `ornament`, `default` | A plain rule |

The opener value `book` and the measure value `book` are different fields.

`default` on `measure` or `scene_break` blocks ancestors and returns that field to the absent behavior in the table. `default` on `opener` is a plain page. `auto` and `none` are not values. A file that still contains them drops that key.

`version` is a string. `authors` is a list of strings. They appear only in a `title` opening. A child inherits them from its nearest `title` ancestor, and overrides either one by writing it in its own file.

## Cascade

On open, once the page list is loaded, walk from the outermost ancestor down to the current page by following `parent`. Start from an empty map. A `measure` or `scene_break` key that is present replaces that key. A key that is absent leaves the inherited value alone. A page that only sets `scene_break: gap` keeps the ancestor's measure. It keeps its own opener, which is no opening when that page does not set one.

`opener` is read from the open page alone. `title`, `book`, and `chapter` apply to that file. A child does not take them.

`version` and `authors` resolve field by field, walking up from the open page. The open page's own value wins. Otherwise the value comes from the nearest ancestor whose own opener is `title`. An ancestor with any other opener, or none, is skipped and passes nothing down. A blank or invalid value counts as absent and does not block an ancestor's value. The resolved values show only when the open page's own opener is `title`. A child with no heading shows neither.

The walk stops at a missing parent and at a page already seen. When an id is duplicated, the style comes from the same page the list already serves (the path that sorts first). A stale editor sidecar does not change the sheet.

Resolution is a pure function on the client. The open page does not fetch its ancestors. The resolver's opener is `title`, `book`, `chapter`, or empty. Empty means no opening.

## What the column does

The sheet changes the writing column. The sidebar and the app header stay as they are. The gear keeps the typeface, paper, and the size bump, and the sheet never disables or overrides them.

**Typeface.** The typeface is a gear setting only. Its presets are:

| Preset | Column font |
|---|---|
| Default | Atkinson Hyperlegible, Inter, system-ui, Segoe UI |
| Literary | Lora, Palatino Linotype, Palatino, Georgia, Times New Roman |
| Document | IBM Plex Sans, Segoe UI, Roboto, Helvetica Neue, Arial, system-ui |
| Blog | Source Serif 4, Palatino, Georgia, Times New Roman |

The opening and the scene-break ornament use the gear's column font. A stored choice of the retired Plain preset reads as Default, which uses the same face. A `typeface` key in a file is ignored.

**Measure.** The writing column is centered and capped at a character measure, so the size bump scales the type and the line grows with it. The cap is a max width: a narrower window shrinks the column. Block handles stay attached to their blocks. A `ch` is measured in the column font, so the pixel width shifts slightly between typefaces.

| Value | Max width |
|---|---|
| `narrow` | 58ch |
| `book` | 66ch |
| `wide` | 78ch |

**Opening.** A `title` or `book` opening draws in the same scroller as the blocks, and it scrolls away with the page. There is one scroller. The text is plain. The opening is not a block: saving does not write it into the markdown or the sidecar, and it cannot be pinned. The `em` is the editor body size, so the gear's size bump scales the opening. The column measure applies to the opening too.

| Value | Treatment |
|---|---|
| `title` | The page title, centered at `2.25em`. Under it, `version` and `authors` in the editor body size. `2em` under the whole heading, then the body |
| `book` | The page title, centered at `1.5em`, with `2em` under it, then the body |
| `chapter` | No heading. Previous and Next slide the page in |
| `default` | No heading and no slide |

An empty page title draws no title line. On `title`, a `version` or `authors` line still shows when that value is present. When the heading draws nothing, the page has no opening.

On `title`, the lines are the title, then `version`, then `authors`. A missing or blank `version` omits that line. `authors` is the remaining names joined with a comma and a space. Blank names are skipped. When no names remain, that line is omitted. `book` draws the title line only.

While any drawn part of a `title` heading is inside the frame, the outline crumb above the editor is hidden. The crumb returns once the heading has scrolled fully above the top of the frame. That crumb is the route drawn while the sidebar is closed. With the sidebar open, the crumb is not drawn. `book` and `chapter` leave the crumb in place.

**Chapter entrance.** Previous and Next are the buttons that move to the neighboring page in sidebar-tree order. Next is the following page. Previous is the page before it. The slide runs when one of those buttons opens a page whose own opener is `chapter`.

Next sets the scroll to the top, then the page starts fully outside the frame on the left and moves right into place. Previous sets the scroll to the bottom, then the page starts fully outside the frame on the right and moves left into place. The scroll is in place before the slide starts. The motion is one 300ms ease-out. A page shorter than the frame has one scroll position, so the landing does not move. When the user prefers reduced motion, Previous and Next skip the slide and still land at that top or bottom.

Sidebar clicks, links, refresh, and browser back and forward do not slide. They keep today's scroll: the top, a linked block, or the saved position. The entrance choice is a pure function of the destination opener and the button direction.

**Scene breaks.** A divider block is the scene break. A line of asterisks inside a paragraph stays a paragraph. Heading blocks inside the page are unchanged.

| Value | Treatment |
|---|---|
| `rule` | The horizontal line BlockNote already draws |
| `gap` | The line is hidden and `2em` of blank remains |
| `ornament` | A centered `* * *` in the column font |

Switching pages reapplies the sheet from the list already in memory.

## Wiring

Scan copies a cleaned `style` map onto each page in `GET /pages`. The field is `style`, and it is `null` when the page has no valid style. JSON keys match the YAML keys: `measure`, `opener`, `scene_break`. Known keys only. A bad value is omitted and the other keys remain.

Scan also copies `version` and `authors`. `version` is a string, or `null` when the key is missing, blank, or not a string. `authors` is the list of remaining names, or `null` when the key is missing, not a list, or nothing remains after blank and non-string entries are dropped. `GET /pages/{id}` still returns the frontmatter as stored.

Scan does not rewrite the file. A later body save or metadata patch writes the frontmatter back as it stands on disk, so a typo stays until you fix it. New pages are created without `style`, `version`, or `authors`.

The client resolver returns measure, opener, and scene break. A second pure function, `resolveTitleMeta`, returns the inherited `version` and `authors`. `measure` comes back empty when the current column width should win. `opener` comes back empty when the page has no opening. The editor surface, not the page root, sets `data-sheet-measure`, `data-sheet-opener`, and `data-scene-break`. An empty field sets no attribute. `data-sheet-opener` is `title` or `book` when that heading is shown. A chapter entrance does not set it.

## Bad values

`style` counts only when it is a mapping. Any other shape is ignored. A field keeps a value only when it is one of its lowercase words, including `default`. `Book`, `Literary`, `auto`, `none`, and any other spelling are dropped. Cleaning happens in the list response. The file and the single-page frontmatter stay as stored. The resolver also treats an unexpected value as an absent key.

`version` counts only when it is a string with text after trimming. `authors` counts only when it is a list. Each entry counts when it is a string with text after trimming.

## Tests

API tests in `backend/tests/test_api.py`:

- The list returns a cleaned map, without `typeface`.
- A bad field is dropped and the good field beside it remains.
- A `style` that is not a mapping is ignored.
- The list returns `version` and `authors` cleaned as above.
- A body save leaves `style`, `version`, and `authors` untouched.
- A metadata patch leaves `style`, `version`, and `authors` untouched.

The cascade and the chapter entrance are pure functions with no React and no DOM. The frontend has no test runner. Those functions get a Node built-in test file, and `make test` runs it after pytest. The cascade cases are: nothing set, a child inheriting a measure, a child keeping its own opener, a `typeface` key ignored, `auto` and `none` dropped, a child overriding one field, `default` clearing measure or scene break, `default` opener meaning no opening, a cycle, and a missing parent. The title-meta cases are: the page's own values, a child inheriting from a `title` ancestor, a child overriding one field and inheriting the other, a non-`title` ancestor passing nothing down, the walk skipping a non-`title` page to reach a `title` ancestor, the nearest `title` ancestor winning, blank values not overriding, and a cycle. The entrance function maps Next on a chapter page to a slide from the left landing at the top, and Previous on a chapter page to a slide from the right landing at the bottom. Next or Previous onto any other opener does not slide. A chapter opened without a button direction does not slide. The typecheck covers the surface attributes. This version has no browser suite.

<!--
Better frontend testing, not part of this version: add Vitest as a frontend
devDependency and run it from `make test` after pytest. The app is already
Vite, so Vitest compiles the style module the same way the app does. A bare
Node test file does not share that setup, and a test command that forgets to
call it will rot. Keep the file a unit test of the pure functions. No
jsdom and no component rendering.
-->

## Out of scope

- A style form in the app.
- A control that edits `version` or `authors`.
- A child without a `title` heading showing an inherited `version` or `authors`.
- Styling heading blocks inside the page.
- The play-syntax legend, semantic text styles, a continuous book view, and Typst export.
- Writing the typeface, paper color, or the size bump into the file.
