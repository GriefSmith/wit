import { AddBlockButton, DragHandleButton, SideMenu, type SideMenuProps } from '@blocknote/react'
import type { FC } from 'react'

import type { PageMeta } from '../types'

import { WitDragHandleMenu } from './WitDragHandleMenu'

export function witEditorSideMenu(
  pages: PageMeta[],
  currentPageId: string | null,
): FC<SideMenuProps> {
  const WitSideMenu: FC<SideMenuProps> = (props) => {
    const DragMenu: FC = () => (
      <WitDragHandleMenu pages={pages} currentPageId={currentPageId} />
    )

    return (
      <SideMenu {...props}>
        <AddBlockButton />
        <DragHandleButton dragHandleMenu={DragMenu} />
      </SideMenu>
    )
  }
  WitSideMenu.displayName = 'WitEditorSideMenu'
  return WitSideMenu
}
