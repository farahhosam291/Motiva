import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type FaceLandmarkerOptions,
  type PoseLandmarkerOptions,
} from '@mediapipe/tasks-vision'

const TASKS_VISION_VERSION = '1.0.1'

const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export function createVisionFileset() {
  return FilesetResolver.forVisionTasks(WASM_BASE_URL)
}

async function createWithDelegateFallback<T>(
  create: (delegate: 'GPU' | 'CPU') => Promise<T>,
): Promise<T> {
  try {
    return await create('GPU')
  } catch {
    return await create('CPU')
  }
}

export async function createFaceLandmarker(
  vision: Awaited<ReturnType<typeof createVisionFileset>>,
) {
  return createWithDelegateFallback((delegate) => {
    const options: FaceLandmarkerOptions = {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    }
    return FaceLandmarker.createFromOptions(vision, options)
  })
}

export async function createPoseLandmarker(
  vision: Awaited<ReturnType<typeof createVisionFileset>>,
) {
  return createWithDelegateFallback((delegate) => {
    const options: PoseLandmarkerOptions = {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      outputSegmentationMasks: false,
    }
    return PoseLandmarker.createFromOptions(vision, options)
  })
}
