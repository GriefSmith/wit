import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cleanOpenerDocument } from '../src/lib/openerSidecar.ts'

const empty = { hidden: { version: false, authors: false }, background: null }

test('cleanOpenerDocument reads a missing or non-object document as empty', () => {
  assert.deepEqual(cleanOpenerDocument(null), empty)
  assert.deepEqual(cleanOpenerDocument('x'), empty)
  assert.deepEqual(cleanOpenerDocument({}), empty)
})

test('cleanOpenerDocument keeps a palette and drops an unknown kind or name', () => {
  assert.deepEqual(
    cleanOpenerDocument({ background: { kind: 'palette', name: 'ocean' } }),
    { ...empty, background: { kind: 'palette', name: 'ocean' } },
  )
  assert.deepEqual(
    cleanOpenerDocument({ background: { kind: 'texture', name: 'paper' } }),
    empty,
  )
  assert.deepEqual(
    cleanOpenerDocument({ background: { kind: 'palette', name: 'system' } }),
    empty,
  )
})

test('cleanOpenerDocument hides a line only for a literal true', () => {
  assert.deepEqual(
    cleanOpenerDocument({ hidden: { version: true, authors: 'yes' } }),
    { ...empty, hidden: { version: true, authors: false } },
  )
})

test('cleanOpenerDocument ignores leftover labels', () => {
  assert.deepEqual(
    cleanOpenerDocument({ labels: { version: { before: 'v', after: '' } } }),
    empty,
  )
})
