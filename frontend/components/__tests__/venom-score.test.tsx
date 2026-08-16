import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { VenomScoreResult, PtosisReading } from '@/lib/nagraksha';
import { useSosStore } from '@/store/sos-store';
import VenomScore from '@/components/venom-score';

// MediaPipe eyelid landmark indices (must mirror the component's LM constant).
const LM = { RU: 159, RL: 145, LU: 386, LL: 374 } as const;

const mockedScore: VenomScoreResult = {
  venomType: 'NEUROTOXIC',
  overallSeverity: 55,
  dryBiteProbability: 0.05,
  estimatedAntivenomVials: 8,
  confidenceLevel: 'moderate',
  clinicalBasis: 'WHO 2016 Table 3',
  disclaimer: 'Confirm with 20WBCT',
  criticalAlert: 'NEUROTOXIC — progressive ptosis detected. Monitor breathing continuously.',
  ventilatorRequired: false,
  ptosisReadingCount: 2,
  woundReadingCount: 0,
  minutesSinceBite: 15,
};

// Module-level mocks referenced by vi.mock factories (must start with `mock`).
const mocks = vi.hoisted(() => ({
  submitPtosisReading: vi.fn(),
  detectForVideo: vi.fn(),
  closeLandmarker: vi.fn(),
  getUserMedia: vi.fn(),
  trackStop: vi.fn(),
  play: vi.fn(),
}));

vi.mock('@/lib/nagraksha', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/nagraksha')>();
  return { ...actual, submitPtosisReading: mocks.submitPtosisReading };
});

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: vi.fn().mockResolvedValue({}),
  },
  FaceLandmarker: {
    createFromOptions: vi.fn().mockResolvedValue({
      detectForVideo: mocks.detectForVideo,
      close: mocks.closeLandmarker,
    }),
  },
}));

// Builds a 478-point landmark array where the eyelid indices produce a target
// aperture: upper lid at 0.5 - a/2, lower lid at 0.5 + a/2 -> |diff| = a.
function makeFace(aperture: number) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  pts[LM.RU] = { ...pts[LM.RU], y: 0.5 - aperture / 2 };
  pts[LM.RL] = { ...pts[LM.RL], y: 0.5 + aperture / 2 };
  pts[LM.LU] = { ...pts[LM.LU], y: 0.5 - aperture / 2 };
  pts[LM.LL] = { ...pts[LM.LL], y: 0.5 + aperture / 2 };
  return { faceLandmarks: [pts] };
}

const BITE_TIME = '2026-08-15T10:00:00.000Z';

async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

function startButton() {
  return screen.getByRole('button', { name: 'Start VenomScore' });
}

describe('VenomScore component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.submitPtosisReading.mockReset();
    mocks.submitPtosisReading.mockResolvedValue({
      id: 'ptosis-reading-001',
      venomScore: mockedScore,
    });
    mocks.detectForVideo.mockReset();
    mocks.closeLandmarker.mockReset();
    mocks.getUserMedia.mockReset();
    mocks.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mocks.trackStop }] });
    mocks.trackStop.mockReset();
    mocks.play.mockReset();
    mocks.play.mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: mocks.play,
    });
    // Simulate a live camera that has produced a decoded 640x480 frame so the
    // component's video-readiness guard (isVideoReady) lets detection run.
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 640,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 2, // HAVE_CURRENT_DATA
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mocks.getUserMedia },
    });
    useSosStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useSosStore.getState().reset();
  });

  it('skips a blink frame, then establishes the baseline: calibrating -> tracking with one baseline submit', async () => {
    // First frame is a blink (avg aperture 0.005 < 0.01) -> stays calibrating.
    // Second frame (10s later) establishes the baseline.
    mocks.detectForVideo.mockReturnValueOnce(makeFace(0.005)).mockReturnValue(makeFace(0.2));

    render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks(); // MediaPipe load resolves

    fireEvent.click(startButton());
    await flushMicrotasks();

    // Blink frame skipped: still calibrating, no submit yet.
    expect(screen.getByText(/Calibrating/)).toBeTruthy();
    expect(mocks.submitPtosisReading).not.toHaveBeenCalled();

    // Advance 10s: baseline frame establishes baseline and submits once.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();

    expect(screen.queryByText(/Calibrating/)).toBeNull();
    expect(screen.getByText('LIVE')).toBeTruthy();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);
    const [incidentId, reading] = mocks.submitPtosisReading.mock.calls[0] as [
      string,
      PtosisReading & { baselineAperture?: number },
    ];
    expect(incidentId).toBe('inc-1');
    expect(reading.baselineAperture).toBeCloseTo(0.2);
    expect(reading.percentChange).toBeNull();
    expect(reading.ptosisDetected).toBe(false);
    expect(reading.severity).toBe('none');
  });

  it('advancing 10s fires a second submit with percentChange > 0 and updates store venomScore', async () => {
    mocks.detectForVideo
      .mockReturnValueOnce(makeFace(0.2)) // baseline
      .mockReturnValue(makeFace(0.1)); // 50% closure vs 0.2 baseline

    render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks();

    fireEvent.click(startButton());
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();

    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(2);
    const [, reading] = mocks.submitPtosisReading.mock.calls[1] as [
      string,
      PtosisReading & { baselineAperture?: number },
    ];
    expect(reading.percentChange).toBeGreaterThan(0);
    expect(reading.percentChange).toBeCloseTo(50);
    expect(reading.ptosisDetected).toBe(true);
    expect(reading.severity).toBe('moderate');
    expect(useSosStore.getState().venomScore?.venomType).toBe('NEUROTOXIC');
  });

  it('unmount stops camera tracks, closes the landmarker, and clears the interval', async () => {
    mocks.detectForVideo.mockReturnValue(makeFace(0.2));

    const { unmount } = render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks();

    fireEvent.click(startButton());
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);

    const submitCountBefore = mocks.submitPtosisReading.mock.calls.length;
    unmount();

    expect(mocks.trackStop).toHaveBeenCalled();
    expect(mocks.closeLandmarker).toHaveBeenCalled();

    // Interval is cleared: advancing timers after unmount adds no submits.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    await flushMicrotasks();
    expect(mocks.submitPtosisReading.mock.calls.length).toBe(submitCountBefore);
  });

  it('skips a blink frame during tracking: no submit, LIVE status preserved, recovery still submits', async () => {
    mocks.detectForVideo
      .mockReturnValueOnce(makeFace(0.2)) // baseline
      .mockReturnValueOnce(makeFace(0.005)) // blink mid-tracking (avg < 0.01)
      .mockReturnValue(makeFace(0.1)); // recovered frame

    render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks();

    fireEvent.click(startButton());
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1); // baseline

    // Blink frame at t+10s: skipped entirely, still LIVE, no submit.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);
    expect(screen.getByText('LIVE')).toBeTruthy();

    // Recovered frame at t+20s: submits normally.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(2);
    const [, reading] = mocks.submitPtosisReading.mock.calls[1] as [string, PtosisReading];
    expect(reading.percentChange).toBeCloseTo(50);
  });

  it('shows the error state when detectForVideo throws mid-tracking', async () => {
    mocks.detectForVideo
      .mockReturnValueOnce(makeFace(0.2)) // baseline
      .mockImplementationOnce(() => {
        throw new Error('WebGL context lost');
      });

    render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks();

    fireEvent.click(startButton());
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();

    expect(screen.getByText(/Tracking failed/)).toBeTruthy();
    expect(screen.queryByText('LIVE')).toBeNull();

    // Interval is cleared after the error — no further captures/submits.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    await flushMicrotasks();
    expect(mocks.submitPtosisReading).toHaveBeenCalledTimes(1);
  });

  it('renders the camera-permission error state when getUserMedia rejects', async () => {
    mocks.getUserMedia.mockRejectedValue(new Error('Permission denied'));

    render(<VenomScore incidentId="inc-1" biteTimestamp={BITE_TIME} />);
    await flushMicrotasks();

    fireEvent.click(startButton());
    await flushMicrotasks();

    expect(screen.getByText(/Camera access denied/)).toBeTruthy();
    expect(screen.queryByText('LIVE')).toBeNull();
  });
});
