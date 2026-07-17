import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';

/**
 * App shell: a fixed left sidebar + a full-height content column that fills the
 * viewport. The main region scrolls independently and spans the full width.
 */
export function Layout() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenu={() => setDrawerOpen(true)} />

        {user && !user.emailVerified && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('auth.emailNotVerifiedBanner')}</span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
