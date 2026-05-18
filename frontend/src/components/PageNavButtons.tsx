import { useCallback, useEffect, useState } from 'react'

import { adjacentPageIdsInTreeOrder } from '../lib/tree'
import type { PageMeta } from '../types'

const SCROLL_EDGE_PX = 8

type Props = {
  pageId: string
  pages: PageMeta[]
  scrollRoot: HTMLElement | null
  onNavigate: (pageId: string) => void
}

export function PageNavButtons({ pageId, pages, scrollRoot, onNavigate }: Props) {
  const { prevId, nextId } = adjacentPageIdsInTreeOrder(pages, pageId)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(true)

  const updateScrollEdges = useCallback(() => {
    const el = scrollRoot
    if (!el) {
      setAtTop(true)
      setAtBottom(true)
      return
    }
    const { scrollTop, clientHeight, scrollHeight } = el
    const maxScroll = Math.max(0, scrollHeight - clientHeight)
    setAtTop(scrollTop <= SCROLL_EDGE_PX)
    setAtBottom(scrollTop >= maxScroll - SCROLL_EDGE_PX)
  }, [scrollRoot])

  useEffect(() => {
    updateScrollEdges()
  }, [pageId, scrollRoot, updateScrollEdges])

  useEffect(() => {
    const el = scrollRoot
    if (!el) {
      return
    }
    updateScrollEdges()
    el.addEventListener('scroll', updateScrollEdges, { passive: true })
    const ro = new ResizeObserver(updateScrollEdges)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollEdges)
      ro.disconnect()
    }
  }, [scrollRoot, updateScrollEdges])

  const goPrev = () => {
    if (prevId) {
      onNavigate(prevId)
    }
  }

  const goNext = () => {
    if (nextId) {
      onNavigate(nextId)
    }
  }

  return (
    <div className="wit-page-nav" aria-label="Page navigation" role="group">
      {atTop ? (
        <button
          type="button"
          className="wit-page-nav-btn wit-page-nav-btn--prev"
          disabled={!prevId}
          onClick={goPrev}
          aria-label="Previous page"
        >
          Previous Page
        </button>
      ) : null}
      {atBottom ? (
        <button
          type="button"
          className="wit-page-nav-btn wit-page-nav-btn--next"
          disabled={!nextId}
          onClick={goNext}
          aria-label="Next page"
        >
          Next Page
        </button>
      ) : null}
    </div>
  )
}
