import type { PageMeta } from '../types'

import { comparePageMeta } from './tree'

/** Effective parent id for grouping (matches `flatToTree` orphan handling). */
export function effectiveParentKey(page: PageMeta, byId: Map<string, PageMeta>): string {
  let key = page.parent.trim()
  if (key !== '' && !byId.has(key)) {
    key = ''
  }
  return key
}

/** True if setting `dragId`'s parent to `newParent` would create a cycle. */
function wouldCycle(
  byId: Map<string, PageMeta>,
  dragId: string,
  newParent: string,
): boolean {
  if (newParent === dragId) {
    return true
  }
  if (newParent === '') {
    return false
  }
  let cur = newParent.trim()
  const seen = new Set<string>()
  while (cur) {
    if (cur === dragId) {
      return true
    }
    if (seen.has(cur)) {
      break
    }
    seen.add(cur)
    const up = byId.get(cur)?.parent
    cur = typeof up === 'string' ? up.trim() : ''
  }
  return false
}

/**
 * Computes meta patches for a sidebar drag-move (react-arborist `onMove`).
 * Returns null if the move would create a parent cycle.
 */
export function computeMovePatches(
  pages: PageMeta[],
  dragIds: string[],
  parentId: string | null,
  index: number,
): { id: string; parent: string; order: number }[] | null {
  if (dragIds.length === 0) {
    return []
  }

  const byId = new Map(pages.map((p) => [p.id, p]))
  for (const id of dragIds) {
    if (!byId.has(id)) {
      return []
    }
  }

  let targetKey = parentId === null || parentId === '' ? '' : parentId.trim()
  if (targetKey !== '' && !byId.has(targetKey)) {
    targetKey = ''
  }

  for (const id of dragIds) {
    if (wouldCycle(byId, id, targetKey)) {
      return null
    }
  }

  const groups = new Map<string, string[]>()

  for (const p of pages) {
    const ep = effectiveParentKey(p, byId)
    if (!groups.has(ep)) {
      groups.set(ep, [])
    }
    groups.get(ep)!.push(p.id)
  }

  for (const ids of groups.values()) {
    ids.sort((a, b) => comparePageMeta(byId.get(a)!, byId.get(b)!))
  }

  const dragSet = new Set(dragIds)
  for (const [key, ids] of groups) {
    groups.set(
      key,
      ids.filter((id) => !dragSet.has(id)),
    )
  }

  const targetList = [...(groups.get(targetKey) ?? [])]
  const insertAt = Math.min(Math.max(0, index), targetList.length)
  targetList.splice(insertAt, 0, ...dragIds)
  groups.set(targetKey, targetList)

  const patches: { id: string; parent: string; order: number }[] = []

  for (const [parentKey, ids] of groups) {
    ids.forEach((id, order) => {
      const p = byId.get(id)!
      const parentStr = parentKey
      const prevKey = effectiveParentKey(p, byId)
      if (prevKey !== parentStr || p.order !== order) {
        patches.push({ id, parent: parentStr, order })
      }
    })
  }

  return patches
}
