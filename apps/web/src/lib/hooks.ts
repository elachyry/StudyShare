import { useQuery } from '@tanstack/react-query';
import { branchesApi } from './api.js';
import type { Branch, Subject } from '@studyshare/shared';

export function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: branchesApi.list, staleTime: 300_000 });
}

export function useSubjects(branchId: string | undefined) {
  return useQuery({
    queryKey: ['subjects', branchId],
    queryFn: () => branchesApi.subjects(branchId!),
    enabled: !!branchId,
    staleTime: 300_000,
  });
}

/** Return the branch/subject name in the active language (falls back to EN). */
export function localizedName(item: Branch | Subject, lang: string): string {
  return lang.startsWith('fr') && item.nameFr ? item.nameFr : item.name;
}
