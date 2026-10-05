import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import { isJobSummary } from './jobs.ts';
import type { JobSummary } from './jobs.ts';

export type Bookmark = { id: number; job: JobSummary; createdAt: string };
export type BookmarkPage = { items: Bookmark[]; page: number; size: number; totalElements: number };
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const bookmark = (v: unknown): v is Bookmark => object(v) && integer(v.id) && v.id > 0
  && isJobSummary(v.job) && v.job.bookmarked && typeof v.createdAt === 'string'
  && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.createdAt) && Number.isFinite(Date.parse(v.createdAt));
const invalid = () => new ApiError('관심 공고 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE');
function validateId(id: number) {
  if (!integer(id) || id < 1) throw new ApiError('공고 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
}
export function createBookmarksApi(request: ReturnType<typeof createApiClient>) {
  async function mutation(path: string, method: 'POST' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!object(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) throw invalid();
    return request(path, { method, body, csrfToken: csrf.token });
  }
  return {
    async list(page = 0, size = 20, signal?: AbortSignal): Promise<BookmarkPage> {
      if (!integer(page) || !integer(size) || size < 1 || size > 100 || page * size > 2147483647) {
        throw new ApiError('페이지 주소를 확인해 주세요.', 400, 'INVALID_INPUT');
      }
      const value = await request('/bookmarks', { query: { page, size }, signal });
      if (!object(value) || !Array.isArray(value.items) || !value.items.every(bookmark)
        || value.page !== page || value.size !== size || !integer(value.totalElements)
        || value.totalElements < value.items.length || value.items.length > size
        || new Set(value.items.map(item => item.job.id)).size !== value.items.length) throw invalid();
      return value as BookmarkPage;
    },
    async add(jobId: number): Promise<Bookmark> {
      validateId(jobId);
      const value = await mutation('/bookmarks', 'POST', { jobId });
      if (!bookmark(value) || value.job.id !== jobId) throw invalid();
      return value;
    },
    async remove(jobId: number): Promise<void> {
      validateId(jobId);
      if (await mutation(`/bookmarks/${jobId}`, 'DELETE') !== undefined) throw invalid();
    },
  };
}
