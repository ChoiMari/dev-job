import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type NotificationItem = {
  id: number; type: 'INTERVIEW_REMINDER' | 'TODO_REMINDER'; sourceId: number;
  scheduledAt: string; subject: string; createdAt: string; readAt: string | null;
};
export type NotificationPage = { items: NotificationItem[]; page: number; size: number; totalElements: number };
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function invalid(): never { throw new ApiError('알림 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
export function isNotification(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return positive(item.id) && positive(item.sourceId)
    && (item.type === 'INTERVIEW_REMINDER' || item.type === 'TODO_REMINDER')
    && instant(item.scheduledAt) && typeof item.subject === 'string' && instant(item.createdAt)
    && (item.readAt === null || instant(item.readAt));
}
export function notificationSource(item: NotificationItem) {
  return item.type === 'INTERVIEW_REMINDER' ? `#/interviews/${item.sourceId}` : `#/todos/${item.sourceId}`;
}
export function createNotificationsApi(request: ReturnType<typeof createApiClient>) {
  return {
    async list(page = 0, signal?: AbortSignal): Promise<NotificationPage> {
      if (!Number.isSafeInteger(page) || page < 0) throw new TypeError('페이지를 확인해 주세요.');
      const value = await request('/me/notifications', { query: { page, size: 20 }, signal });
      if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
        || !('page' in value) || value.page !== page || !('size' in value) || value.size !== 20
        || !('totalElements' in value) || !Number.isSafeInteger(value.totalElements)
        || Number(value.totalElements) < value.items.length || value.items.length > 20
        || !value.items.every(isNotification)
        || new Set(value.items.map(item => item.id)).size !== value.items.length) return invalid();
      return value as NotificationPage;
    },
    async markRead(id: number): Promise<void> {
      if (!positive(id)) throw new TypeError('알림 ID를 확인해 주세요.');
      const csrf = await request('/auth/csrf');
      if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || csrf.headerName !== 'X-CSRF-TOKEN'
        || !('token' in csrf) || typeof csrf.token !== 'string' || !csrf.token) return invalid();
      const response = await request(`/me/notifications/${id}/read`, { method: 'PATCH', csrfToken: csrf.token });
      if (response !== undefined) return invalid();
    },
  };
}
