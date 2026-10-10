import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createLearningGoalsApi } from '../../api/learning-goals';
import type { GoalInput, LearningGoal, LearningGoalPage } from '../../api/learning-goals';
import { createSkillsApi } from '../../api/skills';
import type { Skill } from '../../api/skills';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import art from '../../assets/redesign/ext-img-05d-learning.png';
import './learning-goals.css';

const goals = createLearningGoalsApi(apiRequest), skills = createSkillsApi(apiRequest);
const message = (e: unknown) => e instanceof Error ? e.message : '요청을 처리하지 못했습니다.';
const failure = (e: unknown) => e instanceof ApiError && e.status === 403 ? '이 학습 목표에 접근할 권한이 없습니다.'
  : e instanceof ApiError && e.status === 404 ? '학습 목표를 찾을 수 없습니다.'
    : e instanceof ApiError && e.status === 409 ? '같은 기술과 제목의 목표가 있거나 완료 조건을 충족하지 않았습니다.' : message(e);
const blank = { title: '', description: '', skillId: '', progressPercent: '0' };
export function LearningGoalsPage({ location }: { location: string }) {
  const [path, search = ''] = location.split('?');
  const match = /^\/learning-goals\/(\d+)$/.exec(path), id = match ? Number(match[1]) : null;
  const params = new URLSearchParams(search), page = Math.max(0, Number(params.get('page') || 0) || 0);
  const completed = params.get('completed') === 'true' ? true : params.get('completed') === 'false' ? false : undefined;
  const [list, setList] = useState<LearningGoalPage>(); const [detail, setDetail] = useState<LearningGoal>();
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false), [retry, setRetry] = useState(0);
  const [form, setForm] = useState(blank), [skillQuery, setSkillQuery] = useState(''), [choices, setChoices] = useState<Skill[]>([]);
  const [skillError, setSkillError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const request = id === null ? goals.list(page, completed, controller.signal) : goals.get(id, controller.signal);
    request.then(value => { if (controller.signal.aborted) return;
      if ('items' in value) { setList(value); setDetail(undefined); setForm(blank); }
      else { setDetail(value); setForm({ title: value.title, description: value.description || '', skillId: value.skill ? String(value.skill.id) : '', progressPercent: String(value.progressPercent) }); }
    }).catch(e => { if (!controller.signal.aborted) setError(failure(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [location, retry]);
  useEffect(() => {
    if (!skillQuery.trim()) { setChoices([]); setSkillError(''); return; }
    const controller = new AbortController();
    skills.search(skillQuery.trim(), 0, controller.signal).then(v => { if (!controller.signal.aborted) setChoices(v.items); })
      .catch(e => { if (!controller.signal.aborted) setSkillError(message(e)); });
    return () => controller.abort();
  }, [skillQuery]);
  async function save() {
    if (saving) return;
    if (!form.title.trim() || form.title.length > 200 || form.description.length > 2000 || !/^\d+$/.test(form.progressPercent) || Number(form.progressPercent) > 100) {
      setActionError('제목 1~200자, 설명 2000자 이내, 진행률 0~100 정수를 입력해 주세요.'); return;
    }
    const body: GoalInput = { title: form.title, description: form.description.trim() || null, skillId: form.skillId ? Number(form.skillId) : null, progressPercent: Number(form.progressPercent) };
    setSaving(true); setActionError('');
    try { const value = id === null ? await goals.create(body) : await goals.update(id, body); setDetail(value); window.location.hash = `/learning-goals/${value.id}`; setRetry(v => v + 1); }
    catch (e) { setActionError(failure(e)); } finally { setSaving(false); }
  }
  async function changeCompletion(value: boolean) {
    if (id === null || saving) return;
    if (value && detail?.progressPercent !== 100) { setActionError('완료하려면 진행률을 100으로 저장해 주세요.'); return; }
    setSaving(true); setActionError('');
    try { setDetail(await goals.completion(id, value)); setRetry(v => v + 1); }
    catch (e) { setActionError(failure(e)); } finally { setSaving(false); }
  }
  async function remove() {
    if (id === null || saving || !window.confirm('이 학습 목표를 삭제할까요?')) return;
    setSaving(true); setActionError('');
    try { await goals.remove(id); window.location.hash = '/learning-goals'; }
    catch (e) { setActionError(failure(e)); setSaving(false); }
  }
  const setFilter = (value: string) => { const q = new URLSearchParams(); if (value) q.set('completed', value); window.location.hash = `/learning-goals${q.size ? `?${q}` : ''}`; };
  const setPage = (next: number) => { const q = new URLSearchParams(); if (completed !== undefined) q.set('completed', String(completed)); q.set('page', String(next)); window.location.hash = `/learning-goals?${q}`; };
  return <div className="learning-page">
    <section className="card learning-hero"><div><h2>내 학습 목표</h2><p>개인 목표와 진행률을 기록합니다. Skill Gap은 별도의 읽기 전용 분석입니다.</p><a href="#/skill-gap">Skill Gap 보기</a></div><img src={art} alt="" aria-hidden="true" /></section>
    <p className="learning-note">목표 완료·취소·삭제는 보유 기술, 숙련도·경험 또는 Skill Gap 계산을 자동으로 바꾸지 않습니다. 분석을 계산할 수 없어도 목표는 관리할 수 있습니다.</p>
    {id !== null && <a href="#/learning-goals">← 목표 목록</a>}
    {loading ? <section className="card"><LoadingState message="학습 목표를 불러오고 있습니다." /></section>
      : error ? <section className="card"><ErrorState message={error} onRetry={() => setRetry(v => v + 1)} /></section>
        : id === null ? <section className="card"><h2>목표 목록</h2><label>완료 상태 <select value={completed === undefined ? '' : String(completed)} onChange={e => setFilter(e.target.value)}><option value="">전체</option><option value="false">진행 중</option><option value="true">완료</option></select></label>
          {list && <><p>{list.totalElements}개 목표</p>{list.items.length === 0 ? <EmptyState title="표시할 목표가 없습니다." message="새 목표를 만들거나 필터를 바꿔 보세요." /> : <ul className="learning-list">{list.items.map(g => <li key={g.id}><a href={`#/learning-goals/${g.id}`}><strong>{g.title}</strong></a><span>{g.skill?.name || '연결 기술 없음'} · {g.progressPercent}% · {g.completed ? '완료' : '진행 중'}</span><progress value={g.progressPercent} max="100">{g.progressPercent}%</progress></li>)}</ul>}
            <nav className="learning-pagination" aria-label="학습 목표 페이지"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1}페이지</span><button type="button" disabled={(page + 1) * list.size >= list.totalElements} onClick={() => setPage(page + 1)}>다음</button></nav></>}
        </section> : detail && <section className="card"><h2>{detail.title}</h2><p>진행률 {detail.progressPercent}% · {detail.completed ? '완료' : '진행 중'}</p><p>연결 기술: {detail.skill?.name || '없음'}</p><p>완료 일시: {detail.completedAt ? new Date(detail.completedAt).toLocaleString('ko-KR') : '없음'}</p>
          <div className="learning-actions"><button type="button" disabled={saving || detail.completed || detail.progressPercent !== 100} onClick={() => changeCompletion(true)}>완료</button><button type="button" disabled={saving || !detail.completed} onClick={() => changeCompletion(false)}>완료 취소</button><button type="button" disabled={saving} onClick={remove}>삭제</button></div>
          {detail.progressPercent !== 100 && <p className="learning-note">완료는 저장된 진행률이 100일 때만 가능합니다.</p>}
        </section>}
    {!loading && !error && (id === null || detail) && <section className="card"><h2>{id === null ? '새 목표 만들기' : '목표 수정'}</h2><form className="learning-form" onSubmit={e => { e.preventDefault(); void save(); }}>
      <label>제목<input required maxLength={200} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label>
      <label>설명<textarea maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} /></label>
      <label>진행률 (%)<input type="number" min="0" max="100" step="1" required disabled={!!detail?.completed} value={form.progressPercent} onChange={e => setForm(v => ({ ...v, progressPercent: e.target.value }))} /></label>
      <label>연결 기술 검색 (선택)<input type="search" value={skillQuery} onChange={e => setSkillQuery(e.target.value)} placeholder="공용 기술명" /></label>
      {skillError && <p role="alert">{skillError}</p>}{choices.length > 0 && <div className="learning-matches">{choices.map(s => <button type="button" key={s.id} onClick={() => { setForm(v => ({ ...v, skillId: String(s.id) })); setSkillQuery(s.name); setChoices([]); }}>{s.name}</button>)}</div>}
      <p>선택 기술: {form.skillId ? `${detail?.skill?.id === Number(form.skillId) ? detail.skill.name : skillQuery || '기술'} (ID ${form.skillId})` : '없음'} {form.skillId && <button type="button" onClick={() => { setForm(v => ({ ...v, skillId: '' })); setSkillQuery(''); }}>연결 해제</button>}</p>
      <button type="submit" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
    </form></section>}{actionError && <p role="alert" className="form-error">{actionError}</p>}
  </div>;
}
