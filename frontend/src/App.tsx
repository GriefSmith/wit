import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ColumnTree } from "./components/ColumnTree";
import { PageEditor } from "./components/PageEditor";
import { PinnedBlockPreviewModal } from "./components/PinnedBlockPreviewModal";
import { WitCollapsedPinControl } from "./components/WitCollapsedPinControl";
import { WitSettingsMenu } from "./components/WitSettingsMenu";
import { useWitPins } from "./context/WitPinsContext";
import { usePageNavigation } from "./hooks/usePageNavigation";
import { usePages } from "./hooks/usePages";
import { editorStatusMessage } from "./lib/editorStatus";
import {
  ACCENT_STORAGE_KEY,
  BG_THEME_STORAGE_KEY,
  HIDE_UI_STORAGE_KEY,
  SIZE_BUMP_STORAGE_KEY,
  TYPEFACE_STORAGE_KEY,
  getSystemColorScheme,
  readStoredAccent,
  readStoredBgTheme,
  readStoredHideUi,
  readStoredSizeBump,
  readStoredTypeface,
  resolveEffectiveColorScheme,
  subscribeSystemColorScheme,
} from "./lib/witAppearance";
import type {
  AccentName,
  BgThemeName,
  SizeBumpName,
  TypefaceName,
} from "./lib/witAppearance";
import { resolvePageStyle } from "./lib/pageStyle";
import {
  adjacentPageIdsInTreeOrder,
  formatPageRouteCrumb,
  pageTitleTrail,
} from "./lib/tree";
import type { WitPin } from "./types";
import type {
  PageEditorHandle,
  PageEditorHeaderState,
} from "./components/PageEditor";

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

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 5h6l2 2h10v6H3V5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M3 17h18M3 21h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const { data, error, refresh } = usePages();
  const witPins = useWitPins();
  const [previewPin, setPreviewPin] = useState<WitPin | null>(null);
  const [accent, setAccent] = useState<AccentName>(() => readStoredAccent());
  const [typeface, setTypeface] = useState<TypefaceName>(() =>
    readStoredTypeface(),
  );
  const [sizeBump, setSizeBump] = useState<SizeBumpName>(() =>
    readStoredSizeBump(),
  );
  const [bgTheme, setBgTheme] = useState<BgThemeName>(() => readStoredBgTheme());
  const [hideUi, setHideUi] = useState(() => readStoredHideUi());
  const systemColorScheme = useSyncExternalStore(
    subscribeSystemColorScheme,
    getSystemColorScheme,
    () => "light" as const,
  );
  const colorScheme = resolveEffectiveColorScheme(bgTheme, systemColorScheme);
  const [columnMode, setColumnMode] = useState<"page" | "tree">("page");
  const [treeSelectionId, setTreeSelectionId] = useState<string | null>(null);
  const [focusSearch, setFocusSearch] = useState(false);

  const pages = useMemo(() => data?.pages ?? [], [data]);

  const editorRef = useRef<PageEditorHandle | null>(null);
  const [editorHeader, setEditorHeader] = useState<PageEditorHeaderState>({
    loading: false,
    saving: false,
    dirty: false,
    loadError: null,
    saveError: null,
    witLinkNotice: null,
    overlayStale: false,
    titleHeadingInView: false,
  });

  const canLeavePage = useCallback(
    () =>
      !editorHeader.dirty ||
      window.confirm("This page has unsaved changes. Leave without saving?"),
    [editorHeader.dirty],
  );

  const captureEditorAnchor = useCallback(
    () => editorRef.current?.captureScrollAnchor() ?? null,
    [],
  );

  const {
    pageId: resolvedSelectedId,
    scrollTarget,
    editorSession,
    navigate,
    renameCurrent,
    recordAnchor,
  } = usePageNavigation({
    pages,
    pagesReady: data !== null,
    canLeave: canLeavePage,
    captureAnchor: captureEditorAnchor,
  });

  const sheet = useMemo(() => {
    if (!data || !resolvedSelectedId) {
      return null;
    }
    return resolvePageStyle(resolvedSelectedId, data.pages);
  }, [data, resolvedSelectedId]);

  /** Refresh / tab close would silently drop unsaved edits otherwise. */
  useEffect(() => {
    if (!editorHeader.dirty) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [editorHeader.dirty]);

  const selectedTitle = pages.find((p) => p.id === resolvedSelectedId)?.title;
  useEffect(() => {
    document.title = selectedTitle ? `${selectedTitle} · wit` : "wit";
  }, [selectedTitle]);

  const treeVisible = columnMode === "tree";
  const showEditorChrome = columnMode === "page" && !hideUi;
  const crumbText = formatPageRouteCrumb(
    pageTitleTrail(pages, resolvedSelectedId),
  );
  const { prevId, nextId } = resolvedSelectedId
    ? adjacentPageIdsInTreeOrder(pages, resolvedSelectedId)
    : { prevId: null, nextId: null };
  const statusText = editorStatusMessage({
    saveError: editorHeader.saveError,
    overlayStale: editorHeader.overlayStale,
    dirty: editorHeader.dirty,
    loading: editorHeader.loading,
    witLinkNotice: editorHeader.witLinkNotice,
  });

  const dup = data?.duplicate_warnings ?? [];

  const handleStructureChange = useCallback(() => refresh(), [refresh]);

  const canSave =
    Boolean(resolvedSelectedId) &&
    !editorHeader.loading &&
    !editorHeader.saving &&
    editorHeader.dirty &&
    !editorHeader.loadError;

  /**
   * Shift+Cmd+Enter (Shift+Ctrl+Enter off macOS) saves. Capture phase so the
   * chord never reaches the editor as a line break.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== "Enter" ||
        !e.shiftKey ||
        !(e.metaKey || e.ctrlKey) ||
        e.altKey ||
        e.isComposing
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (canSave && !e.repeat) {
        void editorRef.current?.save();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canSave]);

  const canReloadFromMarkdown =
    Boolean(resolvedSelectedId) &&
    !editorHeader.loading &&
    !editorHeader.saving &&
    !editorHeader.loadError;

  const openPage = useCallback(
    (id: string) => {
      if (!navigate(id)) {
        return false;
      }
      setColumnMode("page");
      return true;
    },
    [navigate],
  );

  const showTree = useCallback(() => {
    setTreeSelectionId(resolvedSelectedId);
    setColumnMode("tree");
  }, [resolvedSelectedId]);

  const onTreeIcon = useCallback(() => {
    if (columnMode === "tree") {
      if (resolvedSelectedId) {
        openPage(resolvedSelectedId);
      }
      return;
    }
    showTree();
  }, [columnMode, openPage, resolvedSelectedId, showTree]);

  const goArrow = useCallback(
    (id: string | null, direction: "next" | "previous") => {
      if (!id) {
        return;
      }
      const opened =
        editorRef.current?.openNeighbor(id, direction) ?? navigate(id);
      if (opened) {
        setColumnMode("page");
      }
    },
    [navigate],
  );

  const handlePageCreated = useCallback((id: string) => {
    setTreeSelectionId(id);
  }, []);

  const handlePageRenamed = useCallback(
    (previousId: string, nextId: string) => {
      witPins.onPageRenamed(previousId, nextId);
      renameCurrent(previousId, nextId);
      setTreeSelectionId((current) =>
        current === previousId ? nextId : current,
      );
    },
    [witPins, renameCurrent],
  );

  /** The navigation hook moves off the deleted page once the refreshed list arrives. */
  const handlePageDeleted = useCallback(
    (deletedId: string) => {
      witPins.onPageDeleted(deletedId);
      setTreeSelectionId((current) => {
        if (current !== deletedId) {
          return current;
        }
        if (resolvedSelectedId && resolvedSelectedId !== deletedId) {
          return resolvedSelectedId;
        }
        return pages.find((p) => p.id !== deletedId)?.id ?? null;
      });
    },
    [witPins, resolvedSelectedId, pages],
  );

  const openPinPreview = useCallback((pin: WitPin) => {
    setPreviewPin(pin);
  }, []);

  const closePinPreview = useCallback(() => {
    setPreviewPin(null);
  }, []);

  const openPinInPage = useCallback(
    (pin: WitPin) => {
      if (navigate(pin.pageId, { blockId: pin.blockId })) {
        setPreviewPin(null);
      }
    },
    [navigate],
  );

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
    if (typeface === "default") {
      root.removeAttribute("data-typeface");
    } else {
      root.setAttribute("data-typeface", typeface);
    }
    window.localStorage.setItem(TYPEFACE_STORAGE_KEY, typeface);
  }, [typeface]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (sizeBump === "none") {
      root.removeAttribute("data-size-bump");
    } else {
      root.setAttribute("data-size-bump", sizeBump);
    }
    window.localStorage.setItem(SIZE_BUMP_STORAGE_KEY, sizeBump);
  }, [sizeBump]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.setAttribute("data-theme", colorScheme);
  }, [colorScheme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (bgTheme === "default") {
      root.removeAttribute("data-bg-theme");
    } else {
      root.setAttribute("data-bg-theme", bgTheme);
    }
    window.localStorage.setItem(BG_THEME_STORAGE_KEY, bgTheme);
  }, [bgTheme]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    if (hideUi) {
      root.setAttribute("data-hide-ui", "on");
    } else {
      root.removeAttribute("data-hide-ui");
    }
    window.localStorage.setItem(HIDE_UI_STORAGE_KEY, hideUi ? "1" : "0");
  }, [hideUi]);

  useEffect(() => {
    if (hideUi) {
      setPreviewPin(null);
    }
  }, [hideUi]);

  useEffect(() => {
    if (!focusSearch || columnMode !== "tree") {
      return;
    }
    document.getElementById("wit-page-search-input")?.focus();
    setFocusSearch(false);
  }, [columnMode, focusSearch]);

  /** ⌘K (Ctrl+K off macOS) shows the tree and focuses its search. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (columnMode !== "tree") {
          setTreeSelectionId(resolvedSelectedId);
          setColumnMode("tree");
        }
        setFocusSearch(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [columnMode, resolvedSelectedId]);

  return (
    <div className="wit-app">
      <header className="container wit-app-header">
        <div className="wit-app-header-clip" inert={hideUi}>
          {showEditorChrome ? (
            <div className="wit-crumb">
              <span
                className="wit-crumb-path"
                data-empty={crumbText.length === 0 ? "true" : "false"}
              >
                {crumbText.length === 0 ? "No page" : crumbText}
              </span>
            </div>
          ) : null}
          <div className="wit-crumb-cluster">
            {statusText ? (
              <small className="wit-muted wit-crumb-status">{statusText}</small>
            ) : null}
            {showEditorChrome ? (
              <>
                <button
                  type="button"
                  className="wit-crumb-action"
                  data-action="save"
                  disabled={!canSave}
                  title="Save (Shift+Cmd+Enter)"
                  onClick={() => void editorRef.current?.save()}
                >
                  {editorHeader.saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="wit-crumb-action"
                  data-action="reload"
                  disabled={!canReloadFromMarkdown}
                  title="Reload from markdown"
                  onClick={() => void editorRef.current?.reloadFromMarkdown()}
                >
                  Reload from markdown
                </button>
                <button
                  type="button"
                  className="wit-crumb-arrow"
                  disabled={!prevId}
                  aria-label="Previous page"
                  onClick={() => goArrow(prevId, "previous")}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  className="wit-crumb-arrow"
                  disabled={!nextId}
                  aria-label="Next page"
                  onClick={() => goArrow(nextId, "next")}
                >
                  <ChevronRightIcon />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <article className="container contrast" inert={hideUi}>
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </article>
      ) : null}

      {dup.length > 0 ? (
        <article className="container contrast" inert={hideUi}>
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
          <main className="wit-main">
            <div
              className="wit-sidebar-collapse-rail"
              aria-label="Sidebar controls"
            >
              <button
                type="button"
                className="wit-sidebar-float-toggle"
                aria-label={
                  columnMode === "tree" ? "Show the open page" : "Show file tree"
                }
                aria-pressed={columnMode === "tree"}
                disabled={columnMode === "tree" && !resolvedSelectedId}
                onClick={onTreeIcon}
              >
                <TreeIcon />
              </button>
              <WitSettingsMenu
                accent={accent}
                onAccentChange={setAccent}
                typeface={typeface}
                onTypefaceChange={setTypeface}
                sizeBump={sizeBump}
                onSizeBumpChange={setSizeBump}
                bgTheme={bgTheme}
                onBgThemeChange={setBgTheme}
                hideUi={hideUi}
                onHideUiChange={setHideUi}
              />
              <WitCollapsedPinControl
                pages={pages}
                onPreviewPin={openPinPreview}
              />
            </div>
            <div className="wit-main-body">
              <div
                className="wit-editor-mount"
                data-hidden={treeVisible ? "true" : "false"}
                inert={treeVisible}
              >
                <PageEditor
                  ref={editorRef}
                  pageId={resolvedSelectedId}
                  editorSession={editorSession}
                  pages={pages}
                  sheet={sheet}
                  colorScheme={colorScheme}
                  onNavigateToPage={navigate}
                  onHeaderStateChange={setEditorHeader}
                  scrollTarget={scrollTarget}
                  onScrollAnchorChange={recordAnchor}
                />
              </div>
              {columnMode === "tree" ? (
                <div className="wit-column-tree-slot">
                  <ColumnTree
                    pages={pages}
                    selectedId={treeSelectionId}
                    unsavedPageId={
                      editorHeader.dirty ? resolvedSelectedId : null
                    }
                    onSelect={setTreeSelectionId}
                    onOpen={openPage}
                    onStructureChange={handleStructureChange}
                    onPageCreated={handlePageCreated}
                    onPageRenamed={handlePageRenamed}
                    onPageDeleted={handlePageDeleted}
                  />
                </div>
              ) : null}
            </div>
          </main>
          <PinnedBlockPreviewModal
            pin={previewPin}
            pages={pages}
            colorScheme={colorScheme}
            onClose={closePinPreview}
            onOpenInPage={openPinInPage}
          />
        </div>
      </div>
    </div>
  );
}
