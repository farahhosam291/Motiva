import { formatElapsed } from './format'
import type { HesitationEvent } from '../types/advanced'

// --- Configurable thresholds (Section 15) ------------------------------------
const WINDOW_MS = 6000 // how far back the rolling window looks
const MIN_SAMPLES_IN_WINDOW = 6 // don't evaluate a window with too little data
const SCORE_START_THRESHOLD = 0.5 // window score needed to begin a candidate event
const SCORE_END_THRESHOLD = 0.35 // window score must drop below this to close the event
const MIN_EVENT_DURATION_MS = 1500 // ignore very short blips — "not one small movement"
const EVENT_COOLDOWN_MS = 5000 // minimum gap between two finalized events
const CHANGE_EDGE_THRESHOLD = 0.5 // per-sample threshold used to count "a change happened"

interface WindowSample {
  elapsedMs: number
  gazeMovement: number | null
  headMovement: number | null
  handMovement: number | null
  movementIntensity: number | null
  movingBackward: number | null
  postureChange: number | null
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function countRisingEdges(samples: WindowSample[], key: 'gazeMovement' | 'headMovement'): number {
  let count = 0
  let wasAbove = false
  for (const sample of samples) {
    const value = sample[key]
    const isAbove = value !== null && value >= CHANGE_EDGE_THRESHOLD
    if (isAbove && !wasAbove) count += 1
    wasAbove = isAbove
  }
  return count
}

interface WindowScore {
  score: number
  contributors: string[]
}

/**
 * Scores how strongly the *recent window* matches the hesitation pattern
 * described in Section 5: the body pausing/slowing while gaze and head
 * direction keep shifting and hands become more active, optionally with a
 * backward lean or posture change. Splits the window into an earlier and a
 * recent half to detect *trends* (increasing hand activity, decreasing body
 * movement) rather than just absolute levels.
 */
function scoreWindow(samples: WindowSample[]): WindowScore {
  const midpoint = samples[Math.floor(samples.length / 2)]?.elapsedMs ?? samples[0].elapsedMs
  const earlierHalf = samples.filter((s) => s.elapsedMs < midpoint)
  const recentHalf = samples.filter((s) => s.elapsedMs >= midpoint)

  const gazeChanges = countRisingEdges(samples, 'gazeMovement')
  const headChanges = countRisingEdges(samples, 'headMovement')
  // "Repeated" implies at least two separate changes within the window.
  const gazeChangeScore = clamp01(gazeChanges / 2)
  const headChangeScore = clamp01(headChanges / 2)

  const earlierHand = average(earlierHalf.map((s) => s.handMovement))
  const recentHand = average(recentHalf.map((s) => s.handMovement))
  const handTrendScore =
    earlierHand === null || recentHand === null ? 0 : clamp01(recentHand - earlierHand)

  const earlierBody = average(earlierHalf.map((s) => s.movementIntensity))
  const recentBody = average(recentHalf.map((s) => s.movementIntensity))
  const bodyPauseScore =
    earlierBody === null || recentBody === null ? 0 : clamp01(earlierBody - recentBody)

  const backwardScore = clamp01(Math.max(0, ...samples.map((s) => s.movingBackward ?? 0)))
  const postureScore = clamp01(Math.max(0, ...samples.map((s) => s.postureChange ?? 0)))

  const score = clamp01(
    gazeChangeScore * 0.25 +
      headChangeScore * 0.2 +
      handTrendScore * 0.2 +
      bodyPauseScore * 0.15 +
      backwardScore * 0.1 +
      postureScore * 0.1,
  )

  const contributors: string[] = []
  if (headChangeScore >= 0.4) contributors.push('head movement increased')
  if (gazeChangeScore >= 0.4) contributors.push('repeated gaze changes')
  if (bodyPauseScore >= 0.3) contributors.push('movement pause')
  if (handTrendScore >= 0.3) contributors.push('hand movement increased')
  if (backwardScore >= 0.3) contributors.push('backward body movement')
  if (postureScore >= 0.3) contributors.push('posture change')

  return { score, contributors }
}

let hesitationIdCounter = 0

/**
 * Detects "hesitation events" from patterns *over time* rather than a single
 * frame: fed one signal snapshot per tick, it maintains a rolling window and
 * only reports a finished event once the pattern has held for a meaningful
 * duration and then subsided — never a single elevated sample.
 */
export class HesitationWindowAnalyzer {
  private buffer: WindowSample[] = []
  private pendingStartElapsedMs: number | null = null
  private pendingMaxScore = 0
  private pendingContributorCounts = new Map<string, number>()
  private lastFinalizedEndAt = -Infinity

  /** Feed one tick's derived signals. Returns a finalized event, if one just ended. */
  update(elapsedMs: number, values: Record<string, number | null>): HesitationEvent | null {
    this.buffer.push({
      elapsedMs,
      gazeMovement: values.gazeMovement ?? null,
      headMovement: values.headMovement ?? null,
      handMovement: values.handMovement ?? null,
      movementIntensity: values.movementIntensity ?? null,
      movingBackward: values.movingBackward ?? null,
      postureChange: values.postureChange ?? null,
    })
    this.buffer = this.buffer.filter((sample) => elapsedMs - sample.elapsedMs <= WINDOW_MS)

    if (this.buffer.length < MIN_SAMPLES_IN_WINDOW) return null

    const { score, contributors } = scoreWindow(this.buffer)

    if (score >= SCORE_START_THRESHOLD) {
      if (this.pendingStartElapsedMs === null) {
        this.pendingStartElapsedMs = elapsedMs
      }
      this.pendingMaxScore = Math.max(this.pendingMaxScore, score)
      for (const contributor of contributors) {
        this.pendingContributorCounts.set(
          contributor,
          (this.pendingContributorCounts.get(contributor) ?? 0) + 1,
        )
      }
      return null
    }

    if (this.pendingStartElapsedMs !== null && score < SCORE_END_THRESHOLD) {
      const startElapsedMs = this.pendingStartElapsedMs
      const durationMs = elapsedMs - startElapsedMs
      const maxScore = this.pendingMaxScore
      const contributingSignals = [...this.pendingContributorCounts.keys()]

      this.pendingStartElapsedMs = null
      this.pendingMaxScore = 0
      this.pendingContributorCounts.clear()

      if (durationMs < MIN_EVENT_DURATION_MS) return null
      if (elapsedMs - this.lastFinalizedEndAt < EVENT_COOLDOWN_MS) return null

      this.lastFinalizedEndAt = elapsedMs
      hesitationIdCounter += 1

      return {
        id: `hesitation-${hesitationIdCounter}`,
        time: formatElapsed(startElapsedMs),
        startElapsedMs,
        endElapsedMs: elapsedMs,
        durationMs,
        score: Math.round(maxScore * 100),
        contributingSignals,
      }
    }

    return null
  }
}
