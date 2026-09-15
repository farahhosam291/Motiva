import { BASELINE_SIGNAL_KEYS, type DeviationLevel, type PersonalBaseline, type SignalDeviation } from '../types/advanced'
import { SIGNAL_LABELS, type SignalStatsMap } from '../types/session'

// A deviation smaller than this (percentage points) is treated as "close to
// baseline" rather than a meaningful change.
const NOTABLE_DEVIATION_POINTS = 15
// Thresholds for the overall session-level deviation label.
const HIGH_DEVIATION_SIGNAL_COUNT = 3
const MODERATE_DEVIATION_SIGNAL_COUNT = 1

function describeDeviation(label: string, difference: number): string {
  const points = Math.round(Math.abs(difference))
  if (points < NOTABLE_DEVIATION_POINTS) {
    return `${label} is close to personal baseline.`
  }
  const direction = difference > 0 ? 'above' : 'below'
  return `${label} is ${points} percentage points ${direction} personal baseline.`
}

/**
 * Compares the current session's signal averages against the user's stored
 * personal baseline. Returns only signals present in both, sorted by the
 * size of the deviation (largest first) so the most significant changes
 * surface first.
 */
export function computeDeviations(
  stats: SignalStatsMap,
  baseline: PersonalBaseline | null,
): SignalDeviation[] {
  if (!baseline) return []

  const deviations: SignalDeviation[] = []
  for (const key of BASELINE_SIGNAL_KEYS) {
    const baselineValue = baseline.values[key]
    const currentValue = stats[key]?.average
    if (baselineValue === undefined || currentValue === null || currentValue === undefined) continue

    const current = Math.round(currentValue * 100)
    const baselinePercent = Math.round(baselineValue * 100)
    const difference = current - baselinePercent
    const label = SIGNAL_LABELS[key]

    deviations.push({
      key,
      label,
      current,
      baseline: baselinePercent,
      difference,
      description: describeDeviation(label, difference),
    })
  }

  return deviations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}

/** How much, overall, this session's behavior departs from the user's own baseline. */
export function computeDeviationLevel(deviations: SignalDeviation[]): DeviationLevel | null {
  if (deviations.length === 0) return null
  const notableCount = deviations.filter(
    (deviation) => Math.abs(deviation.difference) >= NOTABLE_DEVIATION_POINTS,
  ).length
  if (notableCount >= HIGH_DEVIATION_SIGNAL_COUNT) return 'High'
  if (notableCount >= MODERATE_DEVIATION_SIGNAL_COUNT) return 'Moderate'
  return 'Low'
}
