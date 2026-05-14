import { editorHasBlockWithType } from '@blocknote/core'
import { SideMenuExtension } from '@blocknote/core/extensions'
import {
  BlockColorsItem,
  blockTypeSelectItems,
  type BlockTypeSelectItem,
  DragHandleMenu,
  RemoveBlockItem,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
} from '@blocknote/react'
import { useMemo } from 'react'
import { RiLayout2Line, RiLink, RiPushpinLine, RiSubtractLine, RiUnpinLine } from 'react-icons/ri'

import { useWitPins } from '../context/WitPinsContext'
import { blockSelfPreviewLabel } from '../lib/pinBlockPreview'
import type { PageMeta } from '../types'

type Props = {
  pages: PageMeta[]
  currentPageId: string | null
}

export function WitDragHandleMenu({ pages, currentPageId }: Props) {
  const Components = useComponentsContext()!
  const dict = useDictionary()
  const editor = useBlockNoteEditor()
  const witPins = useWitPins()

  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  })

  const filteredTurnIntoItems = useMemo(() => {
    const propsShape = (item: BlockTypeSelectItem) =>
      Object.fromEntries(
        Object.entries(item.props || {}).map(([propName, propValue]) => [
          propName,
          typeof propValue,
        ]),
      ) as Record<string, 'string' | 'number' | 'boolean'>

    const base = blockTypeSelectItems(editor.dictionary).filter((item) =>
      editorHasBlockWithType(editor, item.type, propsShape(item)),
    )

    const dividerItem: BlockTypeSelectItem = {
      name: dict.slash_menu.divider.title,
      type: 'divider',
      icon: RiSubtractLine,
    }

    const cardItem: BlockTypeSelectItem = {
      name: 'Card',
      type: 'card',
      icon: RiLayout2Line,
    }

    let items = editorHasBlockWithType(editor, 'divider') ? [...base, dividerItem] : base

    if (editorHasBlockWithType(editor, 'card')) {
      items = [...items, cardItem]
    }

    return items
  }, [editor, dict])

  const canUsePageLink = useMemo(
    () =>
      editorHasBlockWithType(editor, 'pageLink', {
        pageId: 'string',
        textAlignment: 'string',
        textColor: 'string',
        backgroundColor: 'string',
      }),
    [editor],
  )

  const linkTargets = useMemo(
    () => pages.filter((p) => p.id !== currentPageId),
    [pages, currentPageId],
  )

  const applyTurnInto = (item: BlockTypeSelectItem) => {
    if (block === undefined) {
      return
    }
    const selectedBlocks = editor.getSelection()?.blocks
    const targets =
      selectedBlocks && selectedBlocks.some((b) => b.id === block.id)
        ? selectedBlocks
        : [block]
    editor.focus()
    editor.transact(() => {
      for (const b of targets) {
        editor.updateBlock(b, {
          type: item.type as never,
          props: (item.props ?? {}) as never,
        })
      }
    })
  }

  const pinned =
    block !== undefined &&
    currentPageId !== null &&
    witPins.isPinned(currentPageId, block.id)

  const togglePin = () => {
    if (block === undefined || currentPageId === null) {
      return
    }
    if (pinned) {
      witPins.removePin(currentPageId, block.id)
      return
    }
    const label = blockSelfPreviewLabel(block)
    witPins.addOrRefreshPin({
      pageId: currentPageId,
      blockId: block.id,
      label,
      blockType: block.type,
    })
  }

  const applyPageLink = (pageId: string) => {
    if (block === undefined || !canUsePageLink) {
      return
    }
    const selectedBlocks = editor.getSelection()?.blocks
    const targets =
      selectedBlocks && selectedBlocks.some((b) => b.id === block.id)
        ? selectedBlocks
        : [block]
    editor.focus()
    editor.transact(() => {
      for (const b of targets) {
        editor.updateBlock(b, {
          type: 'pageLink',
          props: { pageId },
        } as never)
      }
    })
  }

  return (
    <DragHandleMenu>
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>

      {block !== undefined && currentPageId !== null ? (
        <Components.Generic.Menu.Item
          className="bn-menu-item"
          icon={pinned ? <RiUnpinLine size={16} /> : <RiPushpinLine size={16} />}
          onClick={togglePin}
        >
          {pinned ? 'Unpin block' : 'Pin block'}
        </Components.Generic.Menu.Item>
      ) : null}


      <Components.Generic.Menu.Root position="right" sub={true}>
        <Components.Generic.Menu.Trigger sub={true}>
          <Components.Generic.Menu.Item className="bn-menu-item" subTrigger={true}>
            Turn into
          </Components.Generic.Menu.Item>
        </Components.Generic.Menu.Trigger>
        <Components.Generic.Menu.Dropdown sub={true} className="bn-menu-dropdown">
          {filteredTurnIntoItems.map((item) => {
            const Icon = item.icon
            return (
              <Components.Generic.Menu.Item
                key={`${item.type}-${JSON.stringify(item.props ?? {})}`}
                className="bn-menu-item"
                icon={<Icon size={16} />}
                onClick={() => applyTurnInto(item)}
              >
                {item.name}
              </Components.Generic.Menu.Item>
            )
          })}
        </Components.Generic.Menu.Dropdown>
      </Components.Generic.Menu.Root>

      {canUsePageLink && linkTargets.length > 0 ? (
        <Components.Generic.Menu.Root position="right" sub={true}>
          <Components.Generic.Menu.Trigger sub={true}>
            <Components.Generic.Menu.Item
              className="bn-menu-item"
              subTrigger={true}
              icon={<RiLink size={16} />}
            >
              Link
            </Components.Generic.Menu.Item>
          </Components.Generic.Menu.Trigger>
          <Components.Generic.Menu.Dropdown sub={true} className="bn-menu-dropdown">
            {linkTargets.map((p) => (
              <Components.Generic.Menu.Item
                key={p.id}
                className="bn-menu-item"
                onClick={() => applyPageLink(p.id)}
              >
                {p.title || p.id}
              </Components.Generic.Menu.Item>
            ))}
          </Components.Generic.Menu.Dropdown>
        </Components.Generic.Menu.Root>
      ) : null}

      <TableRowHeaderItem>{dict.drag_handle.header_row_menuitem}</TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </DragHandleMenu>
  )
}
