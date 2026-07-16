import { useTranslation } from 'react-i18next';

/**
 * Starts the Google OAuth Authorization Code flow by navigating to the API's
 * start-redirect route. The API redirects back to /oauth/callback with the
 * access token in the URL fragment.
 */
export function GoogleButton() {
  const { t } = useTranslation();
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  return (
    <a
      href={`${base}/api/auth/google`}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium text-text transition-colors hover:bg-surface-2"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06L5.84 9.9C6.71 7.3 9.14 4.75 12 4.75Z"
        />
      </svg>
      {t('auth.continueWithGoogle')}
    </a>
  );
}
