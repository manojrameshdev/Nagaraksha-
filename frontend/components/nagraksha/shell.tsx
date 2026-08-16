'use client';
/* eslint-disable security/detect-object-injection -- static presentation-only index maps */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Ambulance,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  ShieldAlert,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ConnectivityIndicator } from './shared';
import { HealthIndicator } from '@/components/health-indicator';

export type Role =
  'Victim' | 'Responder' | 'Rescue' | 'Ambulance' | 'Hospital' | 'ASHA' | 'Stakeholder' | 'Admin';
const roleIcons: Record<Role, LucideIcon> = {
  Victim: ShieldAlert,
  Responder: Stethoscope,
  Rescue: Activity,
  Ambulance,
  Hospital: ClipboardCheck,
  ASHA: ClipboardCheck,
  Stakeholder: Users,
  Admin: LayoutDashboard,
};
const groups: Array<{ label: string; roles: Role[] }> = [
  { label: 'EMERGENCY', roles: ['Victim'] },
  { label: 'OPERATIONS', roles: ['Responder', 'Rescue', 'Ambulance', 'Hospital'] },
  { label: 'COMMUNITY', roles: ['ASHA', 'Stakeholder'] },
  { label: 'SYSTEM', roles: ['Admin'] },
];
const labels: Record<Role, string> = {
  Victim: 'Emergency home',
  Responder: 'Responder desk',
  Rescue: 'Rescue operations',
  Ambulance: 'Ambulance queue',
  Hospital: 'Hospital console',
  ASHA: 'Village audit',
  Stakeholder: 'Stakeholder registry',
  Admin: 'System overview',
};

function RoleButton({
  itemRole,
  role,
  onRoleChange,
  mobile = false,
}: {
  itemRole: Role;
  role: Role;
  onRoleChange: (_role: Role) => void;
  mobile?: boolean;
}) {
  const Icon = roleIcons[itemRole];
  return (
    <button
      type="button"
      onClick={() => onRoleChange(itemRole)}
      aria-current={role === itemRole ? 'page' : undefined}
      aria-label={mobile ? labels[itemRole] : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        mobile ? 'flex-col justify-center gap-1 px-1 text-[10px]' : 'px-3',
        role === itemRole
          ? 'bg-secondary text-primary'
          : 'text-white/70 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {mobile ? itemRole : labels[itemRole]}
    </button>
  );
}

export function WorkspaceSidebar({
  role,
  onRoleChange,
}: {
  role: Role;
  onRoleChange: (_role: Role) => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-foreground text-white lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-destructive font-black">
          N
        </div>
        <div>
          <p className="font-semibold tracking-tight">NagRaksha</p>
          <p className="text-[10px] tracking-[0.12em] text-white/55">EMERGENCY NETWORK</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-5 p-4" aria-label="Workspace navigation">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-white/40">
              {group.label}
            </p>
            <div className="grid gap-1">
              {group.roles.map((itemRole) => (
                <RoleButton
                  key={itemRole}
                  itemRole={itemRole}
                  role={role}
                  onRoleChange={onRoleChange}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <ConnectivityIndicator />
      </div>
    </aside>
  );
}
export function MobileBottomNav({
  role,
  onRoleChange,
}: {
  role: Role;
  onRoleChange: (_role: Role) => void;
}) {
  const items: Role[] = ['Victim', 'Responder', 'Rescue', 'Hospital', 'Admin'];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden"
      aria-label="Mobile workspace navigation"
    >
      {items.map((itemRole) => (
        <RoleButton
          key={itemRole}
          itemRole={itemRole}
          role={role}
          onRoleChange={onRoleChange}
          mobile
        />
      ))}
    </nav>
  );
}
export function AppShell({
  role,
  onRoleChange,
  children,
}: {
  role: Role;
  onRoleChange: (_role: Role) => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <WorkspaceSidebar role={role} onRoleChange={onRoleChange} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-destructive font-black text-primary-foreground lg:hidden">
                N
              </div>
              <div>
                <p className="text-sm font-semibold">{labels[role]}</p>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Emergency coordination network
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HealthIndicator />
              <button
                type="button"
                aria-label={menuOpen ? 'Close workspace menu' : 'Open workspace menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-workspace-menu"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-11 items-center justify-center rounded-lg border border-border bg-card text-primary lg:hidden"
              >
                {menuOpen ? (
                  <X className="size-5" aria-hidden="true" />
                ) : (
                  <Menu className="size-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </header>
          {menuOpen && (
            <div
              id="mobile-workspace-menu"
              className="border-b border-border bg-card px-4 py-4 lg:hidden"
            >
              <p className="px-2 pb-2 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">
                SWITCH WORKSPACE
              </p>
              <div className="grid gap-1">
                {groups
                  .flatMap((g) => g.roles)
                  .map((itemRole) => (
                    <button
                      key={itemRole}
                      type="button"
                      onClick={() => {
                        onRoleChange(itemRole);
                        setMenuOpen(false);
                      }}
                      aria-current={role === itemRole ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        role === itemRole
                          ? 'bg-secondary text-primary'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {(() => {
                        const Icon = roleIcons[itemRole];
                        return <Icon className="size-4" aria-hidden="true" />;
                      })()}
                      {labels[itemRole]}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
      <MobileBottomNav role={role} onRoleChange={onRoleChange} />
    </div>
  );
}
export function RoleSwitcher({
  role,
  onRoleChange,
}: {
  role: Role;
  onRoleChange: (_role: Role) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground">
      View as
      <select
        value={role}
        onChange={(event) => onRoleChange(event.target.value as Role)}
        className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {groups
          .flatMap((group) => group.roles)
          .map((itemRole) => (
            <option key={itemRole}>{itemRole}</option>
          ))}
      </select>
    </label>
  );
}
