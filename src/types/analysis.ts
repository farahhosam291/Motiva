export type AnalysisStatus = 'idle' | 'camera-on' | 'analyzing' | 'paused'

export interface TimelineEntry {
  id: string
  time: string
  description: string
}
