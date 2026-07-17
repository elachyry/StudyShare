import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { ArrowBigUp, Inbox, Plus } from 'lucide-react';
import {
  createRequestSchema,
  type CreateRequestInput,
  type ResourceRequest,
  type ResourceType,
} from '@studyshare/shared';
import { requestsApi, resourcesApi } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import { useBranches, useSubjects, localizedName } from '../../lib/hooks.js';
import {
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  Select,
  Textarea,
  Modal,
  Skeleton,
  EmptyState,
  cn,
} from '../../components/ui/index.js';

const TYPES: ResourceType[] = ['LESSON', 'SUMMARY', 'EXERCISE'];

export function RequestBoardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sort, setSort] = useState<'votes' | 'newest'>('votes');
  // Open pre-filled when arriving from the browse empty-state ("Request it").
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const createDefaults: Partial<CreateRequestInput> = {
    title: searchParams.get('title') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    subjectId: searchParams.get('subjectId') ?? undefined,
    type: (searchParams.get('type') as CreateRequestInput['type']) ?? undefined,
  };
  const [fulfillFor, setFulfillFor] = useState<ResourceRequest | null>(null);

  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.has('create')) setSearchParams({}, { replace: true });
  };

  const query = useInfiniteQuery({
    queryKey: ['requests', sort],
    queryFn: ({ pageParam }) => requestsApi.list({ sort, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('requests.title')}</h1>
          <p className="mt-1 max-w-xl text-muted">{t('requests.subtitle')}</p>
        </div>
        {user && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t('requests.create')}
          </Button>
        )}
      </div>

      <div className="w-48">
        <Select
          aria-label={t('resources.sort')}
          value={sort}
          onChange={(e) => setSort(e.target.value as 'votes' | 'newest')}
          options={[
            { value: 'votes', label: t('requests.sortVotes') },
            { value: 'newest', label: t('requests.sortNewest') },
          ]}
        />
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-10 w-10" />} title={t('requests.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => (
            <RequestRow key={r.id} request={r} onFulfill={() => setFulfillFor(r)} />
          ))}
          {query.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => void query.fetchNextPage()}
                loading={query.isFetchingNextPage}
              >
                {t('common.loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}

      {createOpen && <CreateRequestModal defaults={createDefaults} onClose={closeCreate} />}
      {fulfillFor && (
        <FulfillModal request={fulfillFor} onClose={() => setFulfillFor(null)} />
      )}
    </div>
  );
}

function RequestRow({
  request,
  onFulfill,
}: {
  request: ResourceRequest;
  onFulfill: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();

  const vote = useMutation({
    mutationFn: () =>
      request.viewerHasVoted ? requestsApi.unvote(request.id) : requestsApi.vote(request.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['requests'] }),
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <button
          onClick={() => vote.mutate()}
          disabled={!user}
          aria-pressed={request.viewerHasVoted}
          aria-label={t('requests.upvote')}
          className={cn(
            'flex w-14 shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 transition-colors',
            request.viewerHasVoted
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:border-accent hover:text-accent',
            !user && 'cursor-not-allowed opacity-60',
          )}
        >
          <ArrowBigUp className="h-5 w-5" />
          <span className="text-sm font-bold">{request.votesCount}</span>
        </button>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{t(`resources.types.${request.type}`)}</Badge>
            <Badge tone={request.status === 'FULFILLED' ? 'success' : 'neutral'}>
              {t(`requests.${request.status.toLowerCase()}`)}
            </Badge>
          </div>
          <h3 className="mt-2 font-semibold text-text">{request.title}</h3>
          {request.description && (
            <p className="mt-1 text-sm text-muted">{request.description}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            {request.status === 'FULFILLED' && request.fulfilledByResourceId ? (
              <Link
                to={`/resources/${request.fulfilledByResourceId}`}
                className="text-sm font-medium text-accent hover:underline"
              >
                {t('requests.viewResource')}
              </Link>
            ) : (
              user && (
                <Button size="sm" variant="outline" onClick={onFulfill}>
                  {t('requests.fulfill')}
                </Button>
              )
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function CreateRequestModal({
  defaults,
  onClose,
}: {
  defaults?: Partial<CreateRequestInput>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: defaults,
  });
  const branchId = watch('branchId');
  const branches = useBranches();
  const subjects = useSubjects(branchId);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await requestsApi.create(values);
      toast.success(t('requests.create'));
      void qc.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    } catch (e) {
      toast.error(apiError(e));
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t('requests.createTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button form="create-request" type="submit" loading={isSubmitting} onClick={onSubmit}>
            {t('common.submit')}
          </Button>
        </>
      }
    >
      <form id="create-request" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label={t('upload.resourceTitle')} error={errors.title?.message} {...register('title')} />
        <Textarea
          label={`${t('upload.description')} (${t('common.optional')})`}
          {...register('description')}
        />
        <Select
          label={t('resources.branch')}
          placeholder={t('resources.branch')}
          error={errors.branchId?.message}
          {...register('branchId', { onChange: () => setValue('subjectId', '') })}
          options={(branches.data ?? []).map((b) => ({
            value: b.id,
            label: localizedName(b, i18n.language),
          }))}
        />
        <Select
          label={t('resources.subject')}
          placeholder={t('resources.subject')}
          disabled={!branchId}
          error={errors.subjectId?.message}
          {...register('subjectId')}
          options={(subjects.data ?? []).map((s) => ({
            value: s.id,
            label: localizedName(s, i18n.language),
          }))}
        />
        <Select
          label={t('resources.type')}
          placeholder={t('resources.type')}
          error={errors.type?.message}
          {...register('type')}
          options={TYPES.map((ty) => ({ value: ty, label: t(`resources.types.${ty}`) }))}
        />
      </form>
    </Modal>
  );
}

function FulfillModal({ request, onClose }: { request: ResourceRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const [resourceId, setResourceId] = useState('');
  const mine = useQuery({ queryKey: ['resources', 'mine'], queryFn: resourcesApi.mine });

  const approvedOwn = (mine.data ?? []).filter((r) => r.status === 'APPROVED');

  const fulfill = useMutation({
    mutationFn: () => requestsApi.fulfill(request.id, resourceId),
    onSuccess: () => {
      toast.success(t('requests.fulfilled'));
      void qc.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t('requests.fulfillTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!resourceId} loading={fulfill.isPending} onClick={() => fulfill.mutate()}>
            {t('requests.fulfill')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{t('requests.fulfillHint')}</p>
      <Select
        placeholder={t('resources.title')}
        value={resourceId}
        onChange={(e) => setResourceId(e.target.value)}
        options={approvedOwn.map((r) => ({ value: r.id, label: r.title }))}
      />
    </Modal>
  );
}
