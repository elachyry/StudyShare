import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Menu, Upload, X } from 'lucide-react';
import { Permission, Role } from '@studyshare/shared';
import { useAuth } from '../../lib/auth.js';
import { Button, cn } from '../ui/index.js';
import { ThemeToggle } from './ThemeToggle.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { NotificationBell } from './NotificationBell.js';

export function Header() {
  const { t } = useTranslation();
  const { user, logout, can, hasRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/', label: t('nav.browse'), end: true },
    { to: '/requests', label: t('nav.requests') },
    ...(can(Permission.RESOURCE_MODERATE) ? [{ to: '/moderation', label: t('nav.moderation') }] : []),
    ...(hasRole(Role.ADMIN) ? [{ to: '/admin', label: t('nav.admin') }] : []),
  ];

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-accent/15 text-accent' : 'text-text hover:bg-surface-2',
    );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-text">
          <BookOpen className="h-6 w-6 text-accent" aria-hidden />
          <span className="hidden sm:inline">{t('app.name')}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {user && (
            <Button
              variant="primary"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => navigate('/upload')}
            >
              <Upload className="h-4 w-4" /> {t('nav.upload')}
            </Button>
          )}
          <LanguageSwitcher />
          <ThemeToggle />
          {user && <NotificationBell />}

          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                to="/profile"
                className="rounded-lg px-3 py-2 text-sm font-medium text-text hover:bg-surface-2"
              >
                {user.name.split(' ')[0]}
              </Link>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                {t('nav.login')}
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate('/signup')}>
                {t('nav.signup')}
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border bg-surface px-4 py-2 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={navClass}
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            {user ? (
              <>
                <NavLink to="/upload" className={navClass} onClick={() => setMobileOpen(false)}>
                  {t('nav.upload')}
                </NavLink>
                <NavLink to="/profile" className={navClass} onClick={() => setMobileOpen(false)}>
                  {t('nav.profile')}
                </NavLink>
                <button
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-text hover:bg-surface-2"
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass} onClick={() => setMobileOpen(false)}>
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/signup" className={navClass} onClick={() => setMobileOpen(false)}>
                  {t('nav.signup')}
                </NavLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
