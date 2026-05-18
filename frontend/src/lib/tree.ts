import type { PageMeta, PageTreeNode } from '../types'

/** Normalize a raw slug to match backend ``_slugify_id_candidate``. */
export function slugifyPageId(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'page'
}

export function comparePageMeta(a: PageMeta, b: PageMeta): number {
  if (a.order !== b.order) {
    return a.order - b.order
  }
  const t = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
  if (t !== 0) {
    return t
  }
  return a.id.localeCompare(b.id)
}

/** Root pages use empty-string parent (not folder paths). */
export function flatToTree(pages: PageMeta[]): PageTreeNode[] {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const childMap = new Map<string | null, PageMeta[]>()

  for (const p of pages) {
    let parentKey: string | null =
      p.parent.trim() === '' ? null : p.parent.trim()
    if (parentKey !== null && !byId.has(parentKey)) {
      parentKey = null
    }
    if (!childMap.has(parentKey)) {
      childMap.set(parentKey, [])
    }
    childMap.get(parentKey)!.push(p)
  }

  for (const list of childMap.values()) {
    list.sort(comparePageMeta)
  }

  const build = (parentKey: string | null): PageTreeNode[] =>
    (childMap.get(parentKey) ?? []).map((p) => {
      const nested = build(p.id)
      const node: PageTreeNode = { id: p.id, name: p.title }
      if (nested.length > 0) {
        node.children = nested
      }
      return node
    })

  return build(null)
}

/** Depth-first preorder of page ids (matches sidebar tree order). */
export function pageTreePreorderIds(pages: PageMeta[]): string[] {
  const tree = flatToTree(pages)
  const ids: string[] = []
  const walk = (nodes: PageTreeNode[]) => {
    for (const n of nodes) {
      ids.push(n.id)
      if (n.children?.length) {
        walk(n.children)
      }
    }
  }
  walk(tree)
  return ids
}

/** Previous / next sibling in sidebar tree preorder; null when none. */
export function adjacentPageIdsInTreeOrder(
  pages: PageMeta[],
  currentId: string,
): { prevId: string | null; nextId: string | null } {
  const order = pageTreePreorderIds(pages)
  const index = order.indexOf(currentId)
  if (index < 0) {
    return { prevId: null, nextId: null }
  }
  return {
    prevId: index > 0 ? order[index - 1]! : null,
    nextId: index < order.length - 1 ? order[index + 1]! : null,
  }
}

/** Walk from ``pageId`` toward roots via ``parent``; returns titles root → leaf. */
export function pageTitleTrail(pages: PageMeta[], pageId: string | null): string[] {
  if (!pageId) {
    return []
  }
  const byId = new Map(pages.map((p) => [p.id, p]))
  const segments: string[] = []
  let cur: string | null = pageId
  const seen = new Set<string>()

  while (cur) {
    if (seen.has(cur)) {
      break
    }
    seen.add(cur)
    const p = byId.get(cur)
    if (!p) {
      break
    }
    segments.push(p.title)
    const rawParent = p.parent.trim()
    if (rawParent === '' || !byId.has(rawParent)) {
      break
    }
    cur = rawParent
  }

  segments.reverse()
  return segments
}

const ROUTE_SEP = ' / '

/** Single-line location string using display titles; middle-collapses when long. */
export function formatPageRouteCrumb(trail: string[], maxChars = 88): string {
  if (trail.length === 0) {
    return ''
  }
  if (trail.length === 1) {
    return trail[0]
  }
  const full = trail.join(ROUTE_SEP)
  if (full.length <= maxChars) {
    return full
  }
  const first = trail[0]
  const last = trail[trail.length - 1]
  return `${first}${ROUTE_SEP}…${ROUTE_SEP}${last}`
}
