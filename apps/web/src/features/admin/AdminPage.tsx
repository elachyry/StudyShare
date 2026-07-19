import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download, X } from 'lucide-react';
import { Role, type Role as RoleT, type UserStatus, type Branch } from '@studyshare/shared';
import { adminApi, branchesApi } from '../../lib/api.js';
import { useBranches, useSubjects, localizedName } from '../../lib/hooks.js';
import { useToast } from '../../lib/toast.js';
import { useApiError } from '../../lib/useApiError.js';
import {
  Button,
  Card,
  CardBody,
  Badge,
  Input,
  Select,
  Skeleton,
  cn,
} from '../../components/ui/index.js';
import { formatDateTime } from '../../lib/format.js';

type Tab = 'users' | 'branches' | 'audit';

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('users');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: t('admin.users') },
    { key: 'branches', label: t('admin.branches') },
    { key: 'audit', label: t('admin.auditLog') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text">{t('admin.title')}</h1>
      <div className="flex gap-2 border-b border-border">
        {tabs.map((tk) => (
          <button
            key={tk.key}
            onClick={() => setTab(tk.key)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === tk.key
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tk.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'branches' && <BranchesTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const [q, setQ] = useState('');

  const users = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => adminApi.users({ q }) });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: RoleT }) => adminApi.setRole(id, role),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e) => toast.error(apiError(e)),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      adminApi.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="w-72">
        <Input placeholder={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {users.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="p-3">{t('auth.name')}</th>
                <th className="p-3">{t('auth.email')}</th>
                <th className="p-3">{t('admin.role')}</th>
                <th className="p-3">{t('admin.status')}</th>
                <th className="p-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.items.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-3 text-text">{u.name}</td>
                  <td className="p-3 text-muted">{u.email}</td>
                  <td className="p-3">
                    <Select
                      aria-label={t('admin.role')}
                      value={u.role}
                      onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value as RoleT })}
                      options={[Role.STUDENT, Role.MODERATOR, Role.ADMIN].map((r) => ({
                        value: r,
                        label: r,
                      }))}
                    />
                  </td>
                  <td className="p-3">
                    <Badge tone={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge>
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant={u.status === 'ACTIVE' ? 'danger' : 'outline'}
                      onClick={() =>
                        setStatus.mutate({
                          id: u.id,
                          status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                        })
                      }
                    >
                      {u.status === 'ACTIVE' ? t('admin.suspend') : t('admin.reactivate')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BranchesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const branches = useBranches();
  const [form, setForm] = useState({ name: '', nameFr: '', slug: '' });

  const create = useMutation({
    mutationFn: () => branchesApi.create(form),
    onSuccess: () => {
      setForm({ name: '', nameFr: '', slug: '' });
      void qc.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => branchesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-3">
          <h2 className="font-semibold text-text">{t('admin.createBranch')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={t('admin.nameEn')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label={t('admin.nameFr')}
              value={form.nameFr}
              onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))}
            />
            <Input
              label={t('admin.slug')}
              hint={t('admin.slugHint')}
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="self-end">
            <Button
              loading={create.isPending}
              disabled={!form.name || !form.nameFr || !form.slug}
              onClick={() => create.mutate()}
            >
              {t('admin.createBranch')}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-text">{t('admin.branches')}</h2>
        {branches.isLoading ? (
          <Skeleton className="h-40" />
        ) : branches.data?.length === 0 ? (
          <p className="text-sm text-muted">{t('admin.noBranches')}</p>
        ) : (
          branches.data?.map((b) => (
            <BranchItem key={b.id} branch={b} onDelete={() => remove.mutate(b.id)} />
          ))
        )}
      </div>
    </div>
  );
}

/** A branch card with its subjects and an inline "add subject" form. */
function BranchItem({ branch, onDelete }: { branch: Branch; onDelete: () => void }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const apiError = useApiError();
  const subjects = useSubjects(branch.id);
  const [form, setForm] = useState({ name: '', nameFr: '', slug: '' });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['subjects', branch.id] });

  const addSubject = useMutation({
    mutationFn: () => branchesApi.createSubject({ branchId: branch.id, ...form }),
    onSuccess: () => {
      setForm({ name: '', nameFr: '', slug: '' });
      invalidate();
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const removeSubject = useMutation({
    mutationFn: (id: string) => branchesApi.removeSubject(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-text">
            {localizedName(branch, i18n.language)}{' '}
            <span className="text-muted">({branch.slug})</span>
          </span>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            {t('common.delete')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted/70">
            {t('admin.subjects')}
          </p>
          {subjects.isLoading ? (
            <Skeleton className="h-8" />
          ) : subjects.data?.length === 0 ? (
            <p className="text-sm text-muted">{t('admin.noSubjects')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {subjects.data?.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-sm text-text"
                >
                  {localizedName(s, i18n.language)}
                  <button
                    onClick={() => removeSubject.mutate(s.id)}
                    aria-label={t('common.delete')}
                    className="rounded-full p-0.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end">
          <Input
            label={t('admin.nameEn')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label={t('admin.nameFr')}
            value={form.nameFr}
            onChange={(e) => setForm((f) => ({ ...f, nameFr: e.target.value }))}
          />
          <Input
            label={t('admin.slug')}
            hint={t('admin.slugHint')}
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Button
            loading={addSubject.isPending}
            disabled={!form.name || !form.nameFr || !form.slug}
            onClick={() => addSubject.mutate()}
          >
            {t('admin.addSubject')}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function AuditTab() {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState('');
  const logs = useQuery({
    queryKey: ['admin', 'audit', action],
    queryFn: () => adminApi.auditLogs({ action: action || undefined }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="w-72">
          <Input
            label={t('admin.action')}
            placeholder="auth.login.success"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>
        <a href={adminApi.auditExportUrl()} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <Download className="h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        </a>
      </div>
      {logs.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="p-3">{t('admin.when')}</th>
                <th className="p-3">{t('admin.action')}</th>
                <th className="p-3">{t('admin.actor')}</th>
                <th className="p-3">{t('admin.target')}</th>
                <th className="p-3">{t('admin.ip')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.items.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="whitespace-nowrap p-3 text-muted">
                    {formatDateTime(l.createdAt, i18n.language)}
                  </td>
                  <td className="p-3 font-mono text-xs text-text">{l.action}</td>
                  <td className="p-3 text-muted">{l.actorEmail ?? '—'}</td>
                  <td className="p-3 text-muted">
                    {l.targetType ? `${l.targetType}:${l.targetId?.slice(0, 8)}` : '—'}
                  </td>
                  <td className="p-3 text-muted">{l.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
