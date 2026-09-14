import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraErrorType = 'permission-denied' | 'no-camera' | 'unavailable'

export interface CameraError {
  type: CameraErrorType
  message: string
}

const ERROR_MESSAGES: Record<CameraErrorType, string> = {
  'permission-denied':
    'Camera access was denied. Please allow camera permissions for this site in your browser settings and try again.',
  'no-camera': 'No camera device was found. Please connect a camera and try again.',
  unavailable:
    'Camera access is not available. This may be because your browser does not support it, or because this page is not being served over a secure connection (camera access requires HTTPS).',
}

function resolveCameraError(err: unknown): CameraError {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError') {
      return { type: 'permission-denied', message: ERROR_MESSAGES['permission-denied'] }
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.name === 'OverconstrainedError') {
      return { type: 'no-camera', message: ERROR_MESSAGES['no-camera'] }
    }
  }
  return { type: 'unavailable', message: ERROR_MESSAGES.unavailable }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<CameraError | null>(null)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    releaseStream()
    setIsActive(false)
  }, [releaseStream])

  const startCamera = useCallback(async () => {
    setError(null)
    setIsRequesting(true)

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ type: 'unavailable', message: ERROR_MESSAGES.unavailable })
      setIsRequesting(false)
      return false
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          releaseStream()
          setIsActive(false)
        }
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsActive(true)
      return true
    } catch (err) {
      setError(resolveCameraError(err))
      setIsActive(false)
      return false
    } finally {
      setIsRequesting(false)
    }
  }, [releaseStream])

  useEffect(() => releaseStream, [releaseStream])

  return { videoRef, isActive, isRequesting, error, startCamera, stopCamera }
}
