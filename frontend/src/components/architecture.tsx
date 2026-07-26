"use client";

import { useEffect, useState } from "react";
import { useInView } from "@/hooks/use-scroll";
import { apiUrl } from "@/lib/api";
import {
  ShieldAlert,
  Split,
  Users,
  Droplet,
  Route as RouteIcon,
  Stethoscope,
  Bell,
  BrainCircuit,
  TrendingUp,
  Database,
  Workflow,
  Lock,
  Cpu,
  ChevronRight,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICONS: Record<string, any> = {
  ShieldAlert, Split, Users, Droplet, Route: RouteIcon, Stethoscope, Bell, BrainCircuit, TrendingUp,
};

type ArchData = {
  layers: { name: string; tone: string; components: string[] }[];
  domains: { id: string; name: string; desc: string; icon: string }[];
  sequence: { step: number; action: string; failure: string; tone: string }[];
  roles: { role: string; desc: string; tone: string }[];
  rag: {
    corpusChunks: number;
    reviewedBy: string;
    sources: string;
    retrieval: string;
    generation: string;
    categories: string[];
  };
  outbox: { PENDING: number; PROCESSED: number; FAILED: number };
  logicalFlow: string;
};

export function Architecture() {
  const [data, setData] = useState<ArchData | null>(null);
  const { ref, inView } = useInView<HTMLDivElement>();

  useEffect(() => {
    if (!inView) return; // gate on scroll-into-view to avoid concurrent compiles
    fetch(apiUrl("/api/architecture"))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [inView]);

  return (
    <section ref={ref} id="architecture" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-20 md:px-8 md:py-28">
      <Reveal>
        <div className="mb-3 flex items-center gap-2">
          <span className="h-px w-8 bg-gradient-to-r from-[#2BB673] to-[#D69E2E]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            System architecture
          </span>
        </div>
      </Reveal>
      <Reveal delay={60}>
        <h2 className="max-w-3xl text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold leading-tight tracking-[-0.02em] text-mist">
          A modular monolith with an event-driven core.
        </h2>
      </Reveal>
      <Reveal delay={120}>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          One frontend + one API + a durable outbox + an in-process event bus.
          Three independent dispatch jobs fan out from a single transactional
          write — one branch can never block another. Live state reaches the
          victim UI over SSE.
        </p>
      </Reveal>

      {/* Logical flow ribbon */}
      <Reveal delay={160}>
        <div className="mt-8 rounded-2xl border border-[rgba(43,182,115,0.2)] bg-[rgba(43,182,115,0.05)] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-[#7fd6ad]">
            <Workflow className="h-3.5 w-3.5" /> Logical flow
          </div>
          <p className="text-sm leading-relaxed text-[#bcd2c6]">
            {data?.logicalFlow ??
              "PWA → API Gateway/Auth → Incident Service → transactional write → Dispatch Orchestrator → three independent jobs → SSE → victim UI."}
          </p>
        </div>
      </Reveal>

      {/* Layered architecture diagram */}
      <div className="mt-10">
        <Reveal>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Layered architecture
          </h3>
        </Reveal>
        <div className="space-y-2">
          {(data?.layers ?? DEFAULT_LAYERS).map((l, i) => (
            <Reveal key={l.name} delay={i * 60}>
              <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[180px_1fr]">
                <div
                  className="flex items-center gap-2 rounded-l-xl rounded-r-md px-4 py-3 text-sm font-semibold"
                  style={{ background: `${l.tone}1a`, color: l.tone, borderLeft: `3px solid ${l.tone}` }}
                >
                  <span className="tnum text-[10px] opacity-60">L{i + 1}</span>
                  {l.name}
                </div>
                <div className="flex flex-wrap gap-1.5 rounded-r-xl rounded-l-md border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)] px-3 py-2.5">
                  {l.components.map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-[rgba(234,243,237,0.04)] px-2 py-1 text-[11px] text-[#bcd2c6]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* 9 core domains */}
      <div className="mt-12">
        <Reveal>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Nine core domain modules
          </h3>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.domains ?? []).map((d, i) => {
            const Icon = ICONS[d.icon] ?? ShieldAlert;
            return (
              <Reveal key={d.id} delay={i * 50}>
                <div className="group h-full rounded-xl border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.45)] p-4 transition-colors hover:border-[rgba(214,158,46,0.3)]">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold text-mist">{d.name}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* 8-step SOS sequence with failure behavior */}
      <div className="mt-12">
        <Reveal>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Critical SOS sequence · with failure behavior
          </h3>
        </Reveal>
        <div className="grid gap-2 md:grid-cols-2">
          {(data?.sequence ?? []).map((s, i) => (
            <Reveal key={s.step} delay={i * 40}>
              <div className="flex gap-3 rounded-xl border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)] p-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg tnum text-sm font-bold"
                  style={{ background: `${s.tone}1a`, color: s.tone }}
                >
                  {s.step}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-mist">{s.action}</p>
                  <p className="mt-0.5 flex items-start gap-1 text-[11px] text-muted-foreground">
                    <span className="text-gold"> onFailure:</span>
                    <span>{s.failure}</span>
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* RBAC + RAG pipeline */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-gold" /> RBAC roles
            </h3>
          </Reveal>
          <div className="space-y-2">
            {(data?.roles ?? []).map((r, i) => (
              <Reveal key={r.role} delay={i * 40}>
                <div className="flex items-center gap-3 rounded-lg border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.4)] p-2.5">
                  <span
                    className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${r.tone}1a`, color: r.tone }}
                  >
                    {r.role}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.desc}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <div>
          <Reveal>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <BrainCircuit className="h-3.5 w-3.5 text-gold" /> RAG pipeline · SRS FR-5.1
            </h3>
          </Reveal>
          <Reveal delay={60}>
            <div className="rounded-xl border border-[rgba(214,158,46,0.2)] bg-[rgba(214,158,46,0.05)] p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3.5 w-3.5 text-[#4FBF9A]" /> Knowledge base
                </span>
                <span className="tnum text-2xl font-semibold text-gold">
                  {data?.rag?.corpusChunks ?? "—"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                medically-reviewed chunks · {data?.rag?.reviewedBy}
              </p>

              <div className="mt-4 space-y-2 text-xs">
                <PipeRow icon={<ChevronRight className="h-3 w-3" />} label="Retrieval" value={data?.rag?.retrieval ?? "TF-IDF"} />
                <PipeRow icon={<Cpu className="h-3 w-3" />} label="Generation" value="local GGUF via llama-cpp-python" />
                <PipeRow icon={<ShieldAlert className="h-3 w-3" />} label="Guard" value="emergency redirect to SOS" />
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                <span className="text-gold">Sources:</span> {data?.rag?.sources}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(data?.rag?.categories ?? []).map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-[rgba(234,243,237,0.05)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>

              {/* Outbox operational state — proves the event-driven core is live */}
              <div className="mt-4 border-t border-[rgba(234,243,237,0.08)] pt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Workflow className="h-3 w-3 text-[#E5484D]" /> Outbox worker
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4FBF9A]" /> live
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 tnum text-center">
                  <OutboxStat label="processed" value={data?.outbox?.PROCESSED ?? 0} tone="#4FBF9A" />
                  <OutboxStat label="pending" value={data?.outbox?.PENDING ?? 0} tone="#D69E2E" />
                  <OutboxStat label="failed" value={data?.outbox?.FAILED ?? 0} tone="#E5484D" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PipeRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded bg-[rgba(234,243,237,0.05)] text-gold">
        {icon}
      </span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-mist">{value}</span>
    </div>
  );
}

function OutboxStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-[rgba(234,243,237,0.03)] py-1.5">
      <div className="text-lg font-semibold" style={{ color: tone }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

const DEFAULT_LAYERS = [
  { name: "Client", tone: "#2BB673", components: ["React/TypeScript PWA", "Service worker", "IndexedDB"] },
  { name: "API", tone: "#4FBF9A", components: ["REST", "WebSocket/SSE", "Auth + RBAC"] },
  { name: "Core domains", tone: "#D69E2E", components: ["Incident", "Dispatch", "Routing", "..."] },
];
