import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  chapterEntrance,
  resolvePageStyle,
  resolveTitleMeta,
  showPreviousPage,
} from '../src/lib/pageStyle.ts'

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
    slide: 'from-right',
    scroll: 'top',
  })
  assert.deepEqual(chapterEntrance('chapter', 'previous'), {
    slide: 'from-left',
    scroll: 'bottom',
  })
  assert.deepEqual(chapterEntrance('title', 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('book', 'previous'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance(null, 'next'), { slide: null, scroll: null })
  assert.deepEqual(chapterEntrance('chapter', null), { slide: null, scroll: null })
})

const titled = {
  id: 'titled',
  parent: '',
  style: { opener: 'title' },
  version: '2',
  authors: ['Ada', 'Lin'],
}

test('a page shows its own version and authors', () => {
  assert.deepEqual(resolveTitleMeta('titled', [titled]), {
    version: '2',
    authors: ['Ada', 'Lin'],
  })
})

test('a child inherits version and authors from a title ancestor', () => {
  const kid = { id: 'kid', parent: 'titled', style: { opener: 'title' } }
  assert.deepEqual(resolveTitleMeta('kid', [titled, kid]), {
    version: '2',
    authors: ['Ada', 'Lin'],
  })
})

test('a child overrides one field and inherits the other', () => {
  const kid = { id: 'kid', parent: 'titled', style: { opener: 'title' }, version: '3' }
  assert.deepEqual(resolveTitleMeta('kid', [titled, kid]), {
    version: '3',
    authors: ['Ada', 'Lin'],
  })
})

test('an ancestor that is not a title page passes nothing down', () => {
  const plain = { id: 'plain', parent: '', style: { opener: 'book' }, version: '9', authors: ['Zed'] }
  const kid = { id: 'kid', parent: 'plain', style: { opener: 'title' } }
  assert.deepEqual(resolveTitleMeta('kid', [plain, kid]), { version: null, authors: null })
})

test('the walk skips a non-title page to reach a title ancestor', () => {
  const middle = { id: 'middle', parent: 'titled', style: null, version: '5' }
  const kid = { id: 'kid', parent: 'middle', style: { opener: 'title' } }
  assert.deepEqual(resolveTitleMeta('kid', [titled, middle, kid]), {
    version: '2',
    authors: ['Ada', 'Lin'],
  })
})

test('the nearest title ancestor wins', () => {
  const inner = { id: 'inner', parent: 'titled', style: { opener: 'title' }, authors: ['Mo'] }
  const kid = { id: 'kid', parent: 'inner', style: { opener: 'title' } }
  assert.deepEqual(resolveTitleMeta('kid', [titled, inner, kid]), {
    version: '2',
    authors: ['Mo'],
  })
})

test('blank values do not override and blank names are dropped', () => {
  const kid = {
    id: 'kid',
    parent: 'titled',
    style: { opener: 'title' },
    version: '  ',
    authors: [' ', ''],
  }
  assert.deepEqual(resolveTitleMeta('kid', [titled, kid]), {
    version: '2',
    authors: ['Ada', 'Lin'],
  })
  const trimmed = { ...titled, version: ' 2 ', authors: [' Ada ', '', 'Lin'] }
  assert.deepEqual(resolveTitleMeta('titled', [trimmed]), {
    version: '2',
    authors: ['Ada', 'Lin'],
  })
})

test('title meta stops on a cycle', () => {
  const a = { id: 'a', parent: 'b', style: { opener: 'title' } }
  const b = { id: 'b', parent: 'a', style: { opener: 'title' }, version: '1' }
  assert.deepEqual(resolveTitleMeta('a', [a, b]), { version: '1', authors: null })
})

test('a title page hides the previous-page control', () => {
  assert.equal(showPreviousPage('title'), false)
  assert.equal(showPreviousPage('book'), true)
  assert.equal(showPreviousPage('chapter'), true)
  assert.equal(showPreviousPage(null), true)
})
