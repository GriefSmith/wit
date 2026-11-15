import assert from 'node:assert/strict'
import { test } from 'node:test'

import { editorStatusMessage, type EditorStatusInput } from '../src/lib/editorStatus.ts'

const clear: EditorStatusInput = {
  saveError: null,
  overlayStale: false,
  dirty: false,
  loading: false,
  witLinkNotice: null,
}

test('editorStatusMessage is empty when every input is clear', () => {
  assert.equal(editorStatusMessage(clear), null)
})

test('editorStatusMessage follows the status priority and skips empties', () => {
  assert.equal(
    editorStatusMessage({ ...clear, saveError: 'disk full', dirty: true, loading: true }),
    'disk full',
  )
  assert.equal(
    editorStatusMessage({ ...clear, saveError: '', overlayStale: true, dirty: true }),
    'Markdown file changed outside the editor',
  )
  assert.equal(
    editorStatusMessage({ ...clear, dirty: true, loading: true, witLinkNotice: 'linked' }),
    'Unsaved changes',
  )
  assert.equal(
    editorStatusMessage({ ...clear, loading: true, witLinkNotice: 'linked' }),
    'Loading…',
  )
  assert.equal(editorStatusMessage({ ...clear, witLinkNotice: 'linked' }), 'linked')
  assert.equal(editorStatusMessage({ ...clear, witLinkNotice: '' }), null)
})
