import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type DocumentType = 'RESUME' | 'COVER_LETTER';
export type DocumentVersionSelection = { documentType: DocumentType; documentId: number; versionId: number };
export type DocumentSummary = { id: number; title: string; latestVersionId: number; latestVersionNumber: number; latestVersionCreatedAt: string; createdAt: string; updatedAt: string };
export type DocumentPage = { items: DocumentSummary[]; page: number; size: number; totalElements: number };
export type DocumentVersion = { id: number; versionNumber: number; createdAt: string; content?: string; resumeId?: number; coverLetterId?: number };
export type DocumentAnalysis = { id: number; status: 'PENDING' | 'COMPLETED' | 'FAILED'; source: DocumentVersionSelection & { versionNumber: number; createdAt: string }; stale: boolean; result: { skills: string[]; strengths: string[]; improvements: string[] } | null; failureReason: string | null; consentedAt: string; analyzedAt: string | null; updatedAt: string };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const invalid = (): never => { throw new ApiError('문서 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); };
export const isDocumentSummary = (v: unknown): v is DocumentSummary => record(v) && id(v.id) && typeof v.title === 'string'
  && id(v.latestVersionId) && id(v.latestVersionNumber) && date(v.latestVersionCreatedAt) && date(v.createdAt) && date(v.updatedAt);
export const isDocumentVersion = (v: unknown, type: DocumentType, documentId: number, detail = false): v is DocumentVersion =>
  record(v) && id(v.id) && id(v.versionNumber) && date(v.createdAt)
  && v[type === 'RESUME' ? 'resumeId' : 'coverLetterId'] === documentId
  && (!detail || typeof v.content === 'string');
export const isDocumentAnalysis = (v: unknown, selection: DocumentVersionSelection): v is DocumentAnalysis =>
  record(v) && id(v.id) && ['PENDING', 'COMPLETED', 'FAILED'].includes(String(v.status))
  && record(v.source) && v.source.documentType === selection.documentType
  && v.source.documentId === selection.documentId && v.source.versionId === selection.versionId
  && id(v.source.versionNumber) && date(v.source.createdAt) && typeof v.stale === 'boolean'
  && (v.result === null || (record(v.result) && ['skills', 'strengths', 'improvements'].every(k => Array.isArray((v.result as Record<string, unknown>)[k])
    && ((v.result as Record<string, unknown>)[k] as unknown[]).every(s => typeof s === 'string'))))
  && (v.failureReason === null || typeof v.failureReason === 'string') && date(v.consentedAt)
  && (v.analyzedAt === null || date(v.analyzedAt)) && date(v.updatedAt);

export function createDocumentApi(request: ReturnType<typeof createApiClient>, type: DocumentType) {
  const base = type === 'RESUME' ? '/me/resumes' : '/me/cover-letters';
  const path = (documentId: number) => { if (!id(documentId)) throw new TypeError('문서 ID를 확인해 주세요.'); return `${base}/${documentId}`; };
  const versionPath = (documentId: number, versionId: number) => { if (!id(versionId)) throw new TypeError('버전 ID를 확인해 주세요.'); return `${path(documentId)}/versions/${versionId}`; };
  const csrf = async () => { const value = await request('/auth/csrf'); if (!record(value) || value.headerName !== 'X-CSRF-TOKEN' || typeof value.token !== 'string' || !value.token) return invalid(); return value.token; };
  return {
    list: async (page = 0, signal?: AbortSignal): Promise<DocumentPage> => {
      const v = await request(base, { query: { page, size: 20 }, signal });
      return record(v) && Array.isArray(v.items) && v.items.every(isDocumentSummary)
        && integer(v.page) && id(v.size) && integer(v.totalElements) ? v as DocumentPage : invalid();
    },
    get: async (documentId: number, signal?: AbortSignal): Promise<DocumentSummary> => {
      const v = await request(path(documentId), { signal }); return isDocumentSummary(v) && v.id === documentId ? v : invalid();
    },
    create: async (title: string, content: string): Promise<DocumentSummary> => {
      const v = await request(base, { method: 'POST', body: { title, content }, csrfToken: await csrf() });
      return isDocumentSummary(v) ? v : invalid();
    },
    rename: async (documentId: number, title: string): Promise<DocumentSummary> => {
      const v = await request(path(documentId), { method: 'PATCH', body: { title }, csrfToken: await csrf() });
      return isDocumentSummary(v) && v.id === documentId ? v : invalid();
    },
    remove: async (documentId: number): Promise<void> => { await request(path(documentId), { method: 'DELETE', csrfToken: await csrf() }); },
    versions: async (documentId: number, signal?: AbortSignal): Promise<DocumentVersion[]> => {
      const v = await request(`${path(documentId)}/versions`, { signal });
      return Array.isArray(v) && v.every(item => isDocumentVersion(item, type, documentId) && !('content' in item)) ? v : invalid();
    },
    addVersion: async (documentId: number, content: string): Promise<DocumentVersion> => {
      const v = await request(`${path(documentId)}/versions`, { method: 'POST', body: { content }, csrfToken: await csrf() });
      return isDocumentVersion(v, type, documentId) && !('content' in v) ? v : invalid();
    },
    version: async (documentId: number, versionId: number, signal?: AbortSignal): Promise<DocumentVersion> => {
      const v = await request(versionPath(documentId, versionId), { signal });
      return isDocumentVersion(v, type, documentId, true) && v.id === versionId ? v : invalid();
    },
    analysis: async (selection: DocumentVersionSelection, signal?: AbortSignal): Promise<DocumentAnalysis> => {
      const v = await request(`${versionPath(selection.documentId, selection.versionId)}/analysis`, { signal });
      return isDocumentAnalysis(v, selection) ? v : invalid();
    },
    analyze: async (selection: DocumentVersionSelection): Promise<DocumentAnalysis> => {
      const v = await request(`${versionPath(selection.documentId, selection.versionId)}/analysis`,
        { method: 'POST', body: { consentToExternalAnalysis: true }, csrfToken: await csrf() });
      return isDocumentAnalysis(v, selection) ? v : invalid();
    },
    removeAnalysis: async (selection: DocumentVersionSelection): Promise<void> => {
      await request(`${versionPath(selection.documentId, selection.versionId)}/analysis`, { method: 'DELETE', csrfToken: await csrf() });
    },
  };
}
