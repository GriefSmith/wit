import { useEffect, useRef, useState } from 'react'
import { RiPushpinLine } from 'react-icons/ri'

import { useWitPins } from '../context/WitPinsContext'
import type { PageMeta, WitPin } from '../types'

type Props = {
  pages: PageMeta[]
  onPreviewPin: (pin: WitPin) => void
}

export function WitCollapsedPinControl({ pages, onPreviewPin }: Props) {
  const { pins, removePin } = useWitPins()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const close = (e: MouseEvent) => {
      const el = wrapRef.current
      if (el && !el.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = window.setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('click', close)
    }
  }, [open])

  const titleFor = (pageId: string) => pages.find((p) => p.id === pageId)?.title ?? pageId

  return (
    <div className="wit-collapsed-pins" ref={wrapRef}>
      <button
        type="button"
        className="wit-sidebar-float-toggle wit-sidebar-float-toggle--pin"
        aria-label={open ? 'Close pinned list' : 'Open pinned blocks'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <RiPushpinLine size={18} aria-hidden />
      </button>
      {open ? (
        <div className="wit-collapsed-pins-dropdown" role="menu">
          <div className="wit-collapsed-pins-dropdown-title">Pinned</div>
          {pins.length === 0 ? (
            <p className="wit-collapsed-pins-empty wit-muted">No pins yet. Pin from a block’s ⋮ menu.</p>
          ) : (
            <ul className="wit-collapsed-pins-list">
              {pins.map((pin) => (
                <li key={`${pin.pageId}::${pin.blockId}`}>
                  <button
                    type="button"
                    className="wit-collapsed-pins-item"
                    role="menuitem"
                    onClick={() => {
                      onPreviewPin(pin)
                      setOpen(false)
                    }}
                  >
                    <span className="wit-collapsed-pins-item-label">{pin.label}</span>
                    <span className="wit-collapsed-pins-item-meta">
                      {titleFor(pin.pageId)}
                      <span className="wit-pin-type-pill">{pin.blockType}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wit-collapsed-pins-unpin"
                    aria-label={`Unpin ${pin.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removePin(pin.pageId, pin.blockId)
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
