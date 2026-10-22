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
- **Link** in the drag-handle menu — turn the block into a link to another page (`[Label](wit:page-id)` in the raw markdown). ⌘-click (Ctrl-click off macOS) a page-link block to follow it.
- Markdown shortcuts work inline: `**bold**`, `_italic_`, `` `code` ``, `> quote`, `- list`

## Pinning blocks

Any block can be pinned from its drag-handle (⋮) menu with **Pin block**. Pinned blocks are listed in the pin control beside the pages panel regardless of which page is open — useful for keeping a scratchpad, a to-do list, or reference material in reach. Pins live in your browser, not in `data/pages/`.

## Tags

Tags are set in front-matter:

```yaml
tags:
  - fiction
  - chapter-1
```

The search field in the header matches titles, page ids, and tags across your entire library. `⌘K` (`Ctrl+K` off macOS) focuses it.

## Page IDs and slugs

Page slugs (`id` in front-matter) appear in the URL as the `?page=` query parameter and are used as `parent` references. The app slugifies new page titles automatically: it is lowercased, each run of characters other than `a–z` and `0–9` becomes one hyphen, and hyphens are trimmed from the ends — so `naïve` becomes `na-ve` and `über` becomes `ber`. A title with nothing left becomes `page`. You can rename a slug with the rename button on the page's row in the tree — the app rewrites the file, renames it on disk, and patches all children's `parent` field in one go.

## Keeping the markdown readable

wit writes back a clean markdown body on save. The `editor_overlay` sidecar (`.wit/editor/{id}.json`) stores the BlockNote document — block text plus block ids, colors, and custom block props — and the hash of the markdown it was saved with. If you edit the `.md` file by hand, the hash no longer matches and the editor rebuilds from markdown on next open. **Reload from markdown** does the same on demand.

## Recommended page size

The JSON sidecar is roughly **3× the markdown size** for plain prose (about 2–3.7× on the pages tested); heavily formatted content (nested lists, tables, many inline styles) likely runs higher. Staying within these soft limits keeps the editor fast and save payloads small:

- **Under 50 KB of markdown** — comfortable; no caveats.
- **50–100 KB** — still fine; you may notice a brief pause on first open while the overlay is built.
- **Over 100 KB** — consider splitting. Use the parent/child hierarchy: one root page for the overview, one child per chapter or section. Page links (the **Link** menu, or `wit:` links) let you cross-reference them.

Individual blocks have no enforced size limit, but extremely long paragraphs (several KB of text in a single block) can slow inline formatting. Prefer shorter blocks and use headings to break up long stretches of text.
