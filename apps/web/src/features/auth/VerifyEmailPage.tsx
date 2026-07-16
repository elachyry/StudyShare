import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { authApi } from '../../lib/api.js';
import { AuthShell } from './AuthShell.js';
import { Button, Spinner } from '../../components/ui/index.js';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard StrictMode double-invoke
    ran.current = true;
    const token = params.get('token');
    if (!token) {
      setState('error');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [params]);

  return (
    <AuthShell title={t('auth.verifyTitle')}>
      <div className="flex flex-col items-center gap-4 text-center">
        {state === 'loading' && (
          <>
            <Spinner className="h-8 w-8" />
            <p className="text-muted">{t('auth.verifying')}</p>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-text">{t('auth.verifySuccess')}</p>
            <Link to="/login">
              <Button>{t('nav.login')}</Button>
            </Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-danger" />
            <p className="text-text">{t('auth.verifyError')}</p>
            <Link to="/login">
              <Button variant="outline">{t('nav.login')}</Button>
            </Link>
          </>
        )}
      </div>
    </AuthShell>
  );
}
