'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { apiUrl } from '@/lib/api';
import { useSosStore } from '@/store/sos-store';

interface WoundTrackerProps {
  incidentId: string;
}

export function WoundTracker({ incidentId }: WoundTrackerProps) {
  const { woundReadings, addWoundReading, latestSeverityScore, latestSeverityTrend, recommendedAntivenomVials } = useSosStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
        setStreamActive(true);
      }
    } catch (e) {
      console.warn('Camera access error or unsupported:', e);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      setStreamActive(false);
    }
  };

  // Pixel segmentation for red/purple discoloration
  const processCanvasPixels = (ctx: CanvasRenderingContext2D, width: number, height: number): number => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    let discoloredCount = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // Red/purple envenomation hue threshold
      const isRedish = r > 120 && r > g * 1.3 && r > b * 1.1;
      const isPurpleish = r > 100 && b > 100 && g < r * 0.8;

      if (isRedish || isPurpleish) {
        discoloredCount++;
        // Overlay visual indicator on canvas (magenta tint)
        pixels[i] = Math.min(255, r + 40);
        pixels[i + 1] = Math.max(0, g - 20);
        pixels[i + 2] = Math.min(255, b + 60);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return discoloredCount;
  };

  const captureAndAnalyze = async () => {
    if (!canvasRef.current || analyzing) return;
    setAnalyzing(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setAnalyzing(false);
      return;
    }

    if (videoRef.current && streamActive) {
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      // Demo placeholder frame if camera unavailable
      canvas.width = 640;
      canvas.height = 480;
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(320, 240, 80 + Math.random() * 20, 0, Math.PI * 2);
      ctx.fill();
    }

    const pixelCount = processCanvasPixels(ctx, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setAnalyzing(false);
        return;
      }

      const formData = new FormData();
      formData.append('image', blob, 'wound.jpg');
      formData.append('swelling_area_px', pixelCount.toString());

      try {
        const res = await fetch(apiUrl(`/api/wound/${incidentId}/reading`), {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.reading) {
            addWoundReading(data.reading);
          }
        }
      } catch (err) {
        console.error('Wound analysis failed:', err);
      } finally {
        setAnalyzing(false);
      }
    }, 'image/jpeg');
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const chartData = woundReadings.map((r, i) => ({
    time: `t+${i * 5}m`,
    severity: r.severityScore,
    swelling: Math.round(r.swellingAreaPx / 100),
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
          <h3 className="text-lg font-bold text-white tracking-wide">Wound Swelling & Severity Progression</h3>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-1 rounded">
          Gemini 2.5 Vision + Pixel Segmentation
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera capture feed */}
        <div className="relative bg-black rounded-lg overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
          <video ref={videoRef} className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`} playsInline muted />
          <canvas ref={canvasRef} className={`w-full h-full object-cover ${!streamActive ? 'block' : 'hidden'}`} />

          {!streamActive && woundReadings.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/80">
              <Camera className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm text-slate-300">Point camera at snakebite wound to monitor swelling</p>
              <button
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-xs font-medium transition"
              >
                Enable Camera
              </button>
            </div>
          )}

          {analyzing && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-2 text-rose-400 text-sm font-semibold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Pixel & Vision AI Analysis...
            </div>
          )}
        </div>

        {/* Severity Metrics Card */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Severity Score</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                (latestSeverityScore ?? 0) > 60 ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}>
                {latestSeverityTrend ? latestSeverityTrend.toUpperCase() : 'PENDING'}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-extrabold text-white">{latestSeverityScore ?? '--'}</span>
              <span className="text-sm text-slate-500 font-medium">/ 100</span>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Recommended Antivenom:</span>
                <span className="font-semibold text-rose-400">{recommendedAntivenomVials ?? '--'} Vials (Polyvalent)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Total Frame Scans:</span>
                <span className="font-mono text-slate-200">{woundReadings.length} readings</span>
              </div>
            </div>
          </div>

          <button
            onClick={captureAndAnalyze}
            disabled={analyzing}
            className="w-full mt-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {streamActive ? 'Capture Wound Reading' : 'Run Simulated Wound Scan'}
          </button>
        </div>
      </div>

      {/* Progression Line Chart */}
      {chartData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <span className="text-xs text-slate-400 font-medium mb-2 block">Swelling Severity Over Time</span>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="severity" stroke="#f43f5e" strokeWidth={2.5} dot={{ fill: '#f43f5e', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
