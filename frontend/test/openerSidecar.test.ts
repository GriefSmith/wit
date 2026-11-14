import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  cleanOpenerDocument,
  formatAffixed,
  formatAuthorLine,
  labelsToStored,
  withAuthorAffix,
  withVersionAffix,
} from '../src/lib/openerSidecar.ts'

const empty = { labels: { version: null, authors: {} }, background: null }

test('formatAffixed inserts one space on the sides that have text', () => {
  assert.equal(formatAffixed('2', null), '2')
  assert.equal(formatAffixed('2', { before: 'version so far:', after: '' }), 'version so far: 2')
  assert.equal(formatAffixed('2', { before: '', after: 'so far' }), '2 so far')
  assert.equal(formatAffixed('2', { before: ' draft of ', after: ' so far ' }), 'draft of 2 so far')
})

test('formatAuthorLine keeps the comma between authors', () => {
  assert.equal(
    formatAuthorLine(['Ada', 'Bea'], {
      Ada: { before: 'written by:', after: '' },
      Bea: { before: '', after: 'did the drawings.' },
    }),
    'written by: Ada, Bea did the drawings.',
  )
})

test('cleanOpenerDocument keeps a palette and drops an unknown kind', () => {
  assert.deepEqual(
    cleanOpenerDocument({
      labels: { version: { before: ' version so far: ', after: '' } },
      background: { kind: 'palette', name: 'ocean' },
    }),
    {
      labels: { version: { before: 'version so far:', after: '' }, authors: {} },
      background: { kind: 'palette', name: 'ocean' },
    },
  )
  assert.deepEqual(
    cleanOpenerDocument({ background: { kind: 'texture', name: 'paper' } }),
    empty,
  )
})

test('cleanOpenerDocument drops an over-long side and a non-string side', () => {
  const cleaned = cleanOpenerDocument({
    labels: {
      version: { before: 'x'.repeat(121), after: 'kept' },
      authors: { Ada: { before: 3, after: 'drew' } },
    },
  })
  assert.deepEqual(cleaned.labels.version, { before: '', after: 'kept' })
  assert.deepEqual(cleaned.labels.authors.Ada, { before: '', after: 'drew' })
})

test('cleanOpenerDocument omits a pair whose sides are both empty', () => {
  assert.deepEqual(
    cleanOpenerDocument({
      labels: {
        version: { before: '  ', after: '' },
        authors: { Ada: { before: '', after: ' ' } },
      },
    }),
    empty,
  )
})

test('an author edit keeps the version and drops a name that is not shown', () => {
  const doc = cleanOpenerDocument({
    labels: {
      version: { before: 'version so far:', after: '' },
      authors: {
        Ada: { before: 'written by:', after: '' },
        Old: { before: 'once', after: '' },
      },
    },
  })
  const next = withAuthorAffix(doc, ['Ada', 'Bea'], 'Bea', {
    before: '',
    after: 'did the drawings.',
  })
  assert.deepEqual(labelsToStored(next), {
    version: { before: 'version so far:', after: '' },
    authors: {
      Ada: { before: 'written by:', after: '' },
      Bea: { before: '', after: 'did the drawings.' },
    },
  })
})

test('clearing both sides of the version removes that pair', () => {
  const doc = cleanOpenerDocument({
    labels: { version: { before: 'version so far:', after: '' } },
  })
  const next = withVersionAffix(doc, [], { before: ' ', after: ' ' })
  assert.deepEqual(labelsToStored(next), {})
})
