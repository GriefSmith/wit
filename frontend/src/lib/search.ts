import Fuse from 'fuse.js'

import type { PageMeta } from '../types'

export function createPagesFuse(pages: PageMeta[]) {
  return new Fuse(pages, {
    keys: [
      { name: 'title', weight: 0.6 },
      { name: 'id', weight: 0.2 },
      {
        name: 'tagsFlat',
        weight: 0.2,
        getFn: (page: PageMeta) => page.tags.join(' '),
      },
    ],
    threshold: 0.35,
    ignoreLocation: true,
  })
}
