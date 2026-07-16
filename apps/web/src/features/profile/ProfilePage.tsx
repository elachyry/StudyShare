import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { changePasswordSchema, type ChangePasswordInput } from '@studyshare/shared';
import { resourcesApi, usersApi, authApi } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { useBranches, localizedName } from '../../lib/hooks.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import {
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Badge,
  Skeleton,
} from '../../components/ui/index.js';
import { formatNumber } from '../../lib/format.js';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();
  const apiError = useApiError();
  const navigate = useNavigate();

  const stats = useQuery({ queryKey: ['profile', 'stats'], queryFn: usersApi.stats });
  const mine = useQuery({ queryKey: ['resources', 'mine'], queryFn: resourcesApi.mine });
  const branches = useBranches();

  const [name, setName] = useState(user?.name ?? '');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

  const saveProfile = useMutation({
    mutationFn: () => usersApi.updateProfile({ name, branchId: branchId || null }),
    onSuccess: async () => {
      await refreshUser();
      toast.success(t('common.save'));
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const pwForm = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const changePw = useMutation({
    mutationFn: (v: ChangePasswordInput) => authApi.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success(t('auth.passwordChanged'));
      pwForm.reset();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const del = useMutation({
    mutationFn: usersApi.deleteAccount,
    onSuccess: async () => {
      await logout();
      navigate('/');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (!user) return null;

  const statTiles = [
    { label: t('profile.totalUploads'), value: stats.data?.uploadsCount },
    { label: t('profile.approvedUploads'), value: stats.data?.approvedUploadsCount },
    { label: t('profile.totalRequests'), value: stats.data?.requestsCount },
    { label: t('profile.totalDownloads'), value: stats.data?.totalDownloads },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t('profile.title')}</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statTiles.map((s) => (
          <Card key={s.label}>
            <CardBody className="text-center">
              <p className="text-3xl font-bold text-accent">
                {s.value === undefined ? '—' : formatNumber(s.value, i18n.language)}
              </p>
              <p className="mt-1 text-xs text-muted">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Edit profile */}
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="font-semibold text-text">{t('profile.editProfile')}</h2>
            <Input label={t('auth.name')} value={name} onChange={(e) => setName(e.target.value)} />
            <Select
              label={t('profile.primaryBranch')}
              placeholder={t('common.none')}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              options={(branches.data ?? []).map((b) => ({
                value: b.id,
                label: localizedName(b, i18n.language),
              }))}
            />
            <div className="self-end">
              <Button loading={saveProfile.isPending} onClick={() => saveProfile.mutate()}>
                {t('common.save')}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Change password */}
        <Card>
          <CardBody className="flex flex-col gap-4">
            <h2 className="font-semibold text-text">{t('auth.changePassword')}</h2>
            <form
              onSubmit={pwForm.handleSubmit((v) => changePw.mutate(v))}
              className="flex flex-col gap-4"
            >
              <Input
                type="password"
                label={t('auth.currentPassword')}
                autoComplete="current-password"
                error={pwForm.formState.errors.currentPassword?.message}
                {...pwForm.register('currentPassword')}
              />
              <Input
                type="password"
                label={t('auth.newPassword')}
                autoComplete="new-password"
                error={pwForm.formState.errors.newPassword?.message}
                {...pwForm.register('newPassword')}
              />
              <div className="self-end">
                <Button type="submit" loading={changePw.isPending}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>

      {/* My uploads */}
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-semibold text-text">{t('profile.uploads')}</h2>
          {mine.isLoading ? (
            <Skeleton className="h-20" />
          ) : mine.data?.length === 0 ? (
            <p className="text-sm text-muted">{t('resources.empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {mine.data?.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <Link to={`/resources/${r.id}`} className="text-text hover:text-accent">
                    {r.title}
                  </Link>
                  <Badge
                    tone={
                      r.status === 'APPROVED'
                        ? 'success'
                        : r.status === 'PENDING'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {t(`resources.${r.status.toLowerCase()}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/40">
        <CardBody className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-danger">{t('profile.dangerZone')}</h2>
            <p className="text-sm text-muted">{t('profile.deleteConfirm')}</p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('profile.deleteConfirm'))) del.mutate();
            }}
          >
            {t('profile.deleteAccount')}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
