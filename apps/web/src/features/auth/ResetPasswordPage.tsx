import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { passwordSchema } from '@studyshare/shared';
import { authApi } from '../../lib/api.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { AuthShell } from './AuthShell.js';
import { Button, Input } from '../../components/ui/index.js';

const formSchema = z.object({ password: passwordSchema });

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const apiError = useApiError();
  const token = params.get('token') ?? '';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.resetPassword(token, values.password);
      toast.success(t('auth.resetSuccess'));
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(apiError(err));
    }
  });

  return (
    <AuthShell title={t('auth.resetTitle')}>
      {!token ? (
        <div className="text-center text-muted">
          {t('auth.verifyError')}
          <div className="mt-4">
            <Link to="/forgot-password">
              <Button variant="outline">{t('auth.forgotTitle')}</Button>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            type="password"
            label={t('auth.newPassword')}
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" loading={isSubmitting}>
            {t('common.save')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
