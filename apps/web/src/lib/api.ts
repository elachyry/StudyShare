import type {
  AuthTokens,
  AuthUser,
  Branch,
  Subject,
  Resource,
  ResourceRequest,
  Comment,
  Notification,
  AdminUser,
  AuditLog,
  ProfileStats,
  UploadedFile,
  DownloadUrl,
  ListResourcesQuery,
  ListRequestsQuery,
  CreateResourceInput,
  CreateRequestInput,
  Report,
  Role,
  UserStatus,
} from '@studyshare/shared';
import { http } from './http.js';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  signup: (body: { email: string; password: string; name: string }) =>
    http.post('/auth/signup', body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    http.post<AuthTokens>('/auth/login', body).then((r) => r.data),
  refresh: () => http.post<AuthTokens>('/auth/refresh', {}).then((r) => r.data),
  logout: () => http.post('/auth/logout', {}).then((r) => r.data),
  me: () => http.get<AuthUser>('/auth/me').then((r) => r.data),
  verifyEmail: (token: string) =>
    http.post('/auth/verify-email', { token }).then((r) => r.data),
  forgotPassword: (email: string) =>
    http.post('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, password: string) =>
    http.post('/auth/reset-password', { token, password }).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    http.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

export const branchesApi = {
  list: () => http.get<Branch[]>('/branches').then((r) => r.data),
  subjects: (branchId: string) =>
    http.get<Subject[]>(`/branches/${branchId}/subjects`).then((r) => r.data),
  create: (body: { name: string; nameFr: string; slug: string; description?: string }) =>
    http.post<Branch>('/branches', body).then((r) => r.data),
  createSubject: (body: { branchId: string; name: string; nameFr: string; slug: string }) =>
    http.post<Subject>('/branches/subjects', body).then((r) => r.data),
  remove: (id: string) => http.delete(`/branches/${id}`).then((r) => r.data),
  removeSubject: (id: string) => http.delete(`/branches/subjects/${id}`).then((r) => r.data),
};

export const filesApi = {
  upload: (file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<UploadedFile>('/files', form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data);
  },
};

export const resourcesApi = {
  list: (query: Partial<ListResourcesQuery>) =>
    http.get<Page<Resource>>(`/resources${qs(query)}`).then((r) => r.data),
  mine: () => http.get<Resource[]>('/resources/mine').then((r) => r.data),
  get: (id: string) => http.get<Resource>(`/resources/${id}`).then((r) => r.data),
  create: (body: CreateResourceInput) =>
    http.post<Resource>('/resources', body).then((r) => r.data),
  remove: (id: string) => http.delete(`/resources/${id}`).then((r) => r.data),
  moderate: (id: string, decision: 'APPROVE' | 'REJECT', reason?: string) =>
    http.post<Resource>(`/resources/${id}/moderate`, { decision, reason }).then((r) => r.data),
  download: (id: string) =>
    http.get<DownloadUrl>(`/resources/${id}/download`).then((r) => r.data),
  view: (id: string) => http.get<DownloadUrl>(`/resources/${id}/view`).then((r) => r.data),
  rate: (id: string, value: number) =>
    http
      .put<{ averageRating: number; ratingsCount: number }>(`/resources/${id}/rating`, { value })
      .then((r) => r.data),
  comments: (id: string) =>
    http.get<Comment[]>(`/resources/${id}/comments`).then((r) => r.data),
  addComment: (id: string, body: string) =>
    http.post<Comment>(`/resources/${id}/comments`, { body }).then((r) => r.data),
  deleteComment: (commentId: string) =>
    http.delete(`/resources/comments/${commentId}`).then((r) => r.data),
};

export const requestsApi = {
  list: (query: Partial<ListRequestsQuery>) =>
    http.get<Page<ResourceRequest>>(`/requests${qs(query)}`).then((r) => r.data),
  get: (id: string) => http.get<ResourceRequest>(`/requests/${id}`).then((r) => r.data),
  create: (body: CreateRequestInput) =>
    http.post<ResourceRequest>('/requests', body).then((r) => r.data),
  vote: (id: string) =>
    http.post<{ votesCount: number }>(`/requests/${id}/vote`, {}).then((r) => r.data),
  unvote: (id: string) =>
    http.delete<{ votesCount: number }>(`/requests/${id}/vote`).then((r) => r.data),
  fulfill: (id: string, resourceId: string) =>
    http.post<ResourceRequest>(`/requests/${id}/fulfill`, { resourceId }).then((r) => r.data),
};

export const notificationsApi = {
  list: (cursor?: string) =>
    http.get<Page<Notification>>(`/notifications${qs({ cursor })}`).then((r) => r.data),
  unreadCount: () =>
    http.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => http.post(`/notifications/${id}/read`, {}).then((r) => r.data),
  markAllRead: () => http.post('/notifications/read-all', {}).then((r) => r.data),
};

export const reportsApi = {
  create: (targetType: 'RESOURCE' | 'COMMENT', targetId: string, reason: string) =>
    http.post<Report>('/reports', { targetType, targetId, reason }).then((r) => r.data),
  list: (status?: string) =>
    http.get<Page<Report>>(`/reports${qs({ status })}`).then((r) => r.data),
  resolve: (id: string, status: 'RESOLVED' | 'DISMISSED') =>
    http.post<Report>(`/reports/${id}/resolve`, { status }).then((r) => r.data),
};

export const usersApi = {
  updateProfile: (body: { name?: string; branchId?: string | null }) =>
    http.patch<AuthUser>('/users/me', body).then((r) => r.data),
  stats: () => http.get<ProfileStats>('/users/me/stats').then((r) => r.data),
  deleteAccount: () => http.delete('/users/me').then((r) => r.data),
};

export const adminApi = {
  users: (query: { q?: string; role?: Role; status?: UserStatus; cursor?: string }) =>
    http.get<Page<AdminUser>>(`/admin/users${qs(query)}`).then((r) => r.data),
  setRole: (id: string, role: Role) =>
    http.patch<AdminUser>(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  setStatus: (id: string, status: UserStatus) =>
    http.patch<AdminUser>(`/admin/users/${id}/status`, { status }).then((r) => r.data),
  auditLogs: (query: { action?: string; actorId?: string; cursor?: string }) =>
    http.get<Page<AuditLog>>(`/admin/audit-logs${qs(query)}`).then((r) => r.data),
  auditExportUrl: () => `${http.defaults.baseURL}/admin/audit-logs/export`,
};
