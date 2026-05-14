import { useWitPins } from '../context/WitPinsContext'
import type { PageMeta, WitPin } from '../types'

type Props = {
  pages: PageMeta[]
  selectedPageId: string | null
  onPreviewPin: (pin: WitPin) => void
}

function pageTitle(pages: PageMeta[], pageId: string): string {
  return pages.find((p) => p.id === pageId)?.title ?? pageId
}

export function PinnedSection({ pages, selectedPageId, onPreviewPin }: Props) {
  const { pins, removePin } = useWitPins()

  return (
    <nav className="wit-pinned-section" aria-label="Pinned blocks">
      <h2 className="wit-pinned-heading">Pinned</h2>
      {pins.length === 0 ? (
        <p className="wit-muted wit-pinned-empty">
          Pin blocks from the gutter menu, then click a pin here to preview that block (and its nested
          content) without leaving the page you are editing.
        </p>
      ) : (
        <ul className="wit-pinned-list">
          {pins.map((pin) => {
            const onPage = selectedPageId === pin.pageId
            return (
              <li key={`${pin.pageId}::${pin.blockId}`} className="wit-pinned-row">
                <button
                  type="button"
                  className={`wit-pin-nav${onPage ? ' wit-pin-nav--current-page' : ''}`}
                  onClick={() => onPreviewPin(pin)}
                >
                  <span className="wit-pin-nav-label">{pin.label}</span>
                  <span className="wit-pin-nav-meta">
                    {pageTitle(pages, pin.pageId)}
                    <span className="wit-pin-type-pill">{pin.blockType}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="wit-pin-unpin"
                  aria-label={`Unpin ${pin.label}`}
                  onClick={() => removePin(pin.pageId, pin.blockId)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </nav>
  )
}
