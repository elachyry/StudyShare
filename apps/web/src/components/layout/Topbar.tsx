import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Upload } from 'lucide-react';
import { useAuth } from '../../lib/auth.js';
import { Button } from '../ui/index.js';
import { ThemeToggle } from './ThemeToggle.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { NotificationBell } from './NotificationBell.js';

/** Slim top bar: mobile menu toggle on the left, utility controls on the right. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-4 backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label={t('nav.browse')}
      >
        <Menu className="h-5 w-5" />
      </Button>

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
      </div>
    </header>
  );
}
