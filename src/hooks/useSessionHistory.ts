import { useCallback, useState } from 'react'
import type { CompletedSession } from '../types/session'

const STORAGE_KEY = 'emotisense.sessionHistory.v1'
const MAX_STORED_SESSIONS = 50

function loadFromStorage(): CompletedSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CompletedSession[]) : []
  } catch {
    // Corrupt data, storage disabled, or private-browsing restrictions.
    // Non-fatal: start with an empty history instead of crashing the app.
    return []
  }
}

function saveToStorage(sessions: CompletedSession[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // Quota exceeded or storage unavailable. Non-fatal: the session still
    // displays for this page load, it just won't survive a refresh.
  }
}

/**
 * Persists only numerical measurements and short text summaries — never
 * webcam video, images, or camera frames (none of that is ever produced by
 * this pipeline in the first place).
 */
export function useSessionHistory() {
  const [sessions, setSessions] = useState<CompletedSession[]>(loadFromStorage)

  const addSession = useCallback((session: CompletedSession) => {
    setSessions((prev) => {
      const next = [...prev, session].slice(-MAX_STORED_SESSIONS)
      saveToStorage(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setSessions([])
    saveToStorage([])
  }, [])

  return { sessions, addSession, clearHistory, nextSessionNumber: sessions.length + 1 }
}
