import { useState, type ComponentType } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
import { Button, Modal, cn } from '../ui/index.js';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}
interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * Left navigation. A narrow icon rail on desktop (Studydrive-style, grouped
 * with an active blue highlight); a slide-in labeled drawer on mobile.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, logout, can, hasRole } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const groups: NavGroup[] = [
    { label: null, items: [{ to: '/', label: t('nav.browse'), icon: Compass, end: true }] },
    {
      label: t('sidebar.study'),
      items: [
        ...(user ? [{ to: '/upload', label: t('nav.upload'), icon: Upload }] : []),
        { to: '/requests', label: t('nav.requests'), icon: Inbox },
      ],
    },
    {
      label: t('sidebar.manage'),
      items: [
        ...(can(Permission.RESOURCE_MODERATE)
          ? [{ to: '/moderation', label: t('nav.moderation'), icon: ShieldCheck }]
          : []),
        ...(hasRole(Role.ADMIN) ? [{ to: '/admin', label: t('nav.admin'), icon: Settings }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  // ---- Desktop rail (icon + tiny label) ----
  const railItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      title={item.label}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          'mx-auto flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-2xl text-center text-[10px] font-semibold leading-none transition-colors',
          isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <item.icon className="h-5 w-5" />
      <span className="w-full truncate px-0.5">{item.label}</span>
    </NavLink>
  );

  const rail = (
    <aside className="hidden w-20 shrink-0 flex-col border-r border-border bg-surface py-4 lg:flex">
      <Link to="/" title={t('app.name')} className="mx-auto mb-4 block">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-sm">
          <BookOpen className="h-6 w-6" aria-hidden />
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {groups.map((g, i) => (
          <div key={g.label ?? `g${i}`} className="flex flex-col gap-1">
            {g.label && (
              <p className="mt-3 px-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted/70">
                {g.label}
              </p>
            )}
            {g.items.map(railItem)}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-col items-center gap-1 border-t border-border pt-3">
        {user ? (
          <>
            <NavLink
              to="/profile"
              title={t('nav.profile')}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                  isActive ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-accent',
                )
              }
            >
              <UserIcon className="h-5 w-5" />
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              title={t('nav.logout')}
              onClick={() => setConfirmLogout(true)}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </>
        ) : (
          <Link to="/login" title={t('nav.login')}>
            <Button variant="ghost" size="icon">
              <UserIcon className="h-5 w-5" />
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );

  // ---- Mobile drawer (icon + label rows) ----
  const drawerItem = (item: NavItem) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {item.label}
    </NavLink>
  );

  const drawer = (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden />
      <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-2 border-r border-border bg-surface p-4 shadow-xl animate-slide-up">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2 font-heading text-lg font-bold text-text"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            {t('app.name')}
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Primary">
          {groups.map((g, i) => (
            <div key={g.label ?? `g${i}`} className="flex flex-col gap-1">
              {g.label && (
                <p className="mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-muted/70">
                  {g.label}
                </p>
              )}
              {g.items.map(drawerItem)}
            </div>
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
                onClick={() => setConfirmLogout(true)}
              >
                <LogOut className="h-4 w-4" /> {t('nav.logout')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/signup" onClick={onClose}>
                <Button variant="primary" className="w-full">
                  {t('nav.signup')}
                </Button>
              </Link>
              <Link to="/login" onClick={onClose}>
                <Button variant="outline" className="w-full">
                  {t('nav.login')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <>
      {rail}
      {open && drawer}
      <Modal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title={t('nav.logout')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLogout(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmLogout(false);
                onClose();
                void logout();
              }}
            >
              {t('nav.logout')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('auth.logoutConfirm')}</p>
      </Modal>
    </>
  );
}

