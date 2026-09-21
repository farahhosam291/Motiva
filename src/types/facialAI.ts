/** The trained model's 7 output classes, in the exact order the backend
 *  loads them from emotion_labels.json. */
export const EMOTION_LABELS = [
  'angry',
  'disgust',
  'fear',
  'happy',
  'neutral',
  'sad',
  'surprise',
] as const

export type EmotionLabel = (typeof EMOTION_LABELS)[number]
export type EmotionProbabilities = Record<EmotionLabel, number>

/**
 * The frozen, session-wide facial-AI result computed when Pause Analysis is
 * pressed: the session-average probability for each of the 7 classes across
 * every /predict-emotion response received during the session, with the
 * highest-average class chosen as the final prediction.
 */
export interface FinalAIResult {
  sessionNumber: number
  prediction: EmotionLabel
  /** 0-1, the averaged probability for `prediction`. */
  confidence: number
  /** 0-1 each, session-average per class. */
  probabilities: EmotionProbabilities
  durationMs: number
  /** Number of individual /predict-emotion responses averaged into this result. */
  sampleCount: number
}
