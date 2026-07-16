import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notificationsApi } from '../../lib/api.js';
import { Button } from '../ui/index.js';
import { formatDateTime } from '../../lib/format.js';

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const countQuery = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30_000,
  });
  const listQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(),
    enabled: open,
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unread = countQuery.data?.count ?? 0;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('nav.notifications')}
        aria-expanded={open}
      >
        <span className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface shadow-xl animate-slide-up">
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="font-medium text-text">{t('notifications.title')}</span>
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-accent hover:underline"
              >
                {t('notifications.markAllRead')}
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {listQuery.data?.items.length === 0 && (
                <p className="p-4 text-center text-sm text-muted">{t('notifications.empty')}</p>
              )}
              {listQuery.data?.items.map((n) => {
                const payload = n.payload as { title?: string };
                return (
                  <div
                    key={n.id}
                    className={`border-b border-border p-3 text-sm last:border-0 ${
                      n.readAt ? 'text-muted' : 'text-text'
                    }`}
                  >
                    <p>{t(`notifications.${n.type}`, { title: payload.title ?? '' })}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDateTime(n.createdAt, i18n.language)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
