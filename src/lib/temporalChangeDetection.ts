import { formatElapsed } from './format'
import type { HesitationEvent, TemporalSegment } from '../types/advanced'

/** A single downsampled snapshot of a few key behavior signals, logged once
 *  per second across the whole session (see SessionAccumulator). */
export interface TemporalSample {
  elapsedMs: number
  gazeMovement: number | null
  headMovement: number | null
  handMovement: number | null
  movementIntensity: number | null
}

const BUCKET_MS = 7000 // ~7s time buckets
// How far a bucket's average must exceed the session-wide average (in 0-1
// units) before that signal is called out as "increased" for that bucket.
// Synthetic-data testing showed 0.15 under-detects real phase changes: any
// bucket straddling a transition (behavior rarely changes exactly on a 7s
// boundary) gets its average diluted by the calmer portion, so a genuine
// ~0.45 jump in one half of a bucket could show only a ~0.11-0.13 net delta.
// 0.10 still ignores single-frame noise but catches diluted transitions.
const ELEVATED_MARGIN = 0.1

const SIGNAL_LABELS_FOR_TEMPORAL: Record<'gazeMovement' | 'headMovement' | 'handMovement' | 'movementIntensity', string> = {
  gazeMovement: 'Gaze movement',
  headMovement: 'Head movement',
  handMovement: 'Hand activity',
  movementIntensity: 'Overall movement',
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

interface RawSegment {
  startMs: number
  endMs: number
  description: string
}

/**
 * Groups the session into labeled phases describing *how* behavior changed
 * over time (Section 6) — not just the overall average. Buckets the session
 * into fixed windows, compares each bucket's average against the
 * session-wide average, merges consecutive buckets with the same
 * description, and interleaves any hesitation events at their actual time.
 */
export function segmentSessionTimeline(
  samples: TemporalSample[],
  hesitationEvents: HesitationEvent[],
  sessionDurationMs: number,
): TemporalSegment[] {
  if (samples.length === 0 || sessionDurationMs <= 0) return []

  const overall = {
    gazeMovement: average(samples.map((s) => s.gazeMovement)),
    headMovement: average(samples.map((s) => s.headMovement)),
    handMovement: average(samples.map((s) => s.handMovement)),
    movementIntensity: average(samples.map((s) => s.movementIntensity)),
  }

  const rawSegments: RawSegment[] = []
  for (let bucketStart = 0; bucketStart < sessionDurationMs; bucketStart += BUCKET_MS) {
    const bucketEnd = Math.min(sessionDurationMs, bucketStart + BUCKET_MS)
    const bucketSamples = samples.filter(
      (sample) => sample.elapsedMs >= bucketStart && sample.elapsedMs < bucketEnd,
    )
    if (bucketSamples.length === 0) continue

    const bucketAverage = {
      gazeMovement: average(bucketSamples.map((s) => s.gazeMovement)),
      headMovement: average(bucketSamples.map((s) => s.headMovement)),
      handMovement: average(bucketSamples.map((s) => s.handMovement)),
      movementIntensity: average(bucketSamples.map((s) => s.movementIntensity)),
    }

    const elevated: Array<{ label: string; delta: number }> = []
    for (const key of Object.keys(SIGNAL_LABELS_FOR_TEMPORAL) as Array<keyof typeof SIGNAL_LABELS_FOR_TEMPORAL>) {
      const bucketValue = bucketAverage[key]
      const overallValue = overall[key]
      if (bucketValue === null || overallValue === null) continue
      const delta = bucketValue - overallValue
      if (delta >= ELEVATED_MARGIN) {
        elevated.push({ label: SIGNAL_LABELS_FOR_TEMPORAL[key], delta })
      }
    }
    elevated.sort((a, b) => b.delta - a.delta)

    const description =
      elevated.length === 0
        ? 'Behavior near baseline'
        : `${elevated
            .slice(0, 2)
            .map((e) => e.label)
            .join(' and ')} increased`

    rawSegments.push({ startMs: bucketStart, endMs: bucketEnd, description })
  }

  // Merge consecutive buckets that describe the same change.
  const merged: RawSegment[] = []
  for (const segment of rawSegments) {
    const last = merged[merged.length - 1]
    if (last && last.description === segment.description && last.endMs === segment.startMs) {
      last.endMs = segment.endMs
    } else {
      merged.push({ ...segment })
    }
  }

  const formatted: TemporalSegment[] = merged.map((segment) => ({
    timeRange: `${formatElapsed(segment.startMs)}–${formatElapsed(segment.endMs)}`,
    description: segment.description,
  }))

  const hesitationSegments: TemporalSegment[] = hesitationEvents.map((event) => ({
    timeRange: event.time,
    description: `Possible hesitation event (score ${event.score}%)`,
  }))

  return [
    ...formatted.map((segment, index) => ({ segment, sortKey: merged[index].startMs })),
    ...hesitationSegments.map((segment, index) => ({
      segment,
      sortKey: hesitationEvents[index].startElapsedMs,
    })),
  ]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.segment)
}
