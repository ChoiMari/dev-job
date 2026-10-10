import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type NotificationPreferences = { interviewReminder: boolean; todoReminder: boolean };
const valid = (value: unknown): value is NotificationPreferences => typeof value === 'object' && value !== null
  && 'interviewReminder' in value && typeof value.interviewReminder === 'boolean'
  && 'todoReminder' in value && typeof value.todoReminder === 'boolean';

export function createNotificationPreferencesApi(request: ReturnType<typeof createApiClient>) {
  const parse = (value: unknown): NotificationPreferences => {
    if (!valid(value)) throw new ApiError('알림 설정 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
    return { interviewReminder: value.interviewReminder, todoReminder: value.todoReminder };
  };
  return {
    get: async (signal?: AbortSignal) => parse(await request('/me/notification-preferences', { signal })),
    async save(value: NotificationPreferences) {
      const csrf = await request('/auth/csrf');
      if (typeof csrf !== 'object' || csrf === null || !('token' in csrf) || typeof csrf.token !== 'string'
        || !('headerName' in csrf) || csrf.headerName !== 'X-CSRF-TOKEN')
        throw new ApiError('보안 확인을 준비할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return parse(await request('/me/notification-preferences', { method: 'PUT', body: value, csrfToken: csrf.token }));
    },
  };
}
