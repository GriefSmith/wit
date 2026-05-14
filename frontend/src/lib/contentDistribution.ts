/**
 * Conventions for Psychomancer / chapter content synced from Notion:
 *
 * - **Hub** (`psychomacer-en-gs`, etc.): book-level intro + `wit:` links to chapter roots and related pages.
 * - **Chapter roots** (`chapter-N-root`): front matter + introductory matter only. Include three blocks —
 *   “Main characters”, “Play syntax”, “Prologue” — using Toggle headings or plain headings (see below).
 * - **Numbered sections**: Roman headings (**I**, **II**, …) from Notion map to child pages with ids
 *   `ch{N}-{S}` where `N` is the chapter number and `S` is the ordinal (I→1, II→2). Files: `ch{N}-{S}.md`.
 * - **Import**: paste MCP markdown through `prepareNotionImport`, then `splitMarkdownAtRomanHeadings` to
 *   fill `chapter-N-root` (material before the first Roman heading) and one file per section.
 */

/** Filename stem (no `.md`) for chapter `chapterNum`, section index `sectionIndex` (first Roman heading = 1). */
export function chapterSectionPageId(chapterNum: number, sectionIndex: number): string {
  return `ch${chapterNum}-${sectionIndex}`
}

const HEADING_ROMAN =
  /^(#{1,6})\s+([IVXLCDM]+)\b(?:\s+(.*))?$/i

export type RomanSplitSection = {
  roman: string
  /** 1-based position among Roman headings in source order — use with `chapterSectionPageId(chapter, sectionIndex)`. */
  sectionIndex: number
  /** Parsed numeric value of the Roman token (e.g. VIII → 8), if valid. */
  romanValue: number | null
  headingLine: string
  body: string
}

export type RomanSplitResult = {
  /** Everything before the first Roman heading (trimmed; suitable for `chapter-N-root`). */
  beforeSections: string
  sections: RomanSplitSection[]
}

export function romanNumeralToInt(token: string): number | null {
  const upper = token.trim().toUpperCase()
  if (!/^[IVXLCDM]+$/.test(upper)) {
    return null
  }
  const sym: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  }
  let total = 0
  let prev = 0
  for (let i = upper.length - 1; i >= 0; i--) {
    const v = sym[upper[i]!] ?? 0
    if (v < prev) {
      total -= v
    } else {
      total += v
      prev = v
    }
  }
  return total > 0 ? total : null
}

/**
 * Split Notion/MCP markdown at headings whose title begins with a Roman numeral (play sections).
 * The first chunk (`beforeSections`) is chapter-root material (characters / syntax / prologue).
 */
export function splitMarkdownAtRomanHeadings(markdown: string): RomanSplitResult {
  const lines = markdown.split(/\r?\n/)
  const markers: { index: number; roman: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(HEADING_ROMAN)
    if (m) {
      markers.push({ index: i, roman: m[2]!.toUpperCase() })
    }
  }

  const trimmedTail = (s: string) => {
    const t = s.trimEnd()
    return t.length > 0 ? `${t}\n` : ''
  }

  if (markers.length === 0) {
    return { beforeSections: trimmedTail(markdown), sections: [] }
  }

  const beforeLines = lines.slice(0, markers[0]!.index)
  const sections: RomanSplitSection[] = []

  for (let s = 0; s < markers.length; s++) {
    const start = markers[s]!.index
    const end = s + 1 < markers.length ? markers[s + 1]!.index : lines.length
    const roman = markers[s]!.roman
    const chunk = lines.slice(start, end).join('\n')
    sections.push({
      roman,
      sectionIndex: s + 1,
      romanValue: romanNumeralToInt(roman),
      headingLine: lines[start]!,
      body: trimmedTail(chunk),
    })
  }

  return {
    beforeSections: trimmedTail(beforeLines.join('\n')),
    sections,
  }
}
