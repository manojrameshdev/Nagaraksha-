import { ShaderBackground } from "@/components/shader-background";
import { SnakeProgress } from "@/components/snake-progress";
import { TriLineDock, DockActiveLabel } from "@/components/tri-line-dock";
import {
  Hero,
  Problem,
  ParallelDispatch,
  HowItFlows,
  Roles,
  Prevention,
  Routing,
  Roadmap,
  SiteFooter,
  Section,
} from "@/components/sections";
import { Reveal } from "@/components/reveal";
import { LiveSosDemo, RiskPanel, SnakeId, MythBuster, StatsStrip } from "@/components/interactive";

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Illustration shader — flowing snake-scale / particle field */}
      <ShaderBackground />

      {/* The serpent IS the scroll-progress bar (left rail, desktop) */}
      <SnakeProgress />

      {/* Floating 3-line dock + active section label */}
      <DockActiveLabel />
      <TriLineDock />

      <main className="relative z-10 flex-1 pb-28">
        <Hero />
        <Problem />
        <ParallelDispatch />
        <HowItFlows />
        <Roles />

        {/* Prevention — wraps the three interactive assistants */}
        <Prevention>
          <RiskPanel />
          <div className="mt-3">
            <SnakeId />
          </div>
          <div className="mt-3">
            <MythBuster />
          </div>
        </Prevention>

        <Routing />

        {/* Live SOS demo */}
        <Section
          id="demo"
          eyebrow="Live demo"
          title="Trigger a parallel dispatch — right here."
          subtitle="This is a real round-trip through the NagRaksha backend: one tap creates an incident and three responder lanes light up at once, with antivenom-aware hospital ranking."
        >
          <Reveal>
            <LiveSosDemo />
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8">
              <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Platform analytics (admin view · demo data)
              </div>
              <StatsStrip />
            </div>
          </Reveal>
        </Section>

        <Roadmap />
      </main>

      <SiteFooter />
    </div>
  );
}
