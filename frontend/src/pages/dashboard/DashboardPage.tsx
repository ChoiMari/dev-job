import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createDashboardApi } from '../../api/dashboard';
import type { Dashboard } from '../../api/dashboard';
import type { CurrentUser } from '../../api/auth';
import type { ApplicationStatus } from '../../api/application-status';
import dashboardDesk from '../../assets/illustrations/dashboard-desk.png';
import dashboardHero from '../../assets/illustrations/dashboard-hero.webp';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './dashboard.css';

const api = createDashboardApi(apiRequest);
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
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    api.get(controller.signal).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '대시보드를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user.id, retry]);
  if (loading) return <section className="card"><LoadingState message="취업 준비 현황을 불러오고 있습니다." /></section>;
  if (error) return <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section>;
  if (!data) return null;
  return <div className="dashboard-page">
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="eyebrow">YOUR CAREER JOURNEY</span>
        <h1>내일의 기회를 향해,<br /><em>오늘 한 걸음.</em></h1>
        <p>안녕하세요, {user.email}님. 채용 탐색부터 지원 현황과 역량 분석까지, 지금 필요한 준비를 한곳에서 이어가세요.</p>
        <div className="dashboard-hero-actions"><a className="button-link button-primary" href="#/jobs">채용공고 둘러보기 <span aria-hidden="true">↗</span></a><a className="button-link" href="#/applications">지원 현황 보기</a></div>
      </div>
      <img className="dashboard-hero-art" src={dashboardHero} alt="" aria-hidden="true" width="708" height="520" />
    </section>
    <div className="dashboard-overview-heading"><div><span className="eyebrow">AT A GLANCE</span><h2>나의 준비 현황</h2></div><a href="#/profile">프로필 관리 <span aria-hidden="true">↗</span></a></div>
    <section className="dashboard-metrics" aria-label="취업 준비 현황">
      {([
        ['지원 예정', data.applicationCounts.PLANNED, '#/applications?status=PLANNED'],
        ['지원 완료', data.applicationCounts.APPLIED, '#/applications?status=APPLIED'],
        ['면접 예정', data.applicationCounts.INTERVIEW, '#/applications?status=INTERVIEW'],
        ['관심 공고', data.bookmarkCount, '#/bookmarks'],
      ] as const).map(([label, value, href]) => <a className="card dashboard-metric" href={href} key={label}><span>{label}</span><strong>{value}</strong></a>)}
    </section>
    <section className="dashboard-quick-links" aria-label="주요 기능 바로가기">
      <a href="#/profile"><span>01</span><strong>나를 소개하기</strong><small>프로필과 기술 스택 정리</small><b aria-hidden="true">↗</b></a>
      <a href="#/projects"><span>02</span><strong>경험 기록하기</strong><small>프로젝트 포트폴리오 관리</small><b aria-hidden="true">↗</b></a>
      <a href="#/skill-gap"><span>03</span><strong>다음 기술 찾기</strong><small>목표 직무와 역량 비교</small><b aria-hidden="true">↗</b></a>
    </section>
    <div className="dashboard-content-grid">
    <section className="card dashboard-panel"><div className="dashboard-section-heading"><div className="dashboard-heading-title"><img src={dashboardDesk} alt="" aria-hidden="true" width="64" height="64" /><div><span className="eyebrow">NEXT STEP</span><h2>다음 행동</h2></div></div><a href="#/applications">지원 관리 ↗</a></div>
      {data.nextActions.length ? <ul className="dashboard-list">{data.nextActions.map(action => <li key={action.applicationId}>
        <a href={`#/applications/${action.applicationId}`}>{actionText[action.status]} · {action.jobTitle}</a>
        {action.nextScheduleAt && <span>예정 {date(action.nextScheduleAt)}</span>}
      </li>)}</ul> : <EmptyState title="예정된 다음 행동이 없습니다." message="지원 건을 등록하면 진행 상태에 따른 행동이 여기에 표시됩니다." />}</section>
    <section className="card dashboard-panel"><div className="dashboard-section-heading"><div><span className="eyebrow">FOR YOU</span><h2>추천 채용공고</h2></div><a href="#/jobs">모든 공고 ↗</a></div>
      {data.recommendedJobs.length ? <ul className="dashboard-list">{data.recommendedJobs.map(job => <li key={job.id}>
        <a href={`#/jobs/${job.id}`}><strong>{job.title}</strong><span>{job.company.name}</span></a>
        <span>기술 적합도 {job.matchRate}%{job.deadlineDate ? ` · 마감 ${job.deadlineDate}` : ''}</span>
      </li>)}</ul> : <EmptyState title="추천할 공고가 없습니다." message="기술을 등록하고 공고 분석이 완료되면 적합도에 맞는 공고를 볼 수 있습니다." />}
      <p className="dashboard-note">기술 적합도는 등록한 기술과 분석된 공고 기술의 일치 비율이며 합격 가능성을 뜻하지 않습니다.</p></section>
    </div>
    <section className="card dashboard-panel dashboard-skill-panel"><div className="dashboard-section-heading"><div><span className="eyebrow">GROWTH NOTE</span><h2>부족한 기술 미리보기</h2></div><a href="#/skill-gap">역량 분석 ↗</a></div>
      {data.skillGapPreview.length ? <ul className="dashboard-skills">{data.skillGapPreview.map(skill => <li key={skill.id}>{skill.name}</li>)}</ul>
        : <EmptyState title="표시할 부족 기술이 없습니다." message="등록한 기술과 분석 완료 공고가 충분하면 여기에서 확인할 수 있습니다." />}</section>
  </div>;
}
