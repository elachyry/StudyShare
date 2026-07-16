import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, ErrorCode } from '@studyshare/shared';
import { tokenStore } from './token.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send/receive the httpOnly refresh + csrf cookies
});

const UNSAFE = new Set(['post', 'put', 'patch', 'delete']);

// ---- CSRF token (double-submit): fetched lazily, cached, refreshed on demand ----
let csrfToken: string | null = null;
async function getCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  const res = await axios.get<{ csrfToken: string }>(`${API_BASE}/auth/csrf`, {
    withCredentials: true,
  });
  csrfToken = res.data.csrfToken;
  return csrfToken;
}

http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  if (UNSAFE.has((config.method ?? 'get').toLowerCase())) {
    config.headers.set('x-csrf-token', await getCsrfToken());
  }
  return config;
});

// ---- Session-expiry handling + single-flight refresh ----
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: () => void): void {
  onSessionExpired = fn;
}

let refreshPromise: Promise<string> | null = null;
async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const csrf = await getCsrfToken(true);
      const res = await axios.post<{ accessToken: string }>(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true, headers: { 'x-csrf-token': csrf } },
      );
      tokenStore.set(res.data.accessToken);
      return res.data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    const isAuthRoute = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login');

    if (status === 401 && !original?._retried && !isAuthRoute && tokenStore.get() !== null) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers.set('Authorization', `Bearer ${token}`);
        return http(original);
      } catch {
        tokenStore.clear();
        onSessionExpired?.();
      }
    }

    // Refresh a stale CSRF token once and retry the mutation.
    if (code === 'AUTH_CSRF_INVALID' && !original?._retried) {
      original._retried = true;
      original.headers.set('x-csrf-token', await getCsrfToken(true));
      return http(original);
    }

    return Promise.reject(error);
  },
);

/** Extract a machine-readable error code from a failed request. */
export function errorCodeOf(error: unknown): ErrorCode | 'INTERNAL_ERROR' {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorBody | undefined)?.error?.code ?? 'INTERNAL_ERROR';
  }
  return 'INTERNAL_ERROR';
}
