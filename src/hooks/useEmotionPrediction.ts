import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { cropFaceToBlob, type FaceBoundingBox } from '../lib/faceCrop'
import { EMOTION_LABELS, type EmotionLabel, type EmotionProbabilities } from '../types/facialAI'

const PREDICT_ENDPOINT = 'http://127.0.0.1:8000/predict-emotion'

// ~2 predictions per second, as requested — not every video frame. Easy to
// retune later.
const PREDICTION_INTERVAL_MS = 500

// Smooth the *live* displayed result across this many recent successful
// predictions (a simple moving average of the probability vectors) so it
// doesn't jump between emotions on a single noisy frame. This is separate
// from the whole-session average used for the frozen final result.
const SMOOTHING_WINDOW = 5

// A request is given this long to complete before being treated as failed,
// so a hung backend can't permanently stall the prediction loop.
const REQUEST_TIMEOUT_MS = 3000

// After this many consecutive ticks with no face box (~2s at the interval
// above), drop back to idle instead of showing an increasingly stale result.
const MAX_CONSECUTIVE_MISSES = 4

export type FacialAIStatus = 'idle' | 'waiting' | 'unavailable' | 'ready'

interface EmotionPredictionState {
  status: FacialAIStatus
  /** Smoothed top label, or null until a first prediction has been smoothed in. */
  prediction: EmotionLabel | null
  /** Smoothed confidence (0-1) for `prediction`. */
  confidence: number | null
  /** Smoothed probability (0-1) for every class. */
  probabilities: EmotionProbabilities | null
}

const INITIAL_STATE: EmotionPredictionState = {
  status: 'idle',
  prediction: null,
  confidence: null,
  probabilities: null,
}

interface PredictEmotionResponse {
  prediction: string
  confidence: number
  probabilities: Record<string, number>
}

/** The session-average result, without the App-level fields (sessionNumber,
 *  durationMs) that only App.tsx knows about. */
export interface SessionAIAverage {
  prediction: EmotionLabel
  confidence: number
  probabilities: EmotionProbabilities
  sampleCount: number
}

function createEmptySums(): EmotionProbabilities {
  return Object.fromEntries(EMOTION_LABELS.map((label) => [label, 0])) as EmotionProbabilities
}

/**
 * Periodically crops the currently-detected face out of the video feed and
 * sends it to the backend's /predict-emotion endpoint. Maintains two
 * independent views of the results:
 *
 * - a short rolling-window smoothed value (`status`/`prediction`/
 *   `confidence`/`probabilities`) for live display, updated continuously
 *   whenever the camera is on and a face is detected
 * - a whole-session accumulator (sum of every raw response + count) that
 *   only accumulates while `isAnalyzing` is true, read via
 *   `finalizeSession()` when Pause Analysis is pressed
 *
 * Fully independent of the existing MediaPipe-derived signals/session
 * pipeline — it neither reads from nor feeds into that system.
 */
export function useEmotionPrediction(
  videoRef: RefObject<HTMLVideoElement | null>,
  faceBoundingBox: FaceBoundingBox | null,
  isCameraActive: boolean,
  isAnalyzing: boolean,
) {
  const [state, setState] = useState<EmotionPredictionState>(INITIAL_STATE)

  const boxRef = useRef<FaceBoundingBox | null>(null)
  boxRef.current = faceBoundingBox

  const isAnalyzingRef = useRef(isAnalyzing)
  isAnalyzingRef.current = isAnalyzing

  const historyRef = useRef<EmotionProbabilities[]>([])
  const inFlightRef = useRef(false)
  const missedTicksRef = useRef(0)

  const sessionSumsRef = useRef<EmotionProbabilities | null>(null)
  const sessionCountRef = useRef(0)

  const resetSessionAccumulator = useCallback(() => {
    sessionSumsRef.current = createEmptySums()
    sessionCountRef.current = 0
  }, [])

  /** Call at Start Analysis to begin collecting this session's average. */
  const startSession = resetSessionAccumulator
  /** Call to discard in-progress session data (Reset, or camera dropped mid-analysis). */
  const discardSession = resetSessionAccumulator

  /** Call once (Pause Analysis) to read and freeze the session's average. Null if no
   *  predictions were successfully collected this session (e.g. backend was unreachable). */
  const finalizeSession = useCallback((): SessionAIAverage | null => {
    const sums = sessionSumsRef.current
    const count = sessionCountRef.current
    if (!sums || count === 0) return null

    const probabilities = Object.fromEntries(
      EMOTION_LABELS.map((label) => [label, sums[label] / count]),
    ) as EmotionProbabilities
    const prediction = pickTopLabel(probabilities)

    return { prediction, confidence: probabilities[prediction], probabilities, sampleCount: count }
  }, [])

  useEffect(() => {
    if (!isCameraActive) {
      historyRef.current = []
      inFlightRef.current = false
      missedTicksRef.current = 0
      setState(INITIAL_STATE)
      return
    }

    let cancelled = false

    const tick = async () => {
      const video = videoRef.current
      const box = boxRef.current

      if (!video || !box) {
        missedTicksRef.current += 1
        if (missedTicksRef.current >= MAX_CONSECUTIVE_MISSES) {
          historyRef.current = []
          setState((prev) => (prev.status === 'idle' ? prev : INITIAL_STATE))
        }
        return
      }
      missedTicksRef.current = 0

      if (inFlightRef.current) return
      inFlightRef.current = true
      setState((prev) => (prev.status === 'idle' ? { ...prev, status: 'waiting' } : prev))

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const blob = await cropFaceToBlob(video, box)
        if (!blob) return

        const formData = new FormData()
        formData.append('file', blob, 'face.jpg')

        const response = await fetch(PREDICT_ENDPOINT, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`)
        }

        const data = (await response.json()) as PredictEmotionResponse
        if (cancelled) return

        const probabilities = data.probabilities as EmotionProbabilities

        // Whole-session average, only while an analysis session is running —
        // accumulates the raw (unsmoothed) response, independent of the
        // rolling live-display window below.
        if (isAnalyzingRef.current && sessionSumsRef.current) {
          for (const label of EMOTION_LABELS) {
            sessionSumsRef.current[label] += probabilities[label] ?? 0
          }
          sessionCountRef.current += 1
        }

        historyRef.current = [...historyRef.current, probabilities].slice(-SMOOTHING_WINDOW)

        const smoothed = averageProbabilities(historyRef.current)
        const topLabel = pickTopLabel(smoothed)

        setState({
          status: 'ready',
          prediction: topLabel,
          confidence: smoothed[topLabel],
          probabilities: smoothed,
        })
      } catch {
        if (!cancelled) {
          historyRef.current = []
          setState({ status: 'unavailable', prediction: null, confidence: null, probabilities: null })
        }
      } finally {
        window.clearTimeout(timeoutId)
        inFlightRef.current = false
      }
    }

    const intervalId = window.setInterval(tick, PREDICTION_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [isCameraActive, videoRef])

  return { ...state, startSession, discardSession, finalizeSession }
}

function averageProbabilities(history: EmotionProbabilities[]): EmotionProbabilities {
  const sums = createEmptySums()

  for (const entry of history) {
    for (const label of EMOTION_LABELS) {
      sums[label] += entry[label] ?? 0
    }
  }

  const count = history.length || 1
  for (const label of EMOTION_LABELS) {
    sums[label] = sums[label] / count
  }

  return sums
}

function pickTopLabel(probabilities: EmotionProbabilities): EmotionLabel {
  let best: EmotionLabel = EMOTION_LABELS[0]
  let bestValue = -Infinity
  for (const label of EMOTION_LABELS) {
    if (probabilities[label] > bestValue) {
      bestValue = probabilities[label]
      best = label
    }
  }
  return best
}
