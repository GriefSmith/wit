import { BlockNoteView } from '@blocknote/mantine'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PointerEvent, Ref } from 'react'

import { deletePageOverlay, fetchPage, putPageContent } from '../api'
import { extractStructuralOverlay, parseStoredPageBody } from '../lib/blocknotePersistence'
import { isWitPageHref, witHrefToPageId } from '../lib/internalLinks'
import { captureScrollAnchor, holdScrollPosition } from '../lib/scrollAnchor'
import type { ScrollAnchor, ScrollTarget } from '../lib/scrollAnchor'
import { witBlockNoteSchema } from '../lib/witBlockNoteSchema'
import type { PageMeta } from '../types'

import { PageNavButtons } from './PageNavButtons'
import { witEditorSideMenu } from './WitEditorSideMenu'

/** Scroll writes are batched; Safari throttles frequent `history.replaceState`. */
const SCROLL_RECORD_DEBOUNCE_MS = 250

type WitEditor = (typeof witBlockNoteSchema)['BlockNoteEditor']

/** `editor.domElement` throws while unmounted (tiptap view proxy). */
function mountedEditorElement(editor: WitEditor): HTMLElement | null {
  try {
    return editor.domElement ?? null
  } catch {
    return null
  }
}

export type PageEditorHandle = {
  save: () => Promise<void>
  reloadFromMarkdown: () => Promise<void>
  captureScrollAnchor: () => ScrollAnchor | null
}

export type PageEditorHeaderState = {
  loading: boolean
  saving: boolean
  dirty: boolean
  loadError: string | null
  saveError: string | null
  witLinkNotice: string | null
  overlayStale: boolean
}

type Props = {
  /** A plain prop, not `forwardRef`: React 19.2 leaves `useEffectEvent` stale inside `forwardRef`. */
  ref?: Ref<PageEditorHandle>
  pageId: string | null
  /** A new value opens a fresh editor; a `pageId` change alone (rename) keeps the current one. */
  editorSession: number
  pages: PageMeta[]
  onNavigateToPage: (pageId: string) => void
  onHeaderStateChange?: (state: PageEditorHeaderState) => void
  /** Must match app theme so the editor face is not stuck on OS light/dark. */
  colorScheme: 'light' | 'dark'
  /** Where to scroll once the page is loaded (or immediately, if already loaded); null = top. */
  scrollTarget: ScrollTarget | null
  onScrollAnchorChange?: (pageId: string, anchor: ScrollAnchor) => void
}

export function PageEditor({
  ref,
  pageId,
  editorSession,
  pages,
  onNavigateToPage,
  onHeaderStateChange,
  colorScheme,
  scrollTarget,
  onScrollAnchorChange,
}: Props) {
  const editor = useCreateBlockNote({ schema: witBlockNoteSchema }, [editorSession])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [witLinkNotice, setWitLinkNotice] = useState<string | null>(null)
  const [overlayStale, setOverlayStale] = useState(false)
  const [overlayNoticeDismissed, setOverlayNoticeDismissed] = useState(false)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)
  /** Editor instance whose page content has finished loading. */
  const loadedEditorRef = useRef<WitEditor | null>(null)
  const releaseHoldRef = useRef<(() => void) | null>(null)

  const pageIdSet = useMemo(() => new Set(pages.map((p) => p.id)), [pages])

  const sideMenuComponent = useMemo(
    () => witEditorSideMenu(pages, pageId),
    [pages, pageId],
  )

  const navigateIfKnown = useCallback(
    (targetId: string) => {
      if (!pageIdSet.has(targetId)) {
        setWitLinkNotice(`No page with id “${targetId}” in this workspace.`)
        return
      }
      setWitLinkNotice(null)
      onNavigateToPage(targetId)
    },
    [onNavigateToPage, pageIdSet],
  )

  const handleEditorPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) {
        return
      }
      const target = e.target as HTMLElement | null

      if (e.metaKey || e.ctrlKey) {
        const linkHost = target?.closest?.('[data-wit-page-link-host]')
        const rawId = linkHost?.getAttribute('data-wit-page-id')
        if (rawId && rawId.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          navigateIfKnown(rawId)
          return
        }
      }

      const anchor = target?.closest?.('a')
      const href = anchor?.getAttribute('href')
      if (!isWitPageHref(href)) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      navigateIfKnown(witHrefToPageId(href))
    },
    [navigateIfKnown],
  )

  const applyFetchedDoc = useCallback(
    (doc: { markdown_body: string; editor_overlay?: string | null; overlay_stale?: boolean }) => {
      const blocks = parseStoredPageBody(
        editor,
        doc.markdown_body,
        doc.editor_overlay ?? undefined,
      )
      // Loading is not an edit: keep it out of undo so Cmd+Z cannot blank the page.
      editor.transact((tr) => {
        tr.setMeta('addToHistory', false)
        editor.replaceBlocks(editor.document, blocks as typeof editor.document)
      })
      setOverlayStale(Boolean(doc.overlay_stale))
      setOverlayNoticeDismissed(false)
    },
    [editor],
  )

  const scrollTo = useCallback(
    (target: ScrollTarget | null) => {
      releaseHoldRef.current?.()
      const root = mountedEditorElement(editor)
      if (!root) {
        return
      }
      releaseHoldRef.current = holdScrollPosition(root, target, () => {
        releaseHoldRef.current = null
      })
    },
    [editor],
  )

  useEffect(() => () => releaseHoldRef.current?.(), [editor])

  const applyScrollTarget = useEffectEvent((target: ScrollTarget | null) => {
    if (loadedEditorRef.current === editor) {
      scrollTo(target)
    }
  })

  useEffect(() => {
    applyScrollTarget(scrollTarget)
  }, [scrollTarget])

  const finishLoad = useEffectEvent((doc: Awaited<ReturnType<typeof fetchPage>>) => {
    applyFetchedDoc(doc)
    loadedEditorRef.current = editor
    scrollTo(scrollTarget)
  })

  const startLoad = useEffectEvent((isCancelled: () => boolean) => {
    if (!pageId) {
      setLoadError(null)
      setDirty(false)
      setOverlayStale(false)
      setOverlayNoticeDismissed(false)
      return
    }

    setLoading(true)
    setLoadError(null)
    setDirty(false)
    setOverlayStale(false)
    setOverlayNoticeDismissed(false)

    fetchPage(pageId)
      .then((doc) => {
        if (!isCancelled()) {
          finishLoad(doc)
        }
      })
      .catch((e: unknown) => {
        if (!isCancelled()) {
          setLoadError(e instanceof Error ? e.message : 'Load failed')
        }
      })
      .finally(() => {
        if (!isCancelled()) {
          queueMicrotask(() => {
            setLoading(false)
          })
        }
      })
  })

  useEffect(() => {
    let cancelled = false
    startLoad(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [editorSession, editor])

  const save = useCallback(async () => {
    if (!pageId) {
      return
    }
    setSaveError(null)
    setSaving(true)
    try {
      const md = editor.blocksToMarkdownLossy(editor.document)
      const overlay = extractStructuralOverlay(editor.document)
      await putPageContent(pageId, {
        markdown_body: md.endsWith('\n') ? md : `${md}\n`,
        editor_overlay: overlay,
      })
      setDirty(false)
      setOverlayStale(false)
      setOverlayNoticeDismissed(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [editor, pageId])

  const reloadFromMarkdown = useCallback(
    async (options?: { confirm?: boolean }) => {
      if (!pageId) {
        return
      }
      if (options?.confirm !== false) {
        const warn = dirty
          ? 'You have unsaved changes. Reload from the markdown file anyway? Editor-only structure will be rebuilt.'
          : 'Reload this page from the markdown file? Editor-only structure (block ids, empty blocks) will be rebuilt.'
        if (!window.confirm(warn)) {
          return
        }
      }
      setSaveError(null)
      setLoading(true)
      const root = mountedEditorElement(editor)
      const anchor = root ? captureScrollAnchor(root) : null
      try {
        await deletePageOverlay(pageId)
        const doc = await fetchPage(pageId)
        applyFetchedDoc({
          ...doc,
          editor_overlay: null,
          overlay_stale: false,
        })
        // Block ids are rebuilt here, so this usually lands via the raw `top` fallback.
        scrollTo(anchor)
        await putPageContent(pageId, {
          editor_overlay: extractStructuralOverlay(editor.document),
        })
        setDirty(false)
        setOverlayStale(false)
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : 'Reload failed')
      } finally {
        setLoading(false)
      }
    },
    [applyFetchedDoc, dirty, editor, pageId, scrollTo],
  )

  useImperativeHandle(
    ref,
    () => ({
      save,
      reloadFromMarkdown,
      captureScrollAnchor: () => {
        if (!pageId || loadedEditorRef.current !== editor) {
          return null
        }
        const root = mountedEditorElement(editor)
        return root ? captureScrollAnchor(root) : null
      },
    }),
    [save, reloadFromMarkdown, pageId, editor],
  )

  useEffect(() => {
    onHeaderStateChange?.({
      loading,
      saving,
      dirty,
      loadError,
      saveError,
      witLinkNotice,
      overlayStale,
    })
  }, [
    onHeaderStateChange,
    loading,
    saving,
    dirty,
    loadError,
    saveError,
    witLinkNotice,
    overlayStale,
  ])

  /** The ProseMirror root (`.bn-editor`) is the scroll container, see `.wit-editor-surface` CSS. */
  useEffect(() => {
    setScrollRoot(mountedEditorElement(editor))
    const offMount = editor.onMount(() => setScrollRoot(mountedEditorElement(editor)))
    const offUnmount = editor.onUnmount(() => setScrollRoot(null))
    return () => {
      offMount()
      offUnmount()
    }
  }, [editor])

  useEffect(() => {
    if (!scrollRoot || !pageId || !onScrollAnchorChange) {
      return
    }
    let timer: number | undefined
    const onScroll = () => {
      if (releaseHoldRef.current || loadedEditorRef.current !== editor) {
        return
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        onScrollAnchorChange(pageId, captureScrollAnchor(scrollRoot))
      }, SCROLL_RECORD_DEBOUNCE_MS)
    }
    scrollRoot.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      scrollRoot.removeEventListener('scroll', onScroll)
    }
  }, [scrollRoot, pageId, editor, onScrollAnchorChange])

  if (!pageId) {
    return <p className="wit-placeholder">Select a page from the tree.</p>
  }

  if (loadError) {
    return (
      <article className="contrast">
        <p>{loadError}</p>
      </article>
    )
  }

  return (
    <div
      className="wit-editor-surface"
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
      <PageNavButtons
        pageId={pageId}
        pages={pages}
        scrollRoot={scrollRoot}
        onNavigate={onNavigateToPage}
      />
      <BlockNoteView
        editor={editor}
        theme={colorScheme}
        sideMenu={false}
        onChange={() => {
          if (loading || saving) {
            return
          }
          setDirty(true)
        }}
      >
        <SideMenuController sideMenu={sideMenuComponent} />
      </BlockNoteView>
    </div>
  )
}
