import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readStoredHideUi } from '../src/lib/witAppearance.ts'

function installStorage(entries: [string, string][]) {
  const store = new Map(entries)
  globalThis.window = {
    localStorage: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null
      },
    },
  } as Window & typeof globalThis
}

test('readStoredHideUi is on only for the stored value 1', () => {
  const previous = globalThis.window
  try {
    installStorage([])
    assert.equal(readStoredHideUi(), false)
    installStorage([['wit-hide-ui', '0']])
    assert.equal(readStoredHideUi(), false)
    installStorage([['wit-hide-ui', 'true']])
    assert.equal(readStoredHideUi(), false)
    installStorage([['wit-hide-ui', '1']])
    assert.equal(readStoredHideUi(), true)
  } finally {
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      globalThis.window = previous
    }
  }
})

test('readStoredHideUi is off when window is missing', () => {
  const previous = globalThis.window
  try {
    delete (globalThis as { window?: unknown }).window
    assert.equal(readStoredHideUi(), false)
  } finally {
    if (previous !== undefined) {
      globalThis.window = previous
    }
  }
})
