import type { ConfidenceLevel, ConfidenceResult, ContradictionResult, DeviationLevel } from '../types/advanced'

// Configurable thresholds (Section 15).
const HIGH_CONFIDENCE = 0.7
const MODERATE_CONFIDENCE = 0.4
// Below this many samples (~2s at the ~10Hz sampling rate), there simply
// isn't enough behavioral data to be confident about anything.
const MIN_SAMPLES_FOR_ANY_CONFIDENCE = 20
// Below this many samples (~10s), confidence is capped at Moderate even if
// the few samples collected happened to look clean and consistent.
const MIN_SAMPLES_FOR_HIGH_CONFIDENCE = 100
// Fraction of samples that need an actual face/pose detection before
// confidence is allowed above Low. Matches the guard in computeAffectEstimation.
const MIN_COVERAGE_FOR_ANY_CONFIDENCE = 0.1

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export interface ConfidenceInput {
  /** 0-100, the base estimation's own score — how decisively the signals matched one category. */
  patternStrengthScore: number
  contradiction: ContradictionResult
  /** Fraction of session samples with an actual face/pose detection. */
  coverage: number
  sampleCount: number
  deviationLevel: DeviationLevel | null
  hesitationEventCount: number
}

/**
 * Confidence is a *separate* dimension from the base estimation's score
 * (Section 7): a session can have a strong pattern match yet still warrant
 * low confidence if the data was thin, the face and body disagree, or
 * behavior was volatile. Combines five factors, each independently
 * documented and weighted so the calculation can be re-tuned later:
 *
 *  - dataAmount (20%): more samples + more frames with a detection = more trustworthy.
 *  - signalStrength (20%): how decisive the underlying pattern match was.
 *  - consistency (25%): inverse of the cross-modal contradiction score —
 *    the single biggest lever, since face/body disagreement is exactly the
 *    situation this feature exists to catch.
 *  - baselineDeviation (15%): a *large, clear* shift from the person's own
 *    baseline is treated as a more confident signal that something real is
 *    happening (not just noise) than a session that stayed near baseline,
 *    which is more ambiguous either way. No baseline on file is neutral.
 *  - temporalConsistency (20%): more rolling-window hesitation events
 *    indicate more volatile, less stable behavior across the session.
 */
export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const { patternStrengthScore, contradiction, coverage, sampleCount, deviationLevel, hesitationEventCount } = input

  const dataAmount = clamp01(clamp01(coverage) * 0.6 + clamp01(sampleCount / 60) * 0.4)
  const signalStrength = clamp01(patternStrengthScore / 100)
  const consistency = clamp01(1 - contradiction.score / 100)
  const baselineDeviation =
    deviationLevel === 'High' ? 1 : deviationLevel === 'Moderate' ? 0.6 : deviationLevel === 'Low' ? 0.3 : 0.5
  const temporalConsistency = clamp01(1 - (Math.min(hesitationEventCount, 4) / 4) * 0.6)

  const score = clamp01(
    dataAmount * 0.2 +
      signalStrength * 0.2 +
      consistency * 0.25 +
      baselineDeviation * 0.15 +
      temporalConsistency * 0.2,
  )

  let level: ConfidenceLevel =
    score >= HIGH_CONFIDENCE ? 'High' : score >= MODERATE_CONFIDENCE ? 'Moderate' : 'Low'

  // Safety rule (Section 11): high face/body disagreement must never be
  // paired with a "High" confidence label, regardless of how strong or
  // well-measured the individual signals were — a confident-sounding
  // reading of two contradicting signal groups is exactly the "aggressive
  // conclusion" this system is required to avoid. A weighted-average alone
  // let strong dataAmount/signalStrength/temporalConsistency outvote a High
  // contradiction in testing (score 71 despite a 69% contradiction), so this
  // is an explicit cap on top of the weighted score, not a replacement for it.
  if (contradiction.level === 'High' && level === 'High') {
    level = 'Moderate'
  }

  // A second explicit cap, needed for two related failure modes found in
  // testing: (1) a 5-sample session (well under a second of real data)
  // still landed at 84% "High" via the weighted score alone, since
  // dataAmount is only 20% of the sum; (2) a 57-sample session with ZERO
  // real face/pose detections landed at "Moderate" (~60%), because
  // consistency and temporalConsistency default to their *best* possible
  // values when there is nothing to disagree about or fluctuate — an
  // absence of evidence was scoring as evidence of calm agreement. Both
  // need a hard floor independent of how "clean" the weighted score looked.
  if (sampleCount < MIN_SAMPLES_FOR_ANY_CONFIDENCE || coverage < MIN_COVERAGE_FOR_ANY_CONFIDENCE) {
    level = 'Low'
  } else if (sampleCount < MIN_SAMPLES_FOR_HIGH_CONFIDENCE && level === 'High') {
    level = 'Moderate'
  }

  const reasons: string[] = []
  if (coverage < MIN_COVERAGE_FOR_ANY_CONFIDENCE) {
    reasons.push('A face or body was rarely or never reliably detected this session.')
  } else if (sampleCount < MIN_SAMPLES_FOR_ANY_CONFIDENCE) {
    reasons.push('Too few samples were collected to draw a confident conclusion.')
  } else if (sampleCount < MIN_SAMPLES_FOR_HIGH_CONFIDENCE) {
    reasons.push('A longer session would allow higher confidence.')
  }
  if (dataAmount < 0.4) reasons.push('Limited data was collected this session.')
  if (signalStrength < 0.4) reasons.push('The measured signals were weak or ambiguous.')
  if (contradiction.level !== 'Low') reasons.push('Facial and body signals disagree.')
  if (hesitationEventCount >= 2) {
    reasons.push('Multiple hesitation events were detected, indicating variable behavior.')
  }
  if (reasons.length === 0) {
    reasons.push('Signals were consistent, well-measured, and stable across the session.')
  }

  // Keep the displayed numeric score consistent with the (possibly capped)
  // level — otherwise a capped "Low" could still show alongside an 84% figure.
  let displayScore = Math.round(score * 100)
  if (level === 'Low') displayScore = Math.min(displayScore, Math.round(MODERATE_CONFIDENCE * 100) - 1)
  else if (level === 'Moderate') displayScore = Math.min(displayScore, Math.round(HIGH_CONFIDENCE * 100) - 1)

  return { level, score: displayScore, reasons }
}
