---
created: '2026-01-01'
id: sample-parent
order: 0
parent: ''
tags:
- welcome
- docs
title: Getting Started
---

# Getting Started with wit

**wit** is a local-first markdown notebook. Your pages live as plain `.md` files on disk — you own them, version them with git, sync them however you want. The app is just the read/write engine for human consumption.

## How pages work

Every page is a single `.md` file with a YAML front-matter block at the top:

```yaml
---
id: my-page-slug
title: My Page
parent: ''       # id of the parent page, or empty for root
order: 0         # sibling position (lower = earlier in the tree)
tags:
  - example
created: '2026-01-01'
---
```

The `id` field is the slug: lowercase letters, numbers, and hyphens only. It is the page's stable identity — rename the title freely, but changing the `id` will re-slug the file and update all child `parent` references automatically via the PATCH `/pages/{id}/meta` endpoint.

## Creating and editing pages

Use the sidebar to create pages, nest them under a parent, drag to reorder, or rename them. The rich editor auto-saves to markdown when you hit **Save** (or `Ctrl/Cmd+S`).

You can also create pages directly by dropping a `.md` file into `data/pages/` with a valid front-matter block — the app will pick it up on the next refresh.

## Internal links

Link to another page from the editor using the `wit:` scheme:

```
[Link text](wit:target-page-id)
```

The editor renders these as clickable page-link blocks. In raw markdown they are standard links that remain readable outside the app.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + S` | Save current page |
| `/` in editor | Open block menu |
| `[[` in editor | Insert page link |

## Working with files directly

Since your data is plain markdown, you can:

- **Bulk-edit** pages with any text editor or script
- **Version control** your data separately with git
- **Back up** by copying the `data/pages/` directory
- **Move** to a different directory by setting `WIT_PAGES_ROOT` (see the README)

See **Your First Page** (the child page below) for a quick walkthrough of the editor features.
