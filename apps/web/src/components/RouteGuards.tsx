import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Permission, Role } from '@studyshare/shared';
import { useAuth } from '../lib/auth.js';
import { Spinner } from './ui/index.js';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/** Require an authenticated session; otherwise redirect to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

/** Require a permission (from the shared matrix) or a minimum role. */
export function RequirePermission({
  permission,
  role,
  children,
}: {
  permission?: Permission;
  role?: Role;
  children: ReactNode;
}) {
  const { user, loading, can, hasRole } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  const ok = (permission ? can(permission) : true) && (role ? hasRole(role) : true);
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}
