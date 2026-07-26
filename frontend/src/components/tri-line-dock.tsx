'use client';

import { useState } from 'react';
import {
  ShieldAlert as _ShieldAlert,
  AlertOctagon,
  Split,
  Workflow,
  Users,
  BrainCircuit,
  Route,
  PlayCircle,
  Map,
  Home,
  Network,
} from 'lucide-react';
import { useActiveSection } from '@/hooks/use-scroll';
import { cn } from '@/lib/utils';

export const DOCK_SECTIONS = [
  { id: 'hero', label: 'Home', icon: Home },
  { id: 'problem', label: 'Problem', icon: AlertOctagon },
  { id: 'parallel', label: 'Parallel', icon: Split },
  { id: 'flow', label: 'Flow', icon: Workflow },
  { id: 'roles', label: 'Roles', icon: Users },
  { id: 'prevention', label: 'Prevention', icon: BrainCircuit },
  { id: 'routing', label: 'Routing', icon: Route },
  { id: 'architecture', label: 'Architecture', icon: Network },
  { id: 'demo', label: 'Live SOS', icon: PlayCircle },
  { id: 'roadmap', label: 'Roadmap', icon: Map },
] as const;

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** The three stacked lines = the 3 parallel responder lanes. */
function TriLines({ active }: { active: boolean }) {
  return (
    <span
      className="pointer-events-none absolute -top-[9px] left-1/2 flex -translate-x-1/2 flex-col items-center gap-[2px]"
      aria-hidden
    >
      <span
        className={cn(
          'h-[2px] rounded-full bg-gold transition-all duration-300',
          active ? 'w-[18px] opacity-100' : 'w-0 opacity-0',
        )}
      />
      <span
        className={cn(
          'h-[2px] rounded-full bg-[var(--forest)] transition-all duration-300',
          active ? 'w-[14px] opacity-100 delay-75' : 'w-0 opacity-0',
        )}
      />
      <span
        className={cn(
          'h-[2px] rounded-full bg-[var(--red-bright)] transition-all duration-300',
          active ? 'w-[10px] opacity-100 delay-150' : 'w-0 opacity-0',
        )}
      />
    </span>
  );
}

export function TriLineDock() {
  const ids = DOCK_SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <nav
      aria-label="Section navigation"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3"
    >
      <div
        className="glass-strong flex max-w-[min(96vw,640px)] items-center gap-0.5 overflow-x-auto rounded-2xl p-1.5 shadow-2xl"
        style={{ scrollbarWidth: 'none' }}
      >
        {DOCK_SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              aria-label={s.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex min-w-[46px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2 transition-all',
                isActive
                  ? 'bg-[rgba(43,182,115,0.14)] text-mist'
                  : 'text-muted-foreground hover:bg-[rgba(234,243,237,0.06)] hover:text-mist',
              )}
            >
              <TriLines active={isActive || hovered === s.id} />
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              <span
                className={cn(
                  'hidden text-[10px] font-medium tracking-wide sm:block',
                  isActive ? 'text-gold' : 'text-current',
                )}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Compact top-bar label shown above dock on mobile when a section is active. */
export function DockActiveLabel() {
  const ids = DOCK_SECTIONS.map((s) => s.id);
  const active = useActiveSection(ids);
  const current = DOCK_SECTIONS.find((s) => s.id === active);
  if (!current) return null;
  const Icon = current.icon;
  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-40 hidden -translate-x-1/2 items-center gap-2 rounded-full glass px-3 py-1.5 text-xs text-muted-foreground sm:flex">
      <Icon className="h-3.5 w-3.5 text-gold" />
      <span className="tnum tracking-wide">{current.label}</span>
    </div>
  );
}
