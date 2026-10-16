import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createDashboardApi } from '../../api/dashboard';
import { createCompaniesApi } from '../../api/companies';
import { createSkillGapApi } from '../../api/skill-gap';
import { createTodosApi } from '../../api/todos';
import type { Dashboard } from '../../api/dashboard';
import type { SkillGap } from '../../api/skill-gap';
import type { CurrentUser } from '../../api/auth';
import { statusLabels } from '../../api/application-status';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import dashboardNextAction from '../../assets/illustrations/dashboard-next-action.png';
import recommendationEmptyArt from '../../assets/illustrations/dashboard-recommendations-empty.png';
import dashboardBanner from '../../assets/illustrations/dashboard-spring-banner.png';
import './dashboard.css';

const api = createDashboardApi(apiRequest);
const companies = createCompaniesApi(apiRequest);
const skillGaps = createSkillGapApi(apiRequest);
const todos = createTodosApi(apiRequest);
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const todoDate = (value: string, timeZone: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
}).format(new Date(value));

export function DashboardPage({ user }: { user: CurrentUser }) {
  const [data, setData] = useState<Dashboard>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [companyCount, setCompanyCount] = useState<number | null>(null);
  const [companyCountError, setCompanyCountError] = useState(false);
  const [skillGap, setSkillGap] = useState<SkillGap>();
  const [todoBusyId, setTodoBusyId] = useState<number | null>(null);
  const [todoError, setTodoError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    api.get(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '대시보드를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setCompanyCount(null); setCompanyCountError(false);
    companies.list(0, controller.signal).then(value => {
      if (!controller.signal.aborted) setCompanyCount(value.totalElements);
    }).catch(() => { if (!controller.signal.aborted) setCompanyCountError(true); });
    return () => controller.abort();
  }, [user.id, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setSkillGap(undefined);
    skillGaps.get(undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setSkillGap(value);
    }).catch(() => { /* The dashboard's skill names remain available without the detailed analysis. */ });
    return () => controller.abort();
  }, [user.id, retry]);

  async function completeTodo(id: number) {
    if (todoBusyId !== null) return;
    setTodoError(''); setTodoBusyId(id);
    try {
      await todos.complete(id, true);
      setData(current => current && ({ ...current, personalTodos: current.personalTodos.filter(item => item.id !== id) }));
    } catch (failure) {
      setTodoError(failure instanceof Error ? failure.message : '할 일을 완료하지 못했습니다. 다시 시도해 주세요.');
    } finally { setTodoBusyId(null); }
  }

  if (loading) return <section className="card"><LoadingState message="취업 준비 현황을 불러오고 있습니다." /></section>;
  if (error) return <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section>;
  if (!data) return null;

  const counts = data.applicationCounts;
  const applicationCount = counts.PLANNED + counts.APPLIED + counts.DOCUMENT_PASSED + counts.INTERVIEW
    + counts.FINAL_PASSED + counts.REJECTED + counts.WITHDRAWN;
  const activeCount = counts.APPLIED + counts.DOCUMENT_PASSED + counts.INTERVIEW;
  const metrics = [
    { label: '지원 기록', value: applicationCount, unit: '건', href: '#/applications', icon: 'fileText', tone: 'blue' },
    { label: '진행 중', value: activeCount, unit: '건', href: '#/applications', icon: 'check', tone: 'mint' },
    { label: '면접 진행', value: counts.INTERVIEW, unit: '건', href: '#/interviews', icon: 'clock', tone: 'orange' },
    { label: '불합격', value: counts.REJECTED, unit: '건', href: '#/applications', icon: 'close', tone: 'rose' },
    { label: '관심 공고', value: data.bookmarkCount, unit: '건', href: '#/bookmarks', icon: 'bookmark', tone: 'lavender' },
    { label: '관심 기업', value: companyCount, unit: '곳', href: '#/companies', icon: 'building', tone: 'sky' },
  ] as const;
  const gapById = new Map(skillGap?.items.map(item => [item.skill.id, item]));

  return <div className="dashboard-page">
    <section className="dashboard-banner" aria-label="취업 준비 응원">
      <img src={dashboardBanner} alt="" aria-hidden="true" />
      <div><h1>오늘도 멋진 하루예요!</h1><p>차근차근 준비하면 좋은 결과가 따라올 거예요.</p></div>
    </section>

    <section className="dashboard-summary" aria-label="나의 취업 준비 현황">
      {metrics.map((metric, index) => <a key={metric.label} className={`dashboard-stat is-${metric.tone}${index === 4 ? ' is-group-start' : ''}`} href={metric.href}>
        <span className="dashboard-stat-icon"><LucideIcon name={metric.icon} /></span>
        <span className="dashboard-stat-text"><span>{metric.label}</span><strong>{metric.value ?? '—'}{metric.value !== null && <small>{metric.unit}</small>}</strong></span>
      </a>)}
    </section>
    {companyCountError && <p className="dashboard-inline-error">관심 기업 수를 불러오지 못했습니다.</p>}

    <div className="dashboard-main-grid">
      <section className="dashboard-panel dashboard-actions-panel"><div className="dashboard-panel-heading"><h2><LucideIcon name="calendar" />지원 현황</h2><a href="#/applications">전체보기 <LucideIcon name="chevronRight" /></a></div>
        {data.nextActions.length ? <div className="dashboard-actions-content">
          {data.nextActions.slice(0, 2).map(action => <a className="dashboard-action-row" href={`#/applications/${action.applicationId}`} key={action.applicationId}>
            <span className="dashboard-action-icon"><LucideIcon name="building" /></span><span className="dashboard-action-detail"><strong>{action.jobTitle}</strong><small>{statusLabels[action.status]}</small>{action.nextScheduleAt && <time dateTime={action.nextScheduleAt}>{date(action.nextScheduleAt)}</time>}</span><LucideIcon name="chevronRight" />
          </a>)}
          <div className="dashboard-action-tip"><img src={dashboardNextAction} alt="" aria-hidden="true" /><span><strong>다음 단계를 준비해 보세요!</strong><small>지원 현황과 일정을 미리 확인해 보세요.</small></span></div>
        </div> : <div className="dashboard-panel-empty">예정된 다음 행동이 없습니다.<small>지원 건을 등록하면 이곳에서 확인할 수 있습니다.</small></div>}
      </section>

      <section className="dashboard-panel dashboard-jobs-panel"><div className="dashboard-panel-heading"><h2><LucideIcon name="star" />추천 공고 <span title="등록한 기술과 분석된 공고 기술의 일치 비율을 기준으로 표시합니다."><LucideIcon name="info" /></span></h2><a href="#/jobs">전체보기 <LucideIcon name="chevronRight" /></a></div>
        {data.recommendedJobs.length ? <ul className="dashboard-job-list">{data.recommendedJobs.map((job, index) => <li key={job.id}><a href={`#/jobs/${job.id}`}>
          <span className={`dashboard-company-avatar is-${index % 3}`}>{job.company.name.charAt(0)}</span>
          <span className="dashboard-job-detail"><strong>{job.title}</strong><small>{job.company.name}</small></span>
          <span className="dashboard-job-meta">{job.location && <small><LucideIcon name="mapPin" />{job.location}</small>}{job.careerRequirement && <small>{job.careerRequirement}</small>}{job.matchRate !== null && <small className="dashboard-match-rate">기술 일치 {job.matchRate}%</small>}</span>
          <LucideIcon name="chevronRight" />
        </a></li>)}</ul> : <div className="dashboard-jobs-empty"><img src={recommendationEmptyArt} alt="" aria-hidden="true" /><div><strong>추천할 공고가 없습니다.</strong><small>기술을 등록하고 분석된 공고를 살펴보세요.</small><a href="#/jobs">공고 둘러보기</a></div></div>}
      </section>
    </div>

    <div className="dashboard-bottom-grid">
      <section className="dashboard-panel dashboard-skills-panel"><div className="dashboard-panel-heading"><h2><LucideIcon name="chartBar" />부족한 기술 TOP 5</h2><a href="#/learning-goals">전체보기 <LucideIcon name="chevronRight" /></a></div>
        {data.skillGapPreview.length ? <ol className="dashboard-skill-list">{data.skillGapPreview.map((skill, index) => {
          const detail = gapById.get(skill.id);
          return <li key={skill.id}><span className={`dashboard-skill-rank is-rank-${index + 1}`}>{index + 1}</span><span className="dashboard-skill-name">{skill.name}</span>{detail && <span className="dashboard-skill-track" title={`분석 공고 중 ${Math.round(detail.demandRatio * 100)}%에서 언급`}><span style={{ width: `${Math.round(detail.demandRatio * 100)}%` }} /></span>}<a href="#/learning-goals">학습 목표 보기</a></li>;
        })}</ol> : <div className="dashboard-panel-empty">표시할 부족 기술이 없습니다.<small>등록한 기술과 공고 분석이 충분하면 확인할 수 있습니다.</small></div>}
      </section>

      <section className="dashboard-panel dashboard-todos-panel"><div className="dashboard-panel-heading"><h2><LucideIcon name="check" />미완료 할 일</h2><a href="#/todos">전체보기 <LucideIcon name="chevronRight" /></a></div>
        {todoError && <p className="dashboard-inline-error" role="alert">{todoError}</p>}
        {data.personalTodos.length ? <ul className="dashboard-todo-list">{data.personalTodos.map(todo => <li key={todo.id}>
          <input type="checkbox" aria-label={`${todo.title} 완료`} disabled={todoBusyId !== null} onChange={() => void completeTodo(todo.id)} />
          <span className="dashboard-todo-category">{todo.category}</span><a href={`#/todos/${todo.id}`}>{todo.title}</a><small>{todo.dueAt && todo.dueTimeZone ? todoDate(todo.dueAt, todo.dueTimeZone) : '기한 없음'}</small>
        </li>)}</ul> : <div className="dashboard-panel-empty">미완료 할 일이 없습니다.<small>새 할 일을 등록해 계획을 이어가세요.</small></div>}
      </section>
    </div>
  </div>;
}
