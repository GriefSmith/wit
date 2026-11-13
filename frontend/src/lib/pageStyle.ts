export type PageStyle = {
  measure?: string
  opener?: string
  scene_break?: string
}

export type SheetMeasure = 'narrow' | 'book' | 'wide'
export type SheetOpener = 'title' | 'book' | 'chapter'
export type SheetSceneBreak = 'rule' | 'gap' | 'ornament'

export type ResolvedStyle = {
  measure: SheetMeasure | null
  opener: SheetOpener | null
  scene_break: SheetSceneBreak
}

const MEASURES = new Set(['narrow', 'book', 'wide', 'default'])
const OPENERS = new Set(['title', 'book', 'chapter', 'default'])
const SCENE_BREAKS = new Set(['rule', 'gap', 'ornament', 'default'])

type StylePage = {
  id: string
  parent: string
  style?: PageStyle | null
  version?: string | null
  authors?: string[] | null
}

function accepted(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== 'string' || !allowed.has(value)) {
    return undefined
  }
  return value
}

function ancestorChain(pageId: string, pages: readonly StylePage[]): StylePage[] {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const seen = new Set<string>()
  const upward: StylePage[] = []
  let current = byId.get(pageId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    upward.push(current)
    const parentId = current.parent.trim()
    if (!parentId) {
      break
    }
    current = byId.get(parentId)
  }
  upward.reverse()
  return upward
}

export function resolvePageStyle(
  pageId: string,
  pages: readonly StylePage[],
): ResolvedStyle {
  const resolved: ResolvedStyle = {
    measure: null,
    opener: null,
    scene_break: 'rule',
  }
  const chain = ancestorChain(pageId, pages)
  for (const page of chain) {
    const style = page.style
    if (!style) {
      continue
    }
    const measure = accepted(style.measure, MEASURES)
    if (measure === 'default') {
      resolved.measure = null
    } else if (measure === 'narrow' || measure === 'book' || measure === 'wide') {
      resolved.measure = measure
    }
    const sceneBreak = accepted(style.scene_break, SCENE_BREAKS)
    if (sceneBreak === 'default' || sceneBreak === 'rule') {
      resolved.scene_break = 'rule'
    } else if (sceneBreak === 'gap' || sceneBreak === 'ornament') {
      resolved.scene_break = sceneBreak
    }
  }
  const own = chain.at(-1)
  if (own?.id === pageId) {
    const opener = accepted(own.style?.opener, OPENERS)
    if (opener === 'title' || opener === 'book' || opener === 'chapter') {
      resolved.opener = opener
    }
  }
  return resolved
}

export type TitleMeta = {
  version: string | null
  authors: string[] | null
}

function cleanVersion(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  return raw.trim() || null
}

function cleanAuthors(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const names = raw
    .filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  return names.length > 0 ? names : null
}

/** The open page's own values win; each missing field comes from the nearest `title` ancestor. */
export function resolveTitleMeta(
  pageId: string,
  pages: readonly StylePage[],
): TitleMeta {
  const resolved: TitleMeta = { version: null, authors: null }
  const upward = ancestorChain(pageId, pages).reverse()
  for (const page of upward) {
    const isOwn = page.id === pageId
    if (!isOwn && accepted(page.style?.opener, OPENERS) !== 'title') {
      continue
    }
    resolved.version ??= cleanVersion(page.version)
    resolved.authors ??= cleanAuthors(page.authors)
    if (resolved.version !== null && resolved.authors !== null) {
      break
    }
  }
  return resolved
}

export type ChapterDirection = 'next' | 'previous'

export type ChapterEntrance = {
  slide: 'from-left' | 'from-right' | null
  scroll: 'top' | 'bottom' | null
}

export function chapterEntrance(
  opener: SheetOpener | null,
  direction: ChapterDirection | null,
): ChapterEntrance {
  if (opener !== 'chapter' || direction === null) {
    return { slide: null, scroll: null }
  }
  if (direction === 'next') {
    return { slide: 'from-left', scroll: 'top' }
  }
  return { slide: 'from-right', scroll: 'bottom' }
}
