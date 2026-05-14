import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { fetchPage } from '../api'
import { parseStoredPageBody } from '../lib/blocknotePersistence'
import { isWitPageHref } from '../lib/internalLinks'
import { cloneBlockSubtree, findBlockByIdDeep } from '../lib/pinBlockPreview'
import { witBlockNoteSchema } from '../lib/witBlockNoteSchema'
import type { PageMeta, WitPin } from '../types'

type Props = {
  pin: WitPin | null
  pages: PageMeta[]
  colorScheme: 'light' | 'dark'
  onClose: () => void
}

function pageTitle(pages: PageMeta[], pageId: string): string {
  return pages.find((p) => p.id === pageId)?.title ?? pageId
}

type BodyProps = {
  pin: WitPin
  pages: PageMeta[]
  colorScheme: 'light' | 'dark'
  onClose: () => void
}

function PinnedBlockPreviewBody({ pin, pages, colorScheme, onClose }: BodyProps) {
  const editor = useCreateBlockNote(
    { schema: witBlockNoteSchema },
    [`${pin.pageId}::${pin.blockId}`],
  )
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    setMessage(null)

    fetchPage(pin.pageId)
      .then((doc) => {
        if (cancelled) {
          return
        }
        const blocks = parseStoredPageBody(
          editor,
          doc.markdown_body,
          doc.editor_overlay ?? undefined,
        )
        const found = findBlockByIdDeep(blocks, pin.blockId)
        if (!found) {
          setPhase('error')
          setMessage('That block no longer exists on this page.')
          editor.replaceBlocks(editor.document, [])
          return
        }
        const root = cloneBlockSubtree(found)
        editor.replaceBlocks(editor.document, [root] as typeof editor.document)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setPhase('error')
          setMessage(e instanceof Error ? e.message : 'Could not load page.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [editor, pin.blockId, pin.pageId])

  const swallowNav = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return
    }
    const target = e.target as HTMLElement | null
    if (e.metaKey || e.ctrlKey) {
      const linkHost = target?.closest?.('[data-wit-page-link-host]')
      if (linkHost) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
    const anchor = target?.closest?.('a')
    const href = anchor?.getAttribute('href')
    if (isWitPageHref(href)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  return (
    <article className="wit-pin-preview-card">
      <header className="wit-pin-preview-header">
        <div className="wit-pin-preview-titles">
          <h2 className="wit-pin-preview-title">{pageTitle(pages, pin.pageId)}</h2>
          <p className="wit-pin-preview-sub">
            <span className="wit-pin-type-pill">{pin.blockType}</span>
          </p>
        </div>
        <button type="button" className="secondary wit-pin-preview-close" onClick={onClose}>
          Close
        </button>
      </header>

      {phase === 'loading' ? (
        <p className="wit-muted wit-pin-preview-status">Loading…</p>
      ) : null}
      {phase === 'error' && message ? (
        <p className="wit-pin-preview-error" role="alert">
          {message}
        </p>
      ) : null}

      {phase === 'ready' ? (
        <div className="wit-pin-preview-editor" onPointerDownCapture={swallowNav}>
          <BlockNoteView editor={editor} theme={colorScheme} editable={false} sideMenu={false} />
        </div>
      ) : null}
    </article>
  )
}

export function PinnedBlockPreviewModal({ pin, pages, colorScheme, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    if (pin) {
      if (!el.open) {
        el.showModal()
      }
    } else if (el.open) {
      el.close()
    }
  }, [pin])

  return (
    <dialog
      ref={ref}
      className="wit-pin-preview-dialog"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) {
          onClose()
        }
      }}
    >
      {pin ? (
        <PinnedBlockPreviewBody
          key={`${pin.pageId}::${pin.blockId}`}
          pin={pin}
          pages={pages}
          colorScheme={colorScheme}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  )
}
