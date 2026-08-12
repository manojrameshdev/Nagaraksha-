import { useEffect, useRef } from 'react';
import { wsUrl } from './api';
import { useSosStore } from '../store/sos-store';

export function useIncidentSocket(incidentId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { setWsConnected, updateLaneAcceptance, setSeverityInfo, addWoundReading, setPhase } = useSosStore();

  useEffect(() => {
    if (!incidentId) return;

    let isMounted = true;

    function connect() {
      if (!incidentId) return;
      const url = wsUrl(`/ws/incidents/${incidentId}`);
      console.log(`[WS] Connecting to ${url}`);

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        console.log('[WS] Connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const message = JSON.parse(event.data);
          const { event: evt, data } = message;

          if (evt === 'dispatch_accepted') {
            updateLaneAcceptance(data.responderName || data.responderPhone, data.category || 'TRAINED');
          } else if (evt === 'WOUND_UPDATE') {
            if (data.reading) {
              addWoundReading(data.reading);
            }
            if (data.currentSeverityScore !== undefined) {
              setSeverityInfo(data.currentSeverityScore, data.severityTrend, data.recommendedAntivenomVials);
            }
          } else if (evt === 'incident_state') {
            if (data.state === 'HANDED_OFF') {
              setPhase('handed_off');
            }
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WS] Socket error:', err);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.log('[WS] Connection closed. Retrying in 3s...');
        setWsConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      setWsConnected(false);
    };
  }, [incidentId, setWsConnected, updateLaneAcceptance, setSeverityInfo, addWoundReading, setPhase]);
}
