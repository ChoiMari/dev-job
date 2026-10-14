import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createLearningGoalsApi } from '../../api/learning-goals';
import type { GoalInput, GoalTask, LearningGoal, LearningGoalPage } from '../../api/learning-goals';
import { createSkillGapApi } from '../../api/skill-gap';
import type { SkillGap } from '../../api/skill-gap';
import { createSkillsApi } from '../../api/skills';
import type { OwnedSkill, Skill } from '../../api/skills';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { PixelIcon } from '../../components/PixelArt';
import { FixedSkillImage } from '../../components/FixedSkillImage';
import { skillLevelLabel } from '../../components/skillLevel';
import './learning-goals.css';

const goals = createLearningGoalsApi(apiRequest), gapApi = createSkillGapApi(apiRequest), skills = createSkillsApi(apiRequest);
const message = (e: unknown) => e instanceof Error ? e.message : '요청을 처리하지 못했습니다.';
const failure = (e: unknown) => e instanceof ApiError && e.status === 403 ? '이 학습 목표에 접근할 권한이 없습니다.'
  : e instanceof ApiError && e.status === 404 ? '학습 목표를 찾을 수 없습니다.'
    : e instanceof ApiError && e.status === 409 ? '같은 기술과 제목의 목표가 있거나 현재 상태에서 변경할 수 없습니다.' : message(e);
const blank = { title: '', description: '', skillId: '' };
const gapReasons: Record<string, string> = {
  USER_SKILLS_EMPTY: '등록된 기술이 없습니다. 프로필에 기술을 추가하면 비교할 수 있습니다.',
  INSUFFICIENT_SAMPLE: '분석 완료 공고가 5건 이상 모이면 부족 기술 순위를 볼 수 있습니다.',
  NO_JOB_SKILLS: '분석 완료 공고에서 기술이 추출되면 비교할 수 있습니다.',
};

export function LearningGoalsPage({ location }: { location: string }) {
  const [path, search = ''] = location.split('?');
  const match = /^\/learning-goals\/(\d+)$/.exec(path), id = match ? Number(match[1]) : null;
  const params = new URLSearchParams(search), page = Math.max(0, Number(params.get('page') || 0) || 0);
  const completed = params.get('completed') === 'true' ? true : params.get('completed') === 'false' ? false : undefined;
  const [list, setList] = useState<LearningGoalPage>(), [detail, setDetail] = useState<LearningGoal>();
  const [tasks, setTasks] = useState<GoalTask[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false), [retry, setRetry] = useState(0);
  const [form, setForm] = useState(blank), [skillQuery, setSkillQuery] = useState(''), [choices, setChoices] = useState<Skill[]>([]);
  const [skillError, setSkillError] = useState('');
  const [newTask, setNewTask] = useState(''), [editingTask, setEditingTask] = useState<number | null>(null), [editingTitle, setEditingTitle] = useState('');
  const [gap, setGap] = useState<SkillGap>(), [gapError, setGapError] = useState(''), [gapLoading, setGapLoading] = useState(true);
  const [roleDraft, setRoleDraft] = useState(''), [role, setRole] = useState(''), [gapRetry, setGapRetry] = useState(0);
  const [owned, setOwned] = useState<OwnedSkill[]>([]), [ownedError, setOwnedError] = useState('');

  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const request = id === null ? goals.list(page, completed, controller.signal)
      : Promise.all([goals.get(id, controller.signal), goals.listTasks(id, controller.signal)]);
    request.then(value => {
      if (controller.signal.aborted) return;
      if (Array.isArray(value)) {
        const [goal, items] = value; setDetail(goal); setTasks(items);
        setForm({ title: goal.title, description: goal.description || '', skillId: goal.skill ? String(goal.skill.id) : '' });
        setSkillQuery(goal.skill?.name || '');
      } else { setList(value); setDetail(undefined); setTasks([]); }
    }).catch(e => { if (!controller.signal.aborted) setError(failure(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [location, retry]);
  useEffect(() => {
    const controller = new AbortController(); setGapLoading(true); setGapError('');
    gapApi.get(role || undefined, controller.signal).then(v => { if (!controller.signal.aborted) setGap(v); })
      .catch(e => { if (!controller.signal.aborted) setGapError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setGapLoading(false); });
    return () => controller.abort();
  }, [role, gapRetry]);
  useEffect(() => {
    const controller = new AbortController();
    skills.list(controller.signal).then(v => { if (!controller.signal.aborted) setOwned(v); })
      .catch(e => { if (!controller.signal.aborted) setOwnedError(message(e)); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!skillQuery.trim() || form.skillId) { setChoices([]); setSkillError(''); return; }
    const controller = new AbortController();
    skills.search(skillQuery.trim(), 0, controller.signal).then(v => { if (!controller.signal.aborted) setChoices(v.items); })
      .catch(e => { if (!controller.signal.aborted) setSkillError(message(e)); });
    return () => controller.abort();
  }, [skillQuery, form.skillId]);

  function draftGoal(skill: Skill) {
    setForm({ title: `${skill.name} 학습하기`, description: '', skillId: String(skill.id) });
    setSkillQuery(skill.name); setChoices([]); setActionError('');
    if (id !== null) window.location.hash = '/learning-goals';
    window.setTimeout(() => document.getElementById('learning-goal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
  async function save() {
    if (saving) return;
    if (!form.title.trim() || form.title.length > 200 || form.description.length > 2000) {
      setActionError('제목 1~200자, 설명 2000자 이내로 입력해 주세요.'); return;
    }
    const body: GoalInput = { title: form.title, description: form.description.trim() || null,
      skillId: form.skillId ? Number(form.skillId) : null };
    setSaving(true); setActionError('');
    try {
      const value = id === null ? await goals.create(body) : await goals.update(id, body);
      setDetail(value); window.location.hash = `/learning-goals/${value.id}`; setRetry(v => v + 1);
    } catch (e) { setActionError(failure(e)); } finally { setSaving(false); }
  }
  async function changeCompletion(value: boolean) {
    if (id === null || saving) return;
    if (value && detail?.progressPercent !== 100) {
      setActionError('진행률이 100%가 되면 목표를 완료할 수 있습니다.'); return;
    }
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
  async function mutateTask(action: () => Promise<unknown>) {
    if (saving) return;
    setSaving(true); setActionError('');
    try { await action(); setNewTask(''); setEditingTask(null); setRetry(v => v + 1); }
    catch (e) { setActionError(failure(e)); } finally { setSaving(false); }
  }
  const setFilter = (value: string) => { const q = new URLSearchParams(); if (value) q.set('completed', value); window.location.hash = `/learning-goals${q.size ? `?${q}` : ''}`; };
  const setPage = (next: number) => { const q = new URLSearchParams(); if (completed !== undefined) q.set('completed', String(completed)); q.set('page', String(next)); window.location.hash = `/learning-goals?${q}`; };
  const missing = gap?.available ? gap.items : [];
  const activeGoals = list?.items.filter(goal => !goal.completed).length || 0;
  const completedGoals = list?.items.filter(goal => goal.completed).length || 0;
  const averageProgress = list?.items.length ? Math.round(list.items.reduce((sum, goal) => sum + goal.progressPercent, 0) / list.items.length) : 0;

  return <div className="learning-page">
    <header className="learning-banner">
      <div className="learning-banner__copy"><h1>역량 분석 &amp; 학습 목표</h1><p>내 기술과 채용공고를 비교하고, 부족한 기술을 학습 목표로 이어가세요.</p></div>
    </header>
    <section className="learning-stage" id="learning-analysis" aria-label="역량 분석 요약">
      <div className="learning-stage__head"><div><span className="learning-stage__number">1</span><h2>역량 분석 요약</h2>
        <p>보유 기술과 분석 완료 공고의 요구 기술을 비교합니다.</p></div>
        <form className="learning-role" onSubmit={e => { e.preventDefault(); setRole(roleDraft.trim()); if (roleDraft.trim() === role) setGapRetry(v => v + 1); }}>
          <label>희망 직무<input type="search" maxLength={200} value={roleDraft} onChange={e => setRoleDraft(e.target.value)} placeholder="비우면 프로필 희망 직무" /></label>
          <button type="submit">분석하기</button></form></div>
      {gapLoading ? <LoadingState message="역량 분석을 불러오고 있습니다." /> : gapError ? <ErrorState message={gapError} onRetry={() => setGapRetry(v => v + 1)} /> : gap && <>
        <div className="learning-analysis-grid">
          <article className="learning-panel learning-summary"><h3><PixelIcon name="chart" /> 종합 분석 결과</h3>
            <div className="learning-summary__body"><div className="learning-ring"><strong>{gap.analyzedJobCount}</strong><small>분석 공고</small></div>
              <div><strong>부족 기술 {gap.totalMissingSkills}개</strong><p>비교 직무: {gap.desiredRole || '전체 공고'}</p>
                <p>보유 기술 {owned.length}개와 공고에 나온 기술을 비교했습니다.</p></div></div>
            {gap.provisional && <p className="learning-caution">표본이 적어 순위가 달라질 수 있습니다.</p>}
            {ownedError && <p className="learning-caution" role="alert">보유 기술을 불러오지 못했습니다: {ownedError}</p>}
          </article>
          <article className="learning-panel"><h3><PixelIcon name="chart" /> 부족 기술 수요</h3>
            {missing.length ? <div className="learning-demand-list">{missing.map(item => <div key={item.skill.id} className="learning-demand-row">
              <span className="learning-skill-name"><FixedSkillImage name={item.skill.name} />{item.skill.name}</span><div className="learning-meter"><span style={{ width: `${Math.min(100, item.demandRatio * 100)}%` }} /></div>
              <strong>{(item.demandRatio * 100).toFixed(1)}%</strong></div>)}</div>
              : <p className="learning-muted">{gap.available ? '현재 부족 기술이 없습니다.' : gapReasons[gap.reason || ''] || '현재 분석할 수 없습니다.'}</p>}
          </article>
          <article className="learning-panel"><div className="learning-panel__head"><h3><PixelIcon name="spark" /> 추천 학습 방향</h3></div>
            {missing.length ? <ol className="learning-recommendations">{missing.slice(0, 3).map((item, index) => <li key={item.skill.id}>
              <span>{index + 1}</span><div><strong className="learning-skill-name"><FixedSkillImage name={item.skill.name} />{item.skill.name} 학습하기</strong><small>분석 공고 {item.demandJobCount}건에서 요구 · 필수 {item.requiredJobCount}건</small></div>
              <button type="button" onClick={() => draftGoal(item.skill)} aria-label={`${item.skill.name} 목표 초안 만들기`}>＋</button></li>)}</ol>
              : <p className="learning-muted">분석 결과가 생기면 학습 방향을 제안합니다.</p>}
          </article>
        </div>
        <div className="learning-analysis-grid learning-analysis-grid--lower">
          <article className="learning-panel"><h3><PixelIcon name="spark" /> 기술별 상세 분석</h3>
            {owned.length ? <ul className="learning-owned-list">{owned.slice(0, 6).map(skill => <li key={skill.id}>
              <strong className="learning-skill-name"><FixedSkillImage name={skill.name} />{skill.name}</strong><span>숙련도 {skillLevelLabel(skill.proficiencyLevel)}</span>
              {skill.proficiencyLevel !== null && <div className="learning-meter"><span style={{ width: `${skill.proficiencyLevel * 20}%` }} /></div>}</li>)}</ul>
              : <p className="learning-muted">보유 기술을 등록하면 여기에 표시됩니다.</p>}
          </article>
          <article className="learning-panel learning-missing"><div className="learning-panel__head"><h3><PixelIcon name="check" /> 부족 기술을 학습 목표로 전환해요</h3>
            <button type="button" className="learning-text-button" onClick={() => document.getElementById('learning-goal-form')?.scrollIntoView({ behavior: 'smooth' })}>직접 목표 만들기</button></div>
            {missing.length ? <ul>{missing.map(item => <li key={item.skill.id}><div><strong className="learning-skill-name"><FixedSkillImage name={item.skill.name} />{item.skill.name}</strong><small>공고 등장률 {(item.demandRatio * 100).toFixed(1)}%</small></div>
              <button type="button" onClick={() => draftGoal(item.skill)}>＋ 목표로 추가</button></li>)}</ul>
              : <p className="learning-muted">분석 결과가 없어도 아래에서 목표를 만들 수 있습니다.</p>}
          </article>
        </div>
        <p className="learning-note">공고 등장률은 선택한 조건의 분석 완료 공고 기준입니다. 역량 점수나 개인 숙련도를 뜻하지 않습니다. 목표 완료도 보유 기술·숙련도 또는 역량 분석을 자동으로 바꾸지 않습니다.</p>
      </>}
    </section>
    <section className="learning-stage learning-stage--goals" aria-label="학습 목표">
      <div className="learning-stage__head"><div><span className="learning-stage__number learning-stage__number--green">2</span><h2>학습 목표</h2>
        <p>목표별 체크목록을 완료하면 진행률이 자동으로 올라갑니다.</p></div>
        {id === null && <div className="learning-goal-stats"><span>조회 결과 <strong>{list?.totalElements ?? 0}</strong></span><span>이 페이지 진행 중 <strong>{activeGoals}</strong></span>
          <span>이 페이지 완료 <strong>{completedGoals}</strong></span><span>이 페이지 평균 <strong>{averageProgress}%</strong></span></div>}</div>
      {id !== null && <a className="learning-back" href="#/learning-goals">← 목표 목록</a>}
      {loading ? <LoadingState message="학습 목표를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
        : id === null ? <div className="learning-goals-content"><div className="learning-filter"><label>완료 상태 <select value={completed === undefined ? '' : String(completed)} onChange={e => setFilter(e.target.value)}>
          <option value="">전체</option><option value="false">진행 중</option><option value="true">완료</option></select></label></div>
          {list && (list.items.length === 0 ? <EmptyState title="표시할 목표가 없습니다." message="부족한 기술에서 목표를 만들거나 아래에서 직접 추가해 보세요." />
            : <ul className="learning-list">{list.items.map(g => <li key={g.id}>
              <div className="learning-list__top"><span className="learning-skill-tag">{g.skill && <FixedSkillImage name={g.skill.name} />}{g.skill?.name || '자유 목표'}</span><span className={g.completed ? 'learning-status learning-status--done' : 'learning-status'}>{g.completed ? '완료' : '진행 중'}</span></div>
              <a href={`#/learning-goals/${g.id}`}><strong>{g.title}</strong></a><p>{g.description || '체크목록을 만들어 학습 단계를 관리하세요.'}</p>
              <div className="learning-list__progress"><progress value={g.progressPercent} max="100">{g.progressPercent}%</progress><strong>{g.progressPercent}%</strong></div>
              <a className="learning-card-action" href={`#/learning-goals/${g.id}`}>체크목록 관리 →</a></li>)}</ul>)}
          {list && <nav className="learning-pagination" aria-label="학습 목표 페이지"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1}페이지</span><button type="button" disabled={(page + 1) * list.size >= list.totalElements} onClick={() => setPage(page + 1)}>다음</button></nav>}
        </div> : detail && <div className="learning-detail"><div className="learning-detail__head"><div><span className="learning-skill-tag">{detail.skill && <FixedSkillImage name={detail.skill.name} />}{detail.skill?.name || '자유 목표'}</span><h3>{detail.title}</h3>
          <p>{detail.description || '목표 설명이 없습니다.'}</p></div><strong>{detail.progressPercent}%</strong></div>
          <progress value={detail.progressPercent} max="100">{detail.progressPercent}%</progress>
          <div className="learning-detail__tasks"><div className="learning-panel__head"><h4>할 일 체크목록</h4><span>{tasks.filter(task => task.completed).length}/{tasks.length}개 완료</span></div>
            {tasks.length === 0 ? <p className="learning-muted">목표를 위한 첫 할 일을 추가해 보세요.</p> : <ul>{tasks.map(task => <li key={task.id}>
              <label><input type="checkbox" checked={task.completed} disabled={saving || detail.completed} onChange={e => void mutateTask(() => goals.updateTask(id, task.id, { completed: e.target.checked }))} />
                {editingTask === task.id ? <input type="text" maxLength={200} aria-label="할 일 수정" value={editingTitle} onChange={e => setEditingTitle(e.target.value)} />
                  : <span className={task.completed ? 'is-done' : ''}>{task.title}</span>}</label>
              <div>{editingTask === task.id ? <><button type="button" disabled={saving || !editingTitle.trim()} onClick={() => void mutateTask(() => goals.updateTask(id, task.id, { title: editingTitle }))}>저장</button>
                <button type="button" onClick={() => setEditingTask(null)}>취소</button></> : !detail.completed && <><button type="button" disabled={saving} onClick={() => { setEditingTask(task.id); setEditingTitle(task.title); }}>수정</button>
                <button type="button" disabled={saving} onClick={() => void mutateTask(() => goals.removeTask(id, task.id))}>삭제</button></>}</div></li>)}</ul>}
            {!detail.completed && <form className="learning-task-add" onSubmit={e => { e.preventDefault(); if (newTask.trim() && newTask.length <= 200) void mutateTask(() => goals.addTask(id, newTask)); }}>
              <input type="text" maxLength={200} value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="새 할 일 입력" aria-label="새 할 일" />
              <button type="submit" disabled={saving || !newTask.trim()}>＋ 추가</button></form>}
          </div>
          <div className="learning-actions"><button type="button" disabled={saving || detail.completed || detail.progressPercent !== 100} onClick={() => void changeCompletion(true)}>목표 완료</button>
            <button type="button" disabled={saving || !detail.completed} onClick={() => void changeCompletion(false)}>완료 취소</button>
            <button type="button" disabled={saving} onClick={() => void remove()}>목표 삭제</button></div>
          {detail.completed && <p className="learning-note">완료한 목표의 체크목록을 수정하려면 먼저 완료를 취소해 주세요.</p>}
          {tasks.length === 0 && detail.progressPercent > 0 && <p className="learning-note">기존에 수동으로 저장한 진행률입니다. 체크목록을 추가하면 항목 완료 비율로 전환됩니다.</p>}
        </div>}
      {!loading && !error && (id === null || detail) && <section className="learning-form-card" id="learning-goal-form"><h3>{id === null ? '새 학습 목표 만들기' : '목표 정보 수정'}</h3>
        <form className="learning-form" onSubmit={e => { e.preventDefault(); void save(); }}>
          <label>목표 제목<input required maxLength={200} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label>
          <label>설명<textarea maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} /></label>
          <label>연결 기술 검색 (선택)<input type="search" value={skillQuery} onChange={e => { setSkillQuery(e.target.value); setForm(v => ({ ...v, skillId: '' })); }} placeholder="공용 기술명" /></label>
          {skillError && <p role="alert">{skillError}</p>}{choices.length > 0 && <div className="learning-matches">{choices.map(s => <button type="button" key={s.id} onClick={() => { setForm(v => ({ ...v, skillId: String(s.id) })); setSkillQuery(s.name); setChoices([]); }}>{s.name}</button>)}</div>}
          <p className="learning-selected">선택 기술: {form.skillId ? skillQuery : '없음'} {form.skillId && <button type="button" onClick={() => { setForm(v => ({ ...v, skillId: '' })); setSkillQuery(''); }}>연결 해제</button>}</p>
          <button type="submit" disabled={saving}>{saving ? '저장 중…' : '목표 저장'}</button>
        </form></section>}{actionError && <p role="alert" className="form-error">{actionError}</p>}
    </section>
  </div>;
}
