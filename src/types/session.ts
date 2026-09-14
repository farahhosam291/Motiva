export const FACIAL_SIGNAL_KEYS = [
  'smile',
  'mouthOpen',
  'lipTension',
  'eyeOpenness',
  'squint',
  'eyebrowRaise',
  'eyebrowLower',
  'blinkActivity',
  'gazeMovement',
  'headMovement',
] as const

export const BODY_SIGNAL_KEYS = [
  'handMovement',
  'bodyMovement',
  'postureChange',
  'shoulderMovement',
  'movingBackward',
  'movingForward',
] as const

export const BEHAVIOR_SIGNAL_KEYS = [
  'lookingAround',
  'hesitation',
  'movementIntensity',
  'stability',
] as const

export const ALL_SIGNAL_KEYS = [
  ...FACIAL_SIGNAL_KEYS,
  ...BODY_SIGNAL_KEYS,
  ...BEHAVIOR_SIGNAL_KEYS,
] as const

export type SignalKey = (typeof ALL_SIGNAL_KEYS)[number]

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  smile: 'Smile',
  mouthOpen: 'Mouth Open',
  lipTension: 'Lip Tension',
  eyeOpenness: 'Eye Openness',
  squint: 'Squint',
  eyebrowRaise: 'Eyebrow Raise',
  eyebrowLower: 'Eyebrow Lower',
  blinkActivity: 'Blink Activity',
  gazeMovement: 'Gaze Movement',
  headMovement: 'Head Movement',
  handMovement: 'Hand Movement',
  bodyMovement: 'Body Movement',
  postureChange: 'Posture Change',
  shoulderMovement: 'Shoulder Movement',
  movingBackward: 'Moving Backward',
  movingForward: 'Moving Forward',
  lookingAround: 'Looking Around',
  hesitation: 'Hesitation',
  movementIntensity: 'Movement Intensity',
  stability: 'Stability',
}

/**
 * Signals computed from a heuristic combination or a rate-over-time estimate
 * rather than a single direct model output. Surfaced to the user as
 * "Experimental" instead of being presented with the same confidence as a
 * direct blendshape read.
 */
export const EXPERIMENTAL_SIGNAL_KEYS: readonly SignalKey[] = [
  'blinkActivity',
  'postureChange',
  'movingBackward',
  'movingForward',
  'hesitation',
]

export interface SignalStats {
  /** Most recent value, 0-1. Null if never observed. */
  current: number | null
  /** Mean over every sample this session, 0-1. */
  average: number | null
  min: number | null
  max: number | null
  samples: number
}

export type SignalStatsMap = Record<SignalKey, SignalStats>

export interface TimelineEvent {
  id: string
  time: string
  elapsedMs: number
  description: string
}

export interface ContributingSignal {
  key: SignalKey
  label: string
  value: number
}

export interface AffectEstimation {
  category: string
  score: number
  reliability: 'Low' | 'Medium' | 'High'
  reliabilityScore: number
}

export interface EstimationExplanation {
  headline: string
  topContributors: ContributingSignal[]
  otherSignals: ContributingSignal[]
}

export interface SessionSummary {
  sessionNumber: number
  durationMs: number
  sampleCount: number
  averageMovement: number | null
  mainBehaviors: string[]
  finalState: string
  finalScore: number
}

export interface CompletedSession {
  id: string
  sessionNumber: number
  startedAt: number
  endedAt: number
  durationMs: number
  sampleCount: number
  finalStats: SignalStatsMap
  estimation: AffectEstimation
  explanation: EstimationExplanation
  timeline: TimelineEvent[]
  summary: SessionSummary
}
