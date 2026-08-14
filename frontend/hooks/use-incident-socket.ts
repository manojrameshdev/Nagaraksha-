'use client';
import { useEffect, useRef } from 'react';
import { createIncidentSocket } from '@/lib/realtime';
import { useSosStore } from '@/store/sos-store';

export function useIncidentSocket(incidentId: string | null) {
  const updateFromWsEvent = useSosStore((s) => s.updateFromWsEvent);
  const setWsConnected = useSosStore((s) => s.setWsConnected);
  const socketRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    if (!incidentId) return;
    socketRef.current = createIncidentSocket(incidentId, updateFromWsEvent, setWsConnected);
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
      setWsConnected(false);
    };
  }, [incidentId, updateFromWsEvent, setWsConnected]);
}
