import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, Flag, Trash2, Send } from 'lucide-react';
import { Permission } from '@studyshare/shared';
import { resourcesApi, reportsApi } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { formatDate, formatBytes, formatNumber } from '../../lib/format.js';
import {
  Button,
  Card,
  CardBody,
  Badge,
  StarRating,
  Skeleton,
  Textarea,
  Modal,
} from '../../components/ui/index.js';

export function ResourceDetailPage() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const { user, can } = useAuth();
  const toast = useToast();
  const apiError = useApiError();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const resourceQuery = useQuery({ queryKey: ['resource', id], queryFn: () => resourcesApi.get(id) });
  const commentsQuery = useQuery({
    queryKey: ['resource', id, 'comments'],
    queryFn: () => resourcesApi.comments(id),
  });

  const mimeType = resourceQuery.data?.mimeType ?? '';
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');
  const previewable = isPdf || isImage;
  const viewQuery = useQuery({
    queryKey: ['resource', id, 'view'],
    queryFn: () => resourcesApi.view(id),
    enabled: previewable && !!user,
    staleTime: 60_000,
  });

  const download = useMutation({
    mutationFn: () => resourcesApi.download(id),
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener');
      void qc.invalidateQueries({ queryKey: ['resource', id] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const rate = useMutation({
    mutationFn: (value: number) => resourcesApi.rate(id, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['resource', id] }),
    onError: (e) => toast.error(apiError(e)),
  });

  const addComment = useMutation({
    mutationFn: () => resourcesApi.addComment(id, comment),
    onSuccess: () => {
      setComment('');
      void qc.invalidateQueries({ queryKey: ['resource', id, 'comments'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: () => resourcesApi.remove(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      navigate('/');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const report = useMutation({
    mutationFn: () => reportsApi.create('RESOURCE', id, reportReason),
    onSuccess: () => {
      setReportOpen(false);
      setReportReason('');
      toast.success(t('resources.reported'));
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (resourceQuery.isLoading) return <Skeleton className="h-96" />;
  if (resourceQuery.isError || !resourceQuery.data)
    return <p className="text-muted">{t('errors.NOT_FOUND')}</p>;

  const r = resourceQuery.data;
  const isOwner = user?.id === r.uploaderId;
  const canDelete = isOwner || can(Permission.RESOURCE_DELETE_ANY);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`resources.types.${r.type}`)}</Badge>
            {r.status !== 'APPROVED' && (
              <Badge tone={r.status === 'PENDING' ? 'warning' : 'danger'}>
                {t(`resources.${r.status.toLowerCase()}`)}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-text">{r.title}</h1>
          {r.description && <p className="whitespace-pre-wrap text-text">{r.description}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              {t('resources.by')} {r.uploader.name}
            </span>
            <span>·</span>
            <span>{formatDate(r.createdAt, i18n.language)}</span>
            <span>·</span>
            <span>{formatBytes(r.fileSizeBytes, i18n.language)}</span>
            <span>·</span>
            <span>{t('resources.downloads', { count: r.downloadsCount })}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => download.mutate()} loading={download.isPending} disabled={!user}>
              <Download className="h-4 w-4" /> {t('resources.download')}
            </Button>
            {user && (
              <Button variant="ghost" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4" /> {t('resources.report')}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(t('resources.deleteConfirm'))) remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" /> {t('common.delete')}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Inline preview (PDF / image) */}
      {previewable && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="font-semibold text-text">{t('resources.preview')}</h2>
            {!user ? (
              <p className="text-sm text-muted">{t('resources.signInToPreview')}</p>
            ) : viewQuery.isLoading ? (
              <Skeleton className="h-96" />
            ) : viewQuery.isError || !viewQuery.data ? (
              <p className="text-sm text-muted">{t('resources.previewUnavailable')}</p>
            ) : isPdf ? (
              <iframe
                src={viewQuery.data.url}
                title={r.fileName ?? r.title}
                className="h-[75vh] w-full rounded-lg border border-border bg-surface-2"
              />
            ) : (
              <img
                src={viewQuery.data.url}
                alt={r.title}
                className="mx-auto max-h-[75vh] rounded-lg border border-border object-contain"
              />
            )}
          </CardBody>
        </Card>
      )}

      {/* Ratings */}
      <Card>
        <CardBody className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-text">{t('resources.rateThis')}</span>
            <span className="text-sm text-muted">
              {r.averageRating.toFixed(1)} · {t('resources.ratingsCount', { count: r.ratingsCount })}
            </span>
          </div>
          <StarRating
            value={r.averageRating}
            readOnly={!user}
            label={t('resources.yourRating')}
            onChange={(v) => rate.mutate(v)}
          />
        </CardBody>
      </Card>

      {/* Comments */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <h2 className="font-semibold text-text">
            {t('resources.comments')}{' '}
            <span className="text-muted">
              ({formatNumber(commentsQuery.data?.length ?? 0, i18n.language)})
            </span>
          </h2>

          {user && (
            <div className="flex flex-col gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('resources.commentPlaceholder')}
                aria-label={t('resources.addComment')}
              />
              <div className="self-end">
                <Button
                  size="sm"
                  disabled={!comment.trim()}
                  loading={addComment.isPending}
                  onClick={() => addComment.mutate()}
                >
                  <Send className="h-4 w-4" /> {t('resources.addComment')}
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col divide-y divide-border">
            {commentsQuery.data?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">{t('resources.noComments')}</p>
            )}
            {commentsQuery.data?.map((c) => (
              <div key={c.id} className="py-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-text">{c.author.name}</span>
                  <span className="text-xs text-muted">
                    {formatDate(c.createdAt, i18n.language)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                  {c.deletedAt ? <em className="text-muted">[removed]</em> : c.body}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t('resources.report')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={reportReason.trim().length < 3}
              loading={report.isPending}
              onClick={() => report.mutate()}
            >
              {t('resources.report')}
            </Button>
          </>
        }
      >
        <Textarea
          label={t('resources.reportReason')}
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
