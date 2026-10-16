import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type NotificationItem = {
  id: number; type: NotificationType; sourceId: number;
  scheduledAt: string; subject: string; createdAt: string; readAt: string | null;
};
export const notificationTypes = ['INTERVIEW_REMINDER', 'TODO_REMINDER', 'NEW_JOB', 'AI_JOB_RECOMMENDATION',
  'SAVED_JOB_UPDATE', 'DOCUMENT_ANALYSIS', 'MATCH_ANALYSIS', 'SEMANTIC_RECOMMENDATION',
  'LEARNING_GOAL_REMINDER', 'CHARACTER_ACTIVITY', 'SERVICE_NOTICE'] as const;
export type NotificationType = typeof notificationTypes[number];
export type NotificationPage = { items: NotificationItem[]; page: number; size: number; totalElements: number; unreadCount: number };
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function invalid(): never { throw new ApiError('알림 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
export function isNotification(value: unknown): value is NotificationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return positive(item.id) && positive(item.sourceId)
    && notificationTypes.some(type => type === item.type)
    && instant(item.scheduledAt) && typeof item.subject === 'string' && instant(item.createdAt)
    && (item.readAt === null || instant(item.readAt));
}
export function notificationSource(item: NotificationItem) {
  switch (item.type) {
    case 'INTERVIEW_REMINDER': return `#/interviews/${item.sourceId}`;
    case 'TODO_REMINDER': return `#/todos/${item.sourceId}`;
    case 'NEW_JOB': case 'AI_JOB_RECOMMENDATION': case 'MATCH_ANALYSIS': return `#/jobs/${item.sourceId}`;
    case 'SAVED_JOB_UPDATE': return '#/bookmarks';
    case 'DOCUMENT_ANALYSIS': return item.subject.startsWith('이력서') ? '#/resumes' : '#/cover-letters';
    case 'SEMANTIC_RECOMMENDATION': return `#/recommendations/${item.sourceId}`;
    case 'LEARNING_GOAL_REMINDER': return `#/learning-goals/${item.sourceId}`;
    case 'CHARACTER_ACTIVITY': return '#/character';
    case 'SERVICE_NOTICE': return '#/notifications';
  }
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
        || !('unreadCount' in value) || !Number.isSafeInteger(value.unreadCount)
        || Number(value.unreadCount) < 0 || Number(value.unreadCount) > Number(value.totalElements)
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
