import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type AlioBatchStatus = {
  runId: string | null;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILURE' | 'SOURCE_FAILED' | 'STORAGE_FAILED';
  startedAt: string | null; updatedAt: string | null; finishedAt: string | null;
  processedPages: number; created: number; duplicates: number; rejected: number; failed: number;
  sourceError: string | null;
};
const states = new Set(['IDLE', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILURE', 'SOURCE_FAILED', 'STORAGE_FAILED']);
const stamp = (value: unknown) => value === null || typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export function isAlioBatchStatus(value: unknown): value is AlioBatchStatus {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.runId === null || typeof item.runId === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(item.runId))
    && typeof item.status === 'string' && states.has(item.status)
    && stamp(item.startedAt) && stamp(item.updatedAt) && stamp(item.finishedAt)
    && count(item.processedPages) && count(item.created) && count(item.duplicates)
    && count(item.rejected) && count(item.failed)
    && (item.sourceError === null || typeof item.sourceError === 'string');
}
function parse(value: unknown): AlioBatchStatus {
  if (!isAlioBatchStatus(value)) throw new ApiError('관리자 배치 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
  return value;
}
export function createAlioBatchApi(request: ReturnType<typeof createApiClient>) {
  const path = '/admin/jobs/collections/alio';
  return {
    status: async (signal?: AbortSignal) => parse(await request(path, { signal })),
    async start() {
      const csrf = await request('/auth/csrf');
      if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || csrf.headerName !== 'X-CSRF-TOKEN'
        || !('token' in csrf) || typeof csrf.token !== 'string' || !csrf.token)
        throw new ApiError('보안 확인을 준비할 수 없습니다.', 200, 'INVALID_RESPONSE');
      return parse(await request(path, { method: 'POST', csrfToken: csrf.token }));
    },
  };
}
