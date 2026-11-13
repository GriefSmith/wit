import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chapterEntrance, resolvePageStyle } from '../src/lib/pageStyle.ts'

const book = {
  id: 'book',
  parent: '',
  style: {
    measure: 'book',
    opener: 'title',
    scene_break: 'ornament',
  },
}
const chapter = { id: 'ch', parent: 'book', style: null }
const gap = { id: 'gap', parent: 'book', style: { scene_break: 'gap' } }
const reset = { id: 'reset', parent: 'book', style: { measure: 'default' } }
const ownChapter = { id: 'own', parent: 'book', style: { opener: 'chapter' } }

test('nothing set returns app behavior', () => {
  assert.deepEqual(resolvePageStyle('solo', [{ id: 'solo', parent: '', style: null }]), {
    measure: null,
    opener: null,
    scene_break: 'rule',
  })
})

test('a child inherits measure and scene break only', () => {
  assert.deepEqual(resolvePageStyle('ch', [book, chapter]), {
    measure: 'book',
    opener: null,
    scene_break: 'ornament',
  })
})

test('a typeface key is not part of the sheet', () => {
  const styled = { id: 'styled', parent: '', style: { typeface: 'literary', measure: 'wide' } }
  assert.deepEqual(resolvePageStyle('styled', [styled]), {
    measure: 'wide',
    opener: null,
    scene_break: 'rule',
  })
})

test('a child overrides one field and keeps its own opener', () => {
  const resolved = resolvePageStyle('gap', [book, gap])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, 'book')
  assert.equal(resolved.opener, null)
})

test('default clears measure and leaves the scene break', () => {
  const resolved = resolvePageStyle('reset', [book, reset])
  assert.equal(resolved.measure, null)
  assert.equal(resolved.scene_break, 'ornament')
  assert.equal(resolved.opener, null)
})

test('the open page keeps its own opener', () => {
  assert.equal(resolvePageStyle('own', [book, ownChapter]).opener, 'chapter')
  assert.equal(resolvePageStyle('book', [book, chapter]).opener, 'title')
})

test('default, auto, and none are no opening', () => {
  for (const opener of ['default', 'auto', 'none']) {
    assert.equal(
      resolvePageStyle('p', [{ id: 'p', parent: '', style: { opener } }]).opener,
      null,
    )
  }
})

test('a bad value is ignored and the parent value shows through', () => {
  const resolved = resolvePageStyle('bad', [
    book,
    { id: 'bad', parent: 'book', style: { measure: 'Book', scene_break: 'Literary' } },
  ])
  assert.equal(resolved.measure, 'book')
  assert.equal(resolved.scene_break, 'ornament')
  assert.equal(resolved.opener, null)
})

test('a cycle stops', () => {
  const resolved = resolvePageStyle('a', [
    { id: 'a', parent: 'b', style: { scene_break: 'gap', opener: 'book' } },
    { id: 'b', parent: 'a', style: { measure: 'wide', opener: 'title' } },
  ])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, 'wide')
  assert.equal(resolved.opener, 'book')
})

test('a missing parent stops the walk', () => {
  const resolved = resolvePageStyle('ch', [
    { id: 'ch', parent: 'gone', style: { scene_break: 'gap' } },
  ])
  assert.equal(resolved.scene_break, 'gap')
  assert.equal(resolved.measure, null)
  assert.equal(resolved.opener, null)
})

test('chapter entrance follows the button and the destination opener', () => {
  assert.deepEqual(chapterEntrance('chapter', 'next'), {
    slide: 'from-left',
    scroll: 'top',
  })
  assert.deepEqual(chapterEntrance('chapter', 'previous'), {
    slide: 'from-right',
    scroll: 'bottom',
  })
  assert.deepEqual(chapterEntrance('title', 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('book', 'previous'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance(null, 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('chapter', null), { slide: null, scroll: null })
})
