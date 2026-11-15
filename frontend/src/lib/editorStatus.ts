export type EditorStatusInput = {
  saveError: string | null
  overlayStale: boolean
  dirty: boolean
  loading: boolean
  witLinkNotice: string | null
}

export function editorStatusMessage(input: EditorStatusInput): string | null {
  if (input.saveError) {
    return input.saveError
  }
  if (input.overlayStale) {
    return 'Markdown file changed outside the editor'
  }
  if (input.dirty) {
    return 'Unsaved changes'
  }
  if (input.loading) {
    return 'Loading…'
  }
  if (input.witLinkNotice) {
    return input.witLinkNotice
  }
  return null
}
