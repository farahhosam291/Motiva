import { BASELINE_SIGNAL_KEYS, type PersonalBaseline } from '../types/advanced'
import type { SignalKey, SignalStatsMap } from '../types/session'

const STORAGE_KEY = 'emotisense.personalBaseline.v1'

/** How long "Calibrate Baseline" collects data for, per Section 1 (15-20s). */
export const CALIBRATION_DURATION_MS = 18_000
export const CALIBRATION_MIN_SAMPLES = 20

/** Builds a PersonalBaseline from a finished calibration session's stats. */
export function buildBaselineFromStats(
  stats: SignalStatsMap,
  sampleCount: number,
  durationMs: number,
): PersonalBaseline {
  const values: Partial<Record<SignalKey, number>> = {}
  for (const key of BASELINE_SIGNAL_KEYS) {
    const average = stats[key]?.average
    if (average !== null && average !== undefined) {
      values[key] = average
    }
  }
  return { calibratedAt: Date.now(), durationMs, sampleCount, values }
}

export function loadBaseline(): PersonalBaseline | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.values !== 'object') return null
    return parsed as PersonalBaseline
  } catch {
    return null
  }
}

export function saveBaseline(baseline: PersonalBaseline): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline))
  } catch {
    // Storage unavailable/full — non-fatal, the baseline still applies for
    // this page load, it just won't survive a refresh.
  }
}

export function deleteBaseline(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}
