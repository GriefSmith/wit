# wit

**wit** is a **local-only** read/write engine for independent creators who want to write for a digital audience without the constraints of typical publishing stacks and cloud writing products. Your pages live as plain `.md` files on disk — you own them, version them with git, and move them however you like. The backend exposes a thin REST API for disk operations; the frontend is a rich block editor for human consumption.

This repository contains **the engine only**, not finished works. Creators are expected to host exported `.md`, sidecar JSON, images, and other deliverables on **their own** sites or storage for readers to download directly — that is how digital-first writing can be shared freely while keeping editorial control and hosting separate from the app itself.

## Prerequisites

- Python ≥ 3.11 (backend)
- Node ≥ 18 (frontend)
- [uv](https://docs.astral.sh/uv/) (recommended) or pip

## Quick start

From the repo root:

```bash
make install   # backend venv + frontend npm deps
make dev       # backend on :8000, frontend on :5173
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/pages`, `/health`, and `/config` to the backend automatically.

---

## Make targets

All targets run from the repo root. The Makefile uses [uv](https://docs.astral.sh/uv/) for the Python venv (`.venv`) and `npm` for the frontend.

| Target                  | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `make install`          | Install backend and frontend dependencies (`install-backend` + `install-frontend`)      |
| `make install-backend`  | Create `.venv` and `pip install -e ./backend`                                           |
| `make install-frontend` | `npm install` in `frontend/`                                                            |
| `make dev`              | Start backend (`http://127.0.0.1:8000`) and frontend (`http://localhost:5173`) together |
| `make backend`          | Start the API only (uvicorn with reload)                                                |
| `make frontend`         | Start the Vite dev server only                                                          |
| `make test`             | Run backend tests (`pytest backend/tests/ -v`)                                          |

`make dev`, `make backend`, and `make frontend` check that dependencies are installed and print a hint if you need to run `make install-backend` or `make install-frontend` first.

### Manual setup (without Make)

```bash
# Backend
uv venv .venv
uv pip install -e ./backend
.venv/bin/uvicorn app.main:app --reload --app-dir backend

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

---

## Configuration

Settings are environment variables. For local development, copy [`.env.example`](.env.example) to `.env` at the repo root and edit there — `make dev` and the backend both load it automatically (`.env` is gitignored).

| Variable           | Default                               | Description                                                                                             |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `WIT_PAGES_ROOT`   | `data/pages/` (relative to repo root) | Directory where your page `*.md` files live (not a single file path).                                   |
| `WIT_CORS_ORIGINS` | `http://localhost:5173,...`           | Comma-separated list of allowed CORS origins. Override when running the frontend on a non-default port. |

Example `.env`:

```bash
WIT_PAGES_ROOT=/Users/you/Documents/notes
```

You can also pass variables inline (they override `.env`):

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
parent: "" # id of the parent page, or empty string for root pages
order: 0 # sibling sort order (integer, lower = earlier)
tags:
  - example
  - draft
created: "2026-01-15"
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

Each sidecar is bound to the markdown body it was saved with (SHA-256). If you edit the `.md` file directly, the next load ignores the sidecar, rebuilds the editor from markdown, and shows a notice. Use **Reload from markdown** in the app to drop a sidecar on demand. Sidecars from older saves (no hash) are kept until the next Save, which writes a hashed sidecar.

### Recommended page size

The JSON sidecar is roughly **3× the size of the raw markdown** for plain prose, and up to **8× for heavily formatted content** (nested lists, many inline styles, tables). Keeping pages within these soft limits avoids editor slowdown and large API payloads:

| Content type       | Markdown  | JSON sidecar (approx.) |
| ------------------ | --------- | ---------------------- |
| Comfortable        | < 50 KB   | < 150 KB               |
| Acceptable         | 50–100 KB | 150–300 KB             |
| Consider splitting | > 100 KB  | > 300 KB               |

If a page grows beyond the "consider splitting" threshold, break it up using the parent/child hierarchy — one root page for the overview and one child page per section or chapter. The `[[page-link]]` block type lets you cross-reference them inline.

---

## API reference

The backend serves a small REST API. All paths are relative to `http://127.0.0.1:8000`.

| Method   | Path               | Description                                                        |
| -------- | ------------------ | ------------------------------------------------------------------ |
| `GET`    | `/pages`           | List all pages with metadata and tags index                        |
| `POST`   | `/pages`           | Create a new page                                                  |
| `GET`    | `/pages/{id}`          | Fetch page content (front-matter + markdown body + editor overlay) |
| `PUT`    | `/pages/{id}`          | Overwrite page content and/or editor overlay                       |
| `DELETE` | `/pages/{id}/overlay`  | Delete the editor sidecar so the next load reparses markdown       |
| `DELETE` | `/pages/{id}`          | Delete a leaf page (fails if it has children)                      |
| `PATCH`  | `/pages/{id}/meta` | Update title, parent, order, or rename the slug                    |
| `GET`    | `/health`          | Liveness check                                                     |
| `GET`    | `/config`          | Returns the resolved `pages_root` path                             |

Interactive docs at `http://127.0.0.1:8000/docs` (FastAPI's built-in Swagger UI).

---

## Running tests

```bash
# From the repo root
make test
```

Requires `make install-backend` (or a manual `uv pip install -e ./backend`) so `.venv/bin/pytest` exists.

---

## Security notes

wit is designed to run on `localhost` only. A few things to be aware of:

- **No authentication.** The API has no auth layer. Do not expose it to a network.
- **Disk write access.** The backend writes to `WIT_PAGES_ROOT`. Keep that pointed at a directory you control and back up regularly.
- **Path traversal protection.** Page IDs are validated as `[a-z0-9-]+` slugs before any filesystem operation. The backend will reject any ID that doesn't match this pattern with HTTP 400.
- **CORS.** The default allowed origins are `localhost:5173` and `localhost:5174` (Vite dev server ports). Set `WIT_CORS_ORIGINS` if you run the frontend on a different port.
- **Atomic writes.** All file writes use `os.replace()` on a temp file in the same directory — no partial writes on crash.

---

## License, your work, and the law

- **Software** — Released under the [MIT License](LICENSE), provided as is without warranty.
- **Your work** — Manuscripts, sidecars, and exports you create are yours; this project claims no rights to them.
- **Publishing** — You are responsible for what you share and for respecting others' copyright, trademarks, and other rights.

## Distribution and repository governance

- **Getting wit** — Clone this repo, run `make install` and `make dev`. There is no packaged binary. Share the engine URL with installers, not your manuscripts.
- **Upstream** — This repository is canonical. Issues and PRs are not solicited; MIT-licensed forks for private use are fine.
- **Keep writing separate** — Point `WIT_PAGES_ROOT` at a sibling directory or its own git repo. Only `data/pages/sample-*.md` ships here; other page files and `.wit/` overlays are [gitignored](.gitignore). Do not name your work `sample-*.md` or mix manuscripts into this checkout — it makes upstream updates harder and accidental publication easier.
- **Sharing manuscripts** — Deliver pages through a channel apart from the engine: a private git repo, encrypted transfer, E2E chat, expiring cloud links, or downloads from a site you control.
