import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiFetch, ApiError } from '../api';
import { server } from '../../test/setup';

describe('apiFetch', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('calls health endpoint and returns JSON', async () => {
    const result = await apiFetch<{ ok: boolean }>('/api/health');
    expect(result.ok).toBe(true);
  });

  it('throws ApiError on 401 response', async () => {
    await expect(
      apiFetch('/api/auth/token', {
        method: 'POST',
        body: JSON.stringify({ role: 'admin', secret: 'wrong' }),
      }),
    ).rejects.toThrow(ApiError);
  });

  it('attaches Authorization header when token in localStorage', async () => {
    localStorage.setItem('nagraksha_token', 'mock-jwt-token');

    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:8000/api/health', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch<{ ok: boolean }>('/api/health');
    expect(capturedAuth).toBe('Bearer mock-jwt-token');
  });

  it('sends no Authorization header when no token stored', async () => {
    let capturedAuth: string | null = 'sentinel';
    server.use(
      http.get('http://localhost:8000/api/health', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiFetch<{ ok: boolean }>('/api/health');
    expect(capturedAuth).toBeNull();
  });
});
