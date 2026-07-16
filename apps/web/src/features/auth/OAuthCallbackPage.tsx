import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tokenStore } from '../../lib/token.js';
import { useAuth } from '../../lib/auth.js';
import { Spinner } from '../../components/ui/index.js';

/**
 * Receives the Google OAuth result. The API set the refresh cookie and appended
 * the access token in the URL fragment (kept out of logs/referrers). We store it
 * and load the user, then redirect home.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('access_token');
    if (token) {
      tokenStore.set(token);
      refreshUser()
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/login?error=AUTH_OAUTH_FAILED', { replace: true }));
    } else {
      navigate('/login?error=AUTH_OAUTH_FAILED', { replace: true });
    }
  }, [navigate, refreshUser]);

  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-muted">
      <Spinner className="h-6 w-6" /> {t('common.loading')}
    </div>
  );
}
