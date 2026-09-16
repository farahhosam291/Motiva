import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import {
  DrawingUtils,
  FaceLandmarker,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import { createFaceLandmarker, createPoseLandmarker, createVisionFileset } from '../lib/mediapipe'
import { EMPTY_SIGNALS, extractFaceSignals, extractPoseSignals, type RawSignals } from '../lib/signalExtraction'

const FACE_MESH_COLOR = 'rgba(125, 178, 255, 0.35)'
const FACE_CONTOUR_COLOR = 'rgba(233, 196, 106, 0.9)'
const POSE_CONNECTOR_COLOR = 'rgba(79, 209, 142, 0.9)'
const POSE_POINT_COLOR = 'rgba(79, 209, 142, 1)'

// The debug panel re-renders at most this often, independent of the
// detection/draw loop which still runs every animation frame.
const STATE_UPDATE_INTERVAL_MS = 100
// Console logging of raw signals is throttled separately, and off by default.
const LOG_INTERVAL_MS = 500

interface LandmarkTrackingState {
  signals: RawSignals
  isLoadingTrackers: boolean
  trackingError: string | null
}

const INITIAL_STATE: LandmarkTrackingState = {
  signals: EMPTY_SIGNALS,
  isLoadingTrackers: false,
  trackingError: null,
}

export function useLandmarkTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isCameraActive: boolean,
  logToConsole: boolean = false,
) {
  const [state, setState] = useState<LandmarkTrackingState>(INITIAL_STATE)

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null)
  const drawingUtilsRef = useRef<DrawingUtils | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const previousPoseLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const previousFaceLandmarksRef = useRef<NormalizedLandmark[] | null>(null)
  const lastStateUpdateRef = useRef(0)
  const lastLogRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const stopLoop = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      lastVideoTimeRef.current = -1
      previousPoseLandmarksRef.current = null
      previousFaceLandmarksRef.current = null
    }

    const clearCanvas = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      ctx?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)
    }

    const disposeTrackers = () => {
      faceLandmarkerRef.current?.close()
      poseLandmarkerRef.current?.close()
      faceLandmarkerRef.current = null
      poseLandmarkerRef.current = null
      drawingUtilsRef.current = null
    }

    if (!isCameraActive) {
      stopLoop()
      disposeTrackers()
      clearCanvas()
      setState(INITIAL_STATE)
      return
    }

    const runDetectionLoop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      const face = faceLandmarkerRef.current
      const pose = poseLandmarkerRef.current

      if (video && canvas && face && pose && video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }

        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime
          const timestamp = performance.now()

          let faceResult: FaceLandmarkerResult | null = null
          let poseResult: PoseLandmarkerResult | null = null
          try {
            faceResult = face.detectForVideo(video, timestamp)
            poseResult = pose.detectForVideo(video, timestamp)
          } catch {
            // A detection call can occasionally fail on a single frame (e.g. the
            // video element briefly has no data); skip the frame and retry next tick.
          }

          if (faceResult && poseResult) {
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              const drawingUtils = drawingUtilsRef.current ?? new DrawingUtils(ctx)
              drawingUtilsRef.current = drawingUtils

              for (const landmarks of faceResult.faceLandmarks) {
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                  color: FACE_MESH_COLOR,
                  lineWidth: 1,
                })
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_CONTOURS, {
                  color: FACE_CONTOUR_COLOR,
                  lineWidth: 1.5,
                })
              }

              for (const landmarks of poseResult.landmarks) {
                drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
                  color: POSE_CONNECTOR_COLOR,
                  lineWidth: 2,
                })
                drawingUtils.drawLandmarks(landmarks, {
                  color: POSE_POINT_COLOR,
                  radius: 2,
                })
              }
            }

            const faceSignals = extractFaceSignals(faceResult, previousFaceLandmarksRef.current)
            const poseSignals = extractPoseSignals(poseResult, previousPoseLandmarksRef.current)
            previousFaceLandmarksRef.current = faceSignals.landmarks
            previousPoseLandmarksRef.current = poseSignals.landmarks

            const signals: RawSignals = {
              faceDetected: faceSignals.faceDetected,
              poseDetected: poseSignals.poseDetected,
              smileScore: faceSignals.smileScore,
              mouthOpenness: faceSignals.mouthOpenness,
              eyebrowRaise: faceSignals.eyebrowRaise,
              eyeOpenness: faceSignals.eyeOpenness,
              headYaw: faceSignals.headYaw,
              headPitch: faceSignals.headPitch,
              gazeOffsetX: faceSignals.gazeOffsetX,
              gazeOffsetY: faceSignals.gazeOffsetY,
              handMovement: poseSignals.handMovement,
              bodyMovement: poseSignals.bodyMovement,
              lipTension: faceSignals.lipTension,
              squint: faceSignals.squint,
              eyebrowLower: faceSignals.eyebrowLower,
              shoulderMovement: poseSignals.shoulderMovement,
              postureChangeRaw: poseSignals.postureChangeRaw,
              shoulderWidthDelta: poseSignals.shoulderWidthDelta,
              headMovementRaw: faceSignals.headMovementRaw,
              gazeMovementRaw: faceSignals.gazeMovementRaw,
              headRoll: faceSignals.headRoll,
              jawMovement: faceSignals.jawMovement,
            }

            if (logToConsole && timestamp - lastLogRef.current >= LOG_INTERVAL_MS) {
              lastLogRef.current = timestamp
              console.log('[Motiva raw signals]', {
                face: signals.faceDetected,
                pose: signals.poseDetected,
                smileScore: signals.smileScore?.toFixed(3),
                mouthOpenness: signals.mouthOpenness?.toFixed(3),
                eyebrowRaise: signals.eyebrowRaise?.toFixed(3),
                eyeOpenness: signals.eyeOpenness?.toFixed(3),
                headYaw: signals.headYaw?.toFixed(1),
                headPitch: signals.headPitch?.toFixed(1),
                gazeOffsetX: signals.gazeOffsetX?.toFixed(3),
                gazeOffsetY: signals.gazeOffsetY?.toFixed(3),
                handMovement: signals.handMovement?.toFixed(4),
                bodyMovement: signals.bodyMovement?.toFixed(4),
                lipTension: signals.lipTension?.toFixed(3),
                squint: signals.squint?.toFixed(3),
                eyebrowLower: signals.eyebrowLower?.toFixed(3),
                shoulderMovement: signals.shoulderMovement?.toFixed(4),
                postureChangeRaw: signals.postureChangeRaw?.toFixed(2),
                shoulderWidthDelta: signals.shoulderWidthDelta?.toFixed(4),
                headMovementRaw: signals.headMovementRaw?.toFixed(2),
                gazeMovementRaw: signals.gazeMovementRaw?.toFixed(4),
                headRoll: signals.headRoll?.toFixed(1),
                jawMovement: signals.jawMovement?.toFixed(3),
              })
            }

            if (timestamp - lastStateUpdateRef.current >= STATE_UPDATE_INTERVAL_MS) {
              lastStateUpdateRef.current = timestamp
              setState((prev) => ({ ...prev, signals }))
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(runDetectionLoop)
    }

    const init = async () => {
      setState((prev) => ({ ...prev, isLoadingTrackers: true, trackingError: null }))
      try {
        const vision = await createVisionFileset()
        const [face, pose] = await Promise.all([
          createFaceLandmarker(vision),
          createPoseLandmarker(vision),
        ])

        if (cancelled) {
          face.close()
          pose.close()
          return
        }

        faceLandmarkerRef.current = face
        poseLandmarkerRef.current = pose
        setState((prev) => ({ ...prev, isLoadingTrackers: false }))
        rafIdRef.current = requestAnimationFrame(runDetectionLoop)
      } catch {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isLoadingTrackers: false,
            trackingError: 'Unable to load face and pose tracking models.',
          }))
        }
      }
    }

    init()

    return () => {
      cancelled = true
      stopLoop()
      disposeTrackers()
      clearCanvas()
    }
  }, [isCameraActive, videoRef, canvasRef, logToConsole])

  return state
}
