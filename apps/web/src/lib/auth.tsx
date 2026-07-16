import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, Permission, Role } from '@studyshare/shared';
import { can as canDo } from '@studyshare/shared';
import { authApi } from './api.js';
import { tokenStore } from './token.js';
import { http, setSessionExpiredHandler } from './http.js';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
  can: (permission: Permission) => boolean;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      // Attempt a silent refresh (uses the httpOnly cookie) to restore a session
      // across reloads, then load the current user.
      const tokens = await authApi.refresh();
      tokenStore.set(tokens.accessToken);
      setUser(tokens.user);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login({ email, password });
    tokenStore.set(tokens.accessToken);
    setUser(tokens.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await http.get<AuthUser>('/auth/me').then((r) => r.data);
    setUser(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      setUser,
      can: (permission) => (user ? canDo(user.role, permission) : false),
      hasRole: (role) => user?.role === role,
    }),
    [user, loading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
