import {
  addDefaultPropsExternalHTML,
  createBlockConfig,
  defaultProps,
  parseDefaultProps,
} from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'

import { WIT_LINK_PREFIX } from './internalLinks'

const pageLinkPropSchema = {
  ...defaultProps,
  pageId: { default: '' as const },
} as const

export const createPageLinkBlockConfig = createBlockConfig(
  () =>
    ({
      type: 'pageLink' as const,
      propSchema: pageLinkPropSchema,
      content: 'inline' as const,
    }) as const,
)

export const createPageLinkBlock = createReactBlockSpec(
  createPageLinkBlockConfig,
  () => ({
    meta: {
      isolating: false,
    },
    parse: (element: HTMLElement) => {
      if (element.getAttribute('data-content-type') === 'pageLink') {
        const pageId = element.getAttribute('data-page-id') ?? ''
        return { pageId, ...parseDefaultProps(element) }
      }
      if (element.tagName === 'A') {
        const href = element.getAttribute('href')
        if (href?.startsWith(WIT_LINK_PREFIX) && href.length > WIT_LINK_PREFIX.length) {
          return {
            pageId: href.slice(WIT_LINK_PREFIX.length),
            ...parseDefaultProps(element),
          }
        }
      }
      return undefined
    },
    render: (props: ReactCustomBlockRenderProps<typeof createPageLinkBlockConfig>) => {
      const pageId = props.block.props.pageId
      return (
        <div
          className="wit-page-link-host"
          data-wit-page-link-host="1"
          data-wit-page-id={pageId || undefined}
          title="Follow link: ⌘-click (mac) or Ctrl-click (windows/linux)"
        >
          <div ref={props.contentRef} className="wit-page-link-host-inner" />
        </div>
      )
    },
    toExternalHTML: (
      props: ReactCustomBlockRenderProps<typeof createPageLinkBlockConfig> & {
        context: { nestingLevel: number }
      },
    ) => {
      const href = `${WIT_LINK_PREFIX}${props.block.props.pageId}`
      return (
        <a
          ref={(el) => {
            if (el) {
              addDefaultPropsExternalHTML(props.block.props, el)
            }
          }}
          href={href}
          className="wit-page-link-external"
        >
          <span ref={props.contentRef} />
        </a>
      )
    },
  }),
)
