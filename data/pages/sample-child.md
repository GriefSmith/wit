---
created: '2026-01-01'
id: sample-child
order: 0
parent: sample-parent
tags:
- welcome
- docs
title: Your First Page
---

# Your First Page

This page is a child of **Getting Started**. The sidebar shows the tree; indent pages by setting a `parent` id.

## Editor basics

The editor is powered by [BlockNote](https://www.blocknotejs.org/). Familiar block-editor conventions apply:

- **/** — open the block command menu (headings, lists, code blocks, dividers…)
- **Drag handle** (left of a block) — move blocks, turn them into nested content, or delete
- **[[** — insert an internal page link (`wit:page-id` in the raw markdown)
- Markdown shortcuts work inline: `**bold**`, `_italic_`, `` `code` ``, `> quote`, `- list`

## Pinning blocks

Any block can be pinned to the sidebar pins panel (right-click the drag handle → **Pin**). Pinned blocks float in the sidebar regardless of which page is open — useful for keeping a scratchpad, a to-do list, or reference material always visible.

## Tags

Tags are set in front-matter:

```yaml
tags:
  - fiction
  - chapter-1
```

The sidebar search indexes titles and tags. Type in the search box to filter across your entire library.

## Page IDs and slugs

Page slugs (`id` in front-matter) are used in the URL hash and as `parent` references. The app slugifies new page titles automatically: spaces become hyphens, non-ASCII is dropped. You can rename a slug via the page context menu — the app rewrites the file, renames it on disk, and patches all children's `parent` field in one go.

## Keeping the markdown readable

wit writes back a clean markdown body on save. The `editor_overlay` sidecar (`.wit/editor/{id}.json`) only stores rich-editor state that can't round-trip cleanly through markdown (block UUIDs, custom node props). If you edit the `.md` file by hand and the overlay gets stale, deleting the `.json` sidecar forces the editor to re-parse from markdown on next open.

## Recommended page size

The JSON sidecar is roughly **3× the markdown size** for plain prose and up to **8×** for heavily formatted content (nested lists, tables, many inline styles). Staying within these soft limits keeps the editor fast and save payloads small:

- **Under 50 KB of markdown** — comfortable; no caveats.
- **50–100 KB** — still fine; you may notice a brief pause on first open while the overlay is built.
- **Over 100 KB** — consider splitting. Use the parent/child hierarchy: one root page for the overview, one child per chapter or section. Internal page links (`[[`)  let you cross-reference them inline.

Individual blocks have no enforced size limit, but extremely long paragraphs (several KB of text in a single block) can slow inline formatting. Prefer shorter blocks and use headings to break up long stretches of text.
