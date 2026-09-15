import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import CameraPanel from './components/CameraPanel'
import ControlBar from './components/ControlBar'
import SignalsPanel, { type SignalsPanelMode } from './components/SignalsPanel'
import EmotionCard from './components/EmotionCard'
import ExplanationPanel from './components/ExplanationPanel'
import Timeline from './components/Timeline'
import DebugSignalsPanel from './components/DebugSignalsPanel'
import SessionSummaryPanel from './components/SessionSummaryPanel'
import SessionHistoryPanel from './components/SessionHistoryPanel'
import BaselinePanel from './components/BaselinePanel'
import DeviationPanel from './components/DeviationPanel'
import ContradictionPanel from './components/ContradictionPanel'
import SessionResultPanel from './components/SessionResultPanel'
import PhysicalAIPanel from './components/PhysicalAIPanel'
import ResearchModeToggle from './components/ResearchModeToggle'
import { useCamera } from './hooks/useCamera'
import { useLandmarkTracking } from './hooks/useLandmarkTracking'
import { useSessionAnalysis } from './hooks/useSessionAnalysis'
import { useSessionHistory } from './hooks/useSessionHistory'
import { useBaselineCalibration } from './hooks/useBaselineCalibration'
import type { AnalysisStatus, TimelineEntry } from './types/analysis'
import type { CompletedSession } from './types/session'
import './App.css'

function App() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [currentSessionNumber, setCurrentSessionNumber] = useState<number | null>(null)
  const [currentSessionResult, setCurrentSessionResult] = useState<CompletedSession | null>(null)
  const [researchMode, setResearchMode] = useState(false)

  const { videoRef, isActive: isCameraActive, isRequesting, error: cameraError, startCamera, stopCamera } =
    useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const {
    signals,
    isLoadingTrackers,
    trackingError,
    // Raw-signal console logging is a development aid only — disabled in
    // production builds (import.meta.env.DEV is statically false there, so
    // this branch is also dropped from the production bundle).
  } = useLandmarkTracking(videoRef, canvasRef, isCameraActive, import.meta.env.DEV)

  const { liveStats, timeline, startNewSession, discardCurrentSession, finalizeSession } =
    useSessionAnalysis(signals, status === 'analyzing')
  const { sessions, addSession, clearHistory, nextSessionNumber } = useSessionHistory()
  const {
    baseline,
    phase: calibrationPhase,
    progress: calibrationProgress,
    startCalibration,
    removeBaseline,
  } = useBaselineCalibration(signals, isCameraActive)

  // 'final' is driven by *having a result*, not by the camera status — Stop
  // Camera must keep the completed session visible (Section 10), and it
  // only goes away once the next session's Start Camera clears it below.
  const panelMode: SignalsPanelMode =
    status === 'analyzing' ? 'live' : currentSessionResult ? 'final' : 'idle'

  const handleStartCamera = async () => {
    const started = await startCamera()
    if (started) {
      // Assign the session number now (Section 1: "prepare a new session"),
      // but the accumulator's own clock only starts once analysis actually
      // begins (see handleStartAnalysis) — otherwise any idle time between
      // Start Camera and Start Analysis would incorrectly count toward the
      // reported session duration and timeline timestamps.
      setCurrentSessionNumber(nextSessionNumber)
      setCurrentSessionResult(null)
      setStatus('camera-on')
    }
  }

  const handleStartAnalysis = () => {
    startNewSession()
    setStatus('analyzing')
  }

  const handlePauseAnalysis = () => {
    if (currentSessionNumber === null) return
    const completed = finalizeSession(currentSessionNumber, baseline)
    if (completed) {
      setCurrentSessionResult(completed)
      addSession(completed)
    }
    setStatus('paused')
  }

  const handleStopCamera = () => {
    stopCamera()
    setStatus('idle')
    // Intentionally does NOT clear currentSessionNumber/currentSessionResult:
    // a finalized result must stay visible after Stop Camera. It is cleared
    // only when the next session's Start Camera begins (see handleStartCamera).
  }

  const handleReset = () => {
    discardCurrentSession()
    setStatus('camera-on')
  }

  useEffect(() => {
    if (!isCameraActive && status !== 'idle') {
      if (status === 'analyzing') {
        // Camera dropped mid-analysis (never finalized) — discard the
        // in-progress data, it was never a completed session to preserve.
        discardCurrentSession()
        setCurrentSessionNumber(null)
        setCurrentSessionResult(null)
      }
      setStatus('idle')
    }
  }, [isCameraActive, status, discardCurrentSession])

  const displayedStats =
    panelMode === 'final' && currentSessionResult ? currentSessionResult.finalStats : liveStats

  // Live mode keeps the original granular, single-frame behavior events
  // (unchanged). Final mode shows the richer temporal-segment view (Section
  // 6) when available, falling back to the plain event list for sessions
  // saved before this feature existed.
  const advanced = currentSessionResult?.advanced ?? null
  const displayedTimeline: TimelineEntry[] =
    panelMode === 'final' && currentSessionResult
      ? advanced
        ? advanced.temporalSegments.map((segment, index) => ({
            id: `temporal-${index}`,
            time: segment.timeRange,
            description: segment.description,
          }))
        : currentSessionResult.timeline
      : timeline
  const timelineActive = panelMode !== 'idle'

  return (
    <div className="app">
      <Header />

      <main className="dashboard">
        <div className="dashboard__main">
          <CameraPanel
            status={status}
            videoRef={videoRef}
            canvasRef={canvasRef}
            isCameraActive={isCameraActive}
            isRequesting={isRequesting}
            cameraError={cameraError}
            isLoadingTrackers={isLoadingTrackers}
            trackingError={trackingError}
            faceDetected={signals.faceDetected}
            poseDetected={signals.poseDetected}
          />
          <ControlBar
            status={status}
            isRequestingCamera={isRequesting}
            onStartCamera={handleStartCamera}
            onStartAnalysis={handleStartAnalysis}
            onPauseAnalysis={handlePauseAnalysis}
            onStopCamera={handleStopCamera}
            onReset={handleReset}
          />
          <BaselinePanel
            baseline={baseline}
            phase={calibrationPhase}
            progress={calibrationProgress}
            isCameraActive={isCameraActive}
            isAnalyzing={status === 'analyzing'}
            onStart={startCalibration}
            onDelete={removeBaseline}
          />
          <ResearchModeToggle enabled={researchMode} onChange={setResearchMode} />
          <Timeline entries={displayedTimeline} isActive={timelineActive} />
        </div>

        <div className="dashboard__sidebar">
          <DebugSignalsPanel
            signals={signals}
            isActive={isCameraActive}
            isLoadingTrackers={isLoadingTrackers}
            trackingError={trackingError}
          />
          <EmotionCard
            mode={panelMode}
            estimation={currentSessionResult?.estimation ?? null}
            sessionNumber={currentSessionNumber}
          />
          <SignalsPanel stats={displayedStats} mode={panelMode} />
          <ExplanationPanel
            mode={panelMode}
            explanation={currentSessionResult?.explanation ?? null}
            whyReasons={advanced?.whyReasons}
          />
          <DeviationPanel
            hasBaseline={advanced?.baselineUsed ?? false}
            deviations={advanced?.deviations ?? []}
            level={advanced?.deviationLevel ?? null}
          />
          <ContradictionPanel
            mode={panelMode}
            contradiction={advanced?.contradiction ?? null}
            researchMode={researchMode}
          />
          <SessionResultPanel
            mode={panelMode}
            sessionNumber={currentSessionNumber}
            advanced={advanced}
            researchMode={researchMode}
          />
          <PhysicalAIPanel mode={panelMode} recommendation={advanced?.recommendation ?? null} />
          <SessionSummaryPanel
            mode={panelMode}
            sessionNumber={currentSessionNumber}
            summary={currentSessionResult?.summary ?? null}
          />
          <SessionHistoryPanel sessions={sessions} onClear={clearHistory} />
        </div>
      </main>

      <footer className="app-footer">
        EmotiSense AI — Physical AI Research Prototype. Face and pose tracking runs locally in
        your browser; estimates reflect observable behavior only, not verified internal emotion.
      </footer>
    </div>
  )
}

export default App
