/** In-editor links to other wit pages use the custom URL scheme `wit:<page-id>`. */

export const WIT_LINK_PREFIX = 'wit:' as const

export function isWitPageHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && href.startsWith(WIT_LINK_PREFIX) && href.length > WIT_LINK_PREFIX.length
}

export function witHrefToPageId(href: string): string {
  return href.slice(WIT_LINK_PREFIX.length)
}
