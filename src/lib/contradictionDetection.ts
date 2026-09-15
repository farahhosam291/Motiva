import type { ContradictionLevel, ContradictionResult } from '../types/advanced'
import { SIGNAL_LABELS, type ContributingSignal, type SignalKey, type SignalStatsMap } from '../types/session'

// Thresholds for the 0-100 contradiction score. Configurable per Section 15.
const CONTRADICTION_HIGH = 60
const CONTRADICTION_MODERATE = 30

const BODY_DISCOMFORT_KEYS: SignalKey[] = [
  'movingBackward',
  'gazeMovement',
  'handMovement',
  'bodyMovement',
  'postureChange',
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function avgOf(stats: SignalStatsMap, keys: SignalKey[]): number {
  const values = keys.map((key) => stats[key]?.average).filter((v): v is number => v !== null && v !== undefined)
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function levelFor(score: number): ContradictionLevel {
  if (score >= CONTRADICTION_HIGH) return 'High'
  if (score >= CONTRADICTION_MODERATE) return 'Moderate'
  return 'Low'
}

/**
 * Detects when the face looks positive/calm while the body simultaneously
 * shows discomfort- or arousal-like patterns (retreating, elevated gaze/hand/
 * body movement, posture change) — the "nervous smile" / masked-discomfort
 * case from Section 3. This deliberately checks one specific, well-defined
 * axis (face-positive vs. body-uncomfortable) rather than every conceivable
 * face/body combination; that axis is the one the spec's example describes,
 * and is the one where "just believing the smile" is most misleading.
 *
 * Score formula: 2 × facialPositivityIndex × bodyDiscomfortIndex, clamped to
 * 0-1. This is a product (not a sum/average) on purpose — a real
 * contradiction needs *both* signals present at once; if either is low
 * there is no real conflict to flag. The ×2 rescales so that two
 * moderately-strong signals (e.g. both ~0.7) still read as a clearly high
 * contradiction rather than being pulled down by the multiplication itself.
 */
export function computeContradiction(stats: SignalStatsMap): ContradictionResult {
  const facialPositivityIndex = clamp01(
    avgOf(stats, ['smile']) - avgOf(stats, ['lipTension', 'eyebrowLower', 'squint']) * 0.5,
  )
  const bodyDiscomfortIndex = clamp01(avgOf(stats, BODY_DISCOMFORT_KEYS))

  const score = Math.round(clamp01(2 * facialPositivityIndex * bodyDiscomfortIndex) * 100)
  const level = levelFor(score)

  const contributingSignals: ContributingSignal[] = (
    ['smile', ...BODY_DISCOMFORT_KEYS] as SignalKey[]
  )
    .map((key) => ({
      key,
      label: SIGNAL_LABELS[key],
      value: Math.round((stats[key]?.average ?? 0) * 100),
    }))
    .sort((a, b) => b.value - a.value)

  const smileValue = Math.round((stats.smile?.average ?? 0) * 100)

  let summary: string
  if (level === 'Low') {
    summary = 'Facial and body signals are broadly consistent with each other this session.'
  } else {
    const bodySignalNames = contributingSignals
      .filter((signal) => signal.key !== 'smile' && signal.value >= 40)
      .slice(0, 3)
      .map((signal) => signal.label)
      .join(', ')
    summary =
      `Signal conflict detected: the face reads as positive (Smile ${smileValue}%) ` +
      `while body signals (${bodySignalNames || 'elevated body activity'}) suggest discomfort or arousal — ` +
      `cross-modal incongruence. Possible interpretation: a nervous smile or socially masked discomfort, not straightforward positive affect.`
  }

  return { score, level, facialPositivityIndex, bodyDiscomfortIndex, contributingSignals, summary }
}
