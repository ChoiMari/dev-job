import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createJobsApi } from '../../api/jobs';
import { createApplicationsApi } from '../../api/applications';
import type { Application } from '../../api/applications';
import type { JobDetail } from '../../api/jobs';
import { JobStatusLabel } from '../../components/JobStatusLabel';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { BookmarkButton } from '../../components/BookmarkButton';
import { JobAnalysis } from '../../components/JobAnalysis';
import { JobMatch } from '../../components/JobMatch';
import { ApplicationDetailPage } from '../applications/ApplicationsPage';
import { LucideIcon } from '../../components/LucideIcon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import jobDetailSkyline from '../../assets/redesign/job-detail-skyline.png';
import jobDetailCat from '../../assets/redesign/interview-planner-cat.png';
import building from '../../assets/redesign/interview-building.png';
import './job-detail.css';

const jobs = createJobsApi(apiRequest);
const applications = createApplicationsApi(apiRequest);
const matchViewedKey = (userId: number, jobId: number) => `devjob:match-viewed:${userId}:${jobId}`;
function hasViewedMatch(userId: number, jobId: number) {
  try { return window.localStorage.getItem(matchViewedKey(userId, jobId)) === '1'; }
  catch { return false; }
}
function rememberViewedMatch(userId: number, jobId: number) {
  try { window.localStorage.setItem(matchViewedKey(userId, jobId), '1'); }
  catch { /* Comparison remains available for this visit if storage is disabled. */ }
}
type DetailTab = 'description' | 'application';
const tabs: { value: DetailTab; label: string }[] = [
  { value: 'description', label: '상세 내용' },
  { value: 'application', label: '지원 현황' },
];
const roles: Record<string, string> = {
  DEVELOPMENT: '개발', DATA_AI: '데이터·AI', SECURITY: '보안',
  INFRA: '클라우드·인프라', IT_OPERATIONS: '전산·IT 운영',
};
const alioHeadings = new Set(['지원 자격', '우대 내용', '우대 조건', '전형 방법', '결격 사유']);
const sourceLabel = (source: string) => source === 'ALIO_RECRUITMENT' ? '공공기관 채용'
  : source === 'WORK24_OPEN_RECRUITMENT' ? '고용24' : source;
const detailHeading = (source: string) => source === 'ALIO_RECRUITMENT' ? '제공된 채용 내용' : '채용공고 원문';
function JobApplicationPanel({ application, onViewDetail }: { application: Application; onViewDetail: () => void }) {
  const status = application.currentStatus;
  const schedule = application.nextScheduleAt ? new Date(application.nextScheduleAt).toLocaleString('ko-KR') : null;
  return <section className="job-detail-application" aria-label="내 지원 현황">
    <header><LucideIcon name="briefcase" /><h3>내 지원 현황</h3>
      <button type="button" className="job-detail-application-link" onClick={onViewDetail}>지원 상세 보기</button></header>
    <dl className="job-detail-application-facts">
      <div><dt><LucideIcon name="fileText" /> 진행 상태</dt><dd><span className={`job-detail-status job-detail-status--${status.toLowerCase()}`}><JobStatusLabel status={status} /></span></dd></div>
      {application.appliedDate && <div><dt><LucideIcon name="calendar" /> 지원일</dt><dd>{application.appliedDate}</dd></div>}
      {schedule && <div><dt><LucideIcon name="clock" /> 다음 확인 일정</dt><dd>{schedule}</dd></div>}
      {application.note && <div className="job-detail-application-note"><dt><LucideIcon name="message" /> 메모</dt><dd>{application.note}</dd></div>}
    </dl>
  </section>;
}

function Description({ job }: { job: JobDetail }) {
  const blocks = job.description?.split(/\n\s*\n/).map(value => value.trim()).filter(Boolean) ?? [];
  const structured = job.source === 'ALIO_RECRUITMENT' && blocks.length > 0
    && blocks.every(value => alioHeadings.has(value.split('\n')[0]));
  return <div className="job-detail-content">
    <header><LucideIcon name="fileText" /><h3>{detailHeading(job.source)}</h3>
      <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="button-link job-detail-source-link">
        {job.source === 'ALIO_RECRUITMENT' ? '제공된 출처 사이트 열기' : '외부 공고 열기'} <LucideIcon name="arrowRight" />
      </a></header>
    {blocks.length ? structured ? blocks.map((block, index) => {
      const [heading, ...body] = block.split('\n');
      return <section className="job-detail-content-row" key={index}>
        <h4>{heading}</h4><p>{body.join('\n')}</p>
      </section>;
    }) : <p className="job-detail-raw-description">{job.description}</p>
      : <p>저장된 본문이 없습니다. 외부 출처에서 채용 조건을 확인해 주세요.</p>}
    <section className="job-detail-content-row">
      <h4>근무 정보</h4>
      <dl className="job-detail-conditions">
        {job.location && <div><dt>근무 지역</dt><dd>{job.location}</dd></div>}
        {job.employmentType && <div><dt>고용 형태</dt><dd>{job.employmentType}</dd></div>}
        {job.careerRequirement && <div><dt>경력 조건</dt><dd>{job.careerRequirement}</dd></div>}
        {!job.location && !job.employmentType && !job.careerRequirement && <div><dd>제공된 근무 정보가 없습니다.</dd></div>}
      </dl>
    </section>
    {job.recruitment && <section className="job-detail-content-row">
      <h4>전형 단계</h4>
      {job.recruitment.steps.length ? <ol className="job-recruitment-list">{job.recruitment.steps.map(step =>
        <li key={step.externalId}><strong>{step.title}</strong>
          {step.openings !== null && <span>채용 {step.openings}명</span>}
          {step.applicants !== null && <span>지원 {step.applicants}명</span>}
          {step.competitionRate && <span>경쟁률 {step.competitionRate}</span>}
          {step.eventDate && <span>기준일 {step.eventDate}</span>}
        </li>)}</ol> : <p>제공된 전형 단계가 없습니다.</p>}
    </section>}
    {job.recruitment && <section className="job-detail-content-row">
      <h4>첨부파일</h4>
      {job.recruitment.attachments.length ? <ul className="job-recruitment-list">{job.recruitment.attachments.map(file =>
        <li key={file.externalId}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.name} (새 창)</a></li>)}</ul>
        : <p>제공된 첨부파일이 없습니다.</p>}
    </section>}
  </div>;
}

export function JobDetailPage({ location, userId }: { location: string; userId: number }) {
  const path = location.split('?')[0];
  const id = Number(path.slice('/jobs/'.length));
  const valid = /^\/jobs\/[1-9]\d*$/.test(path) && Number.isSafeInteger(id);
  const query = new URLSearchParams(location.split('?')[1]);
  const from = query.get('from') || '';
  const origin = query.get('origin') === 'bookmarks' ? 'bookmarks' : 'jobs';
  const back = `#/${origin}${from ? `?${from}` : ''}`;
  const [data, setData] = useState<JobDetail>();
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('description');
  const [showMatch, setShowMatch] = useState(() => hasViewedMatch(userId, id));
  const [application, setApplication] = useState<Application>();
  const [applicationError, setApplicationError] = useState('');
  const [applicationRetry, setApplicationRetry] = useState(0);
  const [applicationDetailId, setApplicationDetailId] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setMissing(false); setData(undefined); setAnalysisStatus(null); setActiveTab('description'); setShowMatch(hasViewedMatch(userId, id));
    setApplication(undefined); setApplicationError(''); setApplicationDetailId(null);
    if (!valid) { setError('공고 주소를 확인해 주세요.'); setLoading(false); return; }
    jobs.detail(id, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setData(value);
        setAnalysisStatus(value.analysis && typeof value.analysis === 'object' && 'status' in value.analysis ? String(value.analysis.status) : null);
      }
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 404) setMissing(true);
      else setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, userId, valid, retry]);
  useEffect(() => {
    if (activeTab !== 'application' || !data?.applicationStatus) return;
    const controller = new AbortController();
    setApplication(undefined); setApplicationError('');
    applications.forJob(data.id, controller.signal).then(value => {
      if (!controller.signal.aborted) {
        setApplication(value);
        setData(current => current?.id === data.id && current.applicationStatus !== value.currentStatus
          ? { ...current, applicationStatus: value.currentStatus } : current);
      }
    }).catch(failure => {
      if (!controller.signal.aborted) setApplicationError(failure instanceof Error ? failure.message : '지원 기록을 불러오지 못했습니다.');
    });
    return () => controller.abort();
  }, [activeTab, data?.id, data?.applicationStatus, applicationRetry]);
  return <div className="jobs-page job-detail-page">
    <header className="job-detail-banner" style={{ backgroundImage: `url(${jobDetailSkyline})` }}>
      <a href={back} className="job-detail-back" aria-label={origin === 'bookmarks' ? '관심 공고 목록으로' : '채용공고 목록으로'}><LucideIcon name="arrowLeft" /></a>
      <div className="job-detail-banner-copy"><h1>채용 공고 상세</h1><p>공고 정보를 확인하고 지원, AI 분석, 기술 비교를 이어가세요.</p></div>
      <p className="job-detail-bubble">이 공고, 나와 잘 맞을까?<br />AI 분석과 기술 비교로 확인해 보세요!</p>
      <img src={jobDetailCat} alt="" aria-hidden="true" />
    </header>
    {loading ? <section className="card" aria-busy="true"><LoadingState message="공고 상세를 불러오고 있습니다." /></section>
      : missing ? <section className="card"><EmptyState title="공고를 찾을 수 없습니다." message="삭제되었거나 존재하지 않는 공고입니다. 목록에서 다시 선택해 주세요." /></section>
      : error ? <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section>
      : data && <div className="job-detail-layout">
        <div className="job-detail-primary">
          <section className="card job-detail-summary" aria-label="공고 요약">
            <div className="job-detail-summary-main">
              <span className="job-detail-company-icon"><img src={building} alt="" /></span>
              <div><p className="job-detail-company-name">{data.company.name}</p><h2>{data.title}</h2></div>
            </div>
            <div className="job-detail-tags">
              <span>{sourceLabel(data.source)}</span>
              {data.role && <span>{roles[data.role] || data.role}</span>}
              {data.careerRequirement && <span>{data.careerRequirement}</span>}
              {data.employmentType && <span>{data.employmentType}</span>}
              {data.location && <span>{data.location}</span>}
              {data.applicationStatus && <span className={`job-detail-status job-detail-status--${data.applicationStatus.toLowerCase()}`}>
                <JobStatusLabel status={data.applicationStatus} />
              </span>}
            </div>
            <dl className="job-detail-dates">
              <div><dt><LucideIcon name="calendar" /> 게시일</dt><dd>{data.postedDate || '정보 없음'}</dd></div>
              <div><dt><LucideIcon name="calendar" /> 마감일</dt><dd>{data.deadlineDate || '정보 없음'}</dd></div>
            </dl>
            <div className="job-detail-bookmark">
              <BookmarkButton icon="image" jobId={data.id} saved={data.bookmarked}
                onChange={saved => setData(current => current?.id === id ? { ...current, bookmarked: saved } : current)} />
            </div>
          </section>
          <section className="card job-detail-tab-card" id="job-detail-tabs">
            <div className="job-detail-tabs" role="tablist" aria-label="공고 상세 메뉴">
              {tabs.map(tab => <button key={tab.value} type="button" role="tab"
                aria-selected={activeTab === tab.value} aria-controls="job-detail-panel"
                onClick={() => setActiveTab(tab.value)}>{tab.label}</button>)}
            </div>
            <div id="job-detail-panel" role="tabpanel" className="job-detail-tab-panel">
              {activeTab === 'description' && <Description job={data} />}
              {activeTab === 'application' && (data.applicationStatus
                ? applicationError ? <ErrorState message={applicationError} onRetry={() => setApplicationRetry(value => value + 1)} />
                  : application ? <JobApplicationPanel application={application} onViewDetail={() => setApplicationDetailId(application.id)} />
                    : <LoadingState message="내 지원 기록을 불러오고 있습니다." />
                : <ApplicationRegistration key={data.id} jobId={data.id} status={null} onCreated={applicationStatus =>
                  setData(current => current?.id === id ? { ...current, applicationStatus } : current)} />)}
            </div>
          </section>
        </div>
        <aside className="job-detail-sidebar">
          <section className="card job-detail-side-card">
            <header><LucideIcon name="building" /><h3>기업 정보</h3></header>
            <div className="job-detail-company-line"><span className="job-detail-company-icon"><img src={building} alt="" /></span>
              <div><strong>{data.company.name}</strong><small>{sourceLabel(data.source)}</small></div></div>
            <dl><div><dt>공고 출처</dt><dd>{sourceLabel(data.source)}</dd></div>
              {data.location && <div><dt>근무 지역</dt><dd>{data.location}</dd></div>}
              {data.employmentType && <div><dt>고용 형태</dt><dd>{data.employmentType}</dd></div>}</dl>
          </section>
          <section className="card job-detail-side-card job-detail-ai-card">
            <header><LucideIcon name="fileText" /><h3>AI 분석</h3>
              {analysisStatus === 'COMPLETED' && <span className="job-detail-analysis-state" role="status"><LucideIcon name="check" />분석 완료</span>}</header>
            <JobAnalysis key={data.id} jobId={data.id} canRequest={data.bookmarked}
              initialStatus={analysisStatus} onStatusChange={setAnalysisStatus} />
          </section>
          <section className="card job-detail-side-card job-detail-match-card">
            <header><LucideIcon name="sliders" /><h3>내 기술 매칭</h3></header>
            {showMatch ? <JobMatch key={data.id} jobId={data.id} analysisStatus={analysisStatus} />
              : <><p>{analysisStatus === 'COMPLETED' ? 'AI가 추출한 공고 기술과 등록한 보유·프로젝트 기술을 비교합니다.'
                : 'AI 분석이 완료되면 비교할 수 있습니다.'}</p>
                <button type="button" disabled={analysisStatus !== 'COMPLETED'} onClick={() => {
                  rememberViewedMatch(userId, data.id);
                  setShowMatch(true);
                }}>기술 비교하기</button></>}
          </section>
        </aside>
      </div>}
    {applicationDetailId !== null && <ApplicationDetailPage location={`/applications/${applicationDetailId}`} modalOnly
      onClose={() => setApplicationDetailId(null)}
      onUpdated={updated => {
        setApplication(updated);
        setData(current => current?.id === id ? { ...current, applicationStatus: updated.currentStatus } : current);
      }}
      onDeleted={() => {
        setApplication(undefined);
        setData(current => current?.id === id ? { ...current, applicationStatus: null } : current);
      }} />}
  </div>;
}
