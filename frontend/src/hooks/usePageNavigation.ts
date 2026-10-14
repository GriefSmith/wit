import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { blockJumpTarget, isScrollAnchor } from '../lib/scrollAnchor'
import type { ScrollAnchor, ScrollTarget } from '../lib/scrollAnchor'
import type { PageMeta } from '../types'

/** `?page=` rather than a path: `/pages/*` is the API prefix proxied by Vite. */
const PAGE_PARAM = 'page'
const LAST_LOCATION_KEY = 'wit-last-location'

type HistoryEntry = { witPageId: string; anchor?: ScrollAnchor }

type PageLocation = { pageId: string | null; target: ScrollTarget | null }

function readHistoryEntry(): HistoryEntry | null {
  const s = window.history.state as Partial<HistoryEntry> | null
  if (!s || typeof s.witPageId !== 'string') {
    return null
  }
  return { witPageId: s.witPageId, anchor: isScrollAnchor(s.anchor) ? s.anchor : undefined }
}

function pageIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(PAGE_PARAM) || null
}

function urlForPage(pageId: string | null): string {
  const url = new URL(window.location.href)
  if (pageId) {
    url.searchParams.set(PAGE_PARAM, pageId)
  } else {
    url.searchParams.delete(PAGE_PARAM)
  }
  return `${url.pathname}${url.search}${url.hash}`
}

function readLastLocation(): HistoryEntry | null {
  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<HistoryEntry>) : null
    if (!parsed || typeof parsed.witPageId !== 'string') {
      return null
    }
    return {
      witPageId: parsed.witPageId,
      anchor: isScrollAnchor(parsed.anchor) ? parsed.anchor : undefined,
    }
  } catch {
    return null
  }
}

function writeLastLocation(entry: HistoryEntry): void {
  window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(entry))
}

/** URL wins (refresh, shared link); otherwise reopen wherever the user last was. */
function initialLocation(): PageLocation {
  const fromUrl = pageIdFromUrl()
  const entry = readHistoryEntry()
  const last = readLastLocation()
  const pageId = fromUrl ?? last?.witPageId ?? null
  if (!pageId) {
    return { pageId: null, target: null }
  }
  const anchor =
    (entry?.witPageId === pageId ? entry.anchor : undefined) ??
    (last?.witPageId === pageId ? last.anchor : undefined)
  return { pageId, target: anchor ?? null }
}

type Options = {
  pages: PageMeta[]
  /** False until the first page list arrives; unknown ids are only resolved after that. */
  pagesReady: boolean
  /** Return false to cancel leaving the current page (e.g. unsaved changes). */
  canLeave: () => boolean
  /** Current scroll anchor of the open page, stored on its history entry before leaving. */
  captureAnchor: () => ScrollAnchor | null
}

/**
 * Keeps the open page in the URL and browser history so refresh, back/forward and
 * reopening the app return to the same page and scroll position.
 */
export function usePageNavigation({ pages, pagesReady, canLeave, captureAnchor }: Options) {
  const [location, setLocation] = useState<PageLocation>(initialLocation)
  const currentIdRef = useRef(location.pageId)
  /** Page list current when `location.pageId` was set; a stale list must not evict it. */
  const pagesAtNavRef = useRef<PageMeta[] | null>(null)
  const pagesRef = useRef(pages)
  const canLeaveRef = useRef(canLeave)
  const captureAnchorRef = useRef(captureAnchor)

  useEffect(() => {
    pagesRef.current = pages
    canLeaveRef.current = canLeave
    captureAnchorRef.current = captureAnchor
  })

  const commit = useCallback((pageId: string | null, target: ScrollTarget | null) => {
    currentIdRef.current = pageId
    pagesAtNavRef.current = pagesRef.current
    if (pageId) {
      writeLastLocation({ witPageId: pageId })
    }
    setLocation({ pageId, target })
  }, [])

  const stampCurrentEntry = useCallback((anchor: ScrollAnchor | null) => {
    const pageId = currentIdRef.current
    if (!pageId) {
      return
    }
    const entry: HistoryEntry = { witPageId: pageId, anchor: anchor ?? undefined }
    window.history.replaceState(entry, '', window.location.href)
    writeLastLocation(entry)
  }, [])

  /** Push a history entry for `pageId`; `blockId` scrolls to and highlights that block. */
  const navigate = useCallback(
    (pageId: string, opts?: { blockId?: string }): boolean => {
      const current = currentIdRef.current
      const target = opts?.blockId ? blockJumpTarget(opts.blockId) : null
      if (pageId === current) {
        if (target) {
          setLocation({ pageId, target })
        }
        return true
      }
      if (!canLeaveRef.current()) {
        return false
      }
      stampCurrentEntry(captureAnchorRef.current())
      window.history.pushState({ witPageId: pageId } satisfies HistoryEntry, '', urlForPage(pageId))
      commit(pageId, target)
      return true
    },
    [commit, stampCurrentEntry],
  )

  /** Swap the current entry without adding history (fallbacks, renames). */
  const replace = useCallback(
    (pageId: string | null, target: ScrollTarget | null = null) => {
      const entry = pageId ? ({ witPageId: pageId } satisfies HistoryEntry) : null
      window.history.replaceState(entry, '', urlForPage(pageId))
      commit(pageId, target)
    },
    [commit],
  )

  const renameCurrent = useCallback(
    (previousId: string, nextId: string) => {
      if (currentIdRef.current === previousId) {
        replace(nextId, captureAnchorRef.current())
      }
    },
    [replace],
  )

  /** Persist the latest scroll position of `pageId` (debounced by the caller). */
  const recordAnchor = useCallback(
    (pageId: string, anchor: ScrollAnchor) => {
      if (pageId === currentIdRef.current) {
        stampCurrentEntry(anchor)
      }
    },
    [stampCurrentEntry],
  )

  // Normalize the URL once so it always names the page being shown.
  useEffect(() => {
    const pageId = currentIdRef.current
    if (pageId && pageIdFromUrl() !== pageId) {
      window.history.replaceState(
        { witPageId: pageId } satisfies HistoryEntry,
        '',
        urlForPage(pageId),
      )
    }
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const pageId = pageIdFromUrl()
      const current = currentIdRef.current
      if (pageId === current) {
        return
      }
      if (!canLeaveRef.current()) {
        // The browser already moved; put the page being edited back on top.
        window.history.pushState(
          { witPageId: current, anchor: captureAnchorRef.current() ?? undefined },
          '',
          urlForPage(current),
        )
        return
      }
      const entry = readHistoryEntry()
      commit(pageId, entry?.witPageId === pageId ? (entry.anchor ?? null) : null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [commit])

  useEffect(() => {
    const flush = () => stampCurrentEntry(captureAnchorRef.current())
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [stampCurrentEntry])

  const pageIds = useMemo(() => new Set(pages.map((p) => p.id)), [pages])

  // Missing or unknown page (deleted, renamed outside the app, first visit): open the first page.
  useEffect(() => {
    if (!pagesReady) {
      return
    }
    const current = location.pageId
    if (current && (pageIds.has(current) || pages === pagesAtNavRef.current)) {
      return
    }
    const fallback = pages[0]?.id ?? null
    if (fallback !== current) {
      replace(fallback)
    }
  }, [pagesReady, pages, pageIds, location.pageId, replace])

  return {
    pageId: location.pageId,
    scrollTarget: location.target,
    navigate,
    renameCurrent,
    recordAnchor,
  }
}
