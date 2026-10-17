import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createLearningGoalsApi } from '../../api/learning-goals';
import type { GoalInput, GoalTask, LearningGoal, LearningGoalPage } from '../../api/learning-goals';
import { createSkillGapApi } from '../../api/skill-gap';
import type { SkillGap } from '../../api/skill-gap';
import { createSkillsApi } from '../../api/skills';
import type { Skill } from '../../api/skills';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { PixelIcon } from '../../components/PixelArt';
import { FixedSkillImage } from '../../components/FixedSkillImage';
import learningEmpty from '../../assets/illustrations/learning-goals-empty-pixel.png';
import recommendationEmpty from '../../assets/illustrations/learning-recommendations-empty-pixel.png';
import './learning-goals.css';

const goals = createLearningGoalsApi(apiRequest), gapApi = createSkillGapApi(apiRequest), skills = createSkillsApi(apiRequest);
const message = (e: unknown) => e instanceof Error ? e.message : '요청을 처리하지 못했습니다.';
const failure = (e: unknown) => e instanceof ApiError && e.status === 403 ? '이 학습 목표에 접근할 권한이 없습니다.'
  : e instanceof ApiError && e.status === 404 ? '학습 목표를 찾을 수 없습니다.'
    : e instanceof ApiError && e.status === 409 ? '같은 기술과 제목의 목표가 있거나 현재 상태에서 변경할 수 없습니다.' : message(e);
const blank = { title: '', description: '', skillId: '' };

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
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [skillError, setSkillError] = useState('');
  const [newTask, setNewTask] = useState(''), [editingTask, setEditingTask] = useState<number | null>(null), [editingTitle, setEditingTitle] = useState('');
  const [gap, setGap] = useState<SkillGap>(), [gapError, setGapError] = useState(''), [gapLoading, setGapLoading] = useState(true);
  const [gapRetry, setGapRetry] = useState(0);

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
    const controller = new AbortController(); setGapLoading(true); setGapError(''); setGap(undefined);
    gapApi.get(undefined, controller.signal).then(v => { if (!controller.signal.aborted) setGap(v); })
      .catch(e => { if (!controller.signal.aborted) setGapError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setGapLoading(false); });
    return () => controller.abort();
  }, [gapRetry]);
  useEffect(() => {
    if (!skillQuery.trim() || form.skillId) { setChoices([]); setSkillError(''); return; }
    const controller = new AbortController();
    skills.search(skillQuery.trim(), 0, controller.signal).then(v => { if (!controller.signal.aborted) setChoices(v.items); })
      .catch(e => { if (!controller.signal.aborted) setSkillError(message(e)); });
    return () => controller.abort();
  }, [skillQuery, form.skillId]);

  function openGoalForm() {
    setShowGoalForm(true);
    window.setTimeout(() => document.getElementById('learning-goal-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  function draftGoal(skill: Skill) {
    setForm({ title: `${skill.name} 학습하기`, description: '', skillId: String(skill.id) });
    setSkillQuery(skill.name); setChoices([]); setActionError('');
    if (id !== null) window.location.hash = '/learning-goals';
    openGoalForm();
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
  const noGoals = id === null && completed === undefined && page === 0 && list?.totalElements === 0;

  return <div className="learning-page">
    <header className="learning-banner">
      <div className="learning-banner__copy"><h1>역량 분석 &amp; 학습 목표</h1><p>내 기술과 채용공고를 비교하고, 부족한 기술을 학습 목표로 이어가세요.</p></div>
    </header>
    <section className="learning-stage learning-stage--analysis" id="learning-analysis" aria-label="부족한 기술 TOP 5">
      <div className="learning-stage__head"><div><h2><PixelIcon name="chart" /> 부족한 기술 TOP 5</h2>
        <p>분석 완료된 수집·직접 등록 공고와 내 기술을 비교한 결과예요.</p></div>
        {gap && <div className="learning-analysis-meta"><span>{gap.desiredRole ? `프로필 희망 직무: ${gap.desiredRole}` : '전체 공고'}</span><span>분석 공고 {gap.analyzedJobCount}건</span></div>}</div>
      {gapLoading ? <LoadingState message="역량 분석을 불러오고 있습니다." /> : gapError ? <ErrorState message={gapError} onRetry={() => setGapRetry(v => v + 1)} /> : gap && <>
        {!gap.available && <p className="learning-analysis-hint">ⓘ 분석 조건을 충족하면 부족한 기술 순위가 표시됩니다.</p>}
        {missing.length ? <ol className="learning-top-skills">{missing.map((item, index) => <li key={item.skill.id} className={`learning-top-skill is-rank-${index + 1}`}>
          <div className="learning-top-skill__name"><span className="learning-top-skill__rank">{index + 1}</span><strong>{item.skill.name}</strong></div>
          <span className="learning-top-skill__percent">{(item.demandRatio * 100).toFixed(1)}%</span>
          <div className="learning-top-skill__meter"><span style={{ width: `${Math.min(100, item.demandRatio * 100)}%` }} /></div>
          <small>분석 공고 {item.demandJobCount}건</small>
        </li>)}</ol> : gap.available ? <p className="learning-muted">현재 부족한 기술이 없습니다.</p>
          : <ol className="learning-top-skills learning-top-skills--empty">{Array.from({ length: 5 }, (_, index) => <li key={index} className="learning-top-skill learning-top-skill--empty">
            <span className="learning-top-skill__rank">{index + 1}</span><PixelIcon name="chart" /><strong>분석 후<br />표시됩니다.</strong>
            <span className="learning-top-skill__placeholder-meter" aria-hidden="true" /></li>)}</ol>}
        {!gap.available && <div className="learning-analysis-conditions"><strong>분석 조건</strong>
          <ul><li>프로필 또는 프로젝트에 보유 기술 등록</li><li>분석 완료 공고 1건 이상</li>
            <li>공고 분석 결과에 기술 정보 포함</li></ul></div>}
        {gap.provisional && <p className="learning-caution">분석 공고 {gap.analyzedJobCount}건의 잠정 결과입니다. 표본이 적어 순위가 달라질 수 있습니다.</p>}
        {gap.available && <p className="learning-note">등장률은 분석 완료 공고 기준이며 개인 숙련도를 뜻하지 않습니다.</p>}
      </>}
    </section>
    {id === null && <section className="learning-stage learning-stage--recommendations" id="learning-recommendations" aria-label="추천 학습 목표">
      <div className="learning-stage__head"><div><h2><PixelIcon name="spark" /> 추천 학습 목표</h2>
        <p>분석에서 찾은 부족한 기술로 학습 목표 초안을 만들 수 있어요.</p></div></div>
      {gapLoading ? <LoadingState message="추천 학습 목표를 불러오고 있습니다." />
        : gapError ? <ErrorState message={gapError} onRetry={() => setGapRetry(v => v + 1)} />
          : missing.length > 0 ? <ul className="learning-suggestion-list">{missing.map(item => <li key={item.skill.id}>
            <div className="learning-suggestion-list__title"><FixedSkillImage name={item.skill.name} /><strong>{item.skill.name} 학습하기</strong></div>
            <span className="learning-skill-tag">{item.skill.name}</span>
            <p>분석 공고 {item.demandJobCount}건에서 요구 · 필수 {item.requiredJobCount}건 · 우대 {item.preferredJobCount}건</p>
            <button type="button" onClick={() => draftGoal(item.skill)}>＋ 목표로 추가</button>
          </li>)}</ul>
            : <div className="learning-recommendations-empty"><img src={recommendationEmpty} alt="" aria-hidden="true" />
              <h3>아직 추천할 학습 목표가 없습니다.</h3>
              <p>{gap?.available ? '현재 분석에서 부족한 기술이 발견되지 않았어요.' : '내 기술과 분석 완료 공고를 비교할 수 있으면 부족한 기술을 바탕으로 목표를 추천해 드려요.'}</p>
              <div className="learning-recommendations-empty__tip"><PixelIcon name="spark" /><span>원하는 주제는 아래 학습 목표 목록에서 자유롭게 추가할 수 있어요.</span></div>
            </div>}
    </section>}
    <section className="learning-stage learning-stage--goals" aria-label="학습 목표">
      <div className="learning-stage__head"><div><h2><PixelIcon name="spark" /> 학습 목표 목록</h2>
        <p>부족한 기술을 바탕으로 목표를 관리하고, 꾸준히 성장해보세요.</p></div>
        {id === null && <button type="button" className={noGoals ? 'learning-primary-button learning-primary-button--quiet' : 'learning-primary-button'} onClick={openGoalForm}>＋ 학습 목표 추가</button>}</div>
      {id !== null && <a className="learning-back" href="#/learning-goals">← 목표 목록</a>}
      {loading ? <LoadingState message="학습 목표를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} />
        : id === null ? <div className="learning-goals-content">{!noGoals && <div className="learning-filter" role="group" aria-label="완료 상태">
          <button type="button" aria-pressed={completed === undefined} onClick={() => setFilter('')}>전체</button>
          <button type="button" aria-pressed={completed === false} onClick={() => setFilter('false')}>진행 중</button>
          <button type="button" aria-pressed={completed === true} onClick={() => setFilter('true')}>완료</button>
          {list && <span>현재 목록 {list.totalElements}개</span>}</div>}
          {list && (noGoals ? <div className="learning-goals-empty"><img src={learningEmpty} alt="" aria-hidden="true" />
              <h3>아직 등록된 학습 목표가 없습니다.</h3>
              <p>공고 분석 후 추천되는 학습 목표를 확인할 수 있어요.<br />원하는 주제로 자유롭게 학습 목표를 추가할 수도 있습니다.</p>
              <div className="learning-goals-empty__rows" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <div key={index}><span className="learning-goals-empty__circle" /><span className="learning-goals-empty__bar" /><small>학습 목표가 여기에 표시됩니다.</small></div>)}</div>
            </div> : list.items.length === 0 ? <EmptyState title="조건에 맞는 목표가 없습니다." message="다른 완료 상태를 선택하거나 새 목표를 추가해 보세요." />
            : <ul className="learning-list">{list.items.map(g => <li key={g.id}>
              <div className="learning-goal-row__icon">{g.skill ? <FixedSkillImage name={g.skill.name} /> : <PixelIcon name="spark" />}</div>
              <div className="learning-goal-row__main"><a href={`#/learning-goals/${g.id}`}><strong>{g.title}</strong></a>
                <span>{g.skill?.name || '자유 목표'} · {g.completed ? '완료' : '진행 중'}</span>
                <small>등록 {new Date(g.createdAt).toLocaleDateString('ko-KR')}</small></div>
              <div className="learning-list__progress"><progress value={g.progressPercent} max="100">{g.progressPercent}%</progress><strong>{g.progressPercent}%</strong></div>
              <a className="learning-goal-row__arrow" href={`#/learning-goals/${g.id}`} aria-label={`${g.title} 체크목록 관리`}>›</a></li>)}</ul>)}
          {list && !noGoals && <nav className="learning-pagination" aria-label="학습 목표 페이지"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1}페이지</span><button type="button" disabled={(page + 1) * list.size >= list.totalElements} onClick={() => setPage(page + 1)}>다음</button></nav>}
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
    </section>
    {!loading && !error && (id === null ? showGoalForm : detail) && <section className="learning-form-card" id="learning-goal-form"><div className="learning-form-card__head"><h3>{id === null ? '새 학습 목표 만들기' : '목표 정보 수정'}</h3>
      {id === null && <button type="button" onClick={() => { setShowGoalForm(false); setActionError(''); }}>닫기</button>}</div>
      <form className="learning-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <label>목표 제목<input required maxLength={200} value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} /></label>
        <label>설명<textarea maxLength={2000} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} /></label>
        <label>연결 기술 검색 (선택)<input type="search" value={skillQuery} onChange={e => { setSkillQuery(e.target.value); setForm(v => ({ ...v, skillId: '' })); }} placeholder="공용 기술명" /></label>
        {skillError && <p role="alert">{skillError}</p>}{choices.length > 0 && <div className="learning-matches">{choices.map(s => <button type="button" key={s.id} onClick={() => { setForm(v => ({ ...v, skillId: String(s.id) })); setSkillQuery(s.name); setChoices([]); }}>{s.name}</button>)}</div>}
        <p className="learning-selected">선택 기술: {form.skillId ? skillQuery : '없음'} {form.skillId && <button type="button" onClick={() => { setForm(v => ({ ...v, skillId: '' })); setSkillQuery(''); }}>연결 해제</button>}</p>
        <button type="submit" disabled={saving}>{saving ? '저장 중…' : '목표 저장'}</button>
      </form></section>}{actionError && <p role="alert" className="form-error">{actionError}</p>}
  </div>;
}
