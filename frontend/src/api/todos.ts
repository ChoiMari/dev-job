import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';

export type Todo = {
  id: number; title: string; description: string | null; dueAt: string | null; dueTimeZone: string | null;
  completed: boolean; completedAt: string | null; createdAt: string; updatedAt: string;
};
export type TodoInput = Pick<Todo, 'title' | 'description' | 'dueAt' | 'dueTimeZone'>;
export type TodoPage = { items: Todo[]; page: number; size: number; totalElements: number };
export type TodoFilter = 'all' | 'open' | 'done';
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const offsetDate = (value: unknown): value is string => instant(value) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
function timeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}
function invalid(): never { throw new ApiError('할 일 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
export function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== 'object') return false;
  const todo = value as Record<string, unknown>;
  return positive(todo.id) && typeof todo.title === 'string' && !!todo.title.trim() && todo.title.length <= 200
    && (todo.description === null || (typeof todo.description === 'string' && todo.description.length <= 2000))
    && ((todo.dueAt === null && todo.dueTimeZone === null) || (offsetDate(todo.dueAt) && timeZone(todo.dueTimeZone)))
    && typeof todo.completed === 'boolean' && ((todo.completed && instant(todo.completedAt)) || (!todo.completed && todo.completedAt === null))
    && instant(todo.createdAt) && instant(todo.updatedAt);
}
export function createTodosApi(request: ReturnType<typeof createApiClient>) {
  function path(id: number) { if (!positive(id)) throw new TypeError('할 일 ID를 확인해 주세요.'); return `/me/todos/${id}`; }
  async function mutation(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!csrf || typeof csrf !== 'object' || !('headerName' in csrf) || !('token' in csrf)
      || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(url, { method, body, csrfToken: csrf.token });
  }
  return {
    list: async (page = 0, filter: TodoFilter = 'all', signal?: AbortSignal): Promise<TodoPage> => {
      if (!nonnegative(page)) throw new TypeError('페이지 번호를 확인해 주세요.');
      const completed = filter === 'all' ? undefined : filter === 'done';
      const value = await request('/me/todos', { query: { page, size: 20, completed }, signal });
      if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)
        || !('page' in value) || value.page !== page || !('size' in value) || value.size !== 20
        || !('totalElements' in value) || !nonnegative(value.totalElements)
        || value.totalElements < value.items.length || value.items.length > 20 || !value.items.every(isTodo)) return invalid();
      const items = value.items as Todo[];
      if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
      return { items, page, size: 20, totalElements: value.totalElements };
    },
    get: async (id: number, signal?: AbortSignal): Promise<Todo> => {
      const value = await request(path(id), { signal });
      return isTodo(value) ? value : invalid();
    },
    create: async (input: TodoInput): Promise<Todo> => {
      const value = await mutation('/me/todos', 'POST', input);
      return isTodo(value) ? value : invalid();
    },
    update: async (id: number, patch: Partial<TodoInput>): Promise<Todo> => {
      const value = await mutation(path(id), 'PATCH', patch);
      return isTodo(value) ? value : invalid();
    },
    complete: async (id: number, completed: boolean): Promise<Todo> => {
      const value = await mutation(`${path(id)}/completion`, 'PATCH', { completed });
      return isTodo(value) ? value : invalid();
    },
    remove: async (id: number): Promise<void> => { if (await mutation(path(id), 'DELETE') !== undefined) return invalid(); },
  };
}
