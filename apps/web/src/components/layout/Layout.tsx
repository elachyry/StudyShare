import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { Header } from './Header.js';

export function Layout() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {user && !user.emailVerified && (
        <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span>{t('auth.emailNotVerifiedBanner')}</span>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        {t('app.name')} · {t('app.tagline')}
      </footer>
    </div>
  );
}
