import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../../components/layout/ThemeToggle.js';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher.js';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="flex items-center justify-between p-4">
        <Link to="/" className="flex items-center gap-2 font-heading text-lg font-bold text-text">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          {t('app.name')}
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-text">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
