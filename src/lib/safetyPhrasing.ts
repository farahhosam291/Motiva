import type { ConfidenceLevel, ContradictionResult } from '../types/advanced'
import type { AffectEstimation } from '../types/session'

// Categories the base cascade can select that read as "things are fine" —
// exactly the cases a high facial-vs-body contradiction should override,
// per Section 3 ("do not simply label this happy").
const OVERRIDABLE_CATEGORIES = new Set(['Positive Affect', 'Calm / Neutral'])
const OVERRIDE_CATEGORY = 'Possible Nervous Smile / Masked Discomfort'
const CONTRADICTION_OVERRIDE_THRESHOLD = 60

/**
 * Applies the cross-modal contradiction override (Section 3/4) on top of the
 * base cascade's category — a pure post-processing step that never touches
 * `computeAffectEstimation` itself. Only overrides when the base category
 * would otherwise read as unambiguously fine (Positive Affect / Calm)
 * *and* the contradiction score is high; every other category already
 * reflects some form of tension/discomfort and is left as-is.
 */
export function applyContradictionOverride(
  base: AffectEstimation,
  contradiction: ContradictionResult,
): { displayCategory: string; patternStrength: number; overrideApplied: boolean } {
  const shouldOverride =
    contradiction.score >= CONTRADICTION_OVERRIDE_THRESHOLD && OVERRIDABLE_CATEGORIES.has(base.category)

  if (!shouldOverride) {
    return { displayCategory: base.category, patternStrength: base.score, overrideApplied: false }
  }

  // Blend the base score with the contradiction score so the displayed
  // strength reflects both "how much positivity was measured" and "how much
  // that positivity conflicted with the body" — not a random number.
  const patternStrength = Math.round((base.score + contradiction.score) / 2)

  return { displayCategory: OVERRIDE_CATEGORY, patternStrength, overrideApplied: true }
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Possible Anxiety / Fear-like behavior': 'anxiety or fear-like behavior',
  'Possible Nervousness': 'nervousness',
  'Possible Tension': 'tension',
  'Possible Discomfort': 'discomfort',
  'Positive Affect': 'positive affect',
  'Calm / Neutral': 'a calm, neutral state',
  'Uncertain / Mixed Signals': 'mixed or unclear signals',
  [OVERRIDE_CATEGORY]: 'a nervous smile or socially masked discomfort',
}

/**
 * Produces the hedged, safety-rule-compliant summary sentence (Sections 11
 * and 16). Never asserts the person's true internal state — always frames
 * the category as an observable-behavior pattern, and explicitly says so
 * when confidence is low rather than quietly stating the category as fact.
 */
export function buildSafeSummarySentence(displayCategory: string, confidence: ConfidenceLevel): string {
  const description = CATEGORY_DESCRIPTIONS[displayCategory] ?? displayCategory.toLowerCase()

  if (confidence === 'Low') {
    return `Observable behavior may be consistent with ${description}, but confidence is low — treat this as insufficient evidence for a firm conclusion.`
  }
  if (confidence === 'Moderate') {
    return `Observable behavior suggests a pattern consistent with ${description}. Confidence: Moderate.`
  }
  return `Observable behavior is consistent with ${description}. This reflects estimated affective pattern only, not a confirmed internal emotional state.`
}
