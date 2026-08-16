'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, type Role } from '@/components/nagraksha/shell';
import { RoleWorkspace } from '@/components/nagraksha/workspaces';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useSosStore } from '@/store/sos-store';

export default function Page() {
  const [role, setRole] = useState<Role>('Victim');
  const router = useRouter();
  const { coords } = useGeolocation();
  const triggerSos = useSosStore((s) => s.triggerSos);

  async function handleSos() {
    // Fall back to Bengaluru coordinates when geolocation is denied/unavailable
    const lat = coords?.latitude ?? 12.8003;
    const lng = coords?.longitude ?? 77.5954;
    const incidentId = await triggerSos(lat, lng);
    if (incidentId) {
      router.push(`/incidents/${incidentId}`);
    }
  }

  return (
    <AppShell role={role} onRoleChange={setRole}>
      <RoleWorkspace role={role} active={false} onSos={handleSos} />
    </AppShell>
  );
}
