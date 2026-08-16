import { BACKEND_URL } from './api';

export interface IncidentSocketEvent {
  // Backend broadcasts uppercase for venom score & referral events; legacy dispatch events are lowercase — keep them all.
  event:
    | 'dispatch_attempted'
    | 'dispatch_accepted'
    | 'incident_state'
    | 'VENOM_SCORE_UPDATE'
    | 'REFERRAL_CREATED'
    | 'REFERRAL_ACCEPTED'
    | 'REFERRAL_DECLINED'
    | 'TRANSPORT_STARTED'
    | 'PATIENT_ARRIVED';
  data: Record<string, unknown>;
}

export interface IncidentSocket {
  close: () => void;
}

export function createIncidentSocket(
  incidentId: string,
  onMessage: (_e: IncidentSocketEvent) => void,
  onStatusChange?: (_connected: boolean) => void,
): IncidentSocket {
  const wsBase = BACKEND_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws'));
  let ws: WebSocket;
  let closed = false;
  let pingInterval: ReturnType<typeof setInterval>;

  function connect() {
    ws = new WebSocket(`${wsBase}/ws/incidents/${incidentId}`);
    ws.onopen = () => {
      onStatusChange?.(true);
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 10_000);
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data) as IncidentSocketEvent;
        onMessage(parsed);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      clearInterval(pingInterval);
      onStatusChange?.(false);
      if (!closed) setTimeout(connect, 2_000);
    };
    ws.onerror = () => ws.close();
  }

  connect();
  return {
    close: () => {
      closed = true;
      clearInterval(pingInterval);
      ws?.close();
    },
  };
}
