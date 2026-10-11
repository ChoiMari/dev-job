import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createDashboardApi } from '../../api/dashboard';
import { createCompaniesApi } from '../../api/companies';
import type { Dashboard } from '../../api/dashboard';
import type { CurrentUser } from '../../api/auth';
import type { ApplicationStatus } from '../../api/application-status';
import dashboardDesk from '../../assets/illustrations/dashboard-desk.png';
import dashboardScene from '../../assets/redesign/cur-16-dashboard-developer.png';
import profileArt from '../../assets/redesign/cur-17-dashboard-profile.png';
import projectArt from '../../assets/redesign/cur-18-dashboard-projects.png';
import analysisArt from '../../assets/redesign/cur-19-dashboard-skills.png';
import nextActionArt from '../../assets/redesign/cur-03-next-action.png';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './dashboard.css';

const api = createDashboardApi(apiRequest);
const companies = createCompaniesApi(apiRequest);
const actionText: Record<ApplicationStatus, string> = {
  INTERESTED: '지원 여부 살펴보기', PLANNED: '지원 준비하기', APPLIED: '지원 결과 확인하기',
  DOCUMENT_PASSED: '면접 준비하기', INTERVIEW: '면접 결과 확인하기',
  FINAL_PASSED: '최종 합격', REJECTED: '불합격', WITHDRAWN: '지원 철회',
};
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function DashboardPage({ user }: { user: CurrentUser }) {
  const [data, setData] = useState<Dashboard>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [companyCount, setCompanyCount] = useState<number | null>(null);
  const [companyCountError, setCompanyCountError] = useState(false);
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
  if (loading) return <section className="card"><LoadingState message="취업 준비 현황을 불러오고 있습니다." /></section>;
  if (error) return <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section>;
  if (!data) return null;
  const activeApplications = data.applicationCounts.APPLIED + data.applicationCounts.DOCUMENT_PASSED + data.applicationCounts.INTERVIEW;
  const completedApplications = data.applicationCounts.FINAL_PASSED + data.applicationCounts.REJECTED + data.applicationCounts.WITHDRAWN;
  return <div className="dashboard-page">
    <section className="dashboard-hero">
      <img className="dashboard-hero-art" src={dashboardScene} alt="" aria-hidden="true" />
      <div className="dashboard-hero-copy">
        <span className="eyebrow">MY CAREER SPACE</span>
        <h1>나의 취업 준비 현황</h1>
        <div className="dashboard-hero-metrics" aria-label="나의 취업 준비 현황">
          <a href="#/applications" className="dashboard-hero-metric"><span>진행 중인 지원</span><strong>{activeApplications}<small>건</small></strong><small>지원·서류 통과·면접</small></a>
          <a href="#/applications" className="dashboard-hero-metric"><span>완료한 지원</span><strong>{completedApplications}<small>건</small></strong><small>최종 합격·탈락·철회</small></a>
          <a href="#/bookmarks" className="dashboard-hero-metric"><span>관심 공고</span><strong>{data.bookmarkCount}<small>건</small></strong><small>저장한 공고</small></a>
          <a href="#/companies" className="dashboard-hero-metric"><span>관심 기업</span><strong>{companyCount ?? '—'}{companyCount !== null && <small>곳</small>}</strong><small>{companyCountError ? '기업 수를 불러오지 못했습니다' : '등록한 기업 전체 · 보관 포함'}</small></a>
        </div>
      </div>
    </section>
    <section className="dashboard-quick-links" aria-label="주요 기능 바로가기">
      <a href="#/profile"><img src={profileArt} alt="" aria-hidden="true" /><span>01</span><strong>나를 소개하기</strong><small>프로필과 기술 스택 정리</small><b aria-hidden="true">↗</b></a>
      <a href="#/projects"><img src={projectArt} alt="" aria-hidden="true" /><span>02</span><strong>경험 기록하기</strong><small>프로젝트 포트폴리오 관리</small><b aria-hidden="true">↗</b></a>
      <a href="#/skill-gap"><img src={analysisArt} alt="" aria-hidden="true" /><span>03</span><strong>다음 기술 찾기</strong><small>목표 직무와 역량 비교</small><b aria-hidden="true">↗</b></a>
    </section>
    <div className="dashboard-content-grid">
    <section className="card dashboard-panel"><div className="dashboard-section-heading"><div className="dashboard-heading-title"><img src={dashboardDesk} alt="" aria-hidden="true" width="64" height="64" /><div><span className="eyebrow">FROM APPLICATIONS</span><h2>지원에서 나온 다음 행동</h2></div></div><a href="#/applications">지원 관리 ↗</a></div>
      {data.nextActions.length ? <ul className="dashboard-list">{data.nextActions.map(action => <li key={action.applicationId}>
        <a href={`#/applications/${action.applicationId}`}>{actionText[action.status]} · {action.jobTitle}</a>
        {action.nextScheduleAt && <span>예정 {date(action.nextScheduleAt)}</span>}
      </li>)}</ul> : <EmptyState title="예정된 다음 행동이 없습니다." message="지원 건을 등록하면 진행 상태에 따른 행동이 여기에 표시됩니다." />}</section>
    <section className="card dashboard-panel"><div className="dashboard-section-heading"><div><span className="eyebrow">RULE BASED</span><h2>기본 추천 채용공고</h2></div><a href="#/jobs">모든 공고 ↗</a></div>
      {data.recommendedJobs.length ? <ul className="dashboard-list">{data.recommendedJobs.map(job => <li key={job.id}>
        <a href={`#/jobs/${job.id}`}><strong>{job.title}</strong><span>{job.company.name}</span></a>
        <span>기술 적합도 {job.matchRate}%{job.deadlineDate ? ` · 마감 ${job.deadlineDate}` : ''}</span>
      </li>)}</ul> : <EmptyState title="추천할 공고가 없습니다." message="기술을 등록하고 공고 분석이 완료되면 적합도에 맞는 공고를 볼 수 있습니다." />}
      <p className="dashboard-note">기술 적합도는 등록한 기술과 분석된 공고 기술의 일치 비율이며 합격 가능성을 뜻하지 않습니다.</p></section>
    </div>
    <section className="card dashboard-panel dashboard-todo-panel"><div className="dashboard-section-heading"><div className="dashboard-heading-title"><img src={nextActionArt} alt="" aria-hidden="true" /><div><span className="eyebrow">MY TO-DO</span><h2>내가 등록한 할 일</h2></div></div><a href="#/todos">할 일 관리 ↗</a></div>
      {data.personalTodos.length ? <ul className="dashboard-list">{data.personalTodos.map(todo => <li key={todo.id}>
        <a href={`#/todos/${todo.id}`}>{todo.title}</a>
        <span>{todo.dueAt && todo.dueTimeZone ? `기한 ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short', timeZone: todo.dueTimeZone }).format(new Date(todo.dueAt))} · ${todo.dueTimeZone}` : '기한 없음'}</span>
      </li>)}</ul> : <EmptyState title="미완료 할 일이 없습니다." message="할 일을 등록하면 여기에 표시됩니다." />}</section>
    <section className="card dashboard-panel dashboard-skill-panel"><div className="dashboard-section-heading"><div><span className="eyebrow">GROWTH NOTE</span><h2>부족한 기술 미리보기</h2></div><a href="#/skill-gap">역량 분석 ↗</a></div>
      {data.skillGapPreview.length ? <ul className="dashboard-skills">{data.skillGapPreview.map(skill => <li key={skill.id}>{skill.name}</li>)}</ul>
        : <EmptyState title="표시할 부족 기술이 없습니다." message="등록한 기술과 분석 완료 공고가 충분하면 여기에서 확인할 수 있습니다." />}</section>
  </div>;
}
