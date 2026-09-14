import {
  SIGNAL_LABELS,
  type AffectEstimation,
  type ContributingSignal,
  type EstimationExplanation,
  type SignalKey,
  type SignalStatsMap,
} from '../types/session'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function avgOf(stats: SignalStatsMap, keys: SignalKey[]): number {
  const values = keys.map((key) => stats[key].average).filter((v): v is number => v !== null)
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Thresholds an intermediate composite must clear to count as "elevated" for
// a given rule. Named and centralized so they can be retuned in one place.
const TENSION_HIGH = 0.35
const TENSION_VERY_HIGH = 0.4
const ACTIVITY_HIGH = 0.4
const ACTIVITY_LOW = 0.3
const SCANNING_HIGH = 0.35
const RETREAT_ELEVATED = 0.25
const UNCERTAINTY_ELEVATED = 0.3
const POSITIVITY_HIGH = 0.4
const POSITIVITY_LOW = 0.3
const CALM_CEILING = 0.25

/**
 * Turns session-average signal values into a final affect estimate.
 *
 * This is a transparent, hand-written decision cascade over the measured
 * signals — not a trained classifier and not a random number. Every input
 * is a real session average. Rules are evaluated in order and the first one
 * whose condition is met wins, so categories never have to "outscore" each
 * other on a shared numeric scale (an earlier weighted-sum version of this
 * did exactly that, and a clearly nervous-looking synthetic session — 82%
 * looking-around, 53% hesitation — was misclassified as "Calm / Neutral"
 * because a compensating high-stability term quietly outweighed it; a
 * clearly-smiling session likewise lost to "Calm / Neutral" instead of
 * "Positive Affect". Both were caught and fixed via synthetic-data tests
 * before this shipped — see the project notes for the test transcripts).
 *
 * This is an estimate of *observable behavior*, not a diagnosis of the
 * person's actual internal emotional state — the UI must present it as such.
 */
export function computeAffectEstimation(
  stats: SignalStatsMap,
  detectionCoverage: number,
  sampleCount: number,
): { estimation: AffectEstimation; explanation: EstimationExplanation } {
  // With no reliable detections, every composite below defaults to 0 (the
  // "nothing measured" case), which would otherwise be indistinguishable
  // from "confirmed genuinely calm" and misreport a confident 100% Calm /
  // Neutral result. Refuse to guess instead.
  if (sampleCount === 0 || detectionCoverage < 0.1) {
    return {
      estimation: { category: 'Uncertain / Mixed Signals', score: 0, reliability: 'Low', reliabilityScore: 0 },
      explanation: {
        headline: 'Insufficient Data — no reliable face or body detection this session',
        topContributors: [],
        otherSignals: [],
      },
    }
  }

  const positivity = avgOf(stats, ['smile'])
  const tension = avgOf(stats, ['lipTension', 'eyebrowLower', 'squint'])
  const activity = avgOf(stats, ['movementIntensity'])
  const scanning = avgOf(stats, ['lookingAround'])
  const retreat = avgOf(stats, ['movingBackward'])
  const uncertainty = avgOf(stats, ['hesitation'])

  let category: string
  let score: number

  if (tension >= TENSION_HIGH && activity >= ACTIVITY_HIGH) {
    category = 'Possible Anxiety / Fear-like behavior'
    score = clamp01(tension * 0.4 + activity * 0.4 + retreat * 0.2)
  } else if (scanning >= SCANNING_HIGH && (uncertainty >= UNCERTAINTY_ELEVATED || tension >= 0.25)) {
    category = 'Possible Nervousness'
    score = clamp01(scanning * 0.5 + uncertainty * 0.3 + tension * 0.2)
  } else if (tension >= TENSION_VERY_HIGH && retreat < RETREAT_ELEVATED) {
    // Retreat is excluded here on purpose: tension *combined with* pulling
    // away reads more specifically as Discomfort than as isolated Tension —
    // without this, a session with both signals strongly elevated matched
    // this rule first and never reached the Discomfort branch below.
    category = 'Possible Tension'
    score = clamp01(tension * 0.7 + uncertainty * 0.3)
  } else if (retreat >= RETREAT_ELEVATED || (tension >= 0.3 && positivity < POSITIVITY_LOW)) {
    category = 'Possible Discomfort'
    score = clamp01(retreat * 0.5 + tension * 0.3 + (1 - positivity) * 0.2)
  } else if (positivity >= POSITIVITY_HIGH && tension < 0.3) {
    category = 'Positive Affect'
    score = clamp01(positivity * 0.8 + (1 - tension) * 0.2)
  } else if (
    tension < CALM_CEILING &&
    activity < ACTIVITY_LOW &&
    scanning < ACTIVITY_LOW &&
    uncertainty < ACTIVITY_LOW
  ) {
    category = 'Calm / Neutral'
    score = clamp01(((1 - tension) + (1 - activity) + (1 - scanning) + (1 - uncertainty)) / 4)
  } else {
    category = 'Uncertain / Mixed Signals'
    score = clamp01(Math.max(tension, activity, scanning, uncertainty, positivity))
  }

  const scorePercent = Math.round(score * 100)

  // Reliability: more samples and more frames with an actual detection make
  // the session average more trustworthy.
  const coverageComponent = clamp01(detectionCoverage)
  const sampleComponent = clamp01(sampleCount / 60)
  const reliabilityScore = clamp01(coverageComponent * 0.6 + sampleComponent * 0.4)
  const reliability: AffectEstimation['reliability'] =
    reliabilityScore >= 0.7 ? 'High' : reliabilityScore >= 0.4 ? 'Medium' : 'Low'

  const explanation = buildExplanation(category, scorePercent, stats)

  return {
    estimation: { category, score: scorePercent, reliability, reliabilityScore },
    explanation,
  }
}

const CONTRIBUTOR_KEYS: SignalKey[] = [
  'lookingAround',
  'headMovement',
  'handMovement',
  'bodyMovement',
  'gazeMovement',
  'hesitation',
  'eyeOpenness',
  'smile',
  'lipTension',
  'eyebrowRaise',
  'eyebrowLower',
  'squint',
  'movingBackward',
  'movingForward',
  'postureChange',
  'stability',
]

function buildExplanation(
  category: string,
  score: number,
  stats: SignalStatsMap,
): EstimationExplanation {
  const withValues: ContributingSignal[] = CONTRIBUTOR_KEYS.map((key) => ({
    key,
    label: SIGNAL_LABELS[key],
    value: Math.round((stats[key].average ?? 0) * 100),
  }))

  const sorted = [...withValues].sort((a, b) => b.value - a.value)
  const topContributors = sorted.slice(0, 6).filter((signal) => signal.value > 0)
  const otherSignals = sorted.slice(topContributors.length)

  return {
    headline: `${category} — ${score}%`,
    topContributors,
    otherSignals,
  }
}
