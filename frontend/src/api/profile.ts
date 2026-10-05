import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type ProfileInput = {
  email: string; name: string; desiredRole: string | null; careerLevel: string | null;
  desiredLocation: string | null; introduction: string | null; education: string | null; certifications: string | null;
};
export type Profile = ProfileInput & { id: number };
type Request = ReturnType<typeof createApiClient>;

function parseProfile(value: unknown): Profile {
  if (typeof value !== 'object' || value === null) throw new ApiError('프로필 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== 'number' || !Number.isSafeInteger(entry.id) || entry.id <= 0
      || typeof entry.email !== 'string' || !entry.email || typeof entry.name !== 'string' || !entry.name
      || !(['desiredRole', 'careerLevel', 'desiredLocation', 'introduction', 'education', 'certifications']
        .every(key => entry[key] === null || typeof entry[key] === 'string'))) {
    throw new ApiError('프로필 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
  }
  return value as Profile;
}

export function createProfileApi(request: Request) {
  return {
    get: async (signal?: AbortSignal) => parseProfile(await request('/me/profile', { signal })),
    put: async (input: ProfileInput) => {
      const csrf = await request('/auth/csrf');
      if (typeof csrf !== 'object' || csrf === null || !('headerName' in csrf) || !('token' in csrf)
          || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) {
        throw new ApiError('저장 요청을 준비할 수 없습니다.', 200, 'INVALID_RESPONSE');
      }
      return parseProfile(await request('/me/profile', { method: 'PUT', body: input, csrfToken: csrf.token }));
    },
  };
}
