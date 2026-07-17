import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Compass,
  Inbox,
  Upload,
  ShieldCheck,
  Settings,
  User as UserIcon,
  LogOut,
  X,
} from 'lucide-react';
import { Permission, Role } from '@studyshare/shared';
import { useAuth } from '../../lib/auth.js';
import { Button, cn } from '../ui/index.js';

/**
 * Left navigation sidebar. Fixed on desktop; a slide-in drawer on mobile
 * (controlled by `open`/`onClose` from the Layout).
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, logout, can, hasRole } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', label: t('nav.browse'), icon: Compass, end: true },
    { to: '/requests', label: t('nav.requests'), icon: Inbox },
    ...(user ? [{ to: '/upload', label: t('nav.upload'), icon: Upload }] : []),
    ...(can(Permission.RESOURCE_MODERATE)
      ? [{ to: '/moderation', label: t('nav.moderation'), icon: ShieldCheck }]
      : []),
    ...(hasRole(Role.ADMIN) ? [{ to: '/admin', label: t('nav.admin'), icon: Settings }] : []),
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-accent text-accent-fg shadow-sm'
        : 'text-muted hover:bg-surface-2 hover:text-text',
    );

  const content = (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          onClick={onClose}
          className="flex items-center gap-2 font-heading text-lg font-bold text-text"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-sm">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          {t('app.name')}
        </Link>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose} aria-label={t('common.close')}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1" aria-label="Primary">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={onClose}>
            <l.icon className="h-5 w-5 shrink-0" aria-hidden />
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border pt-3">
        {user ? (
          <div className="flex flex-col gap-2">
            <Link
              to="/profile"
              onClick={onClose}
              className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-accent">
                <UserIcon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">{user.name}</span>
                <span className="block text-xs text-muted">{user.role}</span>
              </span>
            </Link>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                onClose();
                void logout();
              }}
            >
              <LogOut className="h-4 w-4" /> {t('nav.logout')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => { onClose(); navigate('/signup'); }}>
              {t('nav.signup')}
            </Button>
            <Button variant="outline" onClick={() => { onClose(); navigate('/login'); }}>
              {t('nav.login')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixed rail */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        {content}
      </aside>

      {/* Mobile: drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-border bg-surface shadow-xl animate-slide-up">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
