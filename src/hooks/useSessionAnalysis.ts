import { useCallback, useEffect, useRef, useState } from 'react'
import type { RawSignals } from '../lib/signalExtraction'
import { SessionAccumulator } from '../lib/signalAggregation'
import { computeAffectEstimation } from '../lib/affectEstimation'
import { buildAdvancedReport } from '../lib/finalReport'
import { ALL_SIGNAL_KEYS } from '../types/session'
import type { CompletedSession, SignalStatsMap, TimelineEvent } from '../types/session'
import type { PersonalBaseline } from '../types/advanced'

function createEmptyStatsMap(): SignalStatsMap {
  const map = {} as SignalStatsMap
  for (const key of ALL_SIGNAL_KEYS) {
    map[key] = { current: null, average: null, min: null, max: null, samples: 0 }
  }
  return map
}

/**
 * Owns the current session's data collection. Consumes the `signals`
 * snapshot already produced (and throttled to ~10/sec) by the existing,
 * untouched `useLandmarkTracking` — this hook never talks to MediaPipe,
 * the camera, or the canvas directly.
 */
export function useSessionAnalysis(signals: RawSignals, isCollecting: boolean) {
  const accumulatorRef = useRef<SessionAccumulator | null>(null)
  const [liveStats, setLiveStats] = useState<SignalStatsMap>(createEmptyStatsMap)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [sampleCount, setSampleCount] = useState(0)

  useEffect(() => {
    if (!isCollecting || !accumulatorRef.current) return
    const accumulator = accumulatorRef.current
    const newEvents = accumulator.ingest(signals, Date.now())
    setLiveStats(accumulator.getLiveStats())
    setSampleCount(accumulator.getSampleCount())
    if (newEvents.length > 0) {
      setTimeline((prev) => [...prev, ...newEvents])
    }
  }, [signals, isCollecting])

  const resetToFreshAccumulator = useCallback(() => {
    accumulatorRef.current = new SessionAccumulator(Date.now())
    setLiveStats(createEmptyStatsMap())
    setTimeline([])
    setSampleCount(0)
  }, [])

  /** Call when a new session is prepared (Start Camera). */
  const startNewSession = resetToFreshAccumulator

  /** Call to discard in-progress, unfinished data (Reset). Never touches saved history. */
  const discardCurrentSession = resetToFreshAccumulator

  /** Call once (Pause Analysis) to freeze and compute the final result for `sessionNumber`. */
  const finalizeSession = useCallback(
    (sessionNumber: number, baseline: PersonalBaseline | null): CompletedSession | null => {
      const accumulator = accumulatorRef.current
      if (!accumulator) return null

      const endedAt = Date.now()
      const finalStats = accumulator.getLiveStats()
      const finalTimeline = accumulator.getTimeline()
      const coverage = accumulator.getDetectionCoverage()
      const count = accumulator.getSampleCount()

      const { estimation, explanation } = computeAffectEstimation(finalStats, coverage, count)

      const averageMovement = finalStats.movementIntensity.average
      const mainBehaviors = Array.from(
        new Set(finalTimeline.map((event) => event.description)),
      ).slice(0, 5)

      const durationMs = endedAt - accumulator.startedAt

      const advanced = buildAdvancedReport(
        estimation,
        finalStats,
        coverage,
        count,
        baseline,
        accumulator.getHesitationEvents(),
        accumulator.getTemporalSamples(),
        durationMs,
      )

      const completed: CompletedSession = {
        id: `session-${sessionNumber}-${accumulator.startedAt}`,
        sessionNumber,
        startedAt: accumulator.startedAt,
        endedAt,
        durationMs,
        sampleCount: count,
        finalStats,
        estimation,
        explanation,
        timeline: finalTimeline,
        summary: {
          sessionNumber,
          durationMs,
          sampleCount: count,
          averageMovement: averageMovement === null ? null : Math.round(averageMovement * 100),
          mainBehaviors,
          finalState: estimation.category,
          finalScore: estimation.score,
        },
        advanced,
      }

      return completed
    },
    [],
  )

  return {
    liveStats,
    timeline,
    sampleCount,
    startNewSession,
    discardCurrentSession,
    finalizeSession,
  }
}
