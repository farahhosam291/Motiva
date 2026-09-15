import { useCallback, useEffect, useRef, useState } from 'react'
import type { RawSignals } from '../lib/signalExtraction'
import { SessionAccumulator } from '../lib/signalAggregation'
import {
  CALIBRATION_DURATION_MS,
  CALIBRATION_MIN_SAMPLES,
  buildBaselineFromStats,
  deleteBaseline as deleteStoredBaseline,
  loadBaseline,
  saveBaseline,
} from '../lib/baselineCalibration'
import type { PersonalBaseline } from '../types/advanced'

export type CalibrationPhase = 'idle' | 'collecting' | 'complete'

/**
 * Owns the "Calibrate Baseline" flow: runs a short (~18s) data collection
 * pass using the same SessionAccumulator used for real sessions (so the
 * averages it produces are directly comparable), then stores only the
 * resulting numbers — never video, images, or camera frames — to
 * localStorage.
 */
export function useBaselineCalibration(signals: RawSignals, isCameraActive: boolean) {
  const [baseline, setBaseline] = useState<PersonalBaseline | null>(loadBaseline)
  const [phase, setPhase] = useState<CalibrationPhase>('idle')
  const [progress, setProgress] = useState(0)
  const accumulatorRef = useRef<SessionAccumulator | null>(null)
  const startedAtRef = useRef<number>(0)

  const finish = useCallback(() => {
    const accumulator = accumulatorRef.current
    if (accumulator) {
      const sampleCount = accumulator.getSampleCount()
      if (sampleCount >= CALIBRATION_MIN_SAMPLES) {
        const built = buildBaselineFromStats(
          accumulator.getLiveStats(),
          sampleCount,
          Date.now() - startedAtRef.current,
        )
        saveBaseline(built)
        setBaseline(built)
      }
    }
    accumulatorRef.current = null
    setPhase('complete')
    setProgress(1)
  }, [])

  const startCalibration = useCallback(() => {
    if (!isCameraActive) return
    accumulatorRef.current = new SessionAccumulator(Date.now())
    startedAtRef.current = Date.now()
    setProgress(0)
    setPhase('collecting')
  }, [isCameraActive])

  const cancelCalibration = useCallback(() => {
    accumulatorRef.current = null
    setPhase('idle')
    setProgress(0)
  }, [])

  const removeBaseline = useCallback(() => {
    deleteStoredBaseline()
    setBaseline(null)
  }, [])

  // Feed live signals into the calibration accumulator while collecting.
  useEffect(() => {
    if (phase !== 'collecting' || !accumulatorRef.current) return
    accumulatorRef.current.ingest(signals, Date.now())
    const elapsed = Date.now() - startedAtRef.current
    setProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS))
  }, [signals, phase])

  // Auto-finish once the collection window elapses.
  useEffect(() => {
    if (phase !== 'collecting') return
    const remaining = CALIBRATION_DURATION_MS - (Date.now() - startedAtRef.current)
    const timer = window.setTimeout(finish, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [phase, finish])

  // If the camera stops mid-calibration, abandon it rather than saving a
  // partial/short baseline.
  useEffect(() => {
    if (!isCameraActive && phase === 'collecting') {
      cancelCalibration()
    }
  }, [isCameraActive, phase, cancelCalibration])

  return {
    baseline,
    phase,
    progress,
    startCalibration,
    cancelCalibration,
    removeBaseline,
  }
}
