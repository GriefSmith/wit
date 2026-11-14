export const OPENER_PALETTES = [
  'forest',
  'steppe',
  'mountain',
  'ocean',
  'dune',
  'wasteland',
] as const

export type OpenerPalette = (typeof OPENER_PALETTES)[number]

export const OPENER_PALETTE_LABELS: Record<OpenerPalette, string> = {
  forest: 'Forest',
  steppe: 'Steppe',
  mountain: 'Mountain',
  ocean: 'Ocean',
  dune: 'Dune',
  wasteland: 'Wasteland',
}

export type OpenerHidden = {
  version: boolean
  authors: boolean
}

export type OpenerBackground = { kind: 'palette'; name: OpenerPalette }

export type OpenerDocument = {
  hidden: OpenerHidden
  background: OpenerBackground | null
}

export type OpenerPutBody =
  | { hidden: OpenerHidden }
  | { background: OpenerBackground | null }

export function emptyOpenerDocument(): OpenerDocument {
  return { hidden: { version: false, authors: false }, background: null }
}

export function isOpenerPalette(value: unknown): value is OpenerPalette {
  return (
    typeof value === 'string' &&
    (OPENER_PALETTES as readonly string[]).includes(value)
  )
}

export function cleanOpenerDocument(raw: unknown): OpenerDocument {
  const doc = emptyOpenerDocument()
  if (raw === null || typeof raw !== 'object') {
    return doc
  }
  const record = raw as { hidden?: unknown; background?: unknown }
  if (record.hidden !== null && typeof record.hidden === 'object') {
    const hidden = record.hidden as { version?: unknown; authors?: unknown }
    doc.hidden.version = hidden.version === true
    doc.hidden.authors = hidden.authors === true
  }
  if (record.background !== null && typeof record.background === 'object') {
    const background = record.background as { kind?: unknown; name?: unknown }
    if (background.kind === 'palette' && isOpenerPalette(background.name)) {
      doc.background = { kind: 'palette', name: background.name }
    }
  }
  return doc
}
