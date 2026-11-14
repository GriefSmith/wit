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

const LABEL_MAX = 120

export type OpenerAffix = {
  before: string
  after: string
}

export type OpenerLabels = {
  version: OpenerAffix | null
  authors: Record<string, OpenerAffix>
}

export type OpenerDocument = {
  labels: OpenerLabels
  background: { kind: 'palette'; name: OpenerPalette } | null
}

export type StoredLabels = {
  version?: OpenerAffix
  authors?: Record<string, OpenerAffix>
}

export type OpenerPutBody =
  | { labels: StoredLabels }
  | { background: { kind: 'palette'; name: OpenerPalette } | null }

export function emptyAffix(): OpenerAffix {
  return { before: '', after: '' }
}

export function emptyOpenerDocument(): OpenerDocument {
  return { labels: { version: null, authors: {} }, background: null }
}

function trimmedSide(raw: string): string {
  return raw.trim()
}

export function formatAffixed(value: string, affix: OpenerAffix | null): string {
  if (!affix) {
    return value
  }
  const before = trimmedSide(affix.before)
  const after = trimmedSide(affix.after)
  let text = value
  if (before) {
    text = `${before} ${text}`
  }
  if (after) {
    text = `${text} ${after}`
  }
  return text
}

export function formatAuthorLine(
  authors: readonly string[],
  authorsAffix: Record<string, OpenerAffix>,
): string {
  return authors
    .map((name) => formatAffixed(name, authorsAffix[name] ?? null))
    .join(', ')
}

function isPalette(value: unknown): value is OpenerPalette {
  return (
    typeof value === 'string' &&
    (OPENER_PALETTES as readonly string[]).includes(value)
  )
}

function cleanSide(raw: unknown): string {
  if (typeof raw !== 'string') {
    return ''
  }
  const text = raw.trim()
  if (text.length > LABEL_MAX) {
    return ''
  }
  return text
}

function cleanAffix(raw: unknown): OpenerAffix | null {
  if (raw === null || typeof raw !== 'object') {
    return null
  }
  const record = raw as { before?: unknown; after?: unknown }
  const before = cleanSide(record.before)
  const after = cleanSide(record.after)
  if (!before && !after) {
    return null
  }
  return { before, after }
}

export function cleanOpenerDocument(raw: unknown): OpenerDocument {
  const doc = emptyOpenerDocument()
  if (raw === null || typeof raw !== 'object') {
    return doc
  }
  const record = raw as { labels?: unknown; background?: unknown }
  if (record.labels !== null && typeof record.labels === 'object') {
    const labels = record.labels as { version?: unknown; authors?: unknown }
    doc.labels.version = cleanAffix(labels.version)
    if (labels.authors !== null && typeof labels.authors === 'object') {
      for (const [name, value] of Object.entries(labels.authors)) {
        if (name.trim() === '') {
          continue
        }
        const affix = cleanAffix(value)
        if (affix) {
          doc.labels.authors[name] = affix
        }
      }
    }
  }
  if (record.background !== null && typeof record.background === 'object') {
    const background = record.background as { kind?: unknown; name?: unknown }
    if (background.kind === 'palette' && isPalette(background.name)) {
      doc.background = { kind: 'palette', name: background.name }
    }
  }
  return doc
}

function shownAuthors(
  doc: OpenerDocument,
  shown: readonly string[],
): Record<string, OpenerAffix> {
  const authors: Record<string, OpenerAffix> = {}
  for (const name of shown) {
    const affix = doc.labels.authors[name]
    if (!affix) {
      continue
    }
    const before = affix.before.trim()
    const after = affix.after.trim()
    if (!before && !after) {
      continue
    }
    authors[name] = { before, after }
  }
  return authors
}

function normalizeNext(next: OpenerAffix): OpenerAffix | null {
  const before = next.before.trim()
  const after = next.after.trim()
  if (!before && !after) {
    return null
  }
  return { before, after }
}

export function withVersionAffix(
  doc: OpenerDocument,
  shown: readonly string[],
  next: OpenerAffix,
): OpenerLabels {
  return {
    version: normalizeNext(next),
    authors: shownAuthors(doc, shown),
  }
}

export function withAuthorAffix(
  doc: OpenerDocument,
  shown: readonly string[],
  name: string,
  next: OpenerAffix,
): OpenerLabels {
  const authors = shownAuthors(doc, shown)
  const affix = normalizeNext(next)
  if (affix) {
    authors[name] = affix
  } else {
    delete authors[name]
  }
  return { version: doc.labels.version, authors }
}

export function labelsToStored(labels: OpenerLabels): StoredLabels {
  const stored: StoredLabels = {}
  if (labels.version) {
    const before = labels.version.before.trim()
    const after = labels.version.after.trim()
    if (before || after) {
      stored.version = { before, after }
    }
  }
  const authors: Record<string, OpenerAffix> = {}
  for (const [name, affix] of Object.entries(labels.authors)) {
    const before = affix.before.trim()
    const after = affix.after.trim()
    if (before || after) {
      authors[name] = { before, after }
    }
  }
  if (Object.keys(authors).length > 0) {
    stored.authors = authors
  }
  return stored
}
