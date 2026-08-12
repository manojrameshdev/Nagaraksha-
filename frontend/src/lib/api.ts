/**
 * API helper — the NagRaksha backend is a separate Python FastAPI service.
 * In local dev set NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 in .env.local
 * In production Railway sets this to the backend service URL.
 * No more XTransformPort gateway artifact.
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

/** Build an absolute URL to a backend API path. */
export function apiUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

/** Build a WebSocket URL (ws:// or wss://) for a backend path. */
export function wsUrl(path: string): string {
  const base = BACKEND_URL.replace(/^http/, 'ws');
  return `${base}${path}`;
}
