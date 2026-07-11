import { useCallback, useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('vivera-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('vivera-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggle = useCallback(() => setDark(d => !d), [])
  return { dark, toggle }
}
