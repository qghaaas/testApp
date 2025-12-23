import { useEffect, useState } from 'react'
import { api } from '../api.js'

let cached = null

export function useMeta() {
  const [meta, setMeta] = useState(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    if (cached) return

    setLoading(true)
    api('/admin/meta')
      .then((data) => {
        cached = data
        if (alive) setMeta(data)
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))

    return () => { alive = false }
  }, [])

  return { meta, loading, error }
}
