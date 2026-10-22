# wit runbook

For people working on the engine itself. Frontend lint and the production build are covered in [`frontend/README.md`](frontend/README.md); editor usage is in the in-app **Getting Started** page.

## Prerequisites

- Python ≥ 3.11 (backend)
- Node ^20.19.0 or >=22.12.0 (frontend; required by Vite 8)
- [uv](https://docs.astral.sh/uv/) — `make install` and `make install-backend` call it to build `.venv`. Pip can install `./backend` into a venv you build by hand (see [Manual setup](#manual-setup-without-make)), but `make install` will not work without uv.

## Configuration

Settings are environment variables. Copy [`.env.example`](.env.example) to `.env` at the repo root and edit there, then start or reload `make dev`. `backend/app/main.py` loads that `.env`; it does not override variables already set in the environment.

| Variable           | Default                                               | Description                                                                                                                                                                         |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WIT_PAGES_ROOT`   | `data/pages/` (relative to repo root)                 | Directory where your page `*.md` files live. The default is resolved from `backend/app/storage.py`, not the process cwd; a relative value you set is resolved from the process cwd. |
| `WIT_CORS_ORIGINS` | `localhost` and `127.0.0.1` on ports 5173 and 5174    | Comma-separated list of allowed CORS origins. Setting it replaces the default; override only when running the frontend on a non-default port.                                       |

The full CORS default is `http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174`.

## Make targets

All targets run from the repo root. The Makefile uses [uv](https://docs.astral.sh/uv/) for the Python venv (`.venv`) and `npm` for the frontend.

| Target                  | Description                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `make install`          | Install backend and frontend dependencies (`install-backend` + `install-frontend`)                |
| `make install-backend`  | Create `.venv` and `uv pip install -e ./backend` (runtime deps only; no pytest — see Running tests) |
| `make install-frontend` | `npm install` in `frontend/`                                                                      |
| `make dev`              | Start backend (`http://127.0.0.1:8000`) and frontend (`http://localhost:5173`) together           |
| `make backend`          | Start the API only (uvicorn with reload)                                                          |
| `make frontend`         | Start the Vite dev server only                                                                    |
| `make test`             | Run backend tests (`.venv/bin/pytest backend/tests/ -v`); needs the `dev` extra                   |

`make dev`, `make backend`, and `make frontend` check that dependencies are installed and print a hint if you need to run `make install-backend` or `make install-frontend` first.

### Manual setup (without Make)

```bash
# Backend (uv)
uv venv .venv
uv pip install -e ./backend          # add [dev] for tests: uv pip install -e "./backend[dev]"
.venv/bin/uvicorn app.main:app --reload --app-dir backend

# Backend (pip, no uv)
python3 -m venv .venv
.venv/bin/pip install -e ./backend   # or -e "./backend[dev]" for tests

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

## API reference

The backend serves a small REST API with no authentication. All paths are relative to `http://127.0.0.1:8000`.

| Method   | Path                  | Description                                                                |
| -------- | --------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/pages`              | List all pages with metadata and tags index                                |
| `POST`   | `/pages`              | Create a new page                                                          |
| `GET`    | `/pages/{id}`         | Fetch page content (front-matter + markdown body + editor overlay)         |
| `PUT`    | `/pages/{id}`         | Overwrite page content and/or editor overlay (either field may be omitted) |
| `DELETE` | `/pages/{id}/overlay` | Delete the editor sidecar so the next load reparses markdown               |
| `DELETE` | `/pages/{id}`         | Delete a leaf page (409 if it has children)                                |
| `PATCH`  | `/pages/{id}/meta`    | Update title, parent, order, or rename the slug                            |
| `GET`    | `/health`             | Liveness check                                                             |
| `GET`    | `/config`             | Returns the resolved `pages_root` path                                     |

Interactive docs at `http://127.0.0.1:8000/docs` (FastAPI's built-in Swagger UI). Swagger lists the fields; the behavior below is not in it.

### Page ids

- `{id}` in a path must match `^[a-z0-9][a-z0-9-]*[a-z0-9]$` or be a single `[a-z0-9]`. Anything else, including a leading or trailing hyphen, returns 400 before any filesystem access.
- Ids sent in a body (`id` on create, `new_id` on rename) are slugified instead of rejected: lowercased, each run of non-alphanumeric characters becomes one hyphen, hyphens are stripped from the ends, and an empty result becomes `page`.

### Endpoint details

- **`GET /pages`** returns `pages`, `tags_index` (tag → page ids), and `duplicate_warnings` (ids found in more than one file, with their paths). For a duplicate id, the file whose path sorts first is the one listed and served.
- **`POST /pages`** body: `title` (required), `parent` (default `""`), optional `id`. Without `id`, the id is the slugified title, with `-2`, `-3`, … appended if taken. An unknown `parent`, an explicit `id` that already exists, or an existing `{id}.md` returns 400. Returns `{"id": ...}`.
- **`GET /pages/{id}`** returns `frontmatter`, `markdown_body`, `editor_overlay`, and `overlay_stale`. When the sidecar's `markdown_sha256` does not match the body, `editor_overlay` is `null` and `overlay_stale` is `true`. 404 if the page does not exist.
- **`PUT /pages/{id}`** body: `markdown_body`, `editor_overlay`. Omit a field (or send `null`) to leave it unchanged; omitting both returns 400. `editor_overlay: ""` deletes the sidecar. A JSON object with a `document` array is rewritten with `version: 3` and stamped with `markdown_sha256` of the stored markdown body (after the body write, if both are sent); any other value is stored as-is. Writing only `markdown_body` leaves an existing hashed sidecar stale. 404 if the page does not exist.
- **`DELETE /pages/{id}`** returns 204 and also removes the sidecar; 404 if the page is missing; 409 if any page still names it as `parent`.
- **`DELETE /pages/{id}/overlay`** returns 404 if the page does not exist. For an existing page with no sidecar it still succeeds.
- **`PATCH /pages/{id}/meta`** body: `title`, `parent`, `order`, `new_id`. Sending none returns 400. `new_id` is slugified, then the page is renamed: the front matter `id` is rewritten, the file moves to `{new_id}.md` in the pages root, the sidecar is renamed, and every child's `parent` is updated. With `new_id`, a duplicate id or a missing page returns 400; without it, a missing page returns 404. `title`, `parent`, and `order` are applied after any rename. This endpoint does **not** check that `parent` exists.

### Filesystem behavior

- The scanner reads every `*.md` under the pages root, including subfolders. Create and rename always write `{id}.md` directly in the root, so renaming a page that lives in a subfolder moves it to the root.
- A file without `id` or with an empty `title` is skipped with no error.
- There is no file watcher. A markdown file added on disk shows up on the next `GET /pages` (in the app: a browser refresh, or after a create, rename, or delete).
- The backend does not serve `frontend/dist/`; see [`frontend/README.md`](frontend/README.md#build).

## Running tests

`pytest` and `httpx` are in the `dev` extra (`[project.optional-dependencies] dev` in `backend/pyproject.toml`). `make install-backend` does **not** install that extra, so after `make install` alone `.venv/bin/pytest` is missing and `make test` stops with a hint that `make install-backend` will not fix. Install the extra first:

```bash
# From the repo root, after make install-backend
uv pip install -e "./backend[dev]"
make test
```

The frontend has no test script. Its checks are `npm run lint` and `npm run build` in `frontend/`.

## Security notes

wit is designed to run on `localhost` only. A few things to be aware of:

- **No authentication.** The API has no auth layer. Do not expose it to a network.
- **Disk write access.** The backend writes to `WIT_PAGES_ROOT`. Keep that pointed at a directory you control and back up regularly.
- **Path traversal protection.** Page ids in paths must match `^[a-z0-9][a-z0-9-]*[a-z0-9]$` (or a single `[a-z0-9]`) before any filesystem operation. Anything else, including ids with a leading or trailing hyphen, is rejected with HTTP 400.
- **CORS.** The default allowed origins are `localhost` and `127.0.0.1` on ports 5173 and 5174 (Vite dev server ports). Set `WIT_CORS_ORIGINS` if you run the frontend on a different port; it replaces the default list.
- **Atomic writes.** All file writes use `os.replace()` on a temp file in the same directory (`.wit-*.tmp`, gitignored) — no partial writes on crash.
