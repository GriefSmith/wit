import { BlockNoteView } from '@blocknote/mantine'
import { SideMenuController, useCreateBlockNote } from '@blocknote/react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PointerEvent } from 'react'

import { deletePageOverlay, fetchPage, putPageContent } from '../api'
import { extractStructuralOverlay, parseStoredPageBody } from '../lib/blocknotePersistence'
import { isWitPageHref, witHrefToPageId } from '../lib/internalLinks'
import { witBlockNoteSchema } from '../lib/witBlockNoteSchema'
import type { PageMeta } from '../types'

import { PageNavButtons } from './PageNavButtons'
import { witEditorSideMenu } from './WitEditorSideMenu'

export type PageEditorHandle = {
  save: () => Promise<void>
  reloadFromMarkdown: () => Promise<void>
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
  pageId: string | null
  pages: PageMeta[]
  onNavigateToPage: (pageId: string) => void
  onHeaderStateChange?: (state: PageEditorHeaderState) => void
  /** Must match app theme so the editor face is not stuck on OS light/dark. */
  colorScheme: 'light' | 'dark'
}

export const PageEditor = forwardRef<PageEditorHandle, Props>(function PageEditor(
  { pageId, pages, onNavigateToPage, onHeaderStateChange, colorScheme },
  ref,
) {
  const editor = useCreateBlockNote({ schema: witBlockNoteSchema }, [pageId])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [witLinkNotice, setWitLinkNotice] = useState<string | null>(null)
  const [overlayStale, setOverlayStale] = useState(false)
  const [overlayNoticeDismissed, setOverlayNoticeDismissed] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null)

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
      editor.replaceBlocks(editor.document, blocks as typeof editor.document)
      setOverlayStale(Boolean(doc.overlay_stale))
      setOverlayNoticeDismissed(false)
    },
    [editor],
  )

  useEffect(() => {
    if (!pageId) {
      setLoadError(null)
      setDirty(false)
      setOverlayStale(false)
      setOverlayNoticeDismissed(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setDirty(false)
    setOverlayStale(false)
    setOverlayNoticeDismissed(false)

    fetchPage(pageId)
      .then((doc) => {
        if (cancelled) {
          return
        }
        applyFetchedDoc(doc)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Load failed')
        }
      })
      .finally(() => {
        if (!cancelled) {
          queueMicrotask(() => {
            setLoading(false)
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [pageId, editor, applyFetchedDoc])

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
      try {
        await deletePageOverlay(pageId)
        const doc = await fetchPage(pageId)
        applyFetchedDoc(doc)
        setDirty(false)
        setOverlayStale(false)
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : 'Reload failed')
      } finally {
        setLoading(false)
      }
    },
    [applyFetchedDoc, dirty, pageId],
  )

  useImperativeHandle(
    ref,
    () => ({
      save,
      reloadFromMarkdown,
    }),
    [save, reloadFromMarkdown],
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

  const bindScrollRoot = useCallback(() => {
    const el = surfaceRef.current?.querySelector<HTMLElement>('.bn-editor')
    setScrollRoot(el ?? null)
  }, [])

  useEffect(() => {
    bindScrollRoot()
    const surface = surfaceRef.current
    if (!surface) {
      return
    }
    const mo = new MutationObserver(bindScrollRoot)
    mo.observe(surface, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [bindScrollRoot, pageId, loading])

  useEffect(() => {
    const el = surfaceRef.current?.querySelector<HTMLElement>('.bn-editor')
    el?.scrollTo({ top: 0 })
  }, [pageId])

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
      ref={surfaceRef}
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
})
