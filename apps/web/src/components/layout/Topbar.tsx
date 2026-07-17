import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Plus, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { Button, Input } from '../ui/index.js';
import { ThemeToggle } from './ThemeToggle.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { NotificationBell } from './NotificationBell.js';

/** Top bar: mobile menu toggle, a prominent global search, and utility controls. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label={t('topbar.search')}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/?q=${encodeURIComponent(q.trim())}`);
        }}
        className="relative mx-auto w-full max-w-2xl"
        role="search"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('topbar.search')}
          className="h-11 rounded-full bg-surface-2 pl-10"
          aria-label={t('common.search')}
        />
      </form>

      <div className="flex items-center gap-1">
        {user && (
          <Button
            variant="primary"
            className="hidden sm:inline-flex"
            onClick={() => navigate('/upload')}
          >
            <Plus className="h-4 w-4" /> {t('topbar.add')}
          </Button>
        )}
        <LanguageSwitcher />
        <ThemeToggle />
        {user && <NotificationBell />}
      </div>
    </header>
  );
}
