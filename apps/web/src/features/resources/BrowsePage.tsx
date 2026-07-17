import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, FileQuestion } from 'lucide-react';
import type { ListResourcesQuery, ResourceType } from '@studyshare/shared';
import { resourcesApi } from '../../lib/api.js';
import { useBranches, useSubjects, localizedName } from '../../lib/hooks.js';
import { Button, Input, Select, Skeleton, EmptyState } from '../../components/ui/index.js';
import { ResourceCard } from './ResourceCard.js';

const TYPES: ResourceType[] = ['LESSON', 'SUMMARY', 'EXERCISE'];

export function BrowsePage() {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<Partial<ListResourcesQuery>>({ sort: 'newest' });
  const [searchInput, setSearchInput] = useState('');

  const branches = useBranches();
  const subjects = useSubjects(filters.branchId);

  const query = useInfiniteQuery({
    queryKey: ['resources', filters],
    queryFn: ({ pageParam }) =>
      resourcesApi.list({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const update = (patch: Partial<ListResourcesQuery>) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">{t('resources.title')}</h1>
        <p className="mt-1 text-muted">{t('app.tagline')}</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: searchInput || undefined });
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('resources.searchPlaceholder')}
              className="pl-9"
              aria-label={t('common.search')}
            />
          </div>
          <Button type="submit">{t('common.search')}</Button>
        </form>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <SlidersHorizontal className="h-4 w-4" /> {t('resources.filters')}
          </span>
          <div className="min-w-[140px] flex-1">
            <Select
              aria-label={t('resources.branch')}
              placeholder={t('resources.branch')}
              value={filters.branchId ?? ''}
              onChange={(e) => update({ branchId: e.target.value || undefined, subjectId: undefined })}
              options={(branches.data ?? []).map((b) => ({
                value: b.id,
                label: localizedName(b, i18n.language),
              }))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Select
              aria-label={t('resources.subject')}
              placeholder={t('resources.subject')}
              value={filters.subjectId ?? ''}
              disabled={!filters.branchId}
              onChange={(e) => update({ subjectId: e.target.value || undefined })}
              options={(subjects.data ?? []).map((s) => ({
                value: s.id,
                label: localizedName(s, i18n.language),
              }))}
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <Select
              aria-label={t('resources.type')}
              placeholder={t('resources.type')}
              value={filters.type ?? ''}
              onChange={(e) => update({ type: (e.target.value || undefined) as ResourceType })}
              options={TYPES.map((ty) => ({ value: ty, label: t(`resources.types.${ty}`) }))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Select
              aria-label={t('resources.sort')}
              value={filters.sort ?? 'newest'}
              onChange={(e) => update({ sort: e.target.value as ListResourcesQuery['sort'] })}
              options={[
                { value: 'newest', label: t('resources.sortNewest') },
                { value: 'downloads', label: t('resources.sortDownloads') },
                { value: 'rating', label: t('resources.sortRating') },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {query.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<FileQuestion className="h-10 w-10" />} title={t('resources.empty')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
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
        </>
      )}
    </div>
  );
}
