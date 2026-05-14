/**
 * Pin list preview: only this block’s own inline/table “surface” text — never
 * nested child blocks (so toggles don’t flatten their children into one line).
 */

const DEFAULT_MAX = 96

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) {
    return t
  }
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

function textFromStyledTextArray(nodes: unknown): string {
  if (!Array.isArray(nodes)) {
    return ''
  }
  return nodes
    .map((n) => {
      if (typeof n === 'string') {
        return n
      }
      if (!n || typeof n !== 'object') {
        return ''
      }
      const o = n as Record<string, unknown>
      if (o.type === 'text' && typeof o.text === 'string') {
        return o.text
      }
      if (o.type === 'link' && Array.isArray(o.content)) {
        return textFromStyledTextArray(o.content)
      }
      return ''
    })
    .join('')
}

function textFromInlineContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return textFromStyledTextArray(content)
}

function textFromTableContent(content: unknown, maxCellChars: number): string {
  if (!content || typeof content !== 'object') {
    return ''
  }
  const rows = (content as { rows?: unknown }).rows
  if (!Array.isArray(rows) || rows.length === 0) {
    return ''
  }
  const first = rows[0] as { cells?: unknown }
  if (!first || !Array.isArray(first.cells)) {
    return ''
  }
  const bits: string[] = []
  for (const cell of first.cells) {
    if (bits.join(' ').length >= maxCellChars) {
      break
    }
    if (Array.isArray(cell)) {
      bits.push(textFromInlineContent(cell))
    } else if (cell && typeof cell === 'object' && 'content' in (cell as object)) {
      bits.push(textFromInlineContent((cell as { content: unknown }).content))
    }
  }
  return bits.join(' · ').trim()
}

export function blockSelfPreviewLabel(
  block: { type: string; content?: unknown; props?: Record<string, unknown> },
  maxLen = DEFAULT_MAX,
): string {
  const type = block.type

  if (type === 'divider') {
    return 'Divider'
  }

  if (block.content !== undefined && block.content !== null) {
    if (typeof block.content === 'object' && !Array.isArray(block.content)) {
      const maybeRows = (block.content as { rows?: unknown }).rows
      if (Array.isArray(maybeRows)) {
        const t = textFromTableContent(block.content, 120)
        return truncate(t || 'Table', maxLen)
      }
    }
    const inline = textFromInlineContent(block.content)
    if (inline.trim()) {
      return truncate(inline, maxLen)
    }
  }

  if (type === 'pageLink' && typeof block.props?.pageId === 'string' && block.props.pageId) {
    return truncate(`→ ${block.props.pageId}`, maxLen)
  }

  if (type === 'image' && typeof block.props?.url === 'string' && block.props.url) {
    return 'Image'
  }

  if (type === 'card') {
    const imageUrl = typeof block.props?.imageUrl === 'string' ? block.props.imageUrl : ''
    const inline = textFromInlineContent(block.content)
    if (inline.trim()) {
      return truncate(`Card: ${inline}`, maxLen)
    }
    return imageUrl ? 'Card (image)' : 'Card'
  }

  if (type === 'video' && typeof block.props?.url === 'string') {
    return 'Video'
  }

  if (type === 'audio' && typeof block.props?.url === 'string') {
    return 'Audio'
  }

  if (type === 'file') {
    return 'File'
  }

  return truncate(type, maxLen)
}

export function findBlockByIdDeep<T extends { id: string; children?: T[] }>(
  blocks: T[],
  id: string,
): T | undefined {
  for (const b of blocks) {
    if (b.id === id) {
      return b
    }
    if (b.children?.length) {
      const nested = findBlockByIdDeep(b.children, id)
      if (nested) {
        return nested
      }
    }
  }
  return undefined
}

export function cloneBlockSubtree<T>(block: T): T {
  return structuredClone(block) as T
}
