export type PageMeta = {
  id: string
  title: string
  parent: string
  /** Sibling order under the same parent (lower = earlier). */
  order: number
  tags: string[]
  created: string | null
}

export type DuplicateWarning = {
  id: string
  paths: string[]
}

export type PagesPayload = {
  pages: PageMeta[]
  tags_index: Record<string, string[]>
  duplicate_warnings: DuplicateWarning[]
}

export type PageDetail = {
  id: string
  frontmatter: Record<string, unknown>
  markdown_body: string
  /** BlockNote internal HTML; stored under `.wit/editor/{id}.html`, not inside the .md body. */
  editor_overlay?: string | null
}

export type PageTreeNode = {
  id: string
  name: string
  children?: PageTreeNode[]
}

/** Local-only pin to a BlockNote block for quick navigation from the sidebar. */
export type WitPin = {
  pageId: string
  blockId: string
  /** Short preview of block text at pin time. */
  label: string
  /** Block `type` at pin time (e.g. heading, toggle) for list context. */
  blockType: string
  pinnedAt: number
}
