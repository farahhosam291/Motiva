import type { RawSignals } from './signalExtraction'
import {
  ALL_SIGNAL_KEYS,
  FACIAL_SIGNAL_KEYS,
  type SignalKey,
  type SignalStats,
  type SignalStatsMap,
  type TimelineEvent,
} from '../types/session'
import type { HesitationEvent } from '../types/advanced'
import { HesitationWindowAnalyzer } from './hesitationWindowDetection'
import type { TemporalSample } from './temporalChangeDetection'

// How often a downsampled snapshot is kept for whole-session temporal
// segmentation (Section 6) — every tick would be far more data than that
// analysis needs.
const TEMPORAL_SAMPLE_INTERVAL_MS = 1000

// --- Calibration constants --------------------------------------------------
// Every input to these formulas is a real, live measurement (a landmark
// delta, a blendshape score, a time-windowed event rate) — nothing here is
// placeholder or random. The specific scale factors below are heuristic
// calibration that map those real measurements onto a 0-1 range for display,
// tuned by hand rather than from a labeled dataset. They are intentionally
// isolated here as named constants so the algorithm can be recalibrated
// later without touching the rest of the pipeline.
const MOVEMENT_SCALE = 8 // hand/body/shoulder landmark delta per sample -> 0-1
const HEAD_MOVEMENT_SCALE = 15 // degrees of yaw/pitch change per sample -> 0-1
const GAZE_MOVEMENT_SCALE = 6 // gaze-offset delta per sample -> 0-1
const POSTURE_CHANGE_SCALE = 6 // degrees of torso-lean change per sample -> 0-1
const SHOULDER_WIDTH_SCALE = 15 // shoulder-width delta per sample -> 0-1
const HEAD_ANGLE_RANGE_DEGREES = 90 // yaw/pitch/roll clamp range -> maps to 0-100%
const FACIAL_MOVEMENT_SCALE = 5 // avg expression-blendshape delta per sample -> 0-1

const BLINK_CLOSED_THRESHOLD = 0.5 // eyeOpenness below this counts as "eyes closed"
const BLINK_RATE_REFERENCE_PER_MIN = 25 // blink rate that maps to 100% blink activity
const BLINK_WINDOW_MS = 60_000

const EVENT_COOLDOWN_MS = 4000

// Live "current" values are smoothed with an exponential moving average so a
// single noisy frame doesn't make a percentage bar jump — this only affects
// the smoothed display/session-stats stream; the Debug panel still reads
// straight from the unsmoothed RawSignals coming out of useLandmarkTracking.
const FACIAL_SMOOTHING_ALPHA = 0.35

// The expression-blendshape signals whose frame-to-frame change defines
// "facial movement intensity" — deliberately excludes eye/gaze/head signals,
// which already have their own dedicated movement metrics.
const EXPRESSION_SIGNAL_KEYS: SignalKey[] = [
  'smile',
  'mouthOpen',
  'lipTension',
  'eyebrowRaise',
  'eyebrowLower',
  'squint',
  'jawMovement',
]

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

/** Average absolute change between two same-shaped signal snapshots, ignoring keys missing from either. */
function averageAbsoluteDelta(
  previous: Partial<Record<SignalKey, number | null>> | null,
  current: Partial<Record<SignalKey, number | null>>,
  keys: SignalKey[],
): number | null {
  if (!previous) return null
  let total = 0
  let count = 0
  for (const key of keys) {
    const prevValue = previous[key]
    const currValue = current[key]
    if (prevValue !== null && prevValue !== undefined && currValue !== null && currValue !== undefined) {
      total += Math.abs(currValue - prevValue)
      count += 1
    }
  }
  return count > 0 ? total / count : null
}

/**
 * Derives every signal computable directly from a single MediaPipe frame
 * (the raw signals already carry their own frame-to-frame deltas). The
 * exceptions — blinkActivity (a rate over time), hesitation (depends on
 * blinkActivity), and facialMovementIntensity (a frame-to-frame delta of
 * this very function's own output) — need cross-tick state and are
 * computed by SessionAccumulator instead.
 */
export function deriveInstantaneousSignals(
  raw: RawSignals,
): Record<Exclude<SignalKey, 'blinkActivity' | 'hesitation' | 'facialMovementIntensity'>, number | null> {
  const headMovement =
    raw.headMovementRaw === null ? null : clamp01(raw.headMovementRaw / HEAD_MOVEMENT_SCALE)
  const gazeMovement =
    raw.gazeMovementRaw === null ? null : clamp01(raw.gazeMovementRaw * GAZE_MOVEMENT_SCALE)
  const handMovement = raw.handMovement === null ? null : clamp01(raw.handMovement * MOVEMENT_SCALE)
  const bodyMovement = raw.bodyMovement === null ? null : clamp01(raw.bodyMovement * MOVEMENT_SCALE)
  const shoulderMovement =
    raw.shoulderMovement === null ? null : clamp01(raw.shoulderMovement * MOVEMENT_SCALE)
  const postureChange =
    raw.postureChangeRaw === null ? null : clamp01(raw.postureChangeRaw / POSTURE_CHANGE_SCALE)

  let movingForward: number | null = null
  let movingBackward: number | null = null
  if (raw.shoulderWidthDelta !== null) {
    movingForward = clamp01(Math.max(0, raw.shoulderWidthDelta) * SHOULDER_WIDTH_SCALE)
    movingBackward = clamp01(Math.max(0, -raw.shoulderWidthDelta) * SHOULDER_WIDTH_SCALE)
  }

  // Head yaw/pitch/roll are exposed as unsigned "how far from center/level"
  // magnitudes (0% = facing/level straight ahead, 100% = at the ±90° clamp),
  // to fit the same 0-100% bar used by every other signal. Direction (e.g.
  // "turned left" vs "turned right") is preserved separately in the raw
  // signal and used by the behavior-event descriptions.
  const headYaw = raw.headYaw === null ? null : clamp01(Math.abs(raw.headYaw) / HEAD_ANGLE_RANGE_DEGREES)
  const headPitch =
    raw.headPitch === null ? null : clamp01(Math.abs(raw.headPitch) / HEAD_ANGLE_RANGE_DEGREES)
  const headRoll =
    raw.headRoll === null ? null : clamp01(Math.abs(raw.headRoll) / HEAD_ANGLE_RANGE_DEGREES)

  const movementIntensity = average([handMovement, bodyMovement, headMovement])
  const stability = movementIntensity === null ? null : clamp01(1 - movementIntensity)
  const lookingAround = average([gazeMovement, headMovement])

  return {
    smile: raw.smileScore,
    mouthOpen: raw.mouthOpenness,
    lipTension: raw.lipTension,
    eyeOpenness: raw.eyeOpenness,
    squint: raw.squint,
    eyebrowRaise: raw.eyebrowRaise,
    eyebrowLower: raw.eyebrowLower,
    jawMovement: raw.jawMovement,
    headYaw,
    headPitch,
    headRoll,
    gazeMovement,
    headMovement,
    handMovement,
    bodyMovement,
    postureChange,
    shoulderMovement,
    movingBackward,
    movingForward,
    movementIntensity,
    stability,
    lookingAround,
  }
}

function createEmptyStats(): SignalStats {
  return { current: null, average: null, min: null, max: null, samples: 0 }
}

function createEmptyStatsMap(): SignalStatsMap {
  const map = {} as SignalStatsMap
  for (const key of ALL_SIGNAL_KEYS) map[key] = createEmptyStats()
  return map
}

interface EventRule {
  key: string
  signal: SignalKey
  threshold: number
  describe: (value: number, raw: RawSignals) => string
}

const EVENT_RULES: EventRule[] = [
  {
    key: 'headTurn',
    signal: 'headMovement',
    threshold: 0.5,
    describe: (_value, raw) =>
      `Head turned ${raw.headYaw !== null && raw.headYaw < 0 ? 'left' : 'right'}`,
  },
  { key: 'gaze', signal: 'gazeMovement', threshold: 0.5, describe: () => 'Rapid gaze change' },
  { key: 'hand', signal: 'handMovement', threshold: 0.5, describe: () => 'Hand movement increased' },
  { key: 'body', signal: 'bodyMovement', threshold: 0.5, describe: () => 'Body movement increased' },
  { key: 'smile', signal: 'smile', threshold: 0.5, describe: () => 'Smile increased' },
  {
    key: 'lipTension',
    signal: 'lipTension',
    threshold: 0.5,
    describe: () => 'Mouth tension detected',
  },
  {
    key: 'backward',
    signal: 'movingBackward',
    threshold: 0.4,
    describe: () => 'Stepped backward',
  },
  { key: 'forward', signal: 'movingForward', threshold: 0.4, describe: () => 'Stepped forward' },
  {
    key: 'blink',
    signal: 'blinkActivity',
    threshold: 0.6,
    describe: () => 'Frequent blinking detected',
  },
  {
    key: 'hesitation',
    signal: 'hesitation',
    threshold: 0.55,
    describe: () => 'Possible hesitation detected',
  },
  {
    key: 'posture',
    signal: 'postureChange',
    threshold: 0.5,
    describe: () => 'Posture change detected',
  },
  {
    key: 'lookingAround',
    signal: 'lookingAround',
    threshold: 0.6,
    describe: () => 'Looking around became high',
  },
]

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

let eventIdCounter = 0

/**
 * Owns everything about a single analysis session: running per-signal
 * statistics, blink-rate tracking, and behavioral-event detection. One
 * instance is created per session (Start Camera) and fed live signal
 * snapshots via `ingest` while analysis is running.
 */
export class SessionAccumulator {
  readonly startedAt: number
  private stats: SignalStatsMap = createEmptyStatsMap()
  private timeline: TimelineEvent[] = []
  private eventEdgeState = new Map<string, { wasAbove: boolean; lastFiredAt: number }>()
  private blinkWasClosed = false
  private blinkTimestamps: number[] = []
  private sampleCount = 0
  private detectedSampleCount = 0
  private previousExpressionSnapshot: Partial<Record<SignalKey, number | null>> | null = null
  private smoothedFacialValues: Partial<Record<SignalKey, number>> = {}
  private hesitationAnalyzer = new HesitationWindowAnalyzer()
  private hesitationEvents: HesitationEvent[] = []
  private temporalSamples: TemporalSample[] = []
  private lastTemporalSampleAt = -Infinity

  constructor(startedAt: number) {
    this.startedAt = startedAt
  }

  /** Feed one live signal snapshot into the session. Returns any newly-triggered events. */
  ingest(raw: RawSignals, nowMs: number): TimelineEvent[] {
    this.sampleCount += 1
    if (raw.faceDetected || raw.poseDetected) this.detectedSampleCount += 1

    if (raw.eyeOpenness !== null) {
      const isClosed = raw.eyeOpenness < BLINK_CLOSED_THRESHOLD
      if (isClosed && !this.blinkWasClosed) {
        this.blinkTimestamps.push(nowMs)
      }
      this.blinkWasClosed = isClosed
    }
    this.blinkTimestamps = this.blinkTimestamps.filter((t) => nowMs - t <= BLINK_WINDOW_MS)
    const windowMs = Math.max(3000, Math.min(BLINK_WINDOW_MS, nowMs - this.startedAt))
    const blinkRatePerMin = (this.blinkTimestamps.length / windowMs) * 60_000
    const blinkActivity =
      raw.eyeOpenness === null ? null : clamp01(blinkRatePerMin / BLINK_RATE_REFERENCE_PER_MIN)

    const instantaneous = deriveInstantaneousSignals(raw)
    const hesitation = average([instantaneous.lipTension, blinkActivity, instantaneous.squint])

    // Facial movement intensity: how much the expression itself is changing
    // right now, from the *unsmoothed* frame-to-frame delta of the
    // expression-blendshape signals (computed before smoothing is applied
    // below, so it measures genuine change rather than the smoothed lag).
    const expressionDelta = averageAbsoluteDelta(
      this.previousExpressionSnapshot,
      instantaneous,
      EXPRESSION_SIGNAL_KEYS,
    )
    const facialMovementIntensity =
      expressionDelta === null ? null : clamp01(expressionDelta * FACIAL_MOVEMENT_SCALE)
    this.previousExpressionSnapshot = { ...instantaneous }

    const values = {
      ...instantaneous,
      blinkActivity,
      hesitation,
      facialMovementIntensity,
    } as Record<SignalKey, number | null>

    // Smooth the facial signals (EMA) before they feed session stats and
    // event detection — the Debug panel bypasses this and shows the raw,
    // unsmoothed values straight from useLandmarkTracking instead.
    for (const key of FACIAL_SIGNAL_KEYS) {
      const rawValue = values[key]
      if (rawValue === null) {
        delete this.smoothedFacialValues[key]
        continue
      }
      const previousSmoothed = this.smoothedFacialValues[key]
      const smoothed =
        previousSmoothed === undefined
          ? rawValue
          : previousSmoothed + FACIAL_SMOOTHING_ALPHA * (rawValue - previousSmoothed)
      this.smoothedFacialValues[key] = smoothed
      values[key] = smoothed
    }

    for (const key of ALL_SIGNAL_KEYS) {
      const value = values[key]
      const stat = this.stats[key]
      stat.current = value
      if (value !== null) {
        stat.samples += 1
        stat.min = stat.min === null ? value : Math.min(stat.min, value)
        stat.max = stat.max === null ? value : Math.max(stat.max, value)
        stat.average =
          stat.average === null ? value : stat.average + (value - stat.average) / stat.samples
      }
    }

    const newEvents: TimelineEvent[] = []
    for (const rule of EVENT_RULES) {
      const value = values[rule.signal]
      const state = this.eventEdgeState.get(rule.key) ?? { wasAbove: false, lastFiredAt: -Infinity }
      const isAbove = value !== null && value >= rule.threshold
      if (isAbove && !state.wasAbove && nowMs - state.lastFiredAt >= EVENT_COOLDOWN_MS) {
        state.lastFiredAt = nowMs
        eventIdCounter += 1
        const elapsedMs = nowMs - this.startedAt
        const event: TimelineEvent = {
          id: `evt-${eventIdCounter}`,
          time: formatElapsed(elapsedMs),
          elapsedMs,
          description: rule.describe(value as number, raw),
        }
        this.timeline.push(event)
        newEvents.push(event)
      }
      state.wasAbove = isAbove
      this.eventEdgeState.set(rule.key, state)
    }

    const elapsedMs = nowMs - this.startedAt

    // Rolling-window hesitation detection (Section 5) — analyzes the recent
    // pattern across several signals, not this single tick.
    const hesitationEvent = this.hesitationAnalyzer.update(elapsedMs, values)
    if (hesitationEvent) {
      this.hesitationEvents.push(hesitationEvent)
    }

    // Whole-session temporal segmentation (Section 6) samples at a coarser,
    // fixed rate — the full per-tick history isn't needed for that analysis.
    if (elapsedMs - this.lastTemporalSampleAt >= TEMPORAL_SAMPLE_INTERVAL_MS) {
      this.lastTemporalSampleAt = elapsedMs
      this.temporalSamples.push({
        elapsedMs,
        gazeMovement: values.gazeMovement,
        headMovement: values.headMovement,
        handMovement: values.handMovement,
        movementIntensity: values.movementIntensity,
      })
    }

    return newEvents
  }

  getHesitationEvents(): HesitationEvent[] {
    return [...this.hesitationEvents]
  }

  getTemporalSamples(): TemporalSample[] {
    return [...this.temporalSamples]
  }

  getLiveStats(): SignalStatsMap {
    const clone = {} as SignalStatsMap
    for (const key of ALL_SIGNAL_KEYS) clone[key] = { ...this.stats[key] }
    return clone
  }

  getTimeline(): TimelineEvent[] {
    return [...this.timeline]
  }

  getSampleCount(): number {
    return this.sampleCount
  }

  /** Fraction of samples where a face or a pose was detected at all. */
  getDetectionCoverage(): number {
    return this.sampleCount === 0 ? 0 : this.detectedSampleCount / this.sampleCount
  }
}
