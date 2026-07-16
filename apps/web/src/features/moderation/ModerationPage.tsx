import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { resourcesApi, reportsApi } from '../../lib/api.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import {
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  Skeleton,
  EmptyState,
  cn,
} from '../../components/ui/index.js';

type Tab = 'resources' | 'reports';

export function ModerationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('resources');

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t('moderation.title')}</h1>

      <div className="flex gap-2 border-b border-border">
        {(['resources', 'reports'] as Tab[]).map((tk) => (
          <button
            key={tk}
            onClick={() => setTab(tk)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === tk
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tk === 'resources' ? t('moderation.pendingResources') : t('moderation.reports')}
          </button>
        ))}
      </div>

      {tab === 'resources' ? <PendingResources /> : <Reports />}
    </div>
  );
}

function PendingResources() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const pending = useQuery({
    queryKey: ['resources', 'pending'],
    queryFn: () => resourcesApi.list({ status: 'PENDING', sort: 'newest' }),
  });

  const moderate = useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'APPROVE' | 'REJECT'; reason?: string }) =>
      resourcesApi.moderate(id, decision, reason),
    onSuccess: () => {
      toast.success(t('common.confirm'));
      void qc.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (pending.isLoading) return <Skeleton className="h-40" />;
  const items = pending.data?.items ?? [];
  if (items.length === 0)
    return <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title={t('moderation.empty')} />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((r) => (
        <Card key={r.id}>
          <CardBody className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/resources/${r.id}`} className="font-semibold text-text hover:text-accent">
                  {r.title}
                </Link>
                <p className="text-sm text-muted">
                  {t('resources.by')} {r.uploader.name} · {t(`resources.types.${r.type}`)}
                </p>
              </div>
              <Badge tone="warning">{t('resources.pending')}</Badge>
            </div>
            {r.description && <p className="text-sm text-text">{r.description}</p>}
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Input
                  placeholder={t('moderation.rejectReason')}
                  value={reasons[r.id] ?? ''}
                  onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                />
              </div>
              <Button
                onClick={() => moderate.mutate({ id: r.id, decision: 'APPROVE' })}
                loading={moderate.isPending}
              >
                {t('moderation.approve')}
              </Button>
              <Button
                variant="danger"
                onClick={() => moderate.mutate({ id: r.id, decision: 'REJECT', reason: reasons[r.id] })}
              >
                {t('moderation.reject')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function Reports() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();

  const reports = useQuery({
    queryKey: ['reports', 'open'],
    queryFn: () => reportsApi.list('OPEN'),
  });

  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'RESOLVED' | 'DISMISSED' }) =>
      reportsApi.resolve(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (reports.isLoading) return <Skeleton className="h-40" />;
  const items = reports.data?.items ?? [];
  if (items.length === 0)
    return <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title={t('moderation.empty')} />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((rep) => (
        <Card key={rep.id}>
          <CardBody className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text">
                {t('moderation.reportOn', { type: rep.targetType })}
              </p>
              <p className="mt-1 text-sm text-muted">{rep.reason}</p>
              {rep.targetType === 'RESOURCE' && (
                <Link
                  to={`/resources/${rep.targetId}`}
                  className="text-xs text-accent hover:underline"
                >
                  {rep.targetId}
                </Link>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" onClick={() => resolve.mutate({ id: rep.id, status: 'RESOLVED' })}>
                {t('moderation.resolve')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resolve.mutate({ id: rep.id, status: 'DISMISSED' })}
              >
                {t('moderation.dismiss')}
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
