'use client';
import { useEffect, useRef, useState } from 'react';
import { useSosStore } from '@/store/sos-store';
import { submitPtosisReading } from '@/lib/nagraksha';
import type { PtosisReading } from '@/lib/nagraksha';
import { VenomScoreChart } from './venom-score-chart';

// Structural types for the MediaPipe API surface used here. No top-level
// import from '@mediapipe/tasks-vision' — the real module is loaded at runtime
// via the in-effect dynamic import below (never statically bundled).
interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

interface FaceLandmarksResult {
  faceLandmarks: LandmarkPoint[][];
}

interface FaceLandmarkerLike {
  detectForVideo(_video: HTMLVideoElement, _timestamp: number): FaceLandmarksResult;
  close(): void;
}

interface VenomScoreProps {
  incidentId: string;
  biteTimestamp: string;
}

type VenomScoreStatus = 'idle' | 'calibrating' | 'tracking' | 'no-face' | 'error';

// MediaPipe Face Landmarker indices for the upper/lower eyelid on each eye
// (normalized 0-1 coordinates, not pixels).
const LM = { RU: 159, RL: 145, LU: 386, LL: 374 } as const;

// Pinned exact URLs (T-08-03-01): wasm loader matches the installed
// @mediapipe/tasks-vision JS bundle version; model asset is the official
// Google storage path. Never bundled — loaded from CDN at runtime only.
const MEDIAPIPE_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const CAPTURE_INTERVAL_MS = 10_000;
const BLINK_AVG_THRESHOLD = 0.01;
const VIDEO_READY_TIMEOUT_MS = 5_000;

// MediaPipe's ImageToTensorCalculator fails with "ROI width and height must be
// > 0" when detectForVideo() is called before the camera stream has produced a
// decoded frame with real dimensions (videoWidth/Height still 0). Guard every
// capture with this check and wait for readiness before the first one.
function isVideoReady(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
}

function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = VIDEO_READY_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isVideoReady(video)) {
      resolve();
      return;
    }
    const started = Date.now();
    const check = () => {
      if (isVideoReady(video)) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Camera frame never became ready'));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

function severityClasses(severity: PtosisReading['severity']): string {
  if (severity === 'severe') return 'bg-red-100 text-red-700';
  if (severity === 'moderate') return 'bg-orange-100 text-orange-700';
  if (severity === 'mild') return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-600';
}

// Suppress informational logs emitted to stderr (which Emscripten maps to console.error)
// by TensorFlow Lite / MediaPipe WASM delegates during initialization or teardown.
function patchTfliteConsoleLogs() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __tfliteLogPatched?: boolean };
  if (w.__tfliteLogPatched) return;
  w.__tfliteLogPatched = true;

  /* eslint-disable no-console */
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === 'string' &&
      (first.startsWith('INFO: Created TensorFlow Lite') ||
        first.includes('TensorFlow Lite XNNPACK delegate') ||
        (first.startsWith('INFO:') && first.includes('TensorFlow Lite')))
    ) {
      console.info(...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
  /* eslint-enable no-console */
}

export default function VenomScore({ incidentId, biteTimestamp }: VenomScoreProps) {
  const venomScore = useSosStore((s) => s.venomScore);
  const addPtosisReading = useSosStore((s) => s.addPtosisReading);
  const setVenomScore = useSosStore((s) => s.setVenomScore);

  const [status, setStatus] = useState<VenomScoreStatus>('idle');
  const [landmarkerReady, setLandmarkerReady] = useState(false);
  const [readings, setReadings] = useState<PtosisReading[]>([]);
  const [initError, setInitError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerLike | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const baselineRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const readingCounterRef = useRef(0);

  // Mount effect: dynamically load MediaPipe Face Landmarker (browser-only).
  // Cleanup closes the landmarker, stops the camera stream and clears the
  // interval; the cancelled flag prevents stale async writes after unmount.
  useEffect(() => {
    patchTfliteConsoleLogs();
    let cancelled = false;
    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        const landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (cancelled) {
          try {
            landmarker.close();
          } catch {
            // ignore cleanup errors on cancelled landmarker
          }
          return;
        }
        landmarkerRef.current = landmarker;
        setLandmarkerReady(true);
        setStatus('idle');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setInitError('MediaPipe failed to load. Check internet connection.');
        }
      }
    })();
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      try {
        landmarkerRef.current?.close();
      } catch {
        // ignore cleanup errors
      }
      landmarkerRef.current = null;
    };
  }, []);

  const buildReading = (
    right: number,
    left: number,
    avg: number,
    baseline: number,
    percentChange: number | null,
    ptosisDetected: boolean,
    severity: PtosisReading['severity'],
    asymmetric: boolean,
    baselineAperture?: number,
  ): PtosisReading => ({
    id: `local-${readingCounterRef.current++}`,
    incidentId,
    timestamp: new Date().toISOString(),
    rightAperture: right,
    leftAperture: left,
    avgAperture: avg,
    baselineAperture: baselineAperture ?? baseline,
    percentChange,
    ptosisDetected,
    severity,
    asymmetric,
    minutesSinceBite: Math.max(
      0,
      Math.floor((Date.now() - new Date(biteTimestamp).getTime()) / 60_000),
    ),
  });

  const submitReading = (reading: PtosisReading) => {
    if (busyRef.current) return;
    busyRef.current = true;
    submitPtosisReading(incidentId, reading)
      .then((res) => {
        setVenomScore(res.venomScore);
        setSubmitError(null);
      })
      .catch(() => {
        // Best-effort upload: readings stay local; surface non-blocking notice.
        setSubmitError('VenomScore upload failed — readings kept locally.');
      })
      .finally(() => {
        busyRef.current = false;
      });
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    baselineRef.current = null;
    setStatus('idle');
  };

  const capture = () => {
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    if (!landmarker || !video) return;
    // Skip until the camera stream has a decoded frame — MediaPipe throws
    // "ROI width and height must be > 0" on zero-size frames.
    if (!isVideoReady(video)) return;
    let result: FaceLandmarksResult;
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch (e) {
      // MediaPipe can throw if the video has no ready frame yet ("ROI width and
      // height must be > 0"), the GPU/WebGL context is lost, or a frame decode
      // fails. A zero-size frame is transient — skip the tick and let the next
      // interval retry. Anything else surfaces instead of dying silently inside
      // the interval callback — otherwise the LIVE badge stays lit while
      // tracking is dead.
      const msg = e instanceof Error ? e.message : String(e);
      if (/ROI width and height|must be > 0/.test(msg) && !isVideoReady(video)) {
        return;
      }
      stopTracking();
      setStatus('error');
      setInitError('Tracking failed — restart VenomScore.');
      return;
    }
    if (!result.faceLandmarks.length) {
      setStatus('no-face');
      return;
    }
    const points = result.faceLandmarks[0];
    const rightAperture = Math.abs(points[LM.RU].y - points[LM.RL].y);
    const leftAperture = Math.abs(points[LM.LU].y - points[LM.LL].y);
    const avgAperture = (rightAperture + leftAperture) / 2;

    const baseline = baselineRef.current;
    if (baseline === null) {
      // First-frame baseline with blink guard: skip frames whose average
      // aperture is implausibly small (eyes closed / blink).
      if (avgAperture < BLINK_AVG_THRESHOLD) {
        setStatus('calibrating');
        return;
      }
      baselineRef.current = avgAperture;
      setStatus('tracking');
      const reading = buildReading(
        rightAperture,
        leftAperture,
        avgAperture,
        avgAperture,
        null,
        false,
        'none',
        false,
        avgAperture,
      );
      setReadings((prev) => [...prev, reading]);
      addPtosisReading(reading);
      submitReading(reading);
      return;
    }

    // Blink guard during tracking too: a normal blink drives avgAperture toward
    // 0, which would be scored as ~100% closure (percentChange spikes and the
    // frame submits as severe ptosis). Skip the frame — do not submit — and keep
    // the last status.
    if (avgAperture < BLINK_AVG_THRESHOLD) {
      return;
    }

    const percentChange = ((baseline - avgAperture) / baseline) * 100;
    const asymmetric = Math.abs(rightAperture - leftAperture) > baseline * 0.2;
    const ptosisDetected = percentChange > 40;
    const severity: PtosisReading['severity'] =
      percentChange > 70
        ? 'severe'
        : percentChange > 40
          ? 'moderate'
          : percentChange > 20
            ? 'mild'
            : 'none';
    setStatus('tracking');
    const reading = buildReading(
      rightAperture,
      leftAperture,
      avgAperture,
      baseline,
      percentChange,
      ptosisDetected,
      severity,
      asymmetric,
    );
    setReadings((prev) => [...prev, reading]);
    addPtosisReading(reading);
    submitReading(reading);
  };

  const startTracking = async () => {
    const video = videoRef.current;
    if (!video || !landmarkerRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      // Wait for the first decoded frame before running detection — calling
      // detectForVideo() on a zero-size frame makes MediaPipe fail with
      // "ROI width and height must be > 0".
      try {
        await waitForVideoReady(video);
      } catch {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        video.srcObject = null;
        setStatus('error');
        setInitError('Camera did not start — check the camera and try again.');
        return;
      }
      setInitError(null);
      setSubmitError(null);
      baselineRef.current = null;
      setStatus('calibrating');
      capture();
      intervalRef.current = setInterval(capture, CAPTURE_INTERVAL_MS);
    } catch {
      setStatus('error');
      setInitError('Camera access denied. Allow camera permission and try again.');
    }
  };

  const cameraActive = status === 'calibrating' || status === 'tracking' || status === 'no-face';
  const latestSeverity = readings[readings.length - 1]?.severity ?? null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">VenomScore — Ptosis Tracking</h3>
        {status === 'tracking' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            LIVE
          </span>
        )}
      </div>

      <video
        ref={videoRef}
        playsInline
        muted
        className={cameraActive ? 'w-full rounded-lg border bg-black' : 'hidden'}
      />

      {initError && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {initError}
        </div>
      )}

      {status === 'calibrating' && (
        <p className="text-sm text-muted-foreground">
          Calibrating… Keep your face still and look at the camera.
        </p>
      )}

      {status === 'no-face' && (
        <p className="text-sm text-amber-600">No face detected — reposition to face the camera.</p>
      )}

      {status === 'idle' || status === 'error' ? (
        <button
          type="button"
          onClick={startTracking}
          disabled={!landmarkerReady}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
        >
          {landmarkerReady ? 'Start VenomScore' : 'Loading MediaPipe…'}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopTracking}
          className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium"
        >
          Stop Tracking
        </button>
      )}

      {latestSeverity && (
        <span
          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${severityClasses(latestSeverity)}`}
        >
          Severity: {latestSeverity}
        </span>
      )}

      {venomScore?.criticalAlert && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {venomScore.criticalAlert}
        </div>
      )}

      {submitError && <p className="text-xs text-amber-600">{submitError}</p>}

      <VenomScoreChart readings={readings} />

      <p className="text-xs text-muted-foreground">
        Based on WHO snakebite management guidelines (2016). Confirm with 20WBCT at hospital. Not a
        medical device.
      </p>
    </div>
  );
}
