import type { ConfidenceLevel, PhysicalAIRecommendation } from '../types/advanced'

// Categories (from computeAffectEstimation / the contradiction override) that
// read as discomfort-adjacent for recommendation purposes.
const DISCOMFORT_CATEGORIES = new Set([
  'Possible Discomfort',
  'Possible Nervousness',
  'Possible Tension',
  'Possible Anxiety / Fear-like behavior',
  'Possible Nervous Smile / Masked Discomfort',
])

const DISCLAIMER =
  'These are suggested response patterns only — this website does not control a robot or any physical device.'

/**
 * Maps the final (displayed) category, confidence, and hesitation-event
 * count onto a plain-language suggestion for how a Physical AI system might
 * choose to respond. Priority order: low confidence always wins (safety
 * first — don't act on a guess), then discomfort-family categories, then
 * hesitation activity, then a default "continue normally".
 */
export function computeRecommendation(
  displayCategory: string,
  confidence: ConfidenceLevel,
  hesitationEventCount: number,
): PhysicalAIRecommendation {
  if (confidence === 'Low') {
    return {
      title: 'Uncertainty — do not assume an emotional state',
      actions: [
        'Do not assume emotion from this reading alone',
        'Ask the person directly rather than acting on the estimate',
        'Continue at normal pace unless other safety signals indicate otherwise',
      ],
      rationale: `Confidence in this session's estimate is Low, so acting on the "${displayCategory}" label alone would not be justified.`,
    }
  }

  if (DISCOMFORT_CATEGORIES.has(displayCategory)) {
    return {
      title: 'Possible discomfort — respond cautiously',
      actions: [
        'Increase physical distance from the person',
        'Avoid sudden or fast movements',
        'Ask for confirmation before continuing the interaction',
      ],
      rationale: `Observable behavior may be consistent with "${displayCategory}" — a cautious, distance-increasing response reduces the risk of escalating any real discomfort.`,
    }
  }

  if (hesitationEventCount > 0) {
    return {
      title: 'Hesitation detected — slow down',
      actions: [
        'Slow the robot/system’s movement',
        'Wait for explicit confirmation before proceeding',
        'Increase response time to give the person space to react',
      ],
      rationale: `${hesitationEventCount} possible hesitation event${hesitationEventCount === 1 ? '' : 's'} were detected during this session, suggesting the person may benefit from a slower interaction pace.`,
    }
  }

  return {
    title: 'Behavior appears calm — continue normally',
    actions: ['Continue the interaction at a normal pace', 'No behavior-driven adjustment indicated'],
    rationale: `Observable behavior this session was consistent with "${displayCategory}" and showed no strong hesitation or discomfort signals.`,
  }
}

export { DISCLAIMER as PHYSICAL_AI_DISCLAIMER }
