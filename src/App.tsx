import { useEffect, useRef, useState } from 'react'
import Header from './components/Header'
import CameraPanel from './components/CameraPanel'
import ControlBar from './components/ControlBar'
import SignalsPanel, { type SignalsPanelMode } from './components/SignalsPanel'
import EmotionCard from './components/EmotionCard'
import DebugSignalsPanel from './components/DebugSignalsPanel'
import SessionSummaryPanel from './components/SessionSummaryPanel'
import SessionHistoryPanel from './components/SessionHistoryPanel'
import DeviationPanel from './components/DeviationPanel'
import SessionResultPanel from './components/SessionResultPanel'
import HesitationPanel from './components/HesitationPanel'
import FacialAIPanel from './components/FacialAIPanel'
import { useCamera } from './hooks/useCamera'
import { useLandmarkTracking } from './hooks/useLandmarkTracking'
import { useSessionAnalysis } from './hooks/useSessionAnalysis'
import { useSessionHistory } from './hooks/useSessionHistory'
import { useBaselineCalibration } from './hooks/useBaselineCalibration'
import { useEmotionPrediction } from './hooks/useEmotionPrediction'
import type { AnalysisStatus } from './types/analysis'
import type { CompletedSession } from './types/session'
import type { FinalAIResult } from './types/facialAI'
import './App.css'

function capitalize(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function App() {
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [currentSessionNumber, setCurrentSessionNumber] = useState<number | null>(null)
  const [currentSessionResult, setCurrentSessionResult] = useState<CompletedSession | null>(null)

  const { videoRef, isActive: isCameraActive, isRequesting, error: cameraError, startCamera, stopCamera } =
    useCamera()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const {
    signals,
    isLoadingTrackers,
    trackingError,
    faceBoundingBox,
    // Raw-signal console logging is a development aid only — disabled in
    // production builds (import.meta.env.DEV is statically false there, so
    // this branch is also dropped from the production bundle).
  } = useLandmarkTracking(videoRef, canvasRef, isCameraActive, import.meta.env.DEV)

  // Runs its own throttled loop against the /predict-emotion backend
  // whenever a face is detected (live display), and separately accumulates
  // a session-wide average while status === 'analyzing', read once via
  // finalizeSession() at Pause Analysis — this is now the source of the
  // displayed final session result (see handlePauseAnalysis below).
  const facialAI = useEmotionPrediction(videoRef, faceBoundingBox, isCameraActive, status === 'analyzing')

  const { liveStats, startNewSession, discardCurrentSession, finalizeSession } =
    useSessionAnalysis(signals, status === 'analyzing')
  const { sessions, addSession, clearHistory, nextSessionNumber } = useSessionHistory()
  // Only the calibrated baseline itself is needed here — it still feeds the
  // deviation-from-baseline calculation in finalizeSession below even though
  // the Personal Baseline calibration panel is no longer shown in the UI.
  const { baseline } = useBaselineCalibration(signals, isCameraActive)

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
    facialAI.startSession()
    setStatus('analyzing')
  }

  const handlePauseAnalysis = () => {
    if (currentSessionNumber === null) return
    const completed = finalizeSession(currentSessionNumber, baseline)
    if (completed) {
      // The facial AI model's session-average is now the displayed final
      // result — computed from every /predict-emotion response collected
      // since Start Analysis, not the old rule-based estimation cascade.
      const aiAverage = facialAI.finalizeSession()
      const finalAIResult: FinalAIResult | undefined = aiAverage
        ? { ...aiAverage, sessionNumber: currentSessionNumber, durationMs: completed.durationMs }
        : undefined

      const merged: CompletedSession = {
        ...completed,
        finalAIResult,
        // Keep the Session Summary card's "Final State"/"Final Score" in
        // sync with the AI result too, so it doesn't show a different
        // answer than Estimated Emotional State / Session Result.
        summary: finalAIResult
          ? {
              ...completed.summary,
              finalState: capitalize(finalAIResult.prediction),
              finalScore: Math.round(finalAIResult.confidence * 100),
            }
          : completed.summary,
      }

      setCurrentSessionResult(merged)
      addSession(merged)
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
    facialAI.discardSession()
    setStatus('camera-on')
  }

  useEffect(() => {
    if (!isCameraActive && status !== 'idle') {
      if (status === 'analyzing') {
        // Camera dropped mid-analysis (never finalized) — discard the
        // in-progress data, it was never a completed session to preserve.
        discardCurrentSession()
        facialAI.discardSession()
        setCurrentSessionNumber(null)
        setCurrentSessionResult(null)
      }
      setStatus('idle')
    }
  }, [isCameraActive, status, discardCurrentSession, facialAI.discardSession])

  const displayedStats =
    panelMode === 'final' && currentSessionResult ? currentSessionResult.finalStats : liveStats

  const advanced = currentSessionResult?.advanced ?? null

  return (
    <div className="app">
      <Header />

      <main className="dashboard">
        {/* TOP: camera + controls | current analysis + raw values */}
        <div className="dashboard__top">
          <div className="dashboard__column">
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
          </div>

          <div className="dashboard__column dashboard__column--fill">
            <EmotionCard
              mode={panelMode}
              sessionNumber={currentSessionNumber}
              liveStatus={facialAI.status}
              livePrediction={facialAI.prediction}
              liveConfidence={facialAI.confidence}
              liveProbabilities={facialAI.probabilities}
              finalResult={currentSessionResult?.finalAIResult ?? null}
            />
            <DebugSignalsPanel
              signals={signals}
              isActive={isCameraActive}
              isLoadingTrackers={isLoadingTrackers}
              trackingError={trackingError}
            />
          </div>
        </div>

        {/* SIGNALS: face | body | behavior | facial AI model */}
        <div className="dashboard__signals">
          <SignalsPanel stats={displayedStats} mode={panelMode} group="facial" />
          <SignalsPanel stats={displayedStats} mode={panelMode} group="body" />
          <SignalsPanel stats={displayedStats} mode={panelMode} group="behavior" />
          <FacialAIPanel
            status={facialAI.status}
            isCameraActive={isCameraActive}
            prediction={facialAI.prediction}
            confidence={facialAI.confidence}
            probabilities={facialAI.probabilities}
          />
        </div>

        {/* INSIGHTS: deviation | hesitation | session result */}
        <div className="dashboard__insights">
          <DeviationPanel
            hasBaseline={advanced?.baselineUsed ?? false}
            deviations={advanced?.deviations ?? []}
            level={advanced?.deviationLevel ?? null}
          />
          <HesitationPanel mode={panelMode} hesitationEvents={advanced?.hesitationEvents ?? null} />
          <SessionResultPanel
            mode={panelMode}
            sessionNumber={currentSessionNumber}
            finalResult={currentSessionResult?.finalAIResult ?? null}
          />
        </div>

        {/* BOTTOM: session summary */}
        <div className="dashboard__bottom">
          <SessionSummaryPanel
            mode={panelMode}
            sessionNumber={currentSessionNumber}
            summary={currentSessionResult?.summary ?? null}
          />
        </div>

        {/* HISTORY: full width */}
        <div className="dashboard__history">
          <SessionHistoryPanel sessions={sessions} onClear={clearHistory} />
        </div>
      </main>

      <footer className="app-footer">
        Motiva — Physical AI Research Prototype. Face and pose tracking runs locally in your
        browser; estimates reflect observable behavior only, not verified internal emotion.
      </footer>
    </div>
  )
}

export default App
