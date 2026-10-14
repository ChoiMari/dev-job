import { ApiError } from './client.ts';
import type { createApiClient } from './client.ts';
import type { Skill } from './skills.ts';

export type LearningGoal = { id: number; title: string; description: string | null; skill: Skill | null;
  progressPercent: number; completed: boolean; completedAt: string | null; createdAt: string; updatedAt: string };
export type LearningGoalPage = { items: LearningGoal[]; page: number; size: number; totalElements: number };
export type GoalInput = { title: string; description?: string | null; skillId?: number | null; progressPercent?: number };
export type GoalPatch = Partial<GoalInput>;
export type GoalTask = { id: number; title: string; completed: boolean; createdAt: string; updatedAt: string };
type Request = ReturnType<typeof createApiClient>;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const id = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const timestamp = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
function isGoalTask(v: unknown): v is GoalTask {
  return obj(v) && id(v.id) && typeof v.title === 'string' && !!v.title.trim() && v.title.length <= 200
    && typeof v.completed === 'boolean' && timestamp(v.createdAt) && timestamp(v.updatedAt);
}
function task(v: unknown): GoalTask { if (!isGoalTask(v)) return invalid(); return v; }
export function isLearningGoal(v: unknown): v is LearningGoal {
  return obj(v) && id(v.id) && typeof v.title === 'string' && !!v.title.trim() && v.title.length <= 200
    && (v.description === null || typeof v.description === 'string' && v.description.length <= 2000)
    && (v.skill === null || obj(v.skill) && id(v.skill.id) && typeof v.skill.name === 'string' && !!v.skill.name)
    && nonnegative(v.progressPercent) && v.progressPercent <= 100 && typeof v.completed === 'boolean'
    && (v.completedAt === null || timestamp(v.completedAt)) && (v.completed ? v.progressPercent === 100 && timestamp(v.completedAt) : v.completedAt === null)
    && timestamp(v.createdAt) && timestamp(v.updatedAt);
}
function invalid(): never { throw new ApiError('학습 목표 응답을 확인할 수 없습니다.', 200, 'INVALID_RESPONSE'); }
function goal(v: unknown): LearningGoal { if (!isLearningGoal(v)) return invalid(); return v; }
function checkId(value: number) { if (!id(value)) throw new TypeError('학습 목표 ID를 확인해 주세요.'); }
function checkInput(value: GoalPatch, create: boolean) {
  if (!Object.keys(value).length || Object.keys(value).some(k => !['title', 'description', 'skillId', 'progressPercent'].includes(k)))
    throw new TypeError('변경할 목표 내용을 입력해 주세요.');
  if ((create || 'title' in value) && (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200))
    throw new TypeError('목표 제목은 1~200자로 입력해 주세요.');
  if (value.description !== undefined && value.description !== null && (typeof value.description !== 'string' || value.description.length > 2000))
    throw new TypeError('설명은 2000자 이내로 입력해 주세요.');
  if (value.skillId !== undefined && value.skillId !== null && !id(value.skillId)) throw new TypeError('기술을 확인해 주세요.');
  if (value.progressPercent !== undefined && (!nonnegative(value.progressPercent) || value.progressPercent > 100))
    throw new TypeError('진행률은 0~100 정수로 입력해 주세요.');
}
export function createLearningGoalsApi(request: Request) {
  async function mutate(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    const csrf = await request('/auth/csrf');
    if (!obj(csrf) || csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string' || !csrf.token) return invalid();
    return request(path, { method, body, csrfToken: csrf.token });
  }
  return {
    async list(page = 0, completed?: boolean, signal?: AbortSignal): Promise<LearningGoalPage> {
      const value = await request('/me/learning-goals', { query: { page, size: 20, completed }, signal });
      if (!obj(value) || !Array.isArray(value.items) || value.page !== page || value.size !== 20
        || !nonnegative(value.totalElements) || !value.items.every(isLearningGoal)) return invalid();
      return value as LearningGoalPage;
    },
    async get(goalId: number, signal?: AbortSignal) { checkId(goalId); return goal(await request(`/me/learning-goals/${goalId}`, { signal })); },
    async create(input: GoalInput) { checkInput(input, true); return goal(await mutate('/me/learning-goals', 'POST', input)); },
    async update(goalId: number, patch: GoalPatch) { checkId(goalId); checkInput(patch, false); return goal(await mutate(`/me/learning-goals/${goalId}`, 'PATCH', patch)); },
    async completion(goalId: number, completed: boolean) { checkId(goalId); return goal(await mutate(`/me/learning-goals/${goalId}/completion`, 'PATCH', { completed })); },
    async remove(goalId: number) { checkId(goalId); if (await mutate(`/me/learning-goals/${goalId}`, 'DELETE') !== undefined) return invalid(); },
    async listTasks(goalId: number, signal?: AbortSignal): Promise<GoalTask[]> {
      checkId(goalId);
      const value = await request(`/me/learning-goals/${goalId}/tasks`, { signal });
      if (!Array.isArray(value) || !value.every(isGoalTask)) return invalid();
      return value;
    },
    async addTask(goalId: number, title: string): Promise<GoalTask> {
      checkId(goalId);
      return task(await mutate(`/me/learning-goals/${goalId}/tasks`, 'POST', { title }));
    },
    async updateTask(goalId: number, taskId: number, patch: { title?: string; completed?: boolean }): Promise<GoalTask> {
      checkId(goalId); checkId(taskId);
      return task(await mutate(`/me/learning-goals/${goalId}/tasks/${taskId}`, 'PATCH', patch));
    },
    async removeTask(goalId: number, taskId: number): Promise<void> {
      checkId(goalId); checkId(taskId);
      if (await mutate(`/me/learning-goals/${goalId}/tasks/${taskId}`, 'DELETE') !== undefined) return invalid();
    },
  };
}
