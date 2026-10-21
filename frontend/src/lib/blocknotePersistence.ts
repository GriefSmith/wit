import { witBlockNoteSchema } from './witBlockNoteSchema'

type WitBlockNoteEditor = (typeof witBlockNoteSchema)['BlockNoteEditor']

type EditorOverlay = {
  version: number
  markdown_sha256?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any[]
}

type StyledInline = {
  type?: string
  text?: string
  styles?: Record<string, unknown>
  content?: unknown
  children?: unknown
  rows?: unknown
  cells?: unknown[]
}

type StyledText = StyledInline & { type: 'text'; text: string }

type Edge = 'start' | 'end'

/** Styles the markdown exporter writes as `*`, `**`, or `~~` around the text. */
const DELIMITER_STYLES = ['bold', 'italic', 'strike']

const EDGE_SPACE = { start: /^\s+/u, end: /\s+$/u }
const EDGE_PUNCTUATION = { start: /^[\p{P}\p{S}]+/u, end: /[\p{P}\p{S}]+$/u }
// The exporter counts anything that is not whitespace, punctuation, or a symbol as a letter.
const NEIGHBOR_IS_WORD = { start: /[^\s\p{P}\p{S}]$/u, end: /^[^\s\p{P}\p{S}]/u }

function isStyledText(node: unknown): node is StyledText {
  return (
    Boolean(node) &&
    typeof node === 'object' &&
    (node as StyledInline).type === 'text' &&
    typeof (node as StyledInline).text === 'string'
  )
}

function styleKey(styles: Record<string, unknown> | undefined): string {
  if (!styles) return ''
  return Object.keys(styles)
    .filter((key) => Boolean(styles[key]))
    .sort()
    .map((key) => `${key}=${String(styles[key])}`)
    .join('\0')
}

function delimiterKey(node: unknown): string {
  if (!isStyledText(node) || node.styles?.code) return ''
  return DELIMITER_STYLES.filter((key) => node.styles?.[key]).join('+')
}

function isInlineContent(content: unknown): content is StyledInline[] {
  return (
    Array.isArray(content) &&
    content.every(
      (node) =>
        Boolean(node) &&
        typeof node === 'object' &&
        !('props' in node) &&
        !('children' in node),
    )
  )
}

/** Keep only the delimiter styles the neighbor also has, so the peeled text joins its run. */
function stylesSharedWith(
  styles: Record<string, unknown> | undefined,
  neighbor: unknown,
): Record<string, unknown> {
  const shared = { ...styles }
  for (const key of DELIMITER_STYLES) {
    if (!isStyledText(neighbor) || !neighbor.styles?.[key]) delete shared[key]
  }
  return shared
}

function neighborIsWord(neighbor: unknown, edge: Edge): boolean {
  return (
    isStyledText(neighbor) &&
    !neighbor.styles?.code &&
    NEIGHBOR_IS_WORD[edge].test(neighbor.text)
  )
}

function takeEdge(
  group: StyledText[],
  edge: Edge,
  pattern: Record<Edge, RegExp>,
  neighbor: unknown,
): StyledText[] {
  const taken: StyledText[] = []
  const nodes = edge === 'start' ? group : [...group].reverse()
  for (const node of nodes) {
    if (!node.text) continue
    const match = pattern[edge].exec(node.text)?.[0] ?? ''
    if (!match) break
    node.text =
      edge === 'start'
        ? node.text.slice(match.length)
        : node.text.slice(0, -match.length)
    taken.push({ type: 'text', text: match, styles: stylesSharedWith(node.styles, neighbor) })
    if (node.text) break
  }
  return edge === 'start' ? taken : taken.reverse()
}

/**
 * Markers cannot form with whitespace just inside them, or with punctuation
 * just inside and a letter just outside. Peel those characters off the run.
 */
function peelEdge(group: StyledText[], edge: Edge, neighbor: unknown): StyledText[] {
  const markers = DELIMITER_STYLES.filter((key) => group[0].styles?.[key])
  if (isStyledText(neighbor) && markers.every((key) => neighbor.styles?.[key])) return []
  const space = takeEdge(group, edge, EDGE_SPACE, neighbor)
  if (space.length || !neighborIsWord(neighbor, edge)) return space
  const punctuation = takeEdge(group, edge, EDGE_PUNCTUATION, neighbor)
  const innerSpace = takeEdge(group, edge, EDGE_SPACE, neighbor)
  return edge === 'start'
    ? [...punctuation, ...innerSpace]
    : [...innerSpace, ...punctuation]
}

/**
 * The markdown exporter encodes characters as references like `&#x20;` when
 * bold, italic, or strike markers would not form: a space just inside the
 * markers, or punctuation inside them glued to a letter outside (`Ben**."**`).
 * Return a copy of the blocks with those characters moved out of the run.
 */
export function peelStyleEdgesForMarkdown<T>(blocks: T): T {
  const copy = structuredClone(blocks)
  rewriteStyledEdges(copy)
  return copy
}

function rewriteStyledEdges(value: unknown) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) rewriteStyledEdges(item)
    return
  }
  const node = value as StyledInline
  if (isInlineContent(node.content)) {
    node.content = normalizeInlineContent(node.content)
  }
  if (Array.isArray(node.cells)) {
    node.cells = node.cells.map((cell) =>
      isInlineContent(cell) ? normalizeInlineContent(cell) : cell,
    )
  }
  rewriteStyledEdges(node.content)
  rewriteStyledEdges(node.children)
  rewriteStyledEdges(node.rows)
  rewriteStyledEdges(node.cells)
}

function normalizeInlineContent(content: StyledInline[]): StyledInline[] {
  const out: StyledInline[] = []
  let index = 0
  while (index < content.length) {
    const key = delimiterKey(content[index])
    if (!key) {
      out.push(content[index])
      index += 1
      continue
    }

    let end = index + 1
    while (end < content.length && delimiterKey(content[end]) === key) end += 1

    const group = content.slice(index, end) as StyledText[]
    const head = peelEdge(group, 'start', out[out.length - 1])
    const tail = peelEdge(group, 'end', content[end])
    if (group.every((node) => !node.text)) {
      for (const piece of head) piece.styles = stylesSharedWith(piece.styles, content[end])
    }
    out.push(...head, ...group.filter((node) => node.text), ...tail)
    index = end
  }

  const merged: StyledInline[] = []
  for (const node of out) {
    const prev = merged[merged.length - 1]
    if (
      isStyledText(prev) &&
      isStyledText(node) &&
      styleKey(prev.styles) === styleKey(node.styles)
    ) {
      prev.text += node.text
      continue
    }
    merged.push(node)
  }
  return merged
}

/**
 * Serialize `editor.document` into the JSON string written to the `.json` sidecar.
 * The markdown body captures readable content; this captures everything else
 * (nesting, empty blocks, block props) that markdown cannot express.
 * The server stamps `markdown_sha256` from the stored markdown body on save.
 */
export function extractStructuralOverlay(
  blocks: WitBlockNoteEditor['document'],
): string {
  return JSON.stringify({ version: 3, document: blocks })
}

/**
 * Reconstruct editor blocks from stored data.
 * Uses the JSON overlay directly when present (lossless); falls back to parsing
 * the markdown body otherwise. Accepts overlay versions 2 and 3.
 */
export function parseStoredPageBody(
  editor: WitBlockNoteEditor,
  markdownBody: string,
  editorOverlay?: string | null,
): WitBlockNoteEditor['document'] {
  const overlay = editorOverlay?.trim()
  if (overlay) {
    try {
      const parsed = JSON.parse(overlay) as EditorOverlay
      if (
        (parsed.version === 2 || parsed.version === 3) &&
        Array.isArray(parsed.document)
      ) {
        return parsed.document as WitBlockNoteEditor['document']
      }
    } catch {
      // fall through to markdown
    }
  }
  return editor.tryParseMarkdownToBlocks(markdownBody)
}
