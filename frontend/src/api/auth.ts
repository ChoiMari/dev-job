import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type CurrentUser = { id: number; email: string };
type Request = ReturnType<typeof createApiClient>;

function user(value: unknown): CurrentUser {
  if (typeof value !== 'object' || value === null || !('id' in value) || !('email' in value)
      || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0
      || typeof value.email !== 'string' || !value.email) {
    throw new ApiError('사용자 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
  }
  return { id: value.id, email: value.email };
}

export function createAuthApi(request: Request) {
  async function mutation(path: string, body?: unknown) {
    // Login rotates CSRF and logout invalidates the session. Never retry a mutation.
    const csrf = await request('/auth/csrf');
    if (typeof csrf !== 'object' || csrf === null || !('headerName' in csrf) || !('token' in csrf)
        || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) {
      throw new ApiError('인증 요청을 준비할 수 없습니다.', 200, 'INVALID_RESPONSE');
    }
    return request(path, { method: 'POST', body, csrfToken: csrf.token });
  }
  return {
    me: async (signal?: AbortSignal) => user(await request('/auth/me', { signal })),
    register: async (email: string, password: string) => user(await mutation('/auth/register', { email, password })),
    login: async (email: string, password: string) => {
      const response = await mutation('/auth/login', { email, password });
      if (typeof response !== 'object' || response === null || !('user' in response)) {
        throw new ApiError('로그인 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      }
      return user(response.user);
    },
    logout: async () => { await mutation('/auth/logout'); },
  };
}
