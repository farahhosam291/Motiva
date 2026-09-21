import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

/** Axis-aligned box in video pixel coordinates (not normalized, not mirrored). */
export interface FaceBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

// How much extra room to include around the tight landmark bounding box.
// This value is not sourced from the model/metadata/notebook (those only
// define how an already-cropped face image is resized and normalized, not
// how to locate a face within a raw video frame) — it was tuned by visually
// comparing crops against the actual training-sample grid embedded in the
// training notebook: those images are cropped VERY tightly (face fills
// nearly the whole frame, often right up to eyebrow/chin/cheek edges, with
// no hair or background margin). An earlier value of 0.35 here produced a
// much looser, background/hair-heavy crop than the model was trained on,
// which was the root cause of the "predicts fear almost always" bug — the
// model was seeing out-of-distribution input. Kept small and positive
// (rather than 0) only as a safety margin against per-frame landmark jitter
// clipping the chin/side of the face.
const BOX_PADDING_RATIO = 0.08

/**
 * Computes a padded, square, frame-clamped bounding box around a detected
 * face's landmarks, in video pixel coordinates. Kept square so that scaling
 * it down later does not stretch/distort the face.
 */
export function computeFaceBoundingBox(
  landmarks: NormalizedLandmark[],
  videoWidth: number,
  videoHeight: number,
): FaceBoundingBox | null {
  if (landmarks.length === 0 || videoWidth <= 0 || videoHeight <= 0) return null

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of landmarks) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }

  const pxMinX = minX * videoWidth
  const pxMaxX = maxX * videoWidth
  const pxMinY = minY * videoHeight
  const pxMaxY = maxY * videoHeight

  const boxWidth = pxMaxX - pxMinX
  const boxHeight = pxMaxY - pxMinY
  const centerX = pxMinX + boxWidth / 2
  const centerY = pxMinY + boxHeight / 2

  const paddedWidth = boxWidth * (1 + BOX_PADDING_RATIO * 2)
  const paddedHeight = boxHeight * (1 + BOX_PADDING_RATIO * 2)
  let size = Math.max(paddedWidth, paddedHeight)
  size = Math.min(size, videoWidth, videoHeight)

  const x = Math.min(Math.max(centerX - size / 2, 0), videoWidth - size)
  const y = Math.min(Math.max(centerY - size / 2, 0), videoHeight - size)

  return { x, y, width: size, height: size }
}

/**
 * Draws the given box from the video element onto a fresh square canvas at
 * `outputSize` pixels and returns it as a JPEG Blob, ready to upload. This
 * only crops and re-encodes the region — the backend performs the actual
 * grayscale/resize/normalize steps the model expects.
 */
export function cropFaceToBlob(
  video: HTMLVideoElement,
  box: FaceBoundingBox,
  outputSize = 224,
  quality = 0.85,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  ctx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, outputSize, outputSize)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}
