import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc' | null

export function useSort<T>(rows: T[], defaultKey?: keyof T) {
  const [key, setKey] = useState<keyof T | null>(defaultKey ?? null)
  const [dir, setDir] = useState<SortDir>(defaultKey ? 'desc' : null)

  function toggle(k: keyof T) {
    if (key !== k) {
      setKey(k)
      setDir('asc')
      return
    }
    if (dir === 'asc') setDir('desc')
    else if (dir === 'desc') { setDir(null); setKey(null) }
    else setDir('asc')
  }

  const sorted = useMemo(() => {
    if (!key || !dir) return rows
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR')
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, key, dir])

  return { sorted, sortKey: key, sortDir: dir, toggle }
}
