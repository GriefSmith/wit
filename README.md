# wit

**wit** is a **local-only** read/write engine for markdown files.
Create, visualize and edit your pages in localhost using a rich block-style editor. Nest and arrange them into complete works: each page names its `parent` in front matter, and that field — not the folder layout — builds the tree.

## Prerequisites

- Python ≥ 3.11 (backend)
- Node ^20.19.0 or >=22.12.0 (frontend; required by Vite 8)
- [uv](https://docs.astral.sh/uv/) — `make install` and `make install-backend` call it to build `.venv`, so the Make setup does not work without uv. Pip can install `./backend` into a venv you create yourself (see [RUNBOOK.md](RUNBOOK.md#manual-setup-without-make)).

## Quick start

From the repo root:

```bash
make install   # backend venv + frontend npm deps
make dev       # backend on :8000, frontend on :5173
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies `/pages`, `/health`, and `/config` to the backend automatically.

## Configuration

Settings are the variables listed below. Copy to your `.env` file from [`.env.example`](.env.example) at the repo root and edit there, then start or reload `make dev`.

| Variable           | Default                                               | Description                                                                                                                                       |
| ------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WIT_PAGES_ROOT`   | `data/pages/` (relative to repo root)                 | Directory where your page `*.md` files live. A relative value is resolved from the process's working directory, not the repo root.                |
| `WIT_CORS_ORIGINS` | `localhost` and `127.0.0.1` on ports 5173 and 5174    | Comma-separated list of allowed CORS origins. Setting it replaces the default; override only when running the frontend on a non-default port.     |

The full CORS default is `http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174`.

Example `.env`:

```bash
WIT_PAGES_ROOT=/Users/you/Documents/notes
```

## More docs

- **Using the editor** — the in-app pages **Getting Started** (`data/pages/sample-parent.md`) and **Your First Page** (`data/pages/sample-child.md`).
- **Working on the engine** — [RUNBOOK.md](RUNBOOK.md) covers Make targets, the API, tests, and security notes.

---

## License, your work, and the law

- **Software** — Released under the [MIT License](LICENSE), provided as is without warranty.
- **Your work** — Manuscripts, sidecars, and exports you create are yours; this project claims no rights to them.
- **Publishing** — You are responsible for what you share and for respecting others' copyright, trademarks, and other rights.

## Distribution and repository governance

- **Upstream** — This repository is canonical. Issues and PRs are not solicited at the moment; MIT-licensed forks for private use are fine.
- **Keep writing separate** — Point `WIT_PAGES_ROOT` at a sibling directory or its own git repo. Only `data/pages/sample-*.md` ships here; other page files and `.wit/` overlays are [gitignored](.gitignore). Do not name your work `sample-*.md` or mix manuscripts into this checkout — it makes upstream updates harder and accidental publication easier.
- **Sharing manuscripts** — If you wish to share your pages, do so through a channel apart from the engine: a private git repo, encrypted transfer, E2E chat, expiring cloud links, downloads from a site you control, etc.
