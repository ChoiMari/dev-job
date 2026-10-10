import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type DeletionImpact = {
  deletedResources: { code: string; name: string; count: number }[];
  preservedSharedResources: string[];
  confirmationText: string;
  recoverableInApp: boolean;
  processing: string;
  externalDataNotice: string;
};
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export function isDeletionImpact(value: unknown): value is DeletionImpact {
  return object(value) && Array.isArray(value.deletedResources)
    && value.deletedResources.every(row => object(row) && typeof row.code === 'string'
      && typeof row.name === 'string' && typeof row.count === 'number' && Number.isSafeInteger(row.count) && row.count >= 0)
    && Array.isArray(value.preservedSharedResources) && value.preservedSharedResources.every(item => typeof item === 'string')
    && typeof value.confirmationText === 'string' && value.confirmationText.length > 0
    && typeof value.recoverableInApp === 'boolean' && typeof value.processing === 'string'
    && typeof value.externalDataNotice === 'string';
}
export function createAccountDeletionApi(request: ReturnType<typeof createApiClient>) {
  return {
    async impact(signal?: AbortSignal): Promise<DeletionImpact> {
      const value = await request('/auth/me/deletion-impact', { signal });
      if (!isDeletionImpact(value)) throw new ApiError('계정 삭제 영향 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return value;
    },
    async delete(currentPassword: string, confirmation: string): Promise<void> {
      const csrf = await request('/auth/csrf');
      if (!object(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token)
        throw new ApiError('보안 확인을 준비할 수 없습니다.', 200, 'INVALID_RESPONSE');
      const response = await request('/auth/me', { method: 'DELETE', body: { currentPassword, confirmation }, csrfToken: csrf.token });
      if (response !== undefined) throw new ApiError('계정 삭제 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
    },
  };
}
