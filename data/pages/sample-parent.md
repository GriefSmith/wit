---
created: "2026-01-01"
id: sample-parent
order: 0
parent: ""
tags:
  - welcome
  - docs
title: Getting Started
---

# Getting Started with wit

**wit** is a local-only markdown notebook. Your pages live as plain `.md` files on disk — you own and manage them however you want. There is no sync and no account; the app is just the read/write engine for human consumption.

## How pages work

Every page is a single `.md` file that starts with a YAML front-matter block. The front matter closes before the body:

```markdown
---
id: my-page-slug
title: My Page
parent: "" # id of the parent page, or empty for root
order: 0 # sibling position (lower = earlier in the tree)
tags: [] # list of tags. Defaults to empty on page creation
created: "YYYY-MM-DD". Timestamp set at page creation
---

Your markdown content here.
```

The `id` field is the slug: lowercase letters, digits, and hyphens, and it cannot start or end with a hyphen. It is the page's stable identity — rename the title freely. To change the `id`, use the rename control in the tree: it goes through PATCH `/pages/{id}/meta`, which rewrites the file as `{new-id}.md`, renames the editor sidecar, and updates every child's `parent`. Changing `id` by hand in the file does **not** update children.

**Rules:**

- A file needs `id` and a non-empty `title`, or it is ignored with no error. `parent`, `order`, `tags`, and `created` can be omitted.
- `id` is used as the filename (`{id}.md`) for pages the app creates or renames.
- `parent` is the `id` of another page, or empty for a root page. The tree comes from `parent`, not from folders. A `parent` that matches no page shows the page as a root; creating a page in the app with an unknown parent is rejected with HTTP 400.
- `id` should be unique. The app will not create or rename to a duplicate id; it rejects the operation with HTTP 400. Duplicate ids already on disk are not rejected: the app shows a duplicate-id banner and uses the file whose path sorts first.
- Files in subfolders of `data/pages/` are read, but the app always writes `{id}.md` at the top of the folder — renaming a page that sits in a subfolder moves it to the top.

### Editor sidecar files (Overlay)

The app stores rich-editor state as JSON files into a sidecar directory:

```
data/pages/.wit/editor/{page-id}.json
```

Each sidecar holds the BlockNote document — `{ "version": 3, "document": [...] }` — with block ids, colors, and custom block properties alongside the block text. The server adds `markdown_sha256`, the hash of the markdown body it was saved with. The markdown itself stays in the `.md` file. On load, the editor reads the sidecar and applies it.

They are auto-generated and can always be deleted safely — the editor will re-parse from the `.md` source on next open. They are intentionally excluded from git (see `.gitignore`).

Each sidecar is bound to the markdown body it was saved with (SHA-256). If you edit the `.md` file directly, the next load ignores the sidecar, rebuilds the editor from markdown, and shows a banner saying the page was edited outside the editor, with **Dismiss** and **Discard editor cache**. Sidecars from older saves (no hash) are kept until the next Save, which writes a hashed sidecar.

**Reload from markdown** in the header does the rebuild on demand: it deletes the sidecar, reparses the `.md` file, and immediately writes a fresh sidecar.

---

## Creating and editing pages

Use the sidebar to create pages, nest them under a parent, drag to reorder, or rename them. The editor writes back to markdown when you hit **Save** (or `Shift+⌘+Enter`; `Shift+Ctrl+Enter` off macOS).

Leaving a page with unsaved changes asks for confirmation. A browser refresh or closing the tab shows the browser's own leave-page prompt.

You can also create pages directly by dropping a `.md` file into `data/pages/` with a valid front-matter block. There is no file watcher: the page appears the next time the app fetches the page list — a browser refresh, or after you create, rename, or delete a page in the app.

**Previous Page** and **Next Page** appear at the top and bottom of the scroll area and step through pages in tree order.

## Internal links

Link to another page from the editor using the `wit:` scheme:

```
[Link text](wit:target-page-id)
```

To insert one, open a block's drag-handle menu and choose **Link**, then the target page — the block becomes a page-link block. Or write `[Label](wit:page-id)` in the `.md` file. Clicking a `wit:` link in text opens the page; a page-link block opens with ⌘-click (Ctrl-click off macOS). In raw markdown they are standard links that remain readable outside the app.

## Search

The search field in the header matches page titles, ids, and tags. `⌘K` (`Ctrl+K` off macOS) focuses it.

## Pins

Pin a block from its drag-handle menu with **Pin block**. Pinned blocks are listed in the pin control beside the pages panel, whichever page is open.

## Cards

A **Card** is a block of text plus an image URL, with the image on the left or right. Make one from the drag-handle menu: **Turn into → Card**. It is not in the `/` menu.

## Appearance

The gear menu in the header sets:

- **Accent** — Default, Pine, Mint, Cyan, Violet, Scarlet, Amber
- **Font** — Default, Literary, Document, Plain
- **Text size** — Default, Large, Granny
- **Background** — System, Forest, Steppe, Mountain, Ocean, Dune, Wasteland

## Keyboard shortcuts

| Key                        | Action            |
| -------------------------- | ----------------- |
| `Shift + Cmd/Ctrl + Enter` | Save current page |
| `/` in editor              | Open block menu   |
| `Cmd/Ctrl + K`             | Focus search      |

## Working with files directly

Since your data is plain markdown, you can:

- **Bulk-edit** pages with any text editor or script
- **Version control** your data separately with git
- **Back up** by copying the `data/pages/` directory
- **Move** to a different directory by setting `WIT_PAGES_ROOT` (see the README)

Pins, appearance settings, and the last open page live in the browser's `localStorage` (pins under `wit-block-pins-v1`), not in `data/pages/`. Copying the folder does not copy them.

**Examples**

```bash
# Bulk-tag a set of pages (macOS sed; on Linux use sed -i without '').
# Matches only files with an empty `tags: []`, which is what app-created pages have.
for f in data/pages/chapter-*.md; do
  sed -i '' 's/tags: \[\]/tags:\n  - fiction/' "$f"
done

# Export all pages to a zip
zip -r pages-backup.zip data/pages/

# Point the app at a different directory without moving files
export WIT_PAGES_ROOT=/path/to/your/notes
```

See **Your First Page** (the child page below) for a quick walkthrough of the editor features.
