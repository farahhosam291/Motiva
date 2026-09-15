import type { ContributingSignal, SignalKey } from './session'

// --- Personal baseline ------------------------------------------------------

/** The subset of signals calibration measures — deliberately excludes purely
 *  facial-expression details (smile *shape* etc.) and keeps to the broader
 *  behavioral signals named in the calibration spec. */
export const BASELINE_SIGNAL_KEYS: readonly SignalKey[] = [
  'smile',
  'eyeOpenness',
  'blinkActivity',
  'gazeMovement',
  'headMovement',
  'handMovement',
  'bodyMovement',
  'postureChange',
  'shoulderMovement',
  'facialMovementIntensity',
]

export interface PersonalBaseline {
  calibratedAt: number
  durationMs: number
  sampleCount: number
  /** Average 0-1 value per baseline signal, from the calibration session. */
  values: Partial<Record<SignalKey, number>>
}

// --- Deviation from baseline -------------------------------------------------

export interface SignalDeviation {
  key: SignalKey
  label: string
  /** 0-100 */
  current: number
  /** 0-100 */
  baseline: number
  /** current - baseline, in percentage points; can be negative. */
  difference: number
  description: string
}

export type DeviationLevel = 'Low' | 'Moderate' | 'High'

// --- Cross-modal contradiction -----------------------------------------------

export type ContradictionLevel = 'Low' | 'Moderate' | 'High'

export interface ContradictionResult {
  /** 0-100 */
  score: number
  level: ContradictionLevel
  facialPositivityIndex: number
  bodyDiscomfortIndex: number
  contributingSignals: ContributingSignal[]
  summary: string
}

// --- Confidence ---------------------------------------------------------------

export type ConfidenceLevel = 'Low' | 'Moderate' | 'High'

export interface ConfidenceResult {
  level: ConfidenceLevel
  /** 0-100 */
  score: number
  reasons: string[]
}

// --- Hesitation events (rolling-window, distinct from the single-frame
// "hesitation" behavior event already in the Timeline) --------------------------

export interface HesitationEvent {
  id: string
  /** mm:ss at which the window first crossed the threshold. */
  time: string
  startElapsedMs: number
  endElapsedMs: number
  durationMs: number
  /** 0-100 */
  score: number
  contributingSignals: string[]
}

// --- Temporal segmentation ----------------------------------------------------

export interface TemporalSegment {
  /** e.g. "00:00–00:08" */
  timeRange: string
  description: string
}

// --- Physical AI response recommendation --------------------------------------

export interface PhysicalAIRecommendation {
  title: string
  actions: string[]
  rationale: string
}

// --- The consolidated report attached to a CompletedSession -------------------

export interface AdvancedSessionReport {
  baselineUsed: boolean
  deviations: SignalDeviation[]
  deviationLevel: DeviationLevel | null
  contradiction: ContradictionResult
  confidence: ConfidenceResult
  hesitationEvents: HesitationEvent[]
  temporalSegments: TemporalSegment[]
  recommendation: PhysicalAIRecommendation
  /** Category after the contradiction-aware override, e.g. "Possible Nervous
   *  Smile / Masked Discomfort" — falls back to the base estimation category
   *  when no override applies. */
  displayCategory: string
  /** 0-100, matching displayCategory (may differ from the base estimation score
   *  when an override applied). */
  patternStrength: number
  /** The hedged, safety-rule-compliant sentence for display (Section 11/16). */
  safeSummarySentence: string
  contradictionOverrideApplied: boolean
  /** Short, human-readable bullets for the "Strongest Signals" list (Section 8). */
  strongestSignals: string[]
  /** Numbered "why" reasons built from actual session data (Section 9). */
  whyReasons: string[]
}
