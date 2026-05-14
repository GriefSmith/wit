import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  migratePinsPageId,
  readPinsFromStorage,
  removePinByIds,
  removePinsForPage,
  upsertPin,
  WIT_PINS_STORAGE_KEY,
  writePinsToStorage,
} from '../lib/witPins'
import type { WitPin } from '../types'

type WitPinsContextValue = {
  pins: WitPin[]
  isPinned: (pageId: string, blockId: string) => boolean
  addOrRefreshPin: (pin: Omit<WitPin, 'pinnedAt'>) => void
  removePin: (pageId: string, blockId: string) => void
  onPageRenamed: (previousId: string, nextId: string) => void
  onPageDeleted: (pageId: string) => void
}

const WitPinsContext = createContext<WitPinsContextValue | null>(null)

export function WitPinsProvider({ children }: { children: ReactNode }) {
  const [pins, setPins] = useState<WitPin[]>(() => readPinsFromStorage())

  const persist = useCallback((next: WitPin[]) => {
    setPins(next)
    writePinsToStorage(next)
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== WIT_PINS_STORAGE_KEY) {
        return
      }
      setPins(readPinsFromStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const isPinned = useCallback(
    (pageId: string, blockId: string) => pins.some((p) => p.pageId === pageId && p.blockId === blockId),
    [pins],
  )

  const addOrRefreshPin = useCallback(
    (pin: Omit<WitPin, 'pinnedAt'>) => {
      persist(upsertPin(pins, pin))
    },
    [pins, persist],
  )

  const removePin = useCallback(
    (pageId: string, blockId: string) => {
      persist(removePinByIds(pins, pageId, blockId))
    },
    [pins, persist],
  )

  const onPageRenamed = useCallback(
    (previousId: string, nextId: string) => {
      persist(migratePinsPageId(pins, previousId, nextId))
    },
    [pins, persist],
  )

  const onPageDeleted = useCallback(
    (pageId: string) => {
      persist(removePinsForPage(pins, pageId))
    },
    [pins, persist],
  )

  const value = useMemo(
    () => ({
      pins,
      isPinned,
      addOrRefreshPin,
      removePin,
      onPageRenamed,
      onPageDeleted,
    }),
    [pins, isPinned, addOrRefreshPin, removePin, onPageRenamed, onPageDeleted],
  )

  return <WitPinsContext.Provider value={value}>{children}</WitPinsContext.Provider>
}

/** Consumer hook paired with {@link WitPinsProvider}. */
// eslint-disable-next-line react-refresh/only-export-components -- intentional provider + hook module pattern
export function useWitPins(): WitPinsContextValue {
  const ctx = useContext(WitPinsContext)
  if (!ctx) {
    throw new Error('useWitPins must be used within WitPinsProvider')
  }
  return ctx
}
