import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { JobCandidate } from './saved-jobs.ts';

export type RecommendationRequest = {
  resumeVersionId: number | null;
  coverLetterVersionId: number | null;
  candidates: JobCandidate[];
  consentToExternalComparison: true;
};
export type RecommendationEvidence = { documentQuote: string; jobQuote: string; explanation: string };
export type RecommendationPreparationTip = { type: 'CHECK' | 'IMPROVE' | 'PREPARE'; basisQuote: string; text: string };
export type RecommendationItem = JobCandidate & {
  title: string;
  companyName: string | null;
  location: string | null;
  deadlineDate: string | null;
  skillTags: string[];
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'INSUFFICIENT_INPUT' | 'EXCLUDED' | 'NO_RESULT' | 'UNRELATED';
  reason: string | null;
  rank: number | null;
  evidence: RecommendationEvidence[];
  limitations: string[];
  preparationTips: RecommendationPreparationTip[];
};
export type RecommendationPage = {
  id: number; status: 'PENDING' | 'COMPLETED' | 'FAILED'; stale: boolean;
  failureReason: string | null; consentedAt: string; analyzedAt: string | null;
  policyVersion: string; modelName: string;
  resumeVersionId: number | null; coverLetterVersionId: number | null;
  candidateCount: number; items: RecommendationItem[];
  page: number; size: number; totalElements: number; limitation: string;
};
export type RecommendationHistoryItem = Pick<RecommendationPage, 'id' | 'status' | 'consentedAt' | 'analyzedAt' | 'candidateCount' | 'resumeVersionId' | 'coverLetterVersionId'>;
export type RecommendationHistoryPage = { items: RecommendationHistoryItem[]; page: number; size: number; totalElements: number };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const nullableId = (v: unknown) => v === null || positive(v);
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const nullableDate = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
const date = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const candidate = (v: unknown): v is JobCandidate => record(v) && (v.kind === 'COLLECTED' || v.kind === 'MANUAL') && positive(v.id);
const invalid = (): never => { throw new ApiError('추천 결과 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); };
function isRecommendationItem(item: unknown): item is RecommendationItem {
  if (!record(item) || !candidate(item)) return false;
  const fields = item as Record<string, unknown>;
  return typeof fields.title === 'string'
    && nullableText(fields.companyName) && nullableText(fields.location) && nullableDate(fields.deadlineDate)
    && Array.isArray(fields.skillTags) && fields.skillTags.every((s: unknown) => typeof s === 'string')
    && ['PENDING', 'COMPLETED', 'FAILED', 'INSUFFICIENT_INPUT', 'EXCLUDED', 'NO_RESULT', 'UNRELATED'].includes(String(fields.status))
    && nullableText(fields.reason) && (fields.rank === null || positive(fields.rank))
    && Array.isArray(fields.evidence) && fields.evidence.every((e: unknown) => record(e)
      && typeof e.documentQuote === 'string' && typeof e.jobQuote === 'string' && typeof e.explanation === 'string')
    && Array.isArray(fields.limitations) && fields.limitations.every((s: unknown) => typeof s === 'string')
    && Array.isArray(fields.preparationTips) && fields.preparationTips.every((tip: unknown) => record(tip)
      && (tip.type === 'CHECK' || tip.type === 'IMPROVE' || tip.type === 'PREPARE') && typeof tip.basisQuote === 'string'
      && typeof tip.text === 'string');
}

export function validateRecommendationRequest(input: RecommendationRequest): void {
  if (!nullableId(input.resumeVersionId) || !nullableId(input.coverLetterVersionId)
    || (input.resumeVersionId === null && input.coverLetterVersionId === null))
    throw new TypeError('이력서 또는 자기소개서 버전을 하나 이상 선택해 주세요.');
  if (input.consentToExternalComparison !== true) throw new TypeError('외부 비교 동의가 필요합니다.');
  if (!Array.isArray(input.candidates) || input.candidates.length < 1 || input.candidates.length > 20 || !input.candidates.every(candidate)
    || new Set(input.candidates.map(v => `${v.kind}:${v.id}`)).size !== input.candidates.length)
    throw new TypeError('공고 후보는 중복 없이 1개 이상, 최대 20개까지 선택해 주세요.');
}

export function isRecommendationPage(v: unknown): v is RecommendationPage {
  return record(v) && positive(v.id) && ['PENDING', 'COMPLETED', 'FAILED'].includes(String(v.status))
    && typeof v.stale === 'boolean' && nullableText(v.failureReason) && date(v.consentedAt)
    && (v.analyzedAt === null || date(v.analyzedAt)) && typeof v.policyVersion === 'string'
    && typeof v.modelName === 'string' && nullableId(v.resumeVersionId) && nullableId(v.coverLetterVersionId)
    && (positive(v.resumeVersionId) || positive(v.coverLetterVersionId))
    && nonnegative(v.candidateCount) && v.candidateCount <= 20 && Array.isArray(v.items)
    && v.items.every(isRecommendationItem)
    && nonnegative(v.page) && positive(v.size) && nonnegative(v.totalElements)
    && typeof v.limitation === 'string';
}

export function createRecommendationsApi(request: ReturnType<typeof createApiClient>) {
  const csrf = async () => {
    const value = await request('/auth/csrf');
    if (!record(value) || value.headerName !== 'X-CSRF-TOKEN' || typeof value.token !== 'string' || !value.token) return invalid();
    return value.token;
  };
  return {
    async history(page = 0, size = 10, signal?: AbortSignal): Promise<RecommendationHistoryPage> {
      if (!nonnegative(page) || !positive(size) || size > 50) throw new TypeError('비교 내역 페이지를 확인해 주세요.');
      const value = await request('/me/recommendations/jobs/history', { query: { page, size }, signal });
      return record(value) && Array.isArray(value.items) && value.items.every((item: unknown) => record(item)
        && positive(item.id) && ['PENDING', 'COMPLETED', 'FAILED'].includes(String(item.status))
        && date(item.consentedAt) && (item.analyzedAt === null || date(item.analyzedAt))
        && nonnegative(item.candidateCount) && nullableId(item.resumeVersionId) && nullableId(item.coverLetterVersionId))
        && nonnegative(value.page) && positive(value.size) && nonnegative(value.totalElements)
        ? value as RecommendationHistoryPage : invalid();
    },
    async create(input: RecommendationRequest): Promise<RecommendationPage> {
      validateRecommendationRequest(input);
      const value = await request('/me/recommendations/jobs', { method: 'POST', body: input, csrfToken: await csrf() });
      return isRecommendationPage(value) ? value : invalid();
    },
    async get(id: number, page = 0, size = 20, signal?: AbortSignal): Promise<RecommendationPage> {
      if (!positive(id) || !nonnegative(page) || !positive(size) || size > 20) throw new TypeError('추천 결과 주소를 확인해 주세요.');
      const value = await request('/me/recommendations/jobs', { query: { requestId: id, page, size }, signal });
      return isRecommendationPage(value) && value.id === id && value.page === page ? value : invalid();
    },
    async getById(id: number, page = 0, size = 20, signal?: AbortSignal): Promise<RecommendationPage> {
      if (!positive(id) || !nonnegative(page) || !positive(size) || size > 20) throw new TypeError('추천 결과 주소를 확인해 주세요.');
      const value = await request(`/me/recommendations/jobs/${id}`, { query: { page, size }, signal });
      return isRecommendationPage(value) && value.id === id && value.page === page ? value : invalid();
    },
  };
}
