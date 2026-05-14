import { useCallback, useEffect, useState } from 'react'

import { fetchPages } from '../api'
import type { PagesPayload } from '../types'

export function usePages() {
  const [data, setData] = useState<PagesPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const p = await fetchPages()
      setData(p)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, error, loading, refresh }
}
