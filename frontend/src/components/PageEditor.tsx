import { BlockNoteView } from "@blocknote/mantine";
import { SideMenuController, useCreateBlockNote } from "@blocknote/react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PointerEvent, Ref } from "react";
import { createPortal } from "react-dom";

import {
  deletePageOverlay,
  fetchOpener,
  fetchPage,
  putOpener,
  putPageContent,
} from "../api";
import {
  extractStructuralOverlay,
  peelStyleEdgesForMarkdown,
  parseStoredPageBody,
} from "../lib/blocknotePersistence";
import { isWitPageHref, witHrefToPageId } from "../lib/internalLinks";
import { cleanOpenerDocument, emptyOpenerDocument } from "../lib/openerSidecar";
import type {
  OpenerDocument,
  OpenerHidden,
  OpenerPalette,
} from "../lib/openerSidecar";
import {
  chapterEntrance,
  resolveTitleMeta,
  showPreviousPage,
} from "../lib/pageStyle";
import type { ChapterDirection, ResolvedStyle } from "../lib/pageStyle";
import { captureScrollAnchor, holdScrollPosition } from "../lib/scrollAnchor";
import type { ScrollAnchor, ScrollTarget } from "../lib/scrollAnchor";
import { witBlockNoteSchema } from "../lib/witBlockNoteSchema";
import type { PageMeta } from "../types";

import { PageNavButtons } from "./PageNavButtons";
import { TitleOpener } from "./TitleOpener";
import { witEditorSideMenu } from "./WitEditorSideMenu";

/** Scroll writes are batched; Safari throttles frequent `history.replaceState`. */
const SCROLL_RECORD_DEBOUNCE_MS = 250;

/** `scrollTo` clamps, so this holds the bottom while layout settles. */
const BOTTOM_TARGET: ScrollTarget = {
  blockId: null,
  offset: 0,
  top: Number.MAX_SAFE_INTEGER,
};

type WitEditor = (typeof witBlockNoteSchema)["BlockNoteEditor"];

/** `editor.domElement` throws while unmounted (tiptap view proxy). */
function mountedEditorElement(editor: WitEditor): HTMLElement | null {
  try {
    return editor.domElement ?? null;
  } catch {
    return null;
  }
}

function openerHostElement(editor: WitEditor): HTMLElement | null {
  const host = mountedEditorElement(editor)?.closest(".bn-root");
  return host instanceof HTMLElement ? host : null;
}

export type PageEditorHandle = {
  save: () => Promise<void>;
  reloadFromMarkdown: () => Promise<void>;
  captureScrollAnchor: () => ScrollAnchor | null;
};

export type PageEditorHeaderState = {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  loadError: string | null;
  saveError: string | null;
  witLinkNotice: string | null;
  overlayStale: boolean;
  titleHeadingInView: boolean;
};

type Props = {
  /** A plain prop, not `forwardRef`: React 19.2 leaves `useEffectEvent` stale inside `forwardRef`. */
  ref?: Ref<PageEditorHandle>;
  pageId: string | null;
  /** A new value opens a fresh editor; a `pageId` change alone (rename) keeps the current one. */
  editorSession: number;
  pages: PageMeta[];
  sheet: ResolvedStyle | null;
  onNavigateToPage: (pageId: string) => boolean;
  onHeaderStateChange?: (state: PageEditorHeaderState) => void;
  /** Must match app theme so the editor face is not stuck on OS light/dark. */
  colorScheme: "light" | "dark";
  /** Where to scroll once the page is loaded (or immediately, if already loaded); null = top. */
  scrollTarget: ScrollTarget | null;
  onScrollAnchorChange?: (pageId: string, anchor: ScrollAnchor) => void;
};

export function PageEditor({
  ref,
  pageId,
  editorSession,
  pages,
  sheet,
  onNavigateToPage,
  onHeaderStateChange,
  colorScheme,
  scrollTarget,
  onScrollAnchorChange,
}: Props) {
  const editor = useCreateBlockNote({ schema: witBlockNoteSchema }, [
    editorSession,
  ]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [witLinkNotice, setWitLinkNotice] = useState<string | null>(null);
  const [overlayStale, setOverlayStale] = useState(false);
  const [overlayNoticeDismissed, setOverlayNoticeDismissed] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [openerHost, setOpenerHost] = useState<HTMLElement | null>(null);

  const openerTitle =
    pages.find((page) => page.id === pageId)?.title.trim() ?? "";
  const openerKind = sheet?.opener ?? null;
  const titleMeta =
    openerKind === "title" && pageId ? resolveTitleMeta(pageId, pages) : null;
  const openerVersion = titleMeta?.version ?? "";
  const openerAuthors = titleMeta?.authors ?? [];
  const showTitleLine =
    (openerKind === "title" || openerKind === "book") && openerTitle !== "";
  const showVersion = openerKind === "title" && openerVersion !== "";
  const showAuthors = openerKind === "title" && openerAuthors.length > 0;
  const showOpener = showTitleLine || showVersion || showAuthors;
  const titleHeadingShown = showOpener && openerKind === "title";
  const [titleHeadingEl, setTitleHeadingEl] = useState<HTMLElement | null>(
    null,
  );
  const [titleHeadingInView, setTitleHeadingInView] = useState(false);
  const [openerDoc, setOpenerDoc] =
    useState<OpenerDocument>(emptyOpenerDocument);
  const [chapterSlide, setChapterSlide] = useState<
    "from-left" | "from-right" | null
  >(null);
  /** Set only by Previous / Next; consumed by the next `finishLoad`. */
  const entranceRef = useRef<{
    pageId: string;
    direction: ChapterDirection;
  } | null>(null);

  /** `.bn-editor` scrolls until an opening needs the same scroller. */
  const scrollElement = useCallback(
    () =>
      (showOpener ? openerHostElement(editor) : null) ??
      mountedEditorElement(editor),
    [editor, showOpener],
  );
  /** Editor instance whose page content has finished loading. */
  const loadedEditorRef = useRef<WitEditor | null>(null);
  const releaseHoldRef = useRef<(() => void) | null>(null);

  const pageIdSet = useMemo(() => new Set(pages.map((p) => p.id)), [pages]);

  const sideMenuComponent = useMemo(
    () => witEditorSideMenu(pages, pageId),
    [pages, pageId],
  );

  const navigateIfKnown = useCallback(
    (targetId: string) => {
      if (!pageIdSet.has(targetId)) {
        setWitLinkNotice(`No page with id “${targetId}” in this workspace.`);
        return;
      }
      setWitLinkNotice(null);
      entranceRef.current = null;
      onNavigateToPage(targetId);
    },
    [onNavigateToPage, pageIdSet],
  );

  const goToNeighbor = useCallback(
    (id: string, direction: ChapterDirection) => {
      if (!onNavigateToPage(id)) {
        return;
      }
      entranceRef.current = { pageId: id, direction };
    },
    [onNavigateToPage],
  );

  const commitOpenerHidden = useCallback(
    async (hidden: OpenerHidden) => {
      if (!pageId) {
        return;
      }
      await putOpener(pageId, { hidden });
      setOpenerDoc((prev) => ({ ...prev, hidden }));
    },
    [pageId],
  );

  const commitOpenerBackground = useCallback(
    async (palette: OpenerPalette | null) => {
      if (!pageId) {
        return;
      }
      await putOpener(pageId, {
        background: palette ? { kind: "palette", name: palette } : null,
      });
      setOpenerDoc((prev) => ({
        ...prev,
        background: palette ? { kind: "palette", name: palette } : null,
      }));
    },
    [pageId],
  );

  const handleEditorPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) {
        return;
      }
      const target = e.target as HTMLElement | null;

      if (e.metaKey || e.ctrlKey) {
        const linkHost = target?.closest?.("[data-wit-page-link-host]");
        const rawId = linkHost?.getAttribute("data-wit-page-id");
        if (rawId && rawId.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          navigateIfKnown(rawId);
          return;
        }
      }

      const anchor = target?.closest?.("a");
      const href = anchor?.getAttribute("href");
      if (!isWitPageHref(href)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      navigateIfKnown(witHrefToPageId(href));
    },
    [navigateIfKnown],
  );

  const applyFetchedDoc = useCallback(
    (doc: {
      markdown_body: string;
      editor_overlay?: string | null;
      overlay_stale?: boolean;
    }) => {
      const blocks = parseStoredPageBody(
        editor,
        doc.markdown_body,
        doc.editor_overlay ?? undefined,
      );
      // Loading is not an edit: keep it out of undo so Cmd+Z cannot blank the page.
      editor.transact((tr) => {
        tr.setMeta("addToHistory", false);
        editor.replaceBlocks(editor.document, blocks as typeof editor.document);
      });
      setOverlayStale(Boolean(doc.overlay_stale));
      setOverlayNoticeDismissed(false);
    },
    [editor],
  );

  const scrollTo = useCallback(
    (target: ScrollTarget | null) => {
      releaseHoldRef.current?.();
      const root = scrollElement();
      if (!root) {
        return;
      }
      releaseHoldRef.current = holdScrollPosition(root, target, () => {
        releaseHoldRef.current = null;
      });
    },
    [scrollElement],
  );

  useEffect(() => () => releaseHoldRef.current?.(), [editor]);

  const applyScrollTarget = useEffectEvent((target: ScrollTarget | null) => {
    if (loadedEditorRef.current === editor) {
      scrollTo(target);
    }
  });

  useEffect(() => {
    applyScrollTarget(scrollTarget);
  }, [scrollTarget]);

  const finishLoad = useEffectEvent(
    (doc: Awaited<ReturnType<typeof fetchPage>>) => {
      applyFetchedDoc(doc);
      loadedEditorRef.current = editor;
      const pending = entranceRef.current;
      entranceRef.current = null;
      const entrance = chapterEntrance(
        sheet?.opener ?? null,
        pending?.pageId === pageId ? pending.direction : null,
      );
      scrollTo(entrance.scroll === "bottom" ? BOTTOM_TARGET : scrollTarget);
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      setChapterSlide(!reduce && entrance.slide ? entrance.slide : null);
    },
  );

  const startLoad = useEffectEvent((isCancelled: () => boolean) => {
    if (!pageId) {
      setLoadError(null);
      setDirty(false);
      setOverlayStale(false);
      setOverlayNoticeDismissed(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setDirty(false);
    setOverlayStale(false);
    setOverlayNoticeDismissed(false);

    fetchPage(pageId)
      .then((doc) => {
        if (!isCancelled()) {
          finishLoad(doc);
        }
      })
      .catch((e: unknown) => {
        if (!isCancelled()) {
          setLoadError(e instanceof Error ? e.message : "Load failed");
        }
      })
      .finally(() => {
        if (!isCancelled()) {
          queueMicrotask(() => {
            setLoading(false);
          });
        }
      });
  });

  useEffect(() => {
    let cancelled = false;
    startLoad(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [editorSession, editor]);

  const save = useCallback(async () => {
    if (!pageId) {
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const blocksForSave = peelStyleEdgesForMarkdown(editor.document);
      const md = editor.blocksToMarkdownLossy(blocksForSave);
      const overlay = extractStructuralOverlay(blocksForSave);
      await putPageContent(pageId, {
        markdown_body: md.endsWith("\n") ? md : `${md}\n`,
        editor_overlay: overlay,
      });
      setDirty(false);
      setOverlayStale(false);
      setOverlayNoticeDismissed(false);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [editor, pageId]);

  const reloadFromMarkdown = useCallback(
    async (options?: { confirm?: boolean }) => {
      if (!pageId) {
        return;
      }
      if (options?.confirm !== false) {
        const warn = dirty
          ? "You have unsaved changes. Reload from the markdown file anyway? Editor-only structure will be rebuilt."
          : "Reload this page from the markdown file? Editor-only structure (block ids, empty blocks) will be rebuilt.";
        if (!window.confirm(warn)) {
          return;
        }
      }
      setSaveError(null);
      setLoading(true);
      const root = scrollElement();
      const anchor = root ? captureScrollAnchor(root) : null;
      try {
        await deletePageOverlay(pageId);
        const doc = await fetchPage(pageId);
        applyFetchedDoc({
          ...doc,
          editor_overlay: null,
          overlay_stale: false,
        });
        // Block ids are rebuilt here, so this usually lands via the raw `top` fallback.
        scrollTo(anchor);
        await putPageContent(pageId, {
          editor_overlay: extractStructuralOverlay(editor.document),
        });
        setDirty(false);
        setOverlayStale(false);
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : "Reload failed");
      } finally {
        setLoading(false);
      }
    },
    [applyFetchedDoc, dirty, editor, pageId, scrollElement, scrollTo],
  );

  useImperativeHandle(
    ref,
    () => ({
      save,
      reloadFromMarkdown,
      captureScrollAnchor: () => {
        if (!pageId || loadedEditorRef.current !== editor) {
          return null;
        }
        const root = scrollElement();
        return root ? captureScrollAnchor(root) : null;
      },
    }),
    [save, reloadFromMarkdown, pageId, editor, scrollElement],
  );

  useEffect(() => {
    onHeaderStateChange?.({
      loading,
      saving,
      dirty,
      loadError,
      saveError,
      witLinkNotice,
      overlayStale,
      titleHeadingInView,
    });
  }, [
    onHeaderStateChange,
    loading,
    saving,
    dirty,
    loadError,
    saveError,
    witLinkNotice,
    overlayStale,
    titleHeadingInView,
  ]);

  useEffect(() => {
    setTitleHeadingInView(titleHeadingShown);
  }, [titleHeadingShown, pageId]);

  useEffect(() => {
    if (!titleHeadingShown || !titleHeadingEl || !scrollRoot) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setTitleHeadingInView(entry.isIntersecting);
      },
      { root: scrollRoot, threshold: 0 },
    );
    observer.observe(titleHeadingEl);
    return () => observer.disconnect();
  }, [titleHeadingShown, titleHeadingEl, scrollRoot]);

  useEffect(() => {
    if (openerKind !== "title" || !pageId) {
      setOpenerDoc(emptyOpenerDocument());
      return;
    }
    let cancelled = false;
    setOpenerDoc(emptyOpenerDocument());
    void fetchOpener(pageId)
      .then((raw) => {
        if (!cancelled) {
          setOpenerDoc(cleanOpenerDocument(raw));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOpenerDoc(emptyOpenerDocument());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [openerKind, pageId]);

  /** The page list can arrive after the body, moving a restore that is still holding. */
  const reapplyHeldScroll = useEffectEvent(() => {
    if (releaseHoldRef.current && loadedEditorRef.current === editor) {
      scrollTo(scrollTarget);
    }
  });

  /** See `.wit-editor-surface` CSS for which element scrolls. */
  useEffect(() => {
    const sync = () => {
      setScrollRoot(scrollElement());
      setOpenerHost(showOpener ? openerHostElement(editor) : null);
    };
    sync();
    reapplyHeldScroll();
    const offMount = editor.onMount(sync);
    const offUnmount = editor.onUnmount(() => {
      setScrollRoot(null);
      setOpenerHost(null);
    });
    return () => {
      offMount();
      offUnmount();
    };
  }, [editor, scrollElement, showOpener]);

  useEffect(() => {
    if (!scrollRoot || !pageId || !onScrollAnchorChange) {
      return;
    }
    let timer: number | undefined;
    const onScroll = () => {
      if (releaseHoldRef.current || loadedEditorRef.current !== editor) {
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        onScrollAnchorChange(pageId, captureScrollAnchor(scrollRoot));
      }, SCROLL_RECORD_DEBOUNCE_MS);
    };
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      scrollRoot.removeEventListener("scroll", onScroll);
    };
  }, [scrollRoot, pageId, editor, onScrollAnchorChange]);

  if (!pageId) {
    return <p className="wit-placeholder">Select a page from the tree.</p>;
  }

  if (loadError) {
    return (
      <article className="contrast">
        <p>{loadError}</p>
      </article>
    );
  }

  return (
    <div
      className={
        chapterSlide
          ? `wit-editor-surface wit-chapter-enter-${chapterSlide}`
          : "wit-editor-surface"
      }
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) {
          setChapterSlide(null);
        }
      }}
      data-sheet-measure={sheet?.measure ?? undefined}
      data-scene-break={
        sheet && sheet.scene_break !== "rule" ? sheet.scene_break : undefined
      }
      data-sheet-opener={showOpener ? openerKind ?? undefined : undefined}
      onPointerDownCapture={handleEditorPointerDown}
    >
      {overlayStale && !overlayNoticeDismissed ? (
        <div className="wit-overlay-stale-banner" role="status">
          <p>
            This page was edited outside the editor. Showing the markdown file;
            block identities were rebuilt.
          </p>
          <div className="wit-overlay-stale-banner-actions">
            <button
              type="button"
              className="wit-overlay-stale-banner-btn"
              onClick={() => setOverlayNoticeDismissed(true)}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="wit-overlay-stale-banner-btn"
              onClick={() => void reloadFromMarkdown({ confirm: false })}
              disabled={loading || saving}
            >
              Discard editor cache
            </button>
          </div>
        </div>
      ) : null}
      {showOpener && openerHost && openerKind === "title"
        ? createPortal(
            <TitleOpener
              key={pageId}
              ref={titleHeadingShown ? setTitleHeadingEl : undefined}
              title={showTitleLine ? openerTitle : ""}
              version={openerVersion}
              authors={openerAuthors}
              doc={openerDoc}
              onCommitHidden={commitOpenerHidden}
              onCommitBackground={commitOpenerBackground}
            />,
            openerHost,
          )
        : null}
      {showOpener && openerHost && openerKind !== "title"
        ? createPortal(
            <header
              className={`wit-chapter-opener wit-chapter-opener--${openerKind}`}
            >
              {showTitleLine ? (
                <span className="wit-chapter-opener-title">{openerTitle}</span>
              ) : null}
            </header>,
            openerHost,
          )
        : null}
      <PageNavButtons
        pageId={pageId}
        pages={pages}
        scrollRoot={scrollRoot}
        onNavigate={goToNeighbor}
        showPrevious={showPreviousPage(sheet?.opener ?? null)}
      />
      <BlockNoteView
        editor={editor}
        theme={colorScheme}
        sideMenu={false}
        onChange={() => {
          if (loading || saving) {
            return;
          }
          setDirty(true);
        }}
      >
        <SideMenuController sideMenu={sideMenuComponent} />
      </BlockNoteView>
    </div>
  );
}
