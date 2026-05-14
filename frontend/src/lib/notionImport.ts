/**
 * Normalize Notion MCP "enhanced markdown" (page tags, callouts, etc.)
 * into markdown that BlockNote parses well and that uses wit: links when
 * a workspace page matches by title.
 */

import type { PageMeta } from '../types'

const PAGE_TAG_RE = /<page\s+url="([^"]+)">([\s\S]*?)<\/page>/gi
const EMPTY_BLOCK_RE = /<empty-block\s*\/?\s*>/gi

/** Strip simple XML-ish tags, keep inner text (for callouts / mixed markup). */
function stripTagsToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function linesAsBlockQuote(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return ''
  }
  return `${lines.map((l) => `> ${l}`).join('\n')}\n\n`
}

/**
 * Convert `<callout>...</callout>` blocks to GFM-style blockquotes so they survive markdown round-trip.
 */
export function notionCalloutsToBlockquotes(raw: string): string {
  const CALLOUT_RE = /<callout\b[^>]*>([\s\S]*?)<\/callout>/gi
  return raw.replace(CALLOUT_RE, (_, inner) => linesAsBlockQuote(stripTagsToText(inner)))
}

export function stripEmptyNotionBlocks(raw: string): string {
  return raw.replace(EMPTY_BLOCK_RE, '\n')
}

function normalizeTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/:\s*/g, '-') // "chapter 1: foo" → "chapter 1-foo" (aligned with "chapter 1 - foo")
    .replace(/\s*-\s*/g, '-') // collapse hyphen spacing
    .replace(/[:\u2013\u2014–—]/g, '-')
}

export function matchPageIdByTitle(pages: PageMeta[], title: string): string | undefined {
  const key = normalizeTitleKey(title)
  if (!key) {
    return undefined
  }

  const exact = pages.find((p) => normalizeTitleKey(p.title) === key)
  if (exact) {
    return exact.id
  }

  return pages.find((p) => {
    const pk = normalizeTitleKey(p.title)
    return pk.includes(key) || key.includes(pk)
  })?.id
}

/**
 * Replace `<page url="https://www.notion.so/...">Label</page>` with markdown links.
 * When a local page title matches, use `[Label](wit:<id>)`; otherwise keep the Notion URL.
 */
export function resolveNotionPageTags(markdown: string, pages: PageMeta[]): string {
  return markdown.replace(PAGE_TAG_RE, (_, url: string, inner: string) => {
    const label = stripTagsToText(inner) || 'Untitled'
    const witId = matchPageIdByTitle(pages, label)
    if (witId) {
      return `[${label}](wit:${witId})`
    }
    const href = String(url).trim()
    return `[${label}](${href})`
  })
}

/**
 * Obsidian-style `[[Page Title]]` → `[Page Title](wit:id)` when a title matches.
 * Unresolved links stay as wiki syntax so you can fix titles or create pages later.
 */
export function expandWikiLinks(markdown: string, pages: PageMeta[]): string {
  return markdown.replace(/\[\[([^\]]+)]]/g, (full, rawTitle: string) => {
    const label = rawTitle.trim()
    const witId = matchPageIdByTitle(pages, label)
    if (witId) {
      return `[${label}](wit:${witId})`
    }
    return full
  })
}

/** Full pipeline for pasted MCP / Notion-export text. */
export function prepareNotionImport(raw: string, pages: PageMeta[]): string {
  let s = stripEmptyNotionBlocks(raw)
  s = notionCalloutsToBlockquotes(s)
  s = resolveNotionPageTags(s, pages)
  s = expandWikiLinks(s, pages)
  const trimmed = s.trim()
  return trimmed ? `${trimmed}\n` : ''
}

export {
  chapterSectionPageId,
  romanNumeralToInt,
  splitMarkdownAtRomanHeadings,
  type RomanSplitResult,
  type RomanSplitSection,
} from './contentDistribution'
