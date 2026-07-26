import { ShaderBackground } from '@/components/shader-background';
import { SnakeProgress } from '@/components/snake-progress';
import { TriLineDock, DockActiveLabel } from '@/components/tri-line-dock';
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
} from '@/components/sections';
import {
  LazyArchitecture,
  LazyLiveSosDemo,
  LazyBackendPanels,
  LazyKnowledgeBase,
  LazyStatsStrip,
  LazyRiskPanel,
  LazySnakeId,
  LazyMythBuster,
} from '@/components/lazy-sections';
import { Reveal } from '@/components/reveal';

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

        {/* Prevention — wraps the three lazy-loaded assistants */}
        <Prevention>
          <LazyRiskPanel />
          <div className="mt-3">
            <LazySnakeId />
          </div>
          <div className="mt-3">
            <LazyMythBuster />
          </div>
        </Prevention>

        <Routing />

        {/* System architecture — lazy-loaded (code-split) */}
        <LazyArchitecture />

        {/* Live SOS demo — lazy-loaded */}
        <Section
          id="demo"
          eyebrow="Live demo"
          title="Trigger a parallel dispatch — right here."
          subtitle="This is a real round-trip through the NagRaksha backend: one tap creates an incident, appends an IncidentCreated event to the durable outbox, and three responder lanes fan out over the event bus — with antivenom-aware hospital ranking and a live SSE state stream."
        >
          <Reveal>
            <LazyLiveSosDemo />
          </Reveal>

          {/* Backend visibility panels — lazy-loaded */}
          <Reveal delay={120}>
            <LazyBackendPanels />
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-4">
              <LazyKnowledgeBase />
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-8">
              <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                Platform analytics (admin view · demo data)
              </div>
              <LazyStatsStrip />
            </div>
          </Reveal>
        </Section>

        <Roadmap />
      </main>

      <SiteFooter />
    </div>
  );
}
