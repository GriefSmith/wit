/* eslint-disable react-refresh/only-export-components -- BlockNote specs export factories alongside internal view components */
import {
  addDefaultPropsExternalHTML,
  createBlockConfig,
  defaultProps,
  parseDefaultProps,
} from '@blocknote/core'
import { createReactBlockSpec, useBlockNoteEditor } from '@blocknote/react'
import type { ReactCustomBlockRenderProps } from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { RiArrowLeftRightLine, RiEditLine, RiImageLine } from 'react-icons/ri'

const cardPropSchema = {
  ...defaultProps,
  imageUrl: { default: '' as const },
  imagePosition: { default: 'right' as 'right' | 'left' },
} as const

export const createCardBlockConfig = createBlockConfig(
  () =>
    ({
      type: 'card' as const,
      propSchema: cardPropSchema,
      content: 'inline' as const,
    }) as const,
)

function CardImageColumn({
  block,
  imageUrl,
}: {
  block: Parameters<typeof useBlockNoteEditor>[0] extends undefined
    ? never
    : { id: string; props: Record<string, unknown> }
  imageUrl: string
}) {
  const editor = useBlockNoteEditor()
  const [editing, setEditing] = useState(!imageUrl)
  const [draft, setDraft] = useState(imageUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    setDraft(imageUrl)
    setEditing(!imageUrl)
  }, [imageUrl])

  const commit = (value: string) => {
    const trimmed = value.trim()
    editor.updateBlock(block as never, { props: { imageUrl: trimmed } } as never)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(draft)
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(imageUrl)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="wit-card-image-col wit-card-image-col--editing" contentEditable={false}>
        <RiImageLine className="wit-card-url-icon" size={18} />
        <input
          ref={inputRef}
          type="url"
          className="wit-card-url-input"
          placeholder="Paste image URL…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
        />
      </div>
    )
  }

  return (
    <div className="wit-card-image-col" contentEditable={false}>
      <img src={imageUrl} alt="" className="wit-card-image" draggable={false} />
      <button
        type="button"
        className="wit-card-edit-url"
        onClick={() => {
          setDraft(imageUrl)
          setEditing(true)
        }}
        title="Change image URL"
      >
        <RiEditLine size={12} />
      </button>
    </div>
  )
}

function CardBlockView(props: ReactCustomBlockRenderProps<typeof createCardBlockConfig>) {
  const { block, contentRef } = props
  const editor = useBlockNoteEditor()
  const { imageUrl, imagePosition } = block.props

  const handleSwap = () => {
    editor.updateBlock(block as never, {
      props: { imagePosition: imagePosition === 'right' ? 'left' : 'right' },
    } as never)
  }

  const textCol = (
    <div className="wit-card-text-col">
      <div ref={contentRef} className="wit-card-text-content" />
    </div>
  )

  const imageCol = <CardImageColumn block={block as never} imageUrl={imageUrl} />

  return (
    <div className="wit-card-block" data-image-pos={imagePosition}>
      {imagePosition === 'right' ? textCol : imageCol}
      {imagePosition === 'right' ? imageCol : textCol}
      <button
        type="button"
        className="wit-card-swap"
        onClick={handleSwap}
        title="Swap text and image"
        contentEditable={false}
      >
        <RiArrowLeftRightLine size={13} />
      </button>
    </div>
  )
}

export const createCardBlock = createReactBlockSpec(
  createCardBlockConfig,
  () => ({
    parse: (element: HTMLElement) => {
      if (element.getAttribute('data-content-type') === 'card') {
        return {
          imageUrl: element.getAttribute('data-image-url') ?? '',
          imagePosition: (element.getAttribute('data-image-pos') ?? 'right') as 'left' | 'right',
          ...parseDefaultProps(element),
        }
      }
      return undefined
    },
    render: (props: ReactCustomBlockRenderProps<typeof createCardBlockConfig>) => (
      <CardBlockView {...props} />
    ),
    toExternalHTML: (
      props: ReactCustomBlockRenderProps<typeof createCardBlockConfig> & {
        context: { nestingLevel: number }
      },
    ) => {
      const { imageUrl, imagePosition } = props.block.props
      return (
        <div
          ref={(el) => {
            if (el) addDefaultPropsExternalHTML(props.block.props, el)
          }}
          data-content-type="card"
          data-image-url={imageUrl}
          data-image-pos={imagePosition}
          className="wit-card-external"
        >
          <span ref={props.contentRef} />
          {imageUrl && <img src={imageUrl} alt="" />}
        </div>
      )
    },
  }),
)
