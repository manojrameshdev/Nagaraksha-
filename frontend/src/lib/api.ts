/**
 * API helper — the NagRaksha backend is a separate Python FastAPI service on
 * port 8000. The Caddy gateway routes ?XTransformPort=8000 to that port.
 * All API calls use relative paths + the XTransformPort query (never an
 * absolute http://localhost:8000 URL, per the gateway rules).
 */
export const API_PORT = '8000';

/** Append ?XTransformPort=8000 to a relative API path. */
export function apiUrl(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}XTransformPort=${API_PORT}`;
}
