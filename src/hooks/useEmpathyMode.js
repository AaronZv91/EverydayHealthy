import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'everyday-healthy-empathy-mode'

function readStoredEmpathyMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function useEmpathyMode() {
  const [empathyMode, setEmpathyModeState] = useState(() => {
    const stored = readStoredEmpathyMode()
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('empathy-mode', stored)
    }
    return stored
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, empathyMode ? 'true' : 'false')
    } catch {
      // ignore storage errors
    }
    document.documentElement.classList.toggle('empathy-mode', empathyMode)
  }, [empathyMode])

  const setEmpathyMode = useCallback((next) => {
    setEmpathyModeState(Boolean(next))
  }, [])

  const toggleEmpathyMode = useCallback(() => {
    setEmpathyModeState((current) => !current)
  }, [])

  return { empathyMode, setEmpathyMode, toggleEmpathyMode }
}
