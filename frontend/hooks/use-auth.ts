'use client';
import { useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/nagraksha';

const TOKEN_KEY = 'nagraksha_token';
const ROLE_KEY = 'nagraksha_role';

function readStoredRole(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ROLE_KEY);
}

function readStoredLogin(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(ROLE_KEY) && localStorage.getItem(TOKEN_KEY));
}

export function useAuth() {
  const [role, setRole] = useState<string | null>(readStoredRole);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(readStoredLogin);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (roleArg: string, secret: string) => {
    setLoading(true);
    setError(null);
    try {
      const { token, role: returnedRole } = await getAuthToken(roleArg, secret);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, returnedRole);
      setRole(returnedRole);
      setIsLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    setRole(null);
    setIsLoggedIn(false);
  }, []);

  return { role, isLoggedIn, login, logout, error, loading };
}
