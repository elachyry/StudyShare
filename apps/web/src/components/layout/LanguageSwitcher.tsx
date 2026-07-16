import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Toggles EN/FR; the choice persists via i18next's localStorage detector. */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.language.startsWith('fr') ? 'fr' : 'en';
  const next = current === 'fr' ? 'en' : 'fr';
  return (
    <button
      onClick={() => void i18n.changeLanguage(next)}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-text hover:bg-surface-2"
      aria-label={t('language.label')}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span className="uppercase">{current}</span>
    </button>
  );
}
