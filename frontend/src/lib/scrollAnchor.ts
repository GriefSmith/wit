/**
 * Scroll positions are stored relative to the block at the top of the viewport
 * rather than as raw pixels, so they survive layout changes (late-loading media,
 * React-rendered custom blocks, text size / window width changes).
 */

export type ScrollAnchor = {
  /** Deepest block crossing the viewport top; null when above the first block. */
  blockId: string | null
  /** Pixels between that block's top edge and the viewport top. */
  offset: number
  /** Raw `scrollTop`, used when the block no longer exists. */
  top: number
}

export type ScrollTarget = ScrollAnchor & {
  /** Briefly highlight the target block (explicit jumps, not restores). */
  highlight?: boolean
}

/** Gap kept above a block when jumping straight to it. */
const JUMP_MARGIN_PX = 24
/** How long late layout shifts keep re-pinning the restored position. */
const HOLD_MS = 2000
const BLOCK_SELECTOR = '[data-node-type="blockOuter"][data-id]'
const USER_SCROLL_INTENT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export function blockJumpTarget(blockId: string): ScrollTarget {
  return { blockId, offset: -JUMP_MARGIN_PX, top: 0, highlight: true }
}

export function isScrollAnchor(value: unknown): value is ScrollAnchor {
  if (!value || typeof value !== 'object') {
    return false
  }
  const v = value as Record<string, unknown>
  return (
    (v.blockId === null || typeof v.blockId === 'string') &&
    typeof v.offset === 'number' &&
    typeof v.top === 'number'
  )
}

export function captureScrollAnchor(root: HTMLElement): ScrollAnchor {
  const top = Math.round(root.scrollTop)
  if (top <= 0) {
    return { blockId: null, offset: 0, top: 0 }
  }
  const viewportTop = root.getBoundingClientRect().top
  let blockId: string | null = null
  let offset = 0
  // Document order visits parents before children, so the last hit is the deepest block.
  for (const el of root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const rect = el.getBoundingClientRect()
    if (rect.top > viewportTop) {
      break
    }
    if (rect.bottom > viewportTop) {
      blockId = el.dataset.id ?? null
      offset = Math.round(viewportTop - rect.top)
    }
  }
  return { blockId, offset, top }
}

function findBlockElement(root: HTMLElement, blockId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `[data-node-type="blockOuter"][data-id="${CSS.escape(blockId)}"]`,
  )
}

function resolveScrollTop(root: HTMLElement, target: ScrollTarget | null): number {
  if (!target) {
    return 0
  }
  if (target.blockId) {
    const el = findBlockElement(root, target.blockId)
    if (el) {
      const delta = el.getBoundingClientRect().top - root.getBoundingClientRect().top
      return root.scrollTop + delta + target.offset
    }
  }
  return target.top
}

function flashBlock(root: HTMLElement, blockId: string): void {
  // Web Animations leave the DOM attributes alone, so ProseMirror's observer stays quiet.
  const content = findBlockElement(root, blockId)?.querySelector('.bn-block-content')
  content?.animate(
    [
      { backgroundColor: 'var(--pico-primary-focus, rgba(1, 114, 173, 0.25))' },
      { backgroundColor: 'transparent' },
    ],
    { duration: 1600, easing: 'ease-out' },
  )
}

/**
 * Scroll `root` to `target` (top when null) and keep it there while the content
 * is still settling, until the user scrolls or `HOLD_MS` elapses.
 * Returns a function that releases the hold early.
 */
export function holdScrollPosition(
  root: HTMLElement,
  target: ScrollTarget | null,
  onRelease?: () => void,
): () => void {
  let released = false

  const apply = () => {
    if (!released) {
      root.scrollTo({ top: Math.max(0, resolveScrollTop(root, target)), behavior: 'instant' })
    }
  }

  const ro = new ResizeObserver(apply)
  ro.observe(root)
  if (root.firstElementChild) {
    ro.observe(root.firstElementChild)
  }
  const frame = requestAnimationFrame(apply)
  const timer = window.setTimeout(() => release(), HOLD_MS)

  function release() {
    if (released) {
      return
    }
    released = true
    ro.disconnect()
    cancelAnimationFrame(frame)
    window.clearTimeout(timer)
    for (const type of USER_SCROLL_INTENT) {
      root.removeEventListener(type, release)
    }
    onRelease?.()
  }

  for (const type of USER_SCROLL_INTENT) {
    root.addEventListener(type, release, { passive: true })
  }

  apply()
  if (target?.highlight && target.blockId) {
    flashBlock(root, target.blockId)
  }
  return release
}
