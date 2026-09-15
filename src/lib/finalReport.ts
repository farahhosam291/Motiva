import type { AffectEstimation, SignalStatsMap } from '../types/session'
import type {
  AdvancedSessionReport,
  ContradictionResult,
  HesitationEvent,
  PersonalBaseline,
  SignalDeviation,
} from '../types/advanced'
import { computeDeviations, computeDeviationLevel } from './deviationAnalysis'
import { computeContradiction } from './contradictionDetection'
import { computeConfidence } from './confidenceCalculation'
import { applyContradictionOverride, buildSafeSummarySentence } from './safetyPhrasing'
import { computeRecommendation } from './physicalAIRecommendation'
import { segmentSessionTimeline, type TemporalSample } from './temporalChangeDetection'

/**
 * Builds the full "advanced" report (baseline deviation, cross-modal
 * contradiction, confidence, hesitation events, temporal segments, Physical
 * AI recommendation, safety-hedged summary) on top of the existing,
 * unmodified `computeAffectEstimation` output. This is purely additive —
 * nothing here changes the base category/score cascade.
 */
export function buildAdvancedReport(
  baseEstimation: AffectEstimation,
  finalStats: SignalStatsMap,
  coverage: number,
  sampleCount: number,
  baseline: PersonalBaseline | null,
  hesitationEvents: HesitationEvent[],
  temporalSamples: TemporalSample[],
  sessionDurationMs: number,
): AdvancedSessionReport {
  const deviations = computeDeviations(finalStats, baseline)
  const deviationLevel = computeDeviationLevel(deviations)

  const contradiction = computeContradiction(finalStats)

  const { displayCategory, patternStrength, overrideApplied } = applyContradictionOverride(
    baseEstimation,
    contradiction,
  )

  const confidence = computeConfidence({
    patternStrengthScore: patternStrength,
    contradiction,
    coverage,
    sampleCount,
    deviationLevel,
    hesitationEventCount: hesitationEvents.length,
  })

  const temporalSegments = segmentSessionTimeline(temporalSamples, hesitationEvents, sessionDurationMs)
  const recommendation = computeRecommendation(displayCategory, confidence.level, hesitationEvents.length)
  const safeSummarySentence = buildSafeSummarySentence(displayCategory, confidence.level)
  const strongestSignals = buildStrongestSignalsList(deviations, hesitationEvents.length)
  const whyReasons = buildWhyReasons(deviations, contradiction, hesitationEvents.length, displayCategory)

  return {
    baselineUsed: baseline !== null,
    deviations,
    deviationLevel,
    contradiction,
    confidence,
    hesitationEvents,
    temporalSegments,
    recommendation,
    displayCategory,
    patternStrength,
    safeSummarySentence,
    contradictionOverrideApplied: overrideApplied,
    strongestSignals,
    whyReasons,
  }
}

const NOTABLE_DEVIATION_POINTS = 15

/** Prefers baseline-relative deviations (most specific/personalized); falls
 *  back to noting a repeated backward-movement pattern when relevant. */
function buildStrongestSignalsList(deviations: SignalDeviation[], hesitationEventCount: number): string[] {
  const bullets: string[] = []

  const notable = deviations.filter((d) => Math.abs(d.difference) >= NOTABLE_DEVIATION_POINTS).slice(0, 4)
  for (const deviation of notable) {
    const sign = deviation.difference > 0 ? '+' : ''
    const direction = deviation.difference > 0 ? 'above' : 'below'
    bullets.push(`${deviation.label.toLowerCase()} ${sign}${deviation.difference}% ${direction} baseline`)
  }

  if (hesitationEventCount > 0) {
    bullets.push(
      `${hesitationEventCount} possible hesitation event${hesitationEventCount === 1 ? '' : 's'} detected`,
    )
  }

  return bullets
}

/** Builds the numbered "why" list (Section 9) entirely from this session's own data. */
function buildWhyReasons(
  deviations: SignalDeviation[],
  contradiction: ContradictionResult,
  hesitationEventCount: number,
  displayCategory: string,
): string[] {
  const reasons: string[] = []

  const notableAboveBaseline = deviations
    .filter((d) => d.difference >= NOTABLE_DEVIATION_POINTS)
    .slice(0, 3)
  for (const deviation of notableAboveBaseline) {
    reasons.push(`${deviation.label} was ${deviation.difference}% above the user's personal baseline.`)
  }

  if (hesitationEventCount > 0) {
    reasons.push(
      `${hesitationEventCount} possible hesitation event${hesitationEventCount === 1 ? ' was' : 's were'} detected.`,
    )
  }

  if (contradiction.level !== 'Low') {
    reasons.push('Facial smile and body behavior were inconsistent with each other.')
  }

  if (reasons.length === 0) {
    reasons.push('No signal was strongly elevated relative to typical resting behavior.')
  }

  reasons.push(
    `The system therefore estimated a pattern possibly consistent with "${displayCategory}" — an observable-behavior estimate, not a confirmed emotional state.`,
  )

  return reasons
}
