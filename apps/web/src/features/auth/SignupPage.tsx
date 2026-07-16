import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signupSchema, type SignupInput } from '@studyshare/shared';
import { authApi } from '../../lib/api.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { AuthShell } from './AuthShell.js';
import { GoogleButton } from './GoogleButton.js';
import { Button, Input } from '../../components/ui/index.js';

export function SignupPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const apiError = useApiError();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.signup(values);
      toast.success(t('auth.signupSuccess'));
      reset();
    } catch (err) {
      toast.error(apiError(err));
    }
  });

  return (
    <AuthShell title={t('auth.signupTitle')} subtitle={t('auth.signupSubtitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label={t('auth.name')}
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          type="email"
          label={t('auth.email')}
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          type="password"
          label={t('auth.password')}
          autoComplete="new-password"
          hint="Min 10 chars with upper, lower, number & symbol"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting}>
          {t('nav.signup')}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        {t('auth.or')}
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-accent hover:underline">
          {t('nav.login')}
        </Link>
      </p>
    </AuthShell>
  );
}
