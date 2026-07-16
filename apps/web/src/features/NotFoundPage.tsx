import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/index.js';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <p className="text-muted">{t('errors.NOT_FOUND')}</p>
      <Link to="/">
        <Button>{t('nav.browse')}</Button>
      </Link>
    </div>
  );
}
