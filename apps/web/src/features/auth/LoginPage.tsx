import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginInput } from '@studyshare/shared';
import { useAuth } from '../../lib/auth.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { AuthShell } from './AuthShell.js';
import { GoogleButton } from './GoogleButton.js';
import { Button, Input } from '../../components/ui/index.js';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const apiError = useApiError();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      const to = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(to, { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    }
  });

  return (
    <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm text-accent hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting}>
          {t('nav.login')}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        {t('auth.or')}
        <div className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton />

      <p className="mt-6 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-medium text-accent hover:underline">
          {t('nav.signup')}
        </Link>
      </p>
    </AuthShell>
  );
}
