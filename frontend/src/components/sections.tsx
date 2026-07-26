"use client";

import Image from "next/image";
import {
  AlertOctagon,
  Split,
  Workflow,
  Users,
  BrainCircuit,
  Route as RouteIcon,
  ShieldCheck,
  MapPin,
  Clock,
  Activity,
  Droplet,
  Stethoscope,
  Truck,
  Bug,
  CloudSun,
  Smartphone,
  WifiOff,
  BadgeCheck,
  AlertTriangle,
  ArrowDown,
  HeartPulse,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlitherSprite } from "@/components/slither-sprite";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ HERO */
export function Hero() {
  return (
    <section
      id="hero"
      className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-center px-5 pb-24 pt-28 md:px-8"
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <Reveal>
            <Badge
              variant="outline"
              className="mb-5 gap-2 border-[rgba(43,182,115,0.4)] bg-[rgba(43,182,115,0.08)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7fd6ad]"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2BB673]" />
              Nagathon · 2026 · PWA
            </Badge>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-sans text-[clamp(2.6rem,7vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.025em] text-mist">
              <span className="text-forest-gradient">Nag</span>
              <span className="text-gold-gradient">Raksha</span>
              <span className="mt-2 block text-[clamp(1.05rem,2.2vw,1.5rem)] font-normal tracking-normal text-muted-foreground">
                Parallel-dispatch emergency response — and prevention — for
                snakebites in India.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#bcd2c6]">
              One tap. Three responders dispatched{" "}
              <span className="font-medium text-mist">at the same instant</span>{" "}
              — a trained village first responder, a rescue team, and an
              ambulance routed to the nearest hospital that actually has
              antivenom. Software only. No new hardware.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#demo">
                <Button
                  size="lg"
                  className="sos-pulse h-14 gap-3 rounded-2xl bg-[#B42318] px-7 text-[15px] font-semibold tracking-wide text-white hover:bg-[#9c1e15]"
                >
                  <ShieldCheck className="h-5 w-5" />
                  Trigger SOS Demo
                </Button>
              </a>
              <a href="#prevention">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 gap-3 rounded-2xl border-[rgba(214,158,46,0.4)] bg-[rgba(214,158,46,0.06)] px-6 text-[15px] font-medium text-gold hover:bg-[rgba(214,158,46,0.12)]"
                >
                  <Bug className="h-5 w-5" />
                  Identify a snake
                </Button>
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <HeroStat value="58,000+" label="snakebite deaths / yr in India" tone="red" />
              <HeroStat value="3" label="responders dispatched in parallel" tone="green" />
              <HeroStat value="<5s" label="SOS fan-out target" tone="gold" />
              <HeroStat value="0" label="custom hardware required" tone="muted" />
            </div>
          </Reveal>
        </div>

        <div className="hidden lg:block" />
      </div>
    </section>
  );
}

function HeroStat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "red" | "green" | "gold" | "muted";
}) {
  const color =
    tone === "red"
      ? "text-[#E5484D]"
      : tone === "green"
      ? "text-[#4FBF9A]"
      : tone === "gold"
      ? "text-gold"
      : "text-muted-foreground";
  return (
    <div className="flex flex-col">
      <span className={cn("tnum text-2xl font-semibold leading-none md:text-3xl", color)}>
        {value}
      </span>
      <span className="mt-1.5 max-w-[140px] text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- PROBLEM */
export function Problem() {
  const items = [
    {
      icon: AlertOctagon,
      tone: "#E5484D",
      stat: "58,000+",
      label: "deaths from snakebite in India every year",
      note: "among the highest snakebite mortality in the world.",
    },
    {
      icon: HeartPulse,
      tone: "#D69E2E",
      stat: "1st stop",
      label: "for many victims is still a traditional healer, not a hospital",
      note: "the lost first hour is the deadliest.",
    },
    {
      icon: Split,
      tone: "#4FBF9A",
      stat: "1 of 4",
      label: "responder types is contacted at a time today — never all three",
      note: "no single existing app dispatches in parallel.",
    },
  ];
  return (
    <Section id="problem" eyebrow="The problem" title="It isn't awareness. It's the first hour.">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 90}>
            <div className="group relative h-full overflow-hidden rounded-2xl glass p-6">
              <div
                className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
                style={{ background: it.tone }}
              />
              <it.icon className="h-7 w-7" style={{ color: it.tone }} />
              <div className="tnum mt-5 text-4xl font-semibold" style={{ color: it.tone }}>
                {it.stat}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#bcd2c6]">{it.label}</p>
              <p className="mt-3 text-xs text-muted-foreground">{it.note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          Existing apps —{" "}
          <span className="text-mist">SARPA, SERPENT, Snakepedia, The Snakebite Assistant</span>{" "}
          — each solve one piece: a hospital locator, a species guide, a
          myth-buster, or clinical tiers. None route to three responders at
          once, and none make hospital routing depend on whether antivenom is
          actually in stock.
        </p>
      </Reveal>
    </Section>
  );
}

/* ----------------------------------------------------------- PARALLEL DISPATCH */
export function ParallelDispatch() {
  const lanes = [
    {
      tag: "Trained Individual",
      role: "Village-level first responder",
      icon: Stethoscope,
      tone: "#2BB673",
      action: "First aid + structured symptom log",
      delay: "accepts ≈ 6s",
    },
    {
      tag: "Rescue Team",
      role: "Certified snake capture & release",
      icon: Bug,
      tone: "#D69E2E",
      action: "Safe capture, species logged, released",
      delay: "accepts ≈ 12s",
    },
    {
      tag: "Ambulance / Hospital",
      role: "Transport + antivenom-aware routing",
      icon: Truck,
      tone: "#E5484D",
      action: "Routed to confirmed-stock hospital",
      delay: "accepts ≈ 8s",
    },
  ];
  return (
    <Section
      id="parallel"
      eyebrow="The core idea"
      title="One SOS. Three responders. In parallel."
      subtitle="The defining NagRaksha requirement (FR-1.2): all three responder categories are notified at the same instant — no queueing, no single point of failure."
    >
      <Reveal delay={60}>
        <div className="mb-8 flex flex-col items-center gap-3">
          <SlitherSprite size={260} className="drop-shadow-[0_10px_30px_rgba(214,158,46,0.25)]" />
          <p className="text-center text-xs text-muted-foreground">
            6 slither frames · cycled from a generated sprite · the serpent
            quickens as you scroll
          </p>
        </div>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-3">
        {lanes.map((l, i) => (
          <Reveal key={l.tag} delay={i * 110}>
            <div className="relative h-full overflow-hidden rounded-2xl border border-[rgba(234,243,237,0.08)] bg-[rgba(16,42,32,0.6)] p-6">
              <div
                className="absolute left-0 top-0 h-1 w-full"
                style={{ background: l.tone }}
              />
              <div className="flex items-center justify-between">
                <l.icon className="h-7 w-7" style={{ color: l.tone }} />
                <Badge
                  variant="outline"
                  className="border-[rgba(234,243,237,0.12)] text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  lane {i + 1}
                </Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-mist">{l.tag}</h3>
              <p className="text-sm text-muted-foreground">{l.role}</p>
              <div className="mt-4 rounded-lg bg-[rgba(234,243,237,0.04)] p-3 text-xs text-[#bcd2c6]">
                {l.action}
              </div>
              <div className="tnum mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" style={{ color: l.tone }} />
                {l.delay}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <span className="text-gold">Three lines.</span> Three lanes. The dock's
          active marker is built from three stacked strokes — one for each
          responder dispatched at once.
        </p>
      </Reveal>
    </Section>
  );
}

/* -------------------------------------------------------------- HOW IT FLOWS */
export function HowItFlows() {
  const steps = [
    { t: "SOS triggered", d: "Victim taps once. GPS attached. No mandatory text.", icon: ShieldCheck, tone: "#E5484D" },
    { t: "Incident created", d: "Backend commits, then returns an incident id (atomic).", icon: Activity, tone: "#2BB673" },
    { t: "Three jobs fan out", d: "Independent dispatch workers — one branch cannot block another.", icon: Split, tone: "#D69E2E" },
    { t: "Responders accept", d: "Compare-and-set acceptance prevents double-claims.", icon: Users, tone: "#4FBF9A" },
    { t: "Hospital pre-alert", d: "Symptom log + suspected species delivered before arrival.", icon: Stethoscope, tone: "#7fd6ad" },
    { t: "Handoff", d: "Full timestamped audit trail preserved (NFR-8).", icon: BadgeCheck, tone: "#E0B443" },
  ];
  return (
    <Section
      id="flow"
      eyebrow="How an SOS moves"
      title="A transactional, audited path — not a phone tree."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.t} delay={i * 70}>
            <div className="flex h-full gap-3 rounded-xl border border-[rgba(234,243,237,0.07)] bg-[rgba(16,42,32,0.45)] p-4">
              <div className="flex flex-col items-center">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: `${s.tone}1a`, color: s.tone }}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                {i < steps.length - 1 && (
                  <div className="mt-1 h-full w-px flex-1 bg-[rgba(234,243,237,0.08)]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="tnum text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-sm font-semibold text-mist">{s.t}</h3>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- ROLES */
export function Roles() {
  const roles = [
    {
      title: "Public / Victim",
      icon: Smartphone,
      tone: "#E5484D",
      bullets: ["One-tap SOS button", "Optional snake photo", "Live ETA of nearest responder"],
    },
    {
      title: "Trained Individual",
      icon: Stethoscope,
      tone: "#2BB673",
      bullets: ["Location + navigation on accept", "Species-specific first-aid checklist", "Structured symptom logging"],
    },
    {
      title: "Rescue Team",
      icon: Bug,
      tone: "#D69E2E",
      bullets: ["Parallel alert, same location", "Log captured species", "Safe release tracking"],
    },
    {
      title: "Ambulance / Hospital",
      icon: Truck,
      tone: "#4FBF9A",
      bullets: ["Turn-by-turn shortest path", "Antivenom-aware hospital ranking", "Pre-arrival case + symptom handoff"],
    },
  ];
  return (
    <Section id="roles" eyebrow="Roles" title="Every responder gets exactly the view they need.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r, i) => (
          <Reveal key={r.title} delay={i * 90}>
            <div className="group relative h-full overflow-hidden rounded-2xl glass p-5 transition-transform duration-300 hover:-translate-y-1">
              <div
                className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${r.tone}1a`, color: r.tone }}
              >
                <r.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-mist">{r.title}</h3>
              <ul className="mt-3 space-y-2">
                {r.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span
                      className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full"
                      style={{ background: r.tone }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- PREVENTION (wrap) */
export function Prevention({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <Section
      id="prevention"
      eyebrow="Prevention layer"
      title="Fully software. No added hardware."
      subtitle="The prevention layer sits below the emergency path and never blocks it — photo identification never becomes a required step."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Reveal>
          <div className="h-full rounded-2xl border border-[rgba(214,158,46,0.18)] bg-[rgba(214,158,46,0.05)] p-6">
            <CloudSun className="h-6 w-6 text-gold" />
            <h3 className="mt-3 text-base font-semibold text-mist">Weather-Based Risk</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Combines location, season and public weather-API data into an
              encounter-risk advisory for people heading into the field.
            </p>
            <div className="mt-4">{children}</div>
          </div>
        </Reveal>
        <Reveal delay={90}>
          <div className="h-full rounded-2xl border border-[rgba(43,182,115,0.18)] bg-[rgba(43,182,115,0.05)] p-6">
            <Bug className="h-6 w-6 text-[#4FBF9A]" />
            <h3 className="mt-3 text-base font-semibold text-mist">Snake ID by Photo</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Uses the phone's existing camera — no external sensor — to classify
              a photographed snake and flag identification confidence honestly.
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="h-full rounded-2xl border border-[rgba(229,72,77,0.18)] bg-[rgba(229,72,77,0.05)] p-6">
            <BrainCircuit className="h-6 w-6 text-[#E5484D]" />
            <h3 className="mt-3 text-base font-semibold text-mist">AI Myth Buster</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Conversational assistant answers snake and snakebite questions,
              corrects folk-remedy myths, and redirects urgent questions straight
              to the SOS flow.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={120}>
        <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
          Deliberately excluded from this build: custom motion/thermal-camera
          sensors and a physical venom test kit. The system is scoped as
          software running on devices people already own.
        </p>
      </Reveal>
    </Section>
  );
}

/* --------------------------------------------------------- ANTIVENOM ROUTING */
export function Routing() {
  const steps = [
    { n: "1", t: "Hospitals update", d: "Antivenom stock levels updated in their console, in real time.", icon: Droplet },
    { n: "2", t: "System ranks", d: "Hospitals ranked by confirmed stock first, travel time second.", icon: BadgeCheck },
    { n: "3", t: "Dijkstra routing", d: "Shortest path & ETA computed to the top-ranked hospital.", icon: RouteIcon },
    { n: "4", t: "Pre-arrival handoff", d: "Doctor receives symptom log & suspected species before the victim arrives.", icon: Stethoscope },
  ];
  return (
    <Section
      id="routing"
      eyebrow="Antivenom-aware routing"
      title="Routing that knows where the antivenom actually is."
      subtitle="Distance alone can send a victim to the wrong hospital. NagRaksha maintains a live, hospital-updatable antivenom registry and folds it directly into route selection."
    >
      <div className="grid gap-4 md:grid-cols-4">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="relative h-full rounded-2xl glass p-5">
              <div className="tnum absolute right-4 top-3 text-3xl font-bold text-[rgba(214,158,46,0.18)]">
                {s.n}
              </div>
              <s.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-3 text-sm font-semibold text-mist">{s.t}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{s.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- ROADMAP */
export function Roadmap() {
  const phases = [
    {
      p: "Phase 1",
      d: "SOS trigger, parallel dispatch, trained-individual & ambulance apps, basic hospital routing.",
      done: true,
    },
    {
      p: "Phase 2",
      d: "Antivenom registry, Dijkstra-based hospital ranking, symptom hand-off.",
      done: true,
    },
    {
      p: "Phase 3",
      d: "AI myth-buster, snake photo ID, weather-based risk advisory.",
      done: false,
      current: true,
    },
    {
      p: "Phase 4",
      d: "Multi-district rollout, admin analytics, funding-report automation.",
      done: false,
    },
  ];
  return (
    <Section id="roadmap" eyebrow="Roadmap" title="From hackathon MVP to a coverage network.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {phases.map((ph, i) => (
          <Reveal key={ph.p} delay={i * 80}>
            <div
              className={cn(
                "h-full rounded-2xl border p-5",
                ph.current
                  ? "border-[rgba(214,158,46,0.4)] bg-[rgba(214,158,46,0.08)]"
                  : ph.done
                  ? "border-[rgba(43,182,115,0.25)] bg-[rgba(43,182,115,0.06)]"
                  : "border-[rgba(234,243,237,0.08)] bg-[rgba(16,42,32,0.4)]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="tnum text-xs uppercase tracking-wider text-muted-foreground">
                  {ph.p}
                </span>
                {ph.done && <BadgeCheck className="h-4 w-4 text-[#4FBF9A]" />}
                {ph.current && (
                  <span className="rounded-full bg-[rgba(214,158,46,0.2)] px-2 py-0.5 text-[10px] font-medium text-gold">
                    in build
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#bcd2c6]">{ph.d}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <PwaCard icon={Smartphone} title="Installable PWA" body="Add to home screen for an app-like, standalone experience — no app store." />
          <PwaCard icon={WifiOff} title="Offline shell" body="The emergency shell loads first and never produces a false-success state." />
          <PwaCard icon={MapPin} title="Coverage model" body="One trained individual covers multiple villages within a ~10 km radius." />
        </div>
      </Reveal>
    </Section>
  );
}

function PwaCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl glass p-5">
      <Icon className="h-5 w-5 text-[#4FBF9A]" />
      <h4 className="mt-3 text-sm font-semibold text-mist">{title}</h4>
      <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ FOOTER */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[rgba(234,243,237,0.08)] bg-[rgba(8,20,15,0.6)] backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                <span className="text-forest-gradient">Nag</span>
                <span className="text-gold-gradient">Raksha</span>
              </span>
              <span className="rounded-full bg-[rgba(43,182,115,0.12)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#7fd6ad]">
                PWA
              </span>
            </div>
            <p className="mt-2 max-w-md text-xs text-muted-foreground">
              A software-only emergency coordination platform for snakebites in
              India. Calm urgency, clinical clarity, rural accessibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#4FBF9A]" /> Demo data only</span>
            <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-gold" /> Team Nagathon · Bengaluru</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#E5484D]" /> Nagathon 2026</span>
          </div>
        </div>
        <div className="mt-8 border-t border-[rgba(234,243,237,0.06)] pt-6 text-[11px] text-muted-foreground">
          Never rely on a single app during a medical emergency. In a real
          snakebite, contact your local emergency number and get to a hospital
          immediately. NagRaksha is a demonstration prototype.
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------- SECTION SHELL */
export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-7xl scroll-mt-6 px-5 py-20 md:px-8 md:py-28">
      <Reveal>
        <div className="mb-3 flex items-center gap-2">
          <span className="h-px w-8 bg-gradient-to-r from-[#2BB673] to-[#D69E2E]" />
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-gold">
            {eyebrow}
          </span>
        </div>
      </Reveal>
      <Reveal delay={60}>
        <h2 className="max-w-3xl text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold leading-tight tracking-[-0.02em] text-mist">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={120}>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </Reveal>
      )}
      <div className="mt-10">{children}</div>
    </section>
  );
}
