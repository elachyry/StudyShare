import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { errorCodeOf } from './http.js';

/**
 * Returns a helper that maps a failed request to a localized message. The
 * backend returns machine-readable codes (e.g. AUTH_INVALID_CREDENTIALS); we map
 * them to `errors.<CODE>` translations, falling back to a generic message.
 */
export function useApiError(): (error: unknown) => string {
  const { t } = useTranslation();
  return useCallback(
    (error: unknown) => {
      const code = errorCodeOf(error);
      const key = `errors.${code}`;
      const translated = t(key);
      return translated === key ? t('errors.INTERNAL_ERROR') : translated;
    },
    [t],
  );
}
