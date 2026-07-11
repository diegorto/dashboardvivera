import { useCallback, useEffect, useState } from 'react'

export interface Decision {
  id: string
  text: string
  done: boolean
  createdAt: string
}

const KEY = 'vivera-decisoes-semana'

function load(): Decision[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useDecisions() {
  const [decisions, setDecisions] = useState<Decision[]>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(decisions))
  }, [decisions])

  const add = useCallback((text: string) => {
    if (!text.trim()) return
    setDecisions(d => [...d, { id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: new Date().toISOString() }])
  }, [])

  const toggle = useCallback((id: string) => {
    setDecisions(d => d.map(x => x.id === id ? { ...x, done: !x.done } : x))
  }, [])

  const remove = useCallback((id: string) => {
    setDecisions(d => d.filter(x => x.id !== id))
  }, [])

  return { decisions, add, toggle, remove }
}
