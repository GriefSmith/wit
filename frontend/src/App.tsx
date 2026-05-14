import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { PageEditor } from "./components/PageEditor";
import { PinnedBlockPreviewModal } from "./components/PinnedBlockPreviewModal";
import { PinnedSection } from "./components/PinnedSection";
import { SidebarTree } from "./components/SidebarTree";
import { WitCollapsedPinControl } from "./components/WitCollapsedPinControl";
import { WitSettingsMenu } from "./components/WitSettingsMenu";
import { useWitPins } from "./context/WitPinsContext";
import { usePages } from "./hooks/usePages";
import {
  ACCENT_STORAGE_KEY,
  COLOR_SCHEME_STORAGE_KEY,
  FONT_PRESET_STORAGE_KEY,
  TEXT_SIZE_STORAGE_KEY,
  readStoredAccent,
  readStoredColorScheme,
  readStoredFontPreset,
  readStoredTextSize,
} from "./lib/witAppearance";
import type {
  AccentName,
  FontPresetName,
  TextSizeName,
} from "./lib/witAppearance";
import { createPagesFuse } from "./lib/search";
import { formatPageRouteCrumb, pageTitleTrail } from "./lib/tree";
import type { PageMeta, WitPin } from "./types";
import type {
  PageEditorHandle,
  PageEditorHeaderState,
} from "./components/PageEditor";

const SIDEBAR_OPEN_KEY = "wit-sidebar-open";
const SIDEBAR_WIDTH_KEY = "wit-sidebar-width";

/** Matches the previous grid cap (~300px); drag cannot shrink below this. */
const SIDEBAR_WIDTH_MIN = 220;
const SIDEBAR_WIDTH_DEFAULT = 280;
const SIDEBAR_WIDTH_MAX_CAP = 520;
/** Editor column keeps at least this width so the read/edit surface stays usable. */
const MAIN_MIN_WIDTH = 300;
const LAYOUT_RESIZER_WIDTH = 6;

function readSidebarWidth(): number {
  if (typeof window === "undefined") {
    return SIDEBAR_WIDTH_DEFAULT;
  }
  const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) {
    return SIDEBAR_WIDTH_DEFAULT;
  }
  return Math.min(SIDEBAR_WIDTH_MAX_CAP, Math.max(SIDEBAR_WIDTH_MIN, n));
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readSidebarOpen(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  const raw = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
  if (raw === "0" || raw === "false") {
    return false;
  }
  return true;
}

function sidebarWidthMax(): number {
  if (typeof window === "undefined") {
    return SIDEBAR_WIDTH_DEFAULT;
  }
  const vw = window.innerWidth;
  const fromMain = vw - MAIN_MIN_WIDTH - LAYOUT_RESIZER_WIDTH;
  const fromRatio = Math.floor(vw * 0.48);
  return Math.max(
    SIDEBAR_WIDTH_MIN,
    Math.min(SIDEBAR_WIDTH_MAX_CAP, fromMain, fromRatio),
  );
}

export default function App() {
  const { data, error, loading, refresh } = usePages();
  const witPins = useWitPins();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewPin, setPreviewPin] = useState<WitPin | null>(null);
  const [query, setQuery] = useState("");
  const [accent, setAccent] = useState<AccentName>(() => readStoredAccent());
  const [fontPreset, setFontPreset] = useState<FontPresetName>(() =>
    readStoredFontPreset(),
  );
  const [textSize, setTextSize] = useState<TextSizeName>(() =>
    readStoredTextSize(),
  );
  const [colorScheme, setColorScheme] = useState<"light" | "dark">(() =>
    readStoredColorScheme(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const [sidebarWidthPx, setSidebarWidthPx] = useState(readSidebarWidth);
  const deferredQuery = useDeferredValue(query);

  const pages = useMemo(() => data?.pages ?? [], [data]);

  const resolvedSelectedId = selectedId ?? pages[0]?.id ?? null;

  const fuse = useMemo(() => createPagesFuse(pages), [pages]);

  const searchHits = useMemo(() => {
    const q = deferredQuery.trim();
    if (!q) {
      return null;
    }
    return fuse.search(q).map((r) => r.item as PageMeta);
  }, [deferredQuery, fuse]);

  const collapsedRouteLabel = useMemo(() => {
    if (sidebarOpen || !resolvedSelectedId) {
      return "";
    }
    const trail = pageTitleTrail(pages, resolvedSelectedId);
    return formatPageRouteCrumb(trail);
  }, [sidebarOpen, resolvedSelectedId, pages]);

  const dup = data?.duplicate_warnings ?? [];

  const handleStructureChange = useCallback(() => refresh(), [refresh]);

  const editorRef = useRef<PageEditorHandle | null>(null);
  const [editorHeader, setEditorHeader] = useState<PageEditorHeaderState>({
    loading: false,
    saving: false,
    dirty: false,
    loadError: null,
    saveError: null,
    witLinkNotice: null,
  });

  const canSave =
    Boolean(resolvedSelectedId) &&
    !editorHeader.loading &&
    !editorHeader.saving &&
    editorHeader.dirty &&
    !editorHeader.loadError;

  const handlePageRenamed = useCallback(
    (previousId: string, nextId: string) => {
      witPins.onPageRenamed(previousId, nextId);
      setSelectedId((cur) => (cur === previousId ? nextId : cur));
    },
    [witPins],
  );

  const handlePageDeleted = useCallback(
    (deletedId: string) => {
      witPins.onPageDeleted(deletedId);
      setSelectedId((cur) => (cur === deletedId ? null : cur));
    },
    [witPins],
  );

  const openPinPreview = useCallback((pin: WitPin) => {
    setPreviewPin(pin);
  }, []);

  const closePinPreview = useCallback(() => {
    setPreviewPin(null);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (accent === "default") {
      root.removeAttribute("data-accent");
    } else {
      root.setAttribute("data-accent", accent);
    }
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (fontPreset === "default") {
      root.removeAttribute("data-font-preset");
    } else {
      root.setAttribute("data-font-preset", fontPreset);
    }
    window.localStorage.setItem(FONT_PRESET_STORAGE_KEY, fontPreset);
  }, [fontPreset]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (textSize === "default") {
      root.removeAttribute("data-text-size");
    } else {
      root.setAttribute("data-text-size", textSize);
    }
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, textSize);
  }, [textSize]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.setAttribute("data-theme", colorScheme);
  }, [colorScheme]);

  const handleColorSchemeChange = useCallback((scheme: "light" | "dark") => {
    setColorScheme(scheme);
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_OPEN_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidthPx));
  }, [sidebarWidthPx]);

  /** Keep stored width within bounds when the window shrinks. */
  useEffect(() => {
    const clamp = () => {
      const maxW = sidebarWidthMax();
      setSidebarWidthPx((w) => Math.min(maxW, Math.max(SIDEBAR_WIDTH_MIN, w)));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, []);

  const resizeState = useRef<{ startX: number; startW: number } | null>(null);

  const onLayoutResizerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || !sidebarOpen) {
        return;
      }
      e.preventDefault();
      resizeState.current = { startX: e.clientX, startW: sidebarWidthPx };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [sidebarOpen, sidebarWidthPx],
  );

  const onLayoutResizerPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const st = resizeState.current;
      if (!st) {
        return;
      }
      const maxW = sidebarWidthMax();
      const dx = e.clientX - st.startX;
      const next = Math.min(maxW, Math.max(SIDEBAR_WIDTH_MIN, st.startW + dx));
      setSidebarWidthPx(next);
    },
    [],
  );

  const onLayoutResizerPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (resizeState.current) {
        resizeState.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
    },
    [],
  );

  const searchSection = (
    <div className="wit-sidebar-search">
      <label className="wit-sidebar-search-label">
        <span className="wit-sidebar-search-heading">Search</span>
        <input
          type="search"
          placeholder="Titles, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search pages"
          className="wit-sidebar-search-input"
        />
      </label>
    </div>
  );

  return (
    <div className="wit-app">
      <header className="container wit-app-header">
        <div className="wit-app-header-left">
          <h1>wit</h1>
          <p>Local markdown notebook</p>
        </div>

        <div className="wit-app-header-right">
          <div className="wit-app-header-save">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void editorRef.current?.save()}
            >
              {editorHeader.saving ? "Saving…" : "Save"}
            </button>

            {editorHeader.loading ? (
              <small className="wit-muted">Loading…</small>
            ) : null}
            {editorHeader.dirty ? (
              <small className="wit-muted">Unsaved changes</small>
            ) : null}

            {editorHeader.saveError ? (
              <small style={{ color: "var(--pico-del-color, crimson)" }}>
                {editorHeader.saveError}
              </small>
            ) : null}
            {editorHeader.witLinkNotice ? (
              <small className="wit-muted">{editorHeader.witLinkNotice}</small>
            ) : null}
          </div>

          <WitSettingsMenu
            accent={accent}
            onAccentChange={setAccent}
            fontPreset={fontPreset}
            onFontPresetChange={setFontPreset}
            textSize={textSize}
            onTextSizeChange={setTextSize}
            colorScheme={colorScheme}
            onColorSchemeChange={handleColorSchemeChange}
          />
        </div>
      </header>

      {dup.length > 0 ? (
        <article className="container contrast">
          <strong>Duplicate page ids</strong>
          <ul>
            {dup.map((w) => (
              <li key={w.id}>
                <code>{w.id}</code>: {w.paths.join(", ")}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="wit-layout-outer">
        <div className="wit-layout">
          {sidebarOpen ? (
            <aside
              className="wit-sidebar"
              style={{ width: sidebarWidthPx, flex: `0 0 ${sidebarWidthPx}px` }}
              aria-label="Pages and outline"
            >
              <div className="wit-sidebar-topbar">
                <span className="wit-sidebar-topbar-label">Pages</span>
                <button
                  type="button"
                  className="wit-sidebar-float-toggle wit-sidebar-float-toggle--in-panel"
                  aria-label="Hide pages panel"
                  aria-expanded={true}
                  onClick={() => setSidebarOpen(false)}
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {loading ? (
                <p className="wit-sidebar-status">Loading pages…</p>
              ) : null}
              {error ? (
                <article className="contrast wit-sidebar-status">
                  <p>{error}</p>
                  <button type="button" onClick={() => void refresh()}>
                    Retry
                  </button>
                </article>
              ) : null}

              <div className="wit-sidebar-body">
                {searchHits ? (
                  <>
                    <PinnedSection
                      pages={pages}
                      selectedPageId={resolvedSelectedId}
                      onPreviewPin={openPinPreview}
                    />
                    <nav
                      className="wit-sidebar-scroll wit-sidebar-scroll--search"
                      aria-label="Search results"
                    >
                      <ul>
                        {searchHits.length === 0 ? (
                          <li>No matches</li>
                        ) : (
                          searchHits.map((p) => (
                            <li key={p.id}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedId(p.id);
                                }}
                              >
                                {p.title}
                              </a>
                              <small
                                className="wit-muted"
                                style={{ display: "block" }}
                              >
                                {p.tags.join(", ")}
                              </small>
                            </li>
                          ))
                        )}
                      </ul>
                    </nav>
                  </>
                ) : (
                  <>
                    <SidebarTree
                      pages={pages}
                      selectedId={resolvedSelectedId}
                      onSelect={setSelectedId}
                      onStructureChange={handleStructureChange}
                      onPageCreated={setSelectedId}
                      onPageRenamed={handlePageRenamed}
                      onPageDeleted={handlePageDeleted}
                    />
                    <PinnedSection
                      pages={pages}
                      selectedPageId={resolvedSelectedId}
                      onPreviewPin={openPinPreview}
                    />
                  </>
                )}
              </div>

              {searchSection}
            </aside>
          ) : null}

          {sidebarOpen ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize pages panel"
              aria-valuenow={Math.round(sidebarWidthPx)}
              aria-valuemin={SIDEBAR_WIDTH_MIN}
              aria-valuemax={Math.round(sidebarWidthMax())}
              className="wit-layout-resizer"
              tabIndex={0}
              onPointerDown={onLayoutResizerPointerDown}
              onPointerMove={onLayoutResizerPointerMove}
              onPointerUp={onLayoutResizerPointerUp}
              onPointerCancel={onLayoutResizerPointerUp}
              onKeyDown={(e) => {
                const step = 12;
                const maxW = sidebarWidthMax();
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSidebarWidthPx((w) =>
                    Math.max(SIDEBAR_WIDTH_MIN, w - step),
                  );
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSidebarWidthPx((w) => Math.min(maxW, w + step));
                }
              }}
            />
          ) : null}

          <main className="wit-main">
            {!sidebarOpen ? (
              <div
                className="wit-sidebar-collapse-rail"
                aria-label="Collapsed sidebar controls"
              >
                <button
                  type="button"
                  className="wit-sidebar-float-toggle"
                  aria-label="Show pages panel"
                  aria-expanded={false}
                  onClick={() => setSidebarOpen(true)}
                >
                  <ChevronRightIcon />
                </button>
                <WitCollapsedPinControl
                  pages={pages}
                  onPreviewPin={openPinPreview}
                />
              </div>
            ) : null}
            <div className="wit-main-body">
              {!sidebarOpen && collapsedRouteLabel ? (
                <nav
                  className="wit-main-route-context"
                  aria-label="Current page in outline"
                >
                  {collapsedRouteLabel}
                </nav>
              ) : null}
              <PageEditor
                ref={editorRef}
                pageId={resolvedSelectedId}
                pages={pages}
                colorScheme={colorScheme}
                onNavigateToPage={(id) => setSelectedId(id)}
                onHeaderStateChange={setEditorHeader}
              />
            </div>
          </main>
          <PinnedBlockPreviewModal
            pin={previewPin}
            pages={pages}
            colorScheme={colorScheme}
            onClose={closePinPreview}
          />
        </div>
      </div>
    </div>
  );
}
