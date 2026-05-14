import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'

import { createCardBlock } from './cardBlock'
import { createPageLinkBlock } from './pageLinkBlock'

export const witBlockNoteSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    pageLink: createPageLinkBlock(),
    card: createCardBlock(),
  },
})
