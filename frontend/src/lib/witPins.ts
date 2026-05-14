import type { WitPin } from '../types'

export const WIT_PINS_STORAGE_KEY = 'wit-block-pins-v1'

export function readPinsFromStorage(): WitPin[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(WIT_PINS_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }
    const out: WitPin[] = []
    for (const row of parsed) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const r = row as Record<string, unknown>
      if (
        typeof r.pageId === 'string' &&
        typeof r.blockId === 'string' &&
        typeof r.label === 'string' &&
        typeof r.blockType === 'string' &&
        typeof r.pinnedAt === 'number'
      ) {
        out.push({
          pageId: r.pageId,
          blockId: r.blockId,
          label: r.label,
          blockType: r.blockType,
          pinnedAt: r.pinnedAt,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

export function writePinsToStorage(pins: WitPin[]): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(WIT_PINS_STORAGE_KEY, JSON.stringify(pins))
}

export function pinKey(pageId: string, blockId: string): string {
  return `${pageId}::${blockId}`
}

export function upsertPin(pins: WitPin[], next: Omit<WitPin, 'pinnedAt'> & { pinnedAt?: number }): WitPin[] {
  const key = pinKey(next.pageId, next.blockId)
  const filtered = pins.filter((p) => pinKey(p.pageId, p.blockId) !== key)
  const pinnedAt = next.pinnedAt ?? Date.now()
  return [...filtered, { ...next, pinnedAt }].sort((a, b) => b.pinnedAt - a.pinnedAt)
}

export function removePinByIds(pins: WitPin[], pageId: string, blockId: string): WitPin[] {
  const key = pinKey(pageId, blockId)
  return pins.filter((p) => pinKey(p.pageId, p.blockId) !== key)
}

export function migratePinsPageId(pins: WitPin[], previousId: string, nextId: string): WitPin[] {
  return pins.map((p) => (p.pageId === previousId ? { ...p, pageId: nextId } : p))
}

export function removePinsForPage(pins: WitPin[], pageId: string): WitPin[] {
  return pins.filter((p) => p.pageId !== pageId)
}
