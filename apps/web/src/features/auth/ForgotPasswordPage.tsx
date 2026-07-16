import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema } from '@studyshare/shared';
import { authApi } from '../../lib/api.js';
import { AuthShell } from './AuthShell.js';
import { Button, Input } from '../../components/ui/index.js';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await authApi.forgotPassword(values.email);
    setSent(true);
  });

  return (
    <AuthShell title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-text">{t('auth.forgotSent')}</p>
          <Link to="/login">
            <Button variant="outline">{t('nav.login')}</Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            type="email"
            label={t('auth.email')}
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" loading={isSubmitting}>
            {t('common.submit')}
          </Button>
          <Link to="/login" className="text-center text-sm text-accent hover:underline">
            {t('common.back')}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
