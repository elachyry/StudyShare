import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, FileText, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '../../components/layout/ThemeToggle.js';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher.js';
import { WavyBackground } from '../../components/layout/WavyBackground.js';

/**
 * Split-screen auth layout (Studydrive-style): a decorative wavy brand aside on
 * the left (hidden on small screens) and the form card on a light-gray panel on
 * the right.
 */
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

  const features = [
    { icon: FileText, label: t('authAside.featureShare') },
    { icon: Inbox, label: t('authAside.featureRequest') },
    { icon: GraduationCap, label: t('authAside.featureLearn') },
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Brand aside */}
      <aside className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden bg-surface lg:flex">
        <WavyBackground className="text-accent/10" />
        <div className="relative z-10 flex max-w-md flex-col items-center px-8 text-center">
          <Link to="/" className="mb-8 flex items-center gap-2 font-heading text-2xl font-extrabold text-text">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-md">
              <BookOpen className="h-6 w-6" aria-hidden />
            </span>
            {t('app.name')}
          </Link>
          <h1 className="text-4xl font-extrabold text-text">{t('authAside.headline')}</h1>
          <p className="mt-3 text-muted">{t('authAside.subtitle')}</p>

          <ul className="mt-10 flex flex-col gap-5">
            {features.map((f) => (
              <li key={f.label} className="flex items-center gap-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-border">
                  <f.icon className="h-5 w-5 text-accent" aria-hidden />
                </span>
                <span className="text-sm font-medium text-text">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center justify-end gap-1 p-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            {/* Mobile logo (aside is hidden < lg) */}
            <Link
              to="/"
              className="mb-6 flex items-center justify-center gap-2 font-heading text-xl font-extrabold text-text lg:hidden"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg">
                <BookOpen className="h-5 w-5" aria-hidden />
              </span>
              {t('app.name')}
            </Link>
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-extrabold text-text">{title}</h2>
                {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
