# wit — frontend

React + TypeScript + Vite single-page application. Proxies all API calls to the backend during development.

## Dev

```bash
npm install
npm run dev       # http://localhost:5173 — proxies /pages, /health, /config to :8000
```

## Build

```bash
npm run build     # outputs to dist/
```

The built `dist/` can be served as static files alongside the backend (e.g. via `uvicorn` with a static file mount), or kept separate — just set `WIT_CORS_ORIGINS` to include the frontend's origin.

## Lint

```bash
npm run lint
```

## Key directories

```
src/
├── api.ts              # Typed fetch wrappers for the backend REST API
├── App.tsx             # Root layout: sidebar, editor, header
├── components/
│   ├── PageEditor.tsx          # BlockNote editor with markdown persistence
│   ├── SidebarTree.tsx         # Arborist tree for page hierarchy
│   ├── PinnedSection.tsx       # Pinned blocks panel
│   └── …
├── hooks/
│   └── usePages.ts     # SWR-style hook for /pages
├── lib/
│   ├── blocknotePersistence.ts # Markdown ↔ BlockNote round-trip
│   ├── witBlockNoteSchema.ts   # Custom block types (pageLink, …)
│   ├── internalLinks.ts        # wit: link resolution
│   ├── search.ts               # Fuse.js index over page titles/tags
│   └── …
└── types.ts            # Shared TypeScript types
```

## Vite proxy

`vite.config.ts` forwards `/pages`, `/health`, and `/config` to `http://127.0.0.1:8000` in dev mode. No env files or CORS configuration needed for local development.
