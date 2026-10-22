# wit — frontend

React + TypeScript + Vite single-page application. Proxies all API calls to the backend during development.

## Dev

From the **repo root** (recommended):

```bash
make install-frontend   # once
make frontend           # http://localhost:5173 — proxies /pages, /health, /config to :8000
```

Or start backend and frontend together: `make dev`.

From this directory:

```bash
npm install
npm run dev
```

## Build

```bash
npm run build     # type-checks, then writes frontend/dist/
```

wit does not serve `frontend/dist/`; the backend has no static file mount. To use a build, host `dist/` with a separate static server and add that server's origin to `WIT_CORS_ORIGINS` (which replaces the default list). `api.ts` calls relative paths, so that host must also forward `/pages`, `/health`, and `/config` to the backend, as the Vite dev server does. `npm run preview` serves on port 4173 by default, which is not in the default CORS list.

## Lint

```bash
npm run lint
```

There is no frontend test script; `npm run lint` and `npm run build` are the frontend checks.

## Key directories

```
src/
├── api.ts              # Typed fetch wrappers for the backend REST API
├── App.tsx             # Root layout: sidebar, editor, header
├── components/
│   ├── PageEditor.tsx          # BlockNote editor with markdown persistence
│   ├── PageNavButtons.tsx      # Previous Page / Next Page in tree order
│   ├── SidebarTree.tsx         # Arborist tree for page hierarchy
│   ├── PageSearch.tsx          # Header search over page titles/ids/tags (⌘K / Ctrl+K)
│   ├── WitCollapsedPinControl.tsx # Pin icon + dropdown
│   └── …
├── hooks/
│   ├── usePageNavigation.ts # ?page= URL state, history, last open page
│   └── usePages.ts     # Fetches /pages on mount; exposes refresh()
├── lib/
│   ├── blocknotePersistence.ts # Markdown ↔ BlockNote round-trip
│   ├── witBlockNoteSchema.ts   # Custom block types (pageLink, card)
│   ├── cardBlock.tsx           # Card block: text + image URL, image left or right
│   ├── internalLinks.ts        # wit: link resolution
│   ├── search.ts               # Fuse.js index over page titles/ids/tags
│   ├── witAppearance.ts        # Accent, font, text size, background (localStorage)
│   ├── witPins.ts              # Block pins (localStorage)
│   ├── notionImport.ts         # Not used by the UI
│   └── …
└── types.ts            # Shared TypeScript types
```

## Vite proxy

`vite.config.ts` forwards `/pages`, `/health`, and `/config` to `http://127.0.0.1:8000` in dev mode. Page paths are configured via repo-root `.env` on the backend (see the root README); no frontend env file is required for local development.
