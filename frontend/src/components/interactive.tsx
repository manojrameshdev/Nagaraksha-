'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { toast } from 'sonner';
import { useInView } from '@/hooks/use-scroll';
import { apiUrl } from '@/lib/api';
import {
  Truck,
  Stethoscope,
  Bug,
  Loader2,
  MapPin,
  Send,
  Upload,
  RefreshCw,
  ShieldAlert,
  Droplet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Navigation,
  ScrollText,
  Boxes,
  BookOpen,
  Search,
  Activity,
  Cpu,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ===================================================== LIVE SOS DEMO */
type DispatchAttempt = {
  id: string;
  category: 'TRAINED' | 'RESCUE' | 'AMBULANCE';
  candidateName: string;
  candidateRole: string | null;
  distanceKm: number | null;
  etaMin: number | null;
  outcome: string;
  acceptedAt: string | null;
  sequence: number;
};
type RankedHospital = {
  id: string;
  name: string;
  address: string | null;
  contact: string | null;
  distanceKm: number;
  etaMin: number;
  score: number;
  rank: number;
  recommended: boolean;
  freshness: { label: string; tone: 'green' | 'gold' | 'red' };
  stock: { status: string; quantityBand: string | null };
};
type SosResponse = {
  incident: { dispatchAttempts?: DispatchAttempt[] } | null;
  streamUrl: string;
  auditUrl: string;
  ref: string;
  rankedHospitals: RankedHospital[];
  dispatchedAt: string;
};

type LaneState = {
  category: 'TRAINED' | 'RESCUE' | 'AMBULANCE';
  alerted: DispatchAttempt | null;
  accepted: DispatchAttempt | null;
  pending: DispatchAttempt[];
};

const LANE_META = {
  TRAINED: { label: 'Trained Individual', icon: Stethoscope, tone: '#2BB673' },
  RESCUE: { label: 'Rescue Team', icon: Bug, tone: '#D69E2E' },
  AMBULANCE: { label: 'Ambulance / Hospital', icon: Truck, tone: '#E5484D' },
} as const;

type LaneMap = Record<'TRAINED' | 'RESCUE' | 'AMBULANCE', LaneState>;

function emptyLanes(): LaneMap {
  return {
    TRAINED: { category: 'TRAINED', alerted: null, accepted: null, pending: [] },
    RESCUE: { category: 'RESCUE', alerted: null, accepted: null, pending: [] },
    AMBULANCE: { category: 'AMBULANCE', alerted: null, accepted: null, pending: [] },
  };
}

function buildLanes(attempts: DispatchAttempt[]): LaneMap {
  const lanes = emptyLanes();
  for (const a of attempts) {
    const cat = a.category as 'TRAINED' | 'RESCUE' | 'AMBULANCE';
    // eslint-disable-next-line security/detect-object-injection
    const lane = lanes[cat];
    if (a.outcome === 'ACCEPTED') lane.accepted = a;
    else if (!lane.alerted) lane.alerted = a;
    else lane.pending.push(a);
  }
  return lanes;
}

function applyAttempt(
  prev: LaneMap,
  p: {
    attemptId: string;
    category: string;
    candidateName: string;
    candidateRole: string | null;
    distanceKm: number | null;
    etaMin: number | null;
    sequence: number;
  },
): LaneMap {
  const next = { ...prev };
  const cat = p.category as 'TRAINED' | 'RESCUE' | 'AMBULANCE';
  const attempt: DispatchAttempt = {
    id: p.attemptId,
    category: cat,
    candidateName: p.candidateName,
    candidateRole: p.candidateRole,
    distanceKm: p.distanceKm,
    etaMin: p.etaMin,
    outcome: 'PENDING',
    acceptedAt: null,
    sequence: p.sequence,
  };
  // eslint-disable-next-line security/detect-object-injection
  next[cat] = {
    // eslint-disable-next-line security/detect-object-injection
    ...next[cat],
    // eslint-disable-next-line security/detect-object-injection
    alerted: next[cat].alerted ?? attempt,
    // eslint-disable-next-line security/detect-object-injection
    pending: next[cat].alerted ? [...next[cat].pending, attempt] : next[cat].pending,
  };
  return next;
}

function applyAccepted(
  prev: LaneMap,
  p: {
    attemptId: string;
    category: string;
    candidateName: string;
    candidateRole: string | null;
    distanceKm: number | null;
    etaMin: number | null;
    acceptedAt: string;
    sequence: number;
  },
): LaneMap {
  const next = { ...prev };
  const cat = p.category as 'TRAINED' | 'RESCUE' | 'AMBULANCE';
  const attempt: DispatchAttempt = {
    id: p.attemptId,
    category: cat,
    candidateName: p.candidateName,
    candidateRole: p.candidateRole,
    distanceKm: p.distanceKm,
    etaMin: p.etaMin,
    outcome: 'ACCEPTED',
    acceptedAt: p.acceptedAt,
    sequence: p.sequence ?? 1,
  };
  // eslint-disable-next-line security/detect-object-injection
  next[cat] = { ...next[cat], accepted: attempt };
  return next;
}

export function LiveSosDemo({
  lat = 12.8003,
  lng = 77.5954,
  address,
  locationSource = 'default',
}: {
  lat?: number;
  lng?: number;
  address?: string;
  locationSource?: 'gps' | 'default';
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SosResponse | null>(null);
  const [phase, setPhase] = useState<
    'idle' | 'dispatching' | 'accepted' | 'transporting' | 'handedoff'
  >('idle');
  const [lanes, setLanes] = useState<LaneMap>({
    TRAINED: { category: 'TRAINED', alerted: null, accepted: null, pending: [] },
    RESCUE: { category: 'RESCUE', alerted: null, accepted: null, pending: [] },
    AMBULANCE: { category: 'AMBULANCE', alerted: null, accepted: null, pending: [] },
  });
  const [streaming, setStreaming] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setStreaming(false);
  }, []);

  useEffect(() => () => closeStream(), [closeStream]);

  const trigger = useCallback(async () => {
    setLoading(true);
    closeStream();
    setPhase('dispatching');
    setLanes({
      TRAINED: { category: 'TRAINED', alerted: null, accepted: null, pending: [] },
      RESCUE: { category: 'RESCUE', alerted: null, accepted: null, pending: [] },
      AMBULANCE: { category: 'AMBULANCE', alerted: null, accepted: null, pending: [] },
    });
    try {
      const res = await fetch(apiUrl('/api/sos'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          address: address ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        }),
      });
      if (!res.ok) throw new Error('SOS failed');
      const json: SosResponse = await res.json();
      setData(json);
      toast.success('SOS committed · IncidentCreated appended to outbox');

      // Subscribe to the SSE live-state stream (System Design: WebSocket/SSE).
      const es = new EventSource(json.streamUrl);
      esRef.current = es;
      setStreaming(true);

      es.addEventListener('snapshot', (e: MessageEvent) => {
        const d = JSON.parse(e.data);
        // seed lane state from the initial snapshot
        const att: DispatchAttempt[] = d.incident?.dispatchAttempts ?? [];
        setLanes(buildLanes(att));
      });
      es.addEventListener('dispatch_attempted', (e: MessageEvent) => {
        const p = JSON.parse(e.data);
        setLanes((prev) => applyAttempt(prev, p));
      });
      es.addEventListener('dispatch_accepted', (e: MessageEvent) => {
        const p = JSON.parse(e.data);
        setLanes((prev) => applyAccepted(prev, p));
        toast.success(`${p.candidateName} accepted (${p.category.toLowerCase()})`);
      });
      es.addEventListener('incident_state', (e: MessageEvent) => {
        const p = JSON.parse(e.data);
        if (p.state === 'ACCEPTED') setPhase('accepted');
        if (p.state === 'TRANSPORTING') setPhase('transporting');
        if (p.state === 'HANDED_OFF') {
          setPhase('handedoff');
          toast.success('Handed off to hospital · audit trail preserved');
          setTimeout(() => closeStream(), 1500);
        }
      });
      es.onerror = () => {
        // graceful — reconnect is handled by EventSource; if terminal, just stop.
      };
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to dispatch');
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  }, [closeStream, lat, lng, address]);

  const incident = data?.incident;
  const _attempts: DispatchAttempt[] = incident?.dispatchAttempts ?? [];

  return (
    <div className="rounded-3xl border border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.65)] p-5 md:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-[#E5484D]" />
            Victim / Bystander view
            {locationSource === 'gps' && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-[rgba(43,182,115,0.15)] px-2 py-0.5 text-[10px] font-medium text-[#7fd6ad]">
                <Navigation className="h-2.5 w-2.5" /> GPS
              </span>
            )}
          </div>
          {incident && (
            <div className="mt-1 flex items-center gap-2">
              <span className="tnum font-mono text-sm text-mist">Incident #{data?.ref}</span>
              <StatePill phase={phase} />
            </div>
          )}
        </div>
        <Button
          onClick={trigger}
          disabled={loading}
          className={cn(
            'h-12 gap-2 rounded-xl px-6 font-semibold',
            !loading && 'sos-pulse bg-[#B42318] text-white hover:bg-[#9c1e15]',
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          {loading ? 'Dispatching…' : incident ? 'Re-trigger SOS' : 'Trigger SOS'}
        </Button>
      </div>

      {!incident && !loading && (
        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-[rgba(234,243,237,0.12)] p-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            One tap creates an incident and fans out to three responder lanes in parallel. The
            victim sees live ETAs as responders accept.
          </p>
        </div>
      )}

      {incident && (
        <>
          {/* live stream indicator */}
          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                streaming ? 'animate-pulse bg-[#4FBF9A]' : 'bg-muted-foreground/40',
              )}
            />
            {streaming
              ? 'SSE live · event-driven state from the outbox worker'
              : 'Stream closed · open the audit trail for the full history'}
            {data?.auditUrl && (
              <a
                href={data.auditUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-gold underline-offset-2 hover:underline"
              >
                audit trail →
              </a>
            )}
          </div>

          {/* Three parallel lanes — driven by the SSE stream */}
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(['TRAINED', 'RESCUE', 'AMBULANCE'] as const).map((cat) => {
              // eslint-disable-next-line security/detect-object-injection
              const meta = LANE_META[cat];
              // eslint-disable-next-line security/detect-object-injection
              const lane = lanes[cat];
              const accepted = lane?.accepted ?? null;
              const alerted = lane?.alerted ?? null;
              const Icon = meta.icon;
              const idle = !alerted && !accepted;
              return (
                <div
                  key={cat}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border p-4 transition-all',
                    accepted
                      ? 'border-[rgba(43,182,115,0.35)] bg-[rgba(43,182,115,0.06)]'
                      : alerted
                        ? 'border-[rgba(214,158,46,0.3)] bg-[rgba(214,158,46,0.05)]'
                        : 'border-[rgba(234,243,237,0.08)] bg-[rgba(16,42,32,0.5)]',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color: meta.tone }} />
                      <span className="text-xs font-medium text-mist">{meta.label}</span>
                    </div>
                    {accepted ? (
                      <Badge className="bg-[rgba(43,182,115,0.18)] text-[#7fd6ad] hover:bg-[rgba(43,182,115,0.25)]">
                        ACCEPTED
                      </Badge>
                    ) : alerted ? (
                      <Badge variant="outline" className="border-[rgba(214,158,46,0.3)] text-gold">
                        ALERTED
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-[rgba(234,243,237,0.12)] text-muted-foreground"
                      >
                        {idle ? 'QUEUED' : '…'}
                      </Badge>
                    )}
                  </div>
                  {accepted ? (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-mist">{accepted.candidateName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {accepted.candidateRole}
                      </div>
                      <div className="tnum mt-2 flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-gold">
                          <Navigation className="h-3 w-3" />
                          {accepted.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1 text-[#7fd6ad]">
                          <Clock className="h-3 w-3" />
                          {accepted.etaMin} min ETA
                        </span>
                      </div>
                    </div>
                  ) : alerted ? (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-mist">{alerted.candidateName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {alerted.candidateRole}
                      </div>
                      <div className="tnum mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {alerted.distanceKm} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {alerted.etaMin} min
                        </span>
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> awaiting dispatch worker…
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hospital ranking */}
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Droplet className="h-3.5 w-3.5 text-gold" />
              Antivenom-aware hospital ranking
            </div>
            <div className="space-y-2">
              {(data?.rankedHospitals ?? []).slice(0, 4).map((h) => (
                <div
                  key={h.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3',
                    h.recommended
                      ? 'border-[rgba(214,158,46,0.4)] bg-[rgba(214,158,46,0.07)]'
                      : 'border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)]',
                  )}
                >
                  <div className="tnum w-6 text-center text-sm font-bold text-muted-foreground">
                    {h.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-mist">{h.name}</span>
                      {h.recommended && (
                        <Badge className="bg-[rgba(214,158,46,0.2)] text-gold hover:bg-[rgba(214,158,46,0.3)]">
                          RECOMMENDED
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {h.freshness.label}
                    </div>
                  </div>
                  <div className="tnum flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{h.distanceKm}km</span>
                    <span className="font-medium text-mist">{h.etaMin}m</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Note the farther <span className="text-mist">Hospital A</span> is recommended over a
              nearer hospital with <span className="text-gold">stale / unknown stock</span>. That is
              the NagRaksha differentiator (FR-4.2).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatePill({ phase }: { phase: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    idle: { label: 'Idle', tone: '#8FA39B' },
    dispatching: { label: 'Dispatching', tone: '#D69E2E' },
    accepted: { label: 'Responder accepted', tone: '#2BB673' },
    transporting: { label: 'Transporting', tone: '#4FBF9A' },
    handedoff: { label: 'Handed off to hospital', tone: '#E0B443' },
  };
  // eslint-disable-next-line security/detect-object-injection
  const m = map[phase] ?? map.idle;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
      style={{ background: `${m.tone}22`, color: m.tone }}
    >
      {m.label}
    </span>
  );
}

/* ===================================================== RISK PANEL */
type RiskData = {
  level?: string;
  score?: number;
  advisory?: string;
  weather?: string;
  likelySnakes?: string[];
  area?: string;
};
export function RiskPanel({ lat = 12.8003, lng = 77.5954 }: { lat?: number; lng?: number }) {
  const [data, setData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView<HTMLDivElement>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/risk?lat=${lat}&lng=${lng}`));
      const json: RiskData = await res.json();
      setData(json);
    } catch {
      toast.error('Could not load risk advisory');
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!inView) return;
    fetch(apiUrl(`/api/risk?lat=${lat}&lng=${lng}`))
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error('Could not load risk advisory'))
      .finally(() => setLoading(false));
  }, [inView, lat, lng]);

  const level = data?.level ?? 'UNKNOWN';
  const score = data?.score ?? 0;
  const tone =
    level === 'SEVERE'
      ? '#E5484D'
      : level === 'HIGH'
        ? '#E0B443'
        : level === 'MODERATE'
          ? '#D69E2E'
          : '#2BB673';

  return (
    <div
      ref={ref}
      className="mt-4 rounded-xl border border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.5)] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-gold" /> Risk near you
        </span>
        <button
          onClick={load}
          className="text-muted-foreground hover:text-mist"
          aria-label="Refresh risk"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading risk advisory…
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-semibold" style={{ color: tone }}>
              {level}
            </span>
            <span className="tnum text-sm text-muted-foreground">score {score}/100</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(234,243,237,0.08)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${score}%`, background: tone }}
            />
          </div>
          {data?.advisory && (
            <p className="mt-3 text-xs leading-relaxed text-[#bcd2c6]">{data.advisory}</p>
          )}
          {data?.weather && (
            <p className="mt-2 text-[11px] text-muted-foreground">{data.weather}</p>
          )}
          {data?.likelySnakes && data.likelySnakes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.likelySnakes.map((s: string) => (
                <span
                  key={s}
                  className="rounded-full bg-[rgba(214,158,46,0.1)] px-2 py-0.5 text-[10px] text-gold"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ===================================================== SNAKE ID */
type SnakeIdResult = {
  species?: string;
  venom?: string;
  confidence?: number;
  firstAid?: string;
  disclaimer?: string;
};
export function SnakeId() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SnakeIdResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(f);
  };

  const identify = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl('/api/snake-id'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, text }),
      });
      const json = await res.json();
      setResult(json);
    } catch {
      toast.error('Identification failed');
    } finally {
      setLoading(false);
    }
  }, [image, text]);

  return (
    <div className="mt-4 rounded-xl border border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.5)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bug className="h-3.5 w-3.5 text-[#4FBF9A]" /> Photo identification
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          CV assist
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 border-[rgba(43,182,115,0.3)] text-[#7fd6ad] hover:bg-[rgba(43,182,115,0.1)]"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" /> {image ? 'Photo selected' : 'Upload photo'}
        </Button>
        <Button
          size="sm"
          className="h-9 gap-2 bg-[#2BB673] text-[#06120C] hover:bg-[#239961]"
          onClick={identify}
          disabled={loading || (!image && !text)}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bug className="h-3.5 w-3.5" />
          )}
          Identify
        </Button>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Or describe the snake (e.g. 'black with a white hood marking, about 4 feet')…"
        className="mt-2 min-h-[60px] resize-none border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.4)] text-sm text-mist placeholder:text-muted-foreground"
      />

      {result && (
        <div className="mt-3 rounded-lg border border-[rgba(214,158,46,0.2)] bg-[rgba(214,158,46,0.05)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-mist">{result.species}</span>
            <span
              className="tnum rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background:
                  result.venom === 'NON_VENOMOUS'
                    ? 'rgba(43,182,115,0.18)'
                    : 'rgba(229,72,77,0.18)',
                color: result.venom === 'NON_VENOMOUS' ? '#7fd6ad' : '#E5484D',
              }}
            >
              {result.venom}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(234,243,237,0.08)]">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.round((result.confidence ?? 0) * 100)}%` }}
              />
            </div>
            <span className="tnum text-[11px] text-muted-foreground">
              {Math.round((result.confidence ?? 0) * 100)}% confidence
            </span>
          </div>
          {result.firstAid && (
            <p className="mt-2 text-xs leading-relaxed text-[#bcd2c6]">
              <span className="font-medium text-gold">First aid:</span> {result.firstAid}
            </p>
          )}
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-gold" />
            {result.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

/* ===================================================== MYTH BUSTER (RAG) */
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  emergency?: boolean;
  myth?: boolean;
  sources?: { docId: string; title: string; score: number }[];
  source?: string;
};
export function MythBuster() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        "I'm NagRaksha Mitra. Ask me about a snake, a first-aid step, or a remedy you've heard of. If someone has been bitten, tap SOS now.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = useCallback(
    async (overrideText?: string) => {
      const q = (typeof overrideText === 'string' ? overrideText : input).trim();
      if (!q || loading) return;
      setMessages((m) => [...m, { role: 'user', content: q }]);
      setInput('');
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/myth-buster'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: json.answer ?? 'I could not answer that right now.',
            emergency: json.emergency,
            myth: json.mythFlagged,
            sources: json.sources,
            source: json.source,
          },
        ]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: `I'm having trouble reaching the knowledge base (${msg}). Please ensure the backend is running with 'python start.py'.`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading],
  );

  const quick = [
    'Should I tie a tourniquet above a snakebite?',
    'Is sucking out venom effective?',
    'Can a photo confirm the snake species?',
    'Are traditional healers enough for a bite?',
  ];

  return (
    <div className="rounded-xl border border-[rgba(229,72,77,0.18)] bg-[rgba(8,20,15,0.5)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-[#E5484D]" /> NagRaksha Mitra
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          RAG · retrieved + grounded
        </span>
      </div>

      <div
        ref={scrollRef}
        className="mt-3 max-h-[260px] min-h-[180px] space-y-2.5 overflow-y-auto pr-1"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
              m.role === 'user'
                ? 'ml-auto bg-[#2BB673] text-[#06120C]'
                : m.emergency
                  ? 'bg-[rgba(229,72,77,0.15)] text-[#ffb3b6] ring-1 ring-[rgba(229,72,77,0.4)]'
                  : 'bg-[rgba(234,243,237,0.06)] text-[#e6efe9]',
            )}
          >
            {m.role === 'assistant' && m.myth && (
              <span className="mb-1 inline-block rounded bg-[rgba(214,158,46,0.2)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                Myth busted
              </span>
            )}
            <span className="whitespace-pre-wrap">{m.content}</span>
            {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
              <span className="mt-2 flex flex-wrap items-center gap-1 border-t border-[rgba(234,243,237,0.08)] pt-2">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  RAG sources:
                </span>
                {m.sources.map((s) => (
                  <span
                    key={s.docId}
                    title={`${s.title} · score ${s.score}`}
                    className="rounded bg-[rgba(43,182,115,0.12)] px-1.5 py-0.5 text-[9px] text-[#7fd6ad]"
                  >
                    {s.docId}
                  </span>
                ))}
              </span>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> NagRaksha Mitra is thinking…
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="rounded-full border border-[rgba(234,243,237,0.1)] bg-[rgba(234,243,237,0.03)] px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:text-mist"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder="Ask about a myth, remedy, or first-aid step…"
          className="h-9 border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.4)] text-sm text-mist"
        />
        <Button
          size="sm"
          className="h-9 gap-2 bg-[#2BB673] text-[#06120C] hover:bg-[#239961]"
          onClick={() => ask()}
          disabled={loading || !input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ===================================================== STATS STRIP */
type StatsData = {
  totals?: {
    incidents?: number;
    hospitals?: number;
    riskAreas?: number;
    mythConversations?: number;
    knowledgeChunks?: number;
  };
  incidentTrend14d?: { date: string; count: number }[];
};
export function StatsStrip() {
  const [data, setData] = useState<StatsData | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();
  useEffect(() => {
    if (!inView) return; // gate on scroll-into-view
    fetch(apiUrl('/api/stats'))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [inView]);
  if (!data) return <div ref={ref} />;
  const t = data.totals;
  const trend = data.incidentTrend14d ?? [];
  const max = Math.max(1, ...trend.map((d) => d.count));
  return (
    <div ref={ref} className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <StatCard icon={AlertTriangle} tone="#E5484D" value={t?.incidents ?? 0} label="incidents" />
      <StatCard icon={CheckCircle2} tone="#4FBF9A" value={t?.hospitals ?? 0} label="hospitals" />
      <StatCard icon={MapPin} tone="#D69E2E" value={t?.riskAreas ?? 0} label="risk areas" />
      <StatCard
        icon={TrendingUp}
        tone="#2BB673"
        value={t?.mythConversations ?? 0}
        label="myth chats"
      />
      <StatCard
        icon={ShieldAlert}
        tone="#7fd6ad"
        value={t?.knowledgeChunks ?? 0}
        label="RAG chunks"
      />
      <div className="col-span-2 rounded-2xl glass p-4 md:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            14-day trend
          </span>
          <TrendingUp className="h-3 w-3 text-[#4FBF9A]" />
        </div>
        <div className="mt-3 flex h-10 items-end gap-0.5">
          {trend.map((d, i: number) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-[#184D36] to-[#2BB673]"
              style={{ height: `${(d.count / max) * 100}%`, opacity: 0.4 + (d.count / max) * 0.6 }}
              title={`${d.date}: ${d.count}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl glass p-4">
      <Icon className="h-4 w-4" style={{ color: tone }} />
      <div className="tnum mt-2 text-2xl font-semibold text-mist">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/* ===================================================== AUDIT TRAIL PANEL */
const ACTION_META: Record<string, { tone: string; label: string }> = {
  SOS_TRIGGERED: { tone: '#E5484D', label: 'SOS triggered' },
  DISPATCH_FANOUT: { tone: '#D69E2E', label: 'Dispatch fan-out' },
  RESPONDER_ACCEPTED: { tone: '#2BB673', label: 'Responder accepted' },
  STATE_CHANGE: { tone: '#4FBF9A', label: 'State change' },
  HANDOFF: { tone: '#E0B443', label: 'Hospital handoff' },
  STOCK_UPDATED: { tone: '#7fd6ad', label: 'Stock updated' },
  RAG_QUERY: { tone: '#8FA39B', label: 'RAG query' },
};

type AuditEvent = {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  incidentId?: string;
};
type AuditData = { events?: AuditEvent[]; byAction?: Record<string, number> };
export function AuditTrailPanel() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView<HTMLDivElement>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/audit'));
      const json: AuditData = await res.json();
      setData(json);
    } catch {
      toast.error('Could not load audit trail');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!inView) return;
    fetch(apiUrl('/api/audit'))
      .then((r) => r.json())
      .then((json: AuditData) =>
        setData((prev) =>
          JSON.stringify(prev?.events) === JSON.stringify(json.events) ? prev : json,
        ),
      )
      .catch(() => toast.error('Could not load audit trail'))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      fetch(apiUrl('/api/audit'))
        .then((r) => r.json())
        .then((json: AuditData) =>
          setData((prev) =>
            JSON.stringify(prev?.events) === JSON.stringify(json.events) ? prev : json,
          ),
        )
        .catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [inView]);

  const events: AuditEvent[] = data?.events ?? [];

  return (
    <div
      ref={ref}
      className="flex h-full flex-col rounded-2xl border border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.5)] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5 text-[#4FBF9A]" /> Audit trail · NFR-8
        </span>
        <button
          onClick={load}
          className="text-muted-foreground hover:text-mist"
          aria-label="Refresh audit"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && !data ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading audit events…
        </div>
      ) : events.length === 0 ? (
        <div className="mt-3 text-xs text-muted-foreground">
          No audit events yet. Trigger an SOS or ask the myth-buster to populate this trail.
        </div>
      ) : (
        <div className="mt-3 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
          {events.map((e) => {
            const meta = ACTION_META[e.action] ?? { tone: '#8FA39B', label: e.action };
            return (
              <div
                key={e.id}
                className="flex items-start gap-2 rounded-lg border border-[rgba(234,243,237,0.05)] bg-[rgba(16,42,32,0.4)] p-2"
              >
                <span
                  className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: meta.tone }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-mist">{meta.label}</span>
                    <span className="tnum flex-shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="rounded bg-[rgba(234,243,237,0.05)] px-1.5 py-0.5">
                      {e.actor}
                    </span>
                    {e.incidentId && (
                      <span className="truncate font-mono">#{e.incidentId.slice(-6)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.byAction && Object.keys(data.byAction).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[rgba(234,243,237,0.06)] pt-3">
          {Object.entries(data.byAction).map(([action, count]) => {
            // eslint-disable-next-line security/detect-object-injection
            const meta = ACTION_META[action] ?? { tone: '#8FA39B', label: action };
            return (
              <span
                key={action}
                className="tnum rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: `${meta.tone}1a`, color: meta.tone }}
              >
                {meta.label} · {count as number}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===================================================== OUTBOX PANEL */
type OutboxEvent = {
  id: string;
  type: string;
  aggregateId: string;
  state: string;
  attempts: number;
};
type OutboxData = {
  summary?: { pending: number; processed: number; failed: number; total: number };
  recent?: OutboxEvent[];
};
export function OutboxPanel() {
  const [data, setData] = useState<OutboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const { ref, inView } = useInView<HTMLDivElement>();

  useEffect(() => {
    if (!inView) return;
    fetch(apiUrl('/api/outbox'))
      .then((r) => r.json())
      .then((json: OutboxData) =>
        setData((prev) =>
          JSON.stringify(prev?.summary) === JSON.stringify(json.summary) &&
          JSON.stringify(prev?.recent) === JSON.stringify(json.recent)
            ? prev
            : json,
        ),
      )
      .catch(() => toast.error('Could not load outbox'))
      .finally(() => setLoading(false));
    const id = setInterval(() => {
      fetch(apiUrl('/api/outbox'))
        .then((r) => r.json())
        .then((json: OutboxData) =>
          setData((prev) =>
            JSON.stringify(prev?.summary) === JSON.stringify(json.summary) &&
            JSON.stringify(prev?.recent) === JSON.stringify(json.recent)
              ? prev
              : json,
          ),
        )
        .catch(() => {});
    }, 6000);
    return () => clearInterval(id);
  }, [inView]);

  const s = data?.summary ?? { pending: 0, processed: 0, failed: 0, total: 0 };
  const recent: OutboxEvent[] = data?.recent ?? [];

  return (
    <div
      ref={ref}
      className="flex h-full flex-col rounded-2xl border border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.5)] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Boxes className="h-3.5 w-3.5 text-[#E5484D]" /> Outbox · event-driven worker
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#4FBF9A]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4FBF9A]" /> draining
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <OutboxStat label="processed" value={s.processed} tone="#4FBF9A" icon={CheckCircle2} />
        <OutboxStat label="pending" value={s.pending} tone="#D69E2E" icon={Clock} />
        <OutboxStat label="failed" value={s.failed} tone="#E5484D" icon={AlertTriangle} />
      </div>

      <div className="mt-3 flex-1">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          Recent events
        </div>
        {loading && !data ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : recent.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Outbox empty. Trigger an SOS to append an IncidentCreated event.
          </div>
        ) : (
          <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
            {recent.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-lg border border-[rgba(234,243,237,0.05)] bg-[rgba(16,42,32,0.4)] p-2"
              >
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[9px] font-medium"
                  style={{
                    background:
                      e.state === 'PROCESSED'
                        ? 'rgba(79,191,154,0.15)'
                        : e.state === 'FAILED'
                          ? 'rgba(229,72,77,0.15)'
                          : 'rgba(214,158,46,0.15)',
                    color:
                      e.state === 'PROCESSED'
                        ? '#4FBF9A'
                        : e.state === 'FAILED'
                          ? '#E5484D'
                          : '#D69E2E',
                  }}
                >
                  {e.type}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  #{e.aggregateId.slice(-6)}
                </span>
                <span className="ml-auto tnum text-[10px] text-muted-foreground">
                  {e.state.toLowerCase()} · {e.attempts}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OutboxStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
}) {
  return (
    <div className="rounded-lg bg-[rgba(234,243,237,0.03)] p-2 text-center">
      <Icon className="mx-auto h-3 w-3" style={{ color: tone }} />
      <div className="tnum mt-1 text-lg font-semibold" style={{ color: tone }}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/* ===================================================== KNOWLEDGE BASE PANEL */
type KbChunk = { id: string; category: string; title: string; docId: string };
type KbResult = { id: string; category: string; title: string; score: number };
export function KnowledgeBasePanel() {
  const [chunks, setChunks] = useState<KbChunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KbResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { ref, inView } = useInView<HTMLDivElement>();

  useEffect(() => {
    if (!inView) return;
    fetch(apiUrl('/api/knowledge-base?limit=50'))
      .then((r) => r.json())
      .then((json) => setChunks(json.chunks ?? []))
      .catch(() => toast.error('Could not load knowledge base'))
      .finally(() => setLoading(false));
  }, [inView]);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(apiUrl(`/api/knowledge-base?q=${encodeURIComponent(query)}&k=4`));
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      toast.error('Retrieval failed');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const CATEGORY_TONE: Record<string, string> = {
    FIRST_AID: '#2BB673',
    MYTH: '#E5484D',
    SPECIES: '#D69E2E',
    RISK: '#E0B443',
    ANTIVENOM: '#4FBF9A',
    PROTOCOL: '#7fd6ad',
  };

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-[rgba(214,158,46,0.18)] bg-[rgba(214,158,46,0.04)] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 text-gold" /> RAG knowledge base · medically reviewed
        </span>
        <span className="tnum text-[10px] text-muted-foreground">
          {chunks.length} chunks · TF-IDF indexed
        </span>
      </div>

      {/* Retrieval preview */}
      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Try: tourniquet, krait bite, cobra first aid…"
            className="h-9 border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.4)] pl-8 text-sm text-mist"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-2 border-[rgba(214,158,46,0.3)] text-gold hover:bg-[rgba(214,158,46,0.1)]"
          onClick={search}
          disabled={searching || !query.trim()}
        >
          {searching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Cpu className="h-3.5 w-3.5" />
          )}
          Retrieve
        </Button>
      </div>

      {results && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3 text-[#4FBF9A]" /> Top-k retrieved chunks
          </div>
          <div className="space-y-1.5">
            {results.length === 0 ? (
              <div className="text-xs text-muted-foreground">No chunks matched.</div>
            ) : (
              results.map((r, i) => {
                const tone = CATEGORY_TONE[r.category] ?? '#8FA39B';
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)] p-2"
                  >
                    <span className="tnum text-[10px] font-bold text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                      style={{ background: `${tone}1a`, color: tone }}
                    >
                      {r.category}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-mist">{r.title}</span>
                    <span className="tnum text-[10px] text-muted-foreground">score {r.score}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Corpus browser */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Database className="h-3 w-3 text-[#4FBF9A]" /> Corpus
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading corpus…
          </div>
        ) : (
          <div className="max-h-[200px] space-y-1 overflow-y-auto pr-1">
            {chunks.map((c) => {
              const tone = CATEGORY_TONE[c.category] ?? '#8FA39B';
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-md border border-[rgba(234,243,237,0.04)] bg-[rgba(8,20,15,0.4)] px-2 py-1.5"
                >
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                    style={{ background: `${tone}1a`, color: tone }}
                  >
                    {c.category}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[#bcd2c6]">
                    {c.title}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">{c.docId}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================== SNAKE ID ALIAS */
export const SnakeIdUpload = SnakeId;

/* ===================================================== HOSPITAL STOCK CONSOLE */
export function HospitalStockConsole() {
  const [hospitals, setHospitals] = useState<RankedHospital[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/hospitals?lat=12.8003&lng=77.5954'));
      const json = await res.json();
      setHospitals(json.rankedHospitals ?? json.hospitals ?? []);
    } catch {
      toast.error('Could not load hospital registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch(apiUrl('/api/hospitals?lat=12.8003&lng=77.5954'))
      .then((r) => r.json())
      .then((json) => {
        if (isMounted) setHospitals(json.rankedHospitals ?? json.hospitals ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateStock = async (hospitalId: string, status: string) => {
    try {
      const res = await fetch(apiUrl(`/api/hospitals/${hospitalId}/stock`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, verifiedBy: 'Dr. Sharma · Emergency Chief' }),
      });
      if (!res.ok) throw new Error('Stock update failed');
      toast.success(`Antivenom stock updated to ${status}`);
      loadHospitals();
    } catch {
      toast.error('Failed to update antivenom stock');
    }
  };

  return (
    <div className="rounded-2xl border border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.6)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-mist">Hospital Antivenom Registry</h3>
          <p className="text-xs text-muted-foreground">
            Live stock reporting directly feeds Dijkstra travel-time hospital ranking
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadHospitals}
          className="h-8 gap-1.5 text-xs text-gold border-gold/30"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-[#2BB673]" /> Loading hospital inventory...
        </div>
      ) : (
        <div className="space-y-3">
          {hospitals.map((h) => (
            <div
              key={h.id}
              className="rounded-xl border border-[rgba(234,243,237,0.08)] bg-[#11231c] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-mist">{h.name}</h4>
                  {h.recommended && (
                    <Badge className="bg-[rgba(214,158,46,0.2)] text-gold border-0 text-[10px]">
                      RANK #1
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {h.address || 'District Road, Bengaluru'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-[#7fd6ad] font-mono">
                    {h.freshness?.label || h.stock?.status}
                  </span>
                  <span className="text-muted-foreground">
                    {h.distanceKm} km · {h.etaMin} mins ETA
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground sm:hidden">Set Stock:</span>
                {(['CONFIRMED', 'LOW', 'OUT'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => updateStock(h.id, st)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-initial',
                      h.stock?.status === st
                        ? st === 'CONFIRMED'
                          ? 'bg-[#2BB673] text-[#051710]'
                          : st === 'LOW'
                            ? 'bg-[#D69E2E] text-[#051710]'
                            : 'bg-[#E5484D] text-white'
                        : 'bg-[rgba(234,243,237,0.06)] text-muted-foreground hover:text-mist hover:bg-[rgba(234,243,237,0.1)]',
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================================================== SYMPTOM LOGGER */
export function SymptomLogger({ incidentId = 'NR-1042' }: { incidentId?: string }) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState('MODERATE');
  const [biteTime, setBiteTime] = useState('10 mins ago');
  const [bodyPart, setBodyPart] = useState('Right Lower Leg');
  const [submitting, setSubmitting] = useState(false);

  const toggleSymptom = (sym: string) => {
    setSymptoms((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]));
  };

  const submitLog = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/incidents/${incidentId}/symptoms`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms,
          severity,
          biteTime,
          bodyPart,
          observedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Symptom log failed');
      toast.success('Symptom log committed · transmitted to receiving doctor');
    } catch {
      toast.error('Failed to log symptoms');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Bite Location / Body Part
          </label>
          <Input
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value)}
            className="mt-1 bg-[#11231c] border-[rgba(234,243,237,0.1)] text-mist text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Time of Bite
          </label>
          <Input
            value={biteTime}
            onChange={(e) => setBiteTime(e.target.value)}
            className="mt-1 bg-[#11231c] border-[rgba(234,243,237,0.1)] text-mist text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
          Observed Symptoms
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            'Fang Marks',
            'Local Swelling',
            'Active Bleeding',
            'Severe Pain',
            'Ptosis / Drooping Eyelids',
            'Nausea / Vomiting',
            'Dark Urine',
          ].map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => toggleSymptom(sym)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all',
                symptoms.includes(sym)
                  ? 'bg-[rgba(43,182,115,0.2)] border-[#2BB673] text-[#7fd6ad]'
                  : 'bg-[#11231c] border-[rgba(234,243,237,0.08)] text-muted-foreground hover:text-mist',
              )}
            >
              {symptoms.includes(sym) ? '✓ ' : '+ '}
              {sym}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 block">
          Envenomation Severity
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['MILD', 'MODERATE', 'SEVERE'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverity(sev)}
              className={cn(
                'py-2 rounded-xl text-xs font-bold border transition-all',
                severity === sev
                  ? sev === 'SEVERE'
                    ? 'bg-[#E5484D] border-[#E5484D] text-white'
                    : sev === 'MODERATE'
                      ? 'bg-[#D69E2E] border-[#D69E2E] text-[#051710]'
                      : 'bg-[#2BB673] border-[#2BB673] text-[#051710]'
                  : 'bg-[#11231c] border-[rgba(234,243,237,0.08)] text-muted-foreground',
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={submitLog}
        disabled={submitting}
        className="w-full h-11 bg-[#2BB673] hover:bg-[#239961] text-[#051710] font-bold text-sm rounded-xl gap-2 mt-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? 'Transmitting...' : 'Transmit Symptom Log to Hospital'}
      </Button>
    </div>
  );
}

/* ===================================================== HELPERS */
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
