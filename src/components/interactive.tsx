"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ===================================================== LIVE SOS DEMO */
type DispatchAttempt = {
  id: string;
  category: "TRAINED" | "RESCUE" | "AMBULANCE";
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
  freshness: { label: string; tone: "green" | "gold" | "red" };
  stock: { status: string; quantityBand: string | null };
};
type SosResponse = {
  incident: any;
  ref: string;
  rankedHospitals: RankedHospital[];
  dispatchedAt: string;
};

const LANE_META = {
  TRAINED: { label: "Trained Individual", icon: Stethoscope, tone: "#2BB673" },
  RESCUE: { label: "Rescue Team", icon: Bug, tone: "#D69E2E" },
  AMBULANCE: { label: "Ambulance / Hospital", icon: Truck, tone: "#E5484D" },
} as const;

export function LiveSosDemo() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SosResponse | null>(null);
  const [phase, setPhase] = useState<"idle" | "dispatching" | "accepted" | "transporting" | "handedoff">("idle");

  const trigger = useCallback(async () => {
    setLoading(true);
    setPhase("dispatching");
    try {
      const res = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 12.8003, lng: 77.5954, address: "Bannerghatta Forest Edge, Bengaluru" }),
      });
      if (!res.ok) throw new Error("SOS failed");
      const json: SosResponse = await res.json();
      setData(json);
      toast.success("SOS sent · three responders notified in parallel");
      // animate state timeline
      setTimeout(() => setPhase("accepted"), 1400);
      setTimeout(() => setPhase("transporting"), 3000);
      setTimeout(() => setPhase("handedoff"), 5200);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to dispatch");
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  }, []);

  const incident = data?.incident;
  const attempts: DispatchAttempt[] = incident?.dispatchAttempts ?? [];

  return (
    <div className="rounded-3xl border border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.65)] p-5 md:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-[#E5484D]" />
            Victim / Bystander view
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
            "h-12 gap-2 rounded-xl px-6 font-semibold",
            !loading && "sos-pulse bg-[#B42318] text-white hover:bg-[#9c1e15]"
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
          {loading ? "Dispatching…" : incident ? "Re-trigger SOS" : "Trigger SOS"}
        </Button>
      </div>

      {!incident && !loading && (
        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-[rgba(234,243,237,0.12)] p-10 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            One tap creates an incident and fans out to three responder lanes in
            parallel. The victim sees live ETAs as responders accept.
          </p>
        </div>
      )}

      {incident && (
        <>
          {/* Three parallel lanes */}
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(["TRAINED", "RESCUE", "AMBULANCE"] as const).map((cat) => {
              const meta = LANE_META[cat];
              const laneAttempts = attempts.filter((a) => a.category === cat);
              const accepted = laneAttempts.find((a) => a.outcome === "ACCEPTED");
              const Icon = meta.icon;
              return (
                <div
                  key={cat}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-4 transition-all",
                    accepted
                      ? "border-[rgba(43,182,115,0.35)] bg-[rgba(43,182,115,0.06)]"
                      : "border-[rgba(234,243,237,0.08)] bg-[rgba(16,42,32,0.5)]"
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
                    ) : (
                      <Badge variant="outline" className="border-[rgba(234,243,237,0.12)] text-muted-foreground">
                        ALERTED
                      </Badge>
                    )}
                  </div>
                  {accepted ? (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-mist">{accepted.candidateName}</div>
                      <div className="text-[11px] text-muted-foreground">{accepted.candidateRole}</div>
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
                  ) : (
                    <div className="mt-3 space-y-2">
                      {laneAttempts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="truncate">{a.candidateName}</span>
                          <span className="tnum">{a.distanceKm}km · {a.etaMin}m</span>
                        </div>
                      ))}
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
                    "flex items-center gap-3 rounded-xl border p-3",
                    h.recommended
                      ? "border-[rgba(214,158,46,0.4)] bg-[rgba(214,158,46,0.07)]"
                      : "border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)]"
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
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{h.freshness.label}</div>
                  </div>
                  <div className="tnum flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{h.distanceKm}km</span>
                    <span className="font-medium text-mist">{h.etaMin}m</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Note the farther <span className="text-mist">Hospital A</span> is
              recommended over a nearer hospital with{" "}
              <span className="text-gold">stale / unknown stock</span>. That is
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
    idle: { label: "Idle", tone: "#8FA39B" },
    dispatching: { label: "Dispatching", tone: "#D69E2E" },
    accepted: { label: "Responder accepted", tone: "#2BB673" },
    transporting: { label: "Transporting", tone: "#4FBF9A" },
    handedoff: { label: "Handed off to hospital", tone: "#E0B443" },
  };
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
export function RiskPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/risk?lat=12.8003&lng=77.5954");
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Could not load risk advisory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const level = data?.level ?? "UNKNOWN";
  const score = data?.score ?? 0;
  const tone =
    level === "SEVERE" ? "#E5484D" : level === "HIGH" ? "#E0B443" : level === "MODERATE" ? "#D69E2E" : "#2BB673";

  return (
    <div className="mt-4 rounded-xl border border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.5)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-gold" /> Risk near you
        </span>
        <button onClick={load} className="text-muted-foreground hover:text-mist" aria-label="Refresh risk">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
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
          {data?.likelySnakes?.length > 0 && (
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
export function SnakeId() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
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
      const res = await fetch("/api/snake-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, text }),
      });
      const json = await res.json();
      setResult(json);
    } catch {
      toast.error("Identification failed");
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
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">CV assist</span>
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
          <Upload className="h-3.5 w-3.5" /> {image ? "Photo selected" : "Upload photo"}
        </Button>
        <Button
          size="sm"
          className="h-9 gap-2 bg-[#2BB673] text-[#06120C] hover:bg-[#239961]"
          onClick={identify}
          disabled={loading || (!image && !text)}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bug className="h-3.5 w-3.5" />}
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
                  result.venom === "NON_VENOMOUS" ? "rgba(43,182,115,0.18)" : "rgba(229,72,77,0.18)",
                color: result.venom === "NON_VENOMOUS" ? "#7fd6ad" : "#E5484D",
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

/* ===================================================== MYTH BUSTER */
type Msg = { role: "user" | "assistant"; content: string; emergency?: boolean; myth?: boolean };
export function MythBuster() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "I'm NagRaksha Mitra. Ask me about a snake, a first-aid step, or a remedy you've heard of. If someone has been bitten, tap SOS now.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/myth-buster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const json = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: json.answer ?? "I could not answer that right now.",
          emergency: json.emergency,
          myth: json.mythFlagged,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I'm having trouble reaching the knowledge base. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const quick = [
    "Should I tie a tourniquet above a snakebite?",
    "Is sucking out venom effective?",
    "Can a photo confirm the snake species?",
    "Are traditional healers enough for a bite?",
  ];

  return (
    <div className="rounded-xl border border-[rgba(229,72,77,0.18)] bg-[rgba(8,20,15,0.5)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-[#E5484D]" /> NagRaksha Mitra
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">LLM · guarded</span>
      </div>

      <div
        ref={scrollRef}
        className="mt-3 max-h-[260px] min-h-[180px] space-y-2.5 overflow-y-auto pr-1"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-[#2BB673] text-[#06120C]"
                : m.emergency
                ? "bg-[rgba(229,72,77,0.15)] text-[#ffb3b6] ring-1 ring-[rgba(229,72,77,0.4)]"
                : "bg-[rgba(234,243,237,0.06)] text-[#e6efe9]"
            )}
          >
            {m.role === "assistant" && m.myth && (
              <span className="mb-1 inline-block rounded bg-[rgba(214,158,46,0.2)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                Myth busted
              </span>
            )}
            <span className="whitespace-pre-wrap">{m.content}</span>
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
            onClick={() => setInput(q)}
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
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask about a myth, remedy, or first-aid step…"
          className="h-9 border-[rgba(234,243,237,0.1)] bg-[rgba(8,20,15,0.4)] text-sm text-mist"
        />
        <Button
          size="sm"
          className="h-9 gap-2 bg-[#2BB673] text-[#06120C] hover:bg-[#239961]"
          onClick={ask}
          disabled={loading || !input.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ===================================================== STATS STRIP */
export function StatsStrip() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);
  if (!data) return null;
  const t = data.totals;
  const trend = data.incidentTrend14d ?? [];
  const max = Math.max(1, ...trend.map((d: any) => d.count));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard icon={AlertTriangle} tone="#E5484D" value={t?.incidents ?? 0} label="incidents" />
      <StatCard icon={CheckCircle2} tone="#4FBF9A" value={t?.hospitals ?? 0} label="hospitals" />
      <StatCard icon={MapPin} tone="#D69E2E" value={t?.riskAreas ?? 0} label="risk areas" />
      <StatCard icon={TrendingUp} tone="#2BB673" value={t?.mythConversations ?? 0} label="myth chats" />
      <div className="col-span-2 rounded-2xl glass p-4 md:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">14-day trend</span>
          <TrendingUp className="h-3 w-3 text-[#4FBF9A]" />
        </div>
        <div className="mt-3 flex h-10 items-end gap-0.5">
          {trend.map((d: any, i: number) => (
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

function StatCard({ icon: Icon, tone, value, label }: { icon: any; tone: string; value: number; label: string }) {
  return (
    <div className="rounded-2xl glass p-4">
      <Icon className="h-4 w-4" style={{ color: tone }} />
      <div className="tnum mt-2 text-2xl font-semibold text-mist">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
