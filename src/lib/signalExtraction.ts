import type {
  Category,
  FaceLandmarkerResult,
  NormalizedLandmark,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

/**
 * Raw, uninterpreted per-frame values read directly from MediaPipe output.
 * Nothing here is a threshold, a label, or a placeholder — every field is
 * either a live blendshape score or a live landmark-geometry calculation.
 * `null` means "no face/pose in this frame", never a fake fallback number.
 */
export interface RawSignals {
  faceDetected: boolean
  poseDetected: boolean
  /** Blendshape: average(mouthSmileLeft, mouthSmileRight), 0-1. */
  smileScore: number | null
  /** Blendshape: jawOpen, 0-1. */
  mouthOpenness: number | null
  /** Blendshape: average(browInnerUp, browOuterUpLeft, browOuterUpRight), 0-1. */
  eyebrowRaise: number | null
  /** Blendshape: 1 - average(eyeBlinkLeft, eyeBlinkRight), 0-1 (1 = fully open). */
  eyeOpenness: number | null
  /** Landmark geometry: nose-tip offset from face-width midline, in pseudo-degrees. */
  headYaw: number | null
  /** Landmark geometry: nose-tip offset from face-height midline, in pseudo-degrees. */
  headPitch: number | null
  /** Landmark geometry: iris position within the eye socket, -1..1 (0 = centered). */
  gazeOffsetX: number | null
  gazeOffsetY: number | null
  /** Landmark geometry: average wrist displacement since the previous frame (normalized units). */
  handMovement: number | null
  /** Landmark geometry: average shoulder/hip displacement since the previous frame (normalized units). */
  bodyMovement: number | null
  /** Blendshape: average(mouthPressLeft, mouthPressRight, mouthPucker), 0-1. */
  lipTension: number | null
  /** Blendshape: average(eyeSquintLeft, eyeSquintRight), 0-1. */
  squint: number | null
  /** Blendshape: average(browDownLeft, browDownRight), 0-1. */
  eyebrowLower: number | null
  /** Landmark geometry: average shoulder displacement since the previous frame (normalized units). */
  shoulderMovement: number | null
  /** Landmark geometry: change in torso lean angle since the previous frame (degrees). */
  postureChangeRaw: number | null
  /** Landmark geometry: signed change in shoulder-to-shoulder width since the previous frame
   *  (normalized units; positive = person appears closer/moving forward, negative = farther/moving backward). */
  shoulderWidthDelta: number | null
  /** Landmark geometry: magnitude of (yaw, pitch) change since the previous frame (degrees). */
  headMovementRaw: number | null
  /** Landmark geometry: magnitude of gaze-offset change since the previous frame. */
  gazeMovementRaw: number | null
  /** Landmark geometry: eye-line tilt from horizontal, in degrees (0 = level). */
  headRoll: number | null
  /** Blendshape: average(jawLeft, jawRight, jawForward), 0-1. */
  jawMovement: number | null
}

export const EMPTY_SIGNALS: RawSignals = {
  faceDetected: false,
  poseDetected: false,
  smileScore: null,
  mouthOpenness: null,
  eyebrowRaise: null,
  eyeOpenness: null,
  headYaw: null,
  headPitch: null,
  gazeOffsetX: null,
  gazeOffsetY: null,
  handMovement: null,
  bodyMovement: null,
  lipTension: null,
  squint: null,
  eyebrowLower: null,
  shoulderMovement: null,
  postureChangeRaw: null,
  shoulderWidthDelta: null,
  headMovementRaw: null,
  gazeMovementRaw: null,
  headRoll: null,
  jawMovement: null,
}

// Canonical MediaPipe Face Mesh landmark indices (468/478-point topology).
const NOSE_TIP = 1
const FOREHEAD = 10
const CHIN = 152
const LEFT_FACE_EDGE = 234
const RIGHT_FACE_EDGE = 454

const RIGHT_EYE_OUTER = 33
const RIGHT_EYE_INNER = 133
const RIGHT_EYE_UPPER = 159
const RIGHT_EYE_LOWER = 145
const RIGHT_IRIS_CENTER = 468

const LEFT_EYE_INNER = 362
const LEFT_EYE_OUTER = 263
const LEFT_EYE_UPPER = 386
const LEFT_EYE_LOWER = 374
const LEFT_IRIS_CENTER = 473

// Canonical MediaPipe Pose landmark indices (33-point BlazePose topology).
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_HIP = 23
const RIGHT_HIP = 24

function getBlendshapeScore(categories: Category[] | undefined, name: string): number {
  return categories?.find((category) => category.categoryName === name)?.score ?? 0
}

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function computeHeadPose(landmarks: NormalizedLandmark[]): { yaw: number; pitch: number } | null {
  const nose = landmarks[NOSE_TIP]
  const forehead = landmarks[FOREHEAD]
  const chin = landmarks[CHIN]
  const leftEdge = landmarks[LEFT_FACE_EDGE]
  const rightEdge = landmarks[RIGHT_FACE_EDGE]
  if (!nose || !forehead || !chin || !leftEdge || !rightEdge) return null

  const faceHalfWidth = Math.abs(rightEdge.x - leftEdge.x) / 2 || 1e-6
  const midX = (leftEdge.x + rightEdge.x) / 2
  const yaw = clamp(((nose.x - midX) / faceHalfWidth) * 90, -90, 90)

  const faceHalfHeight = Math.abs(chin.y - forehead.y) / 2 || 1e-6
  const midY = (forehead.y + chin.y) / 2
  const pitch = clamp(((nose.y - midY) / faceHalfHeight) * 90, -90, 90)

  return { yaw, pitch }
}

function computeGazeOffset(landmarks: NormalizedLandmark[]): { x: number; y: number } | null {
  const rOuter = landmarks[RIGHT_EYE_OUTER]
  const rInner = landmarks[RIGHT_EYE_INNER]
  const rUpper = landmarks[RIGHT_EYE_UPPER]
  const rLower = landmarks[RIGHT_EYE_LOWER]
  const rIris = landmarks[RIGHT_IRIS_CENTER]

  const lInner = landmarks[LEFT_EYE_INNER]
  const lOuter = landmarks[LEFT_EYE_OUTER]
  const lUpper = landmarks[LEFT_EYE_UPPER]
  const lLower = landmarks[LEFT_EYE_LOWER]
  const lIris = landmarks[LEFT_IRIS_CENTER]

  if (
    !rOuter || !rInner || !rUpper || !rLower || !rIris ||
    !lInner || !lOuter || !lUpper || !lLower || !lIris
  ) {
    return null
  }

  // Measured relative to each eye's own center, never a specific corner, so
  // both eyes agree in sign when the gaze shifts in the same real-world
  // direction (an inner/outer-corner-relative formula flips sign between the
  // two eyes and cancels out on average — see signalExtraction bug notes).
  const rCenterX = (rOuter.x + rInner.x) / 2
  const rHalfWidth = Math.abs(rInner.x - rOuter.x) / 2 || 1e-6
  const rCenterY = (rUpper.y + rLower.y) / 2
  const rHalfHeight = Math.abs(rLower.y - rUpper.y) / 2 || 1e-6
  const rX = clamp((rIris.x - rCenterX) / rHalfWidth, -1, 1)
  const rY = clamp((rIris.y - rCenterY) / rHalfHeight, -1, 1)

  const lCenterX = (lOuter.x + lInner.x) / 2
  const lHalfWidth = Math.abs(lOuter.x - lInner.x) / 2 || 1e-6
  const lCenterY = (lUpper.y + lLower.y) / 2
  const lHalfHeight = Math.abs(lLower.y - lUpper.y) / 2 || 1e-6
  const lX = clamp((lIris.x - lCenterX) / lHalfWidth, -1, 1)
  const lY = clamp((lIris.y - lCenterY) / lHalfHeight, -1, 1)

  return { x: (rX + lX) / 2, y: (rY + lY) / 2 }
}

/** Angle (degrees) of the line between the two eye centers, relative to horizontal. 0 = level. */
function computeHeadRoll(landmarks: NormalizedLandmark[]): number | null {
  const rOuter = landmarks[RIGHT_EYE_OUTER]
  const rInner = landmarks[RIGHT_EYE_INNER]
  const lInner = landmarks[LEFT_EYE_INNER]
  const lOuter = landmarks[LEFT_EYE_OUTER]
  if (!rOuter || !rInner || !lInner || !lOuter) return null

  const rEyeCenter = { x: (rOuter.x + rInner.x) / 2, y: (rOuter.y + rInner.y) / 2 }
  const lEyeCenter = { x: (lOuter.x + lInner.x) / 2, y: (lOuter.y + lInner.y) / 2 }

  const dx = lEyeCenter.x - rEyeCenter.x
  const dy = lEyeCenter.y - rEyeCenter.y
  return clamp((Math.atan2(dy, dx) * 180) / Math.PI, -90, 90)
}

function averageMovement(
  previous: NormalizedLandmark[] | null,
  current: NormalizedLandmark[],
  indices: number[],
): number | null {
  if (!previous) return null
  let total = 0
  let count = 0
  for (const index of indices) {
    const prevPoint = previous[index]
    const currPoint = current[index]
    if (prevPoint && currPoint) {
      total += distance(prevPoint, currPoint)
      count += 1
    }
  }
  return count > 0 ? total / count : null
}

export function extractFaceSignals(
  result: FaceLandmarkerResult | null,
  previousLandmarks: NormalizedLandmark[] | null,
): {
  faceDetected: boolean
  smileScore: number | null
  mouthOpenness: number | null
  eyebrowRaise: number | null
  eyeOpenness: number | null
  headYaw: number | null
  headPitch: number | null
  gazeOffsetX: number | null
  gazeOffsetY: number | null
  lipTension: number | null
  squint: number | null
  eyebrowLower: number | null
  /** Landmark geometry: magnitude of (yaw, pitch) change since the previous frame (degrees). */
  headMovementRaw: number | null
  /** Landmark geometry: magnitude of gaze-offset change since the previous frame. */
  gazeMovementRaw: number | null
  headRoll: number | null
  jawMovement: number | null
  landmarks: NormalizedLandmark[] | null
} {
  const landmarks = result?.faceLandmarks?.[0]

  if (!landmarks || landmarks.length === 0) {
    return {
      faceDetected: false,
      smileScore: null,
      mouthOpenness: null,
      eyebrowRaise: null,
      eyeOpenness: null,
      headYaw: null,
      headPitch: null,
      gazeOffsetX: null,
      gazeOffsetY: null,
      lipTension: null,
      squint: null,
      eyebrowLower: null,
      headMovementRaw: null,
      gazeMovementRaw: null,
      headRoll: null,
      jawMovement: null,
      landmarks: null,
    }
  }

  const blendshapes = result?.faceBlendshapes?.[0]?.categories

  const smileScore =
    (getBlendshapeScore(blendshapes, 'mouthSmileLeft') +
      getBlendshapeScore(blendshapes, 'mouthSmileRight')) /
    2
  const mouthOpenness = getBlendshapeScore(blendshapes, 'jawOpen')
  const eyebrowRaise =
    (getBlendshapeScore(blendshapes, 'browInnerUp') +
      getBlendshapeScore(blendshapes, 'browOuterUpLeft') +
      getBlendshapeScore(blendshapes, 'browOuterUpRight')) /
    3
  const eyeOpenness =
    1 -
    (getBlendshapeScore(blendshapes, 'eyeBlinkLeft') +
      getBlendshapeScore(blendshapes, 'eyeBlinkRight')) /
      2
  const lipTension =
    (getBlendshapeScore(blendshapes, 'mouthPressLeft') +
      getBlendshapeScore(blendshapes, 'mouthPressRight') +
      getBlendshapeScore(blendshapes, 'mouthPucker')) /
    3
  const squint =
    (getBlendshapeScore(blendshapes, 'eyeSquintLeft') +
      getBlendshapeScore(blendshapes, 'eyeSquintRight')) /
    2
  const eyebrowLower =
    (getBlendshapeScore(blendshapes, 'browDownLeft') +
      getBlendshapeScore(blendshapes, 'browDownRight')) /
    2
  const jawMovement =
    (getBlendshapeScore(blendshapes, 'jawLeft') +
      getBlendshapeScore(blendshapes, 'jawRight') +
      getBlendshapeScore(blendshapes, 'jawForward')) /
    3

  const headPose = computeHeadPose(landmarks)
  const gaze = computeGazeOffset(landmarks)
  const headRoll = computeHeadRoll(landmarks)

  let headMovementRaw: number | null = null
  let gazeMovementRaw: number | null = null
  if (previousLandmarks) {
    const previousHeadPose = computeHeadPose(previousLandmarks)
    const previousGaze = computeGazeOffset(previousLandmarks)
    if (headPose && previousHeadPose) {
      headMovementRaw = Math.hypot(
        headPose.yaw - previousHeadPose.yaw,
        headPose.pitch - previousHeadPose.pitch,
      )
    }
    if (gaze && previousGaze) {
      gazeMovementRaw = Math.hypot(gaze.x - previousGaze.x, gaze.y - previousGaze.y)
    }
  }

  return {
    faceDetected: true,
    smileScore,
    mouthOpenness,
    eyebrowRaise,
    eyeOpenness,
    headYaw: headPose?.yaw ?? null,
    headPitch: headPose?.pitch ?? null,
    gazeOffsetX: gaze?.x ?? null,
    gazeOffsetY: gaze?.y ?? null,
    lipTension,
    squint,
    eyebrowLower,
    headMovementRaw,
    gazeMovementRaw,
    headRoll,
    jawMovement,
    landmarks,
  }
}

/** Angle (degrees) of the shoulder-midpoint-to-hip-midpoint vector from vertical; a proxy for torso lean. */
function computeTorsoLeanAngle(landmarks: NormalizedLandmark[]): number | null {
  const lShoulder = landmarks[LEFT_SHOULDER]
  const rShoulder = landmarks[RIGHT_SHOULDER]
  const lHip = landmarks[LEFT_HIP]
  const rHip = landmarks[RIGHT_HIP]
  if (!lShoulder || !rShoulder || !lHip || !rHip) return null

  const shoulderMidX = (lShoulder.x + rShoulder.x) / 2
  const shoulderMidY = (lShoulder.y + rShoulder.y) / 2
  const hipMidX = (lHip.x + rHip.x) / 2
  const hipMidY = (lHip.y + rHip.y) / 2

  const dx = shoulderMidX - hipMidX
  const dy = shoulderMidY - hipMidY
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

function computeShoulderWidth(landmarks: NormalizedLandmark[]): number | null {
  const lShoulder = landmarks[LEFT_SHOULDER]
  const rShoulder = landmarks[RIGHT_SHOULDER]
  if (!lShoulder || !rShoulder) return null
  return distance(lShoulder, rShoulder)
}

export function extractPoseSignals(
  result: PoseLandmarkerResult | null,
  previousLandmarks: NormalizedLandmark[] | null,
): {
  poseDetected: boolean
  handMovement: number | null
  bodyMovement: number | null
  shoulderMovement: number | null
  postureChangeRaw: number | null
  shoulderWidthDelta: number | null
  landmarks: NormalizedLandmark[] | null
} {
  const landmarks = result?.landmarks?.[0]

  if (!landmarks || landmarks.length === 0) {
    return {
      poseDetected: false,
      handMovement: null,
      bodyMovement: null,
      shoulderMovement: null,
      postureChangeRaw: null,
      shoulderWidthDelta: null,
      landmarks: null,
    }
  }

  const handMovement = averageMovement(previousLandmarks, landmarks, [LEFT_WRIST, RIGHT_WRIST])
  const bodyMovement = averageMovement(previousLandmarks, landmarks, [
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    LEFT_HIP,
    RIGHT_HIP,
  ])
  const shoulderMovement = averageMovement(previousLandmarks, landmarks, [
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
  ])

  let postureChangeRaw: number | null = null
  const currentLean = computeTorsoLeanAngle(landmarks)
  const previousLean = previousLandmarks ? computeTorsoLeanAngle(previousLandmarks) : null
  if (currentLean !== null && previousLean !== null) {
    postureChangeRaw = Math.abs(currentLean - previousLean)
  }

  let shoulderWidthDelta: number | null = null
  const currentWidth = computeShoulderWidth(landmarks)
  const previousWidth = previousLandmarks ? computeShoulderWidth(previousLandmarks) : null
  if (currentWidth !== null && previousWidth !== null) {
    shoulderWidthDelta = currentWidth - previousWidth
  }

  return {
    poseDetected: true,
    handMovement,
    bodyMovement,
    shoulderMovement,
    postureChangeRaw,
    shoulderWidthDelta,
    landmarks,
  }
}
