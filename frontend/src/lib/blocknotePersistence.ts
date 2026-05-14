import { witBlockNoteSchema } from './witBlockNoteSchema'

type WitBlockNoteEditor = (typeof witBlockNoteSchema)['BlockNoteEditor']

type EditorOverlay = {
  version: 2
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any[]
}

/**
 * Serialize `editor.document` into the JSON string written to the `.json` sidecar.
 * The markdown body captures readable content; this captures everything else
 * (nesting, empty blocks, block props) that markdown cannot express.
 */
export function extractStructuralOverlay(
  blocks: WitBlockNoteEditor['document'],
): string {
  return JSON.stringify({ version: 2, document: blocks })
}

/**
 * Reconstruct editor blocks from stored data.
 * Uses the JSON overlay directly when present (lossless); falls back to parsing
 * the markdown body otherwise.
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
      if (parsed.version === 2 && Array.isArray(parsed.document)) {
        return parsed.document as WitBlockNoteEditor['document']
      }
    } catch {
      // fall through to markdown
    }
  }
  return editor.tryParseMarkdownToBlocks(markdownBody)
}
