# wit

**wit** is a **local-only** read/write engine for independent creators who want to write for a digital audience without the constraints of typical publishing stacks and cloud writing products. Your pages live as plain `.md` files on disk — you own them, version them with git, and move them however you like. The backend exposes a thin REST API for disk operations; the frontend is a rich block editor for human consumption.

This repository contains **the engine only**, not finished works. Creators are expected to host exported `.md`, sidecar JSON, images, and other deliverables on **their own** sites or storage for readers to download directly — that is how digital-first writing can be shared freely while keeping editorial control and hosting separate from the app itself. For **software licensing**, **your intellectual property**, and **how to obtain wit**, see [License, your work, and the law](#license-your-work-and-the-law) and [Distribution and repository governance](#distribution-and-repository-governance).

## Philosophy

| File system | wit |
|-------------|-----|
| Source of truth | Read/write engine |
| You manage pages programmatically | App renders them for humans |
| Version-control, script, sync however you want | Saves back to clean `.md` |

## Prerequisites

- Python ≥ 3.11 (backend)
- Node ≥ 18 (frontend)
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Quick start

### 1. Install backend dependencies

```bash
# From the repo root — using the bundled venv
uv venv .venv
uv pip install -e ./backend
# or with plain pip:
pip install -e ./backend
```

### 2. Start the backend

```bash
# From the repo root
.venv/bin/uvicorn app.main:app --reload --app-dir backend
# or if you activated the venv:
uvicorn app.main:app --reload --app-dir backend
```

The API listens on `http://127.0.0.1:8000`.

### 3. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/pages`, `/health`, and `/config` to the backend automatically.

---

## Configuration

All configuration is via environment variables — no config files to edit.

| Variable | Default | Description |
|----------|---------|-------------|
| `WIT_PAGES_ROOT` | `data/pages/` (relative to repo root) | Absolute path to the directory where your `.md` files live. Set this to point at any directory on your machine. |
| `WIT_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed CORS origins. Override when running the frontend on a non-default port. |

Example — store your pages in `~/Documents/notes`:

```bash
WIT_PAGES_ROOT=~/Documents/notes uvicorn app.main:app --reload --app-dir backend
```

---

## Page format

Every page is a single `.md` file with a YAML front-matter block:

```yaml
---
id: my-page-slug
title: My Page Title
parent: ''        # id of the parent page, or empty string for root pages
order: 0          # sibling sort order (integer, lower = earlier)
tags:
  - example
  - draft
created: '2026-01-15'
---

Your markdown content here.
```

**Rules:**
- `id` must be unique across all pages. It is slugified (`[a-z0-9-]+`) and used as the filename (`{id}.md`).
- `parent` must be the `id` of an existing page, or empty string for a root page.
- The app will not create duplicate IDs; it will reject the operation with HTTP 400.

---

## Managing your pages

Because pages are plain files, you have full control outside the app:

```bash
# Bulk-tag a set of pages
for f in data/pages/chapter-*.md; do
  sed -i '' 's/tags: \[\]/tags:\n  - fiction/' "$f"
done

# Export all pages to a zip
zip -r pages-backup.zip data/pages/

# Point the app at a different directory without moving files
export WIT_PAGES_ROOT=/path/to/your/notes
```

### Editor sidecar files

The app stores rich-editor state (block UUIDs, custom node properties) in a sidecar directory:

```
data/pages/.wit/editor/{page-id}.json
```

These files are auto-generated and can always be deleted safely — the editor will re-parse from the `.md` source on next open. They are intentionally excluded from git (see `.gitignore`).

### Recommended page size

The JSON sidecar is roughly **3× the size of the raw markdown** for plain prose, and up to **8× for heavily formatted content** (nested lists, many inline styles, tables). Keeping pages within these soft limits avoids editor slowdown and large API payloads:

| Content type | Markdown | JSON sidecar (approx.) |
|---|---|---|
| Comfortable | < 50 KB | < 150 KB |
| Acceptable | 50–100 KB | 150–300 KB |
| Consider splitting | > 100 KB | > 300 KB |

If a page grows beyond the "consider splitting" threshold, break it up using the parent/child hierarchy — one root page for the overview and one child page per section or chapter. The `[[page-link]]` block type lets you cross-reference them inline.

---

## API reference

The backend serves a small REST API. All paths are relative to `http://127.0.0.1:8000`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pages` | List all pages with metadata and tags index |
| `POST` | `/pages` | Create a new page |
| `GET` | `/pages/{id}` | Fetch page content (front-matter + markdown body + editor overlay) |
| `PUT` | `/pages/{id}` | Overwrite page content and/or editor overlay |
| `DELETE` | `/pages/{id}` | Delete a leaf page (fails if it has children) |
| `PATCH` | `/pages/{id}/meta` | Update title, parent, order, or rename the slug |
| `GET` | `/health` | Liveness check |
| `GET` | `/config` | Returns the resolved `pages_root` path |

Interactive docs at `http://127.0.0.1:8000/docs` (FastAPI's built-in Swagger UI).

---

## Running tests

```bash
# From the repo root
.venv/bin/pytest backend/tests/ -v
```

---

## Security notes

wit is designed to run on `localhost` only. A few things to be aware of:

- **No authentication.** The API has no auth layer. Do not expose it to a network.
- **Disk write access.** The backend writes to `WIT_PAGES_ROOT`. Keep that pointed at a directory you control and back up regularly.
- **Path traversal protection.** Page IDs are validated as `[a-z0-9-]+` slugs before any filesystem operation. The backend will reject any ID that doesn't match this pattern with HTTP 400.
- **CORS.** The default allowed origins are `localhost:5173` and `localhost:5174` (Vite dev server ports). Set `WIT_CORS_ORIGINS` if you run the frontend on a different port.
- **Atomic writes.** All file writes use `os.replace()` on a temp file in the same directory — no partial writes on crash.

---

## Project structure

```
wit/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI routes
│   │   ├── models.py     # Pydantic request/response models
│   │   └── storage.py    # All filesystem operations
│   ├── tests/
│   │   └── test_api.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api.ts         # Typed fetch wrappers
│   │   ├── components/    # PageEditor, SidebarTree, …
│   │   ├── hooks/
│   │   ├── lib/           # BlockNote schema, persistence, search, …
│   │   └── types.ts
│   ├── package.json
│   └── vite.config.ts
└── data/
    └── pages/             # Sample .md only; everything else under pages/ is gitignored
```

---

## License, your work, and the law

- **Software.** wit is released under the [MIT License](LICENSE): you may use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions in that file. The software is provided **as is**, without warranty.
- **Your manuscripts and exports.** Anything you author in wit — markdown on disk, editor sidecars, rendered or packaged files you produce — is **yours**. This project does **not** claim ownership of your creative work. Do **not** commit personal or commercially sensitive manuscripts to this upstream repository unless you intend to publish them from here; the default [`.gitignore`](.gitignore) keeps `data/pages/` minimal (sample pages only) so your writing stays local by default. **Do not treat your wit clone as the home for prose in git**, even in a private fork: keep the engine checkout disposable and point `WIT_PAGES_ROOT` at a **separate** tree (and ideally a **separate** repository) so application code and creative files never share history.
- **Before you share publicly.** Publishing is your responsibility: register or protect intellectual property as you see fit, understand the rights you are granting readers, and **do not** use wit to prepare or distribute material that infringes anyone else’s copyright, trademarks, or other rights. wit’s authors are not responsible for how you use the tool or what you publish.

## Distribution and repository governance

- **How to get wit.** Clone this repository (or a fork), install dependencies, and run it on your machine. There is no separate app store or signed binary distribution in this repo — just source you control. When you tell someone how to install wit, **send them only the engine’s clone URL** (this repo or a fork you keep aligned with upstream). They should **not** expect your manuscripts to live in that same repository.
- **Canonical upstream.** The git history maintained here is **authoritative for this project**. **Collaboration (issues, PRs, shared roadmap) is not solicited at this time.** You may still fork under the MIT license for private experiments or downstream tooling.
- **Sample pages vs. your work.** This repo ships with `data/pages/sample-*.md` only. All other files under `data/pages/` (including images, exports, and `.wit/` editor overlays) are [ignored by git](.gitignore) so manuscripts do not land in the upstream repository by accident. Avoid naming your own manuscripts `sample-*.md`, or git will treat them like the shipped examples. To version your own pages in git, point `WIT_PAGES_ROOT` at a **separate** directory (for example its own private repository) and keep that content independent from the engine repo.
- **Avoid committing creative work into your wit clone.** Even if files stay untracked or live outside `data/pages/`, mixing prose, exports, or large assets into the **same git repo** as the engine works against the separation this project is designed around: forks drift from upstream, rebases and merges get riskier, and it is too easy to broaden `.gitignore` or rename paths and **accidentally publish** something you meant to keep private. Prefer a **sibling directory** (or another machine path) for `WIT_PAGES_ROOT`, and a **dedicated repo** for manuscripts if you use git for them at all.
- **Reasonable ways to share files without bundling them into wit’s repo** (choose for your audience and threat model; not legal advice): a **private** Git host repository containing only your pages and assets; **encrypted transfer** with [age](https://github.com/FiloSottile/age) or OpenPGP before sending a blob over email or cloud storage; **end-to-end encrypted chat** (e.g. Signal) for smaller payloads; cloud drives with **non-public links**, tight ACLs, and **expiry** where available; or **HTTPS downloads from a domain you control** for intentional public release. In every case, **point recipients at this engine repository (or your thin fork) for the app**, and deliver manuscripts or bundles through a **different** channel.
