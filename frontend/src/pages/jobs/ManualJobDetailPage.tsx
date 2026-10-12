import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createSavedJobsApi } from '../../api/saved-jobs';
import type { ManualSavedJob } from '../../api/saved-jobs';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { LucideIcon } from '../../components/LucideIcon';
import type { ApplicationStatus } from '../../api/application-status';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import jobDetailSkyline from '../../assets/redesign/job-detail-skyline.png';
import jobDetailCat from '../../assets/redesign/interview-planner-cat.png';
import building from '../../assets/redesign/interview-building.png';
import './jobs.css';
import './job-detail.css';
import './manual-job-detail.css';

const savedJobs = createSavedJobsApi(apiRequest);
type Analysis = { status: 'COMPLETED' | 'FAILED'; requiredSkills: string[]; preferredSkills: string[]; failureReason: string | null };
function readAnalysis(value: unknown): Analysis {
  if (!value || typeof value !== 'object') throw new Error('분석 응답을 확인할 수 없습니다.');
  const result = value as Record<string, unknown>;
  if (!['COMPLETED', 'FAILED'].includes(String(result.status)) || !Array.isArray(result.requiredSkills)
    || !result.requiredSkills.every(skill => typeof skill === 'string') || !Array.isArray(result.preferredSkills)
    || !result.preferredSkills.every(skill => typeof skill === 'string')) throw new Error('분석 응답을 확인할 수 없습니다.');
  return result as Analysis;
}

export function ManualJobDetailPage({ location, onBack, initialApplicationStatus = null }: {
  location: string; onBack?: () => void; initialApplicationStatus?: ApplicationStatus | null;
}) {
  const path = location.split('?')[0];
  const id = Number(path.slice('/bookmarks/'.length));
  const valid = /^\/bookmarks\/[1-9]\d*$/.test(path) && Number.isSafeInteger(id);
  const [job, setJob] = useState<ManualSavedJob>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [busy, setBusy] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(initialApplicationStatus);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'application'>('description');
  useEffect(() => {
    const controller = new AbortController(); setJob(undefined); setLoading(true); setError('');
    if (!valid) { setError('직접 등록 공고 주소를 확인해 주세요.'); setLoading(false); return; }
    savedJobs.detail(id, controller.signal).then(value => { if (!controller.signal.aborted) setJob(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof ApiError && failure.status === 404
        ? '공고를 찾을 수 없습니다.' : failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, valid, retry]);
  useEffect(() => {
    if (!job) return;
    let active = true; setAnalysisError(''); setAnalysis(null);
    savedJobs.analysis(id).then(value => { if (active) setAnalysis(readAnalysis(value)); })
      .catch(failure => { if (active && !(failure instanceof ApiError && failure.status === 404))
        setAnalysisError(failure instanceof Error ? failure.message : '분석을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [id, job?.updatedAt]);
  async function analyze() {
    setBusy(true); setAnalysisError('');
    try { setAnalysis(readAnalysis(await savedJobs.requestAnalysis(id))); }
    catch (failure) { setAnalysisError(failure instanceof ApiError && failure.status === 400 ? '공고 본문을 입력해 주세요.'
      : failure instanceof ApiError && failure.status === 409 ? '수정된 공고입니다. 다시 불러와 주세요.'
        : failure instanceof Error ? failure.message : '분석에 실패했습니다.'); }
    finally { setBusy(false); }
  }
  return <div className="jobs-page job-detail-page manual-job-detail-page">
    <header className="job-detail-banner" style={{ backgroundImage: `url(${jobDetailSkyline})` }}>
      {onBack ? <button type="button" className="job-detail-back" onClick={onBack} aria-label="관심 공고 목록으로"><LucideIcon name="arrowLeft" /></button>
        : <a href="#/bookmarks" className="job-detail-back" aria-label="관심 공고 목록으로"><LucideIcon name="arrowLeft" /></a>}
      <div className="job-detail-banner-copy"><h1>관심 공고 상세</h1><p>직접 등록한 공고 정보와 지원 현황을 확인하세요.</p></div>
      <img src={jobDetailCat} alt="" aria-hidden="true" />
    </header>
    {loading ? <section className="card" aria-busy="true"><LoadingState message="직접 등록 공고를 불러오고 있습니다." /></section>
      : error ? <section className="card"><ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /></section>
        : !job ? <section className="card"><EmptyState title="공고가 없습니다." /></section>
          : <div className="job-detail-layout">
            <div className="job-detail-primary">
              <section className="card job-detail-summary" aria-label="공고 요약">
                <div className="job-detail-summary-main"><span className="job-detail-company-icon"><img src={building} alt="" aria-hidden="true" /></span>
                  <div><p className="job-detail-company-name">{job.companyName}</p><h2>{job.title}</h2></div></div>
                <div className="job-detail-tags"><span>직접 등록</span>{job.role && <span>{job.role}</span>}
                  {job.careerLevel && <span>{job.careerLevel}</span>}{job.employmentType && <span>{job.employmentType}</span>}
                  {job.location && <span>{job.location}</span>}{applicationStatus && <span className={`job-detail-status job-detail-status--${applicationStatus.toLowerCase()}`}><ApplicationStatusBadge status={applicationStatus} /></span>}</div>
                <dl className="job-detail-dates"><div><dt><LucideIcon name="calendar" /> 등록일</dt><dd>{job.createdAt.slice(0, 10)}</dd></div>
                  <div><dt><LucideIcon name="calendar" /> 마감일</dt><dd>{job.deadlineDate || '정보 없음'}</dd></div></dl>
              </section>
              <section className="card job-detail-tab-card" id="manual-job-tabs">
                <div className="job-detail-tabs" role="tablist" aria-label="관심 공고 상세 메뉴">
                  <button type="button" role="tab" aria-selected={activeTab === 'description'} aria-controls="manual-job-panel" onClick={() => setActiveTab('description')}>상세 내용</button>
                  <button type="button" role="tab" aria-selected={activeTab === 'application'} aria-controls="manual-job-panel" onClick={() => setActiveTab('application')}>지원 현황</button>
                </div>
                <div id="manual-job-panel" role="tabpanel" className="job-detail-tab-panel">
                  {activeTab === 'description' ? <div className="job-detail-content">
                    <header><LucideIcon name="fileText" /><h3>채용공고 내용</h3>
                      <div className="manual-job-content-actions"><a href={job.url} target="_blank" rel="noopener noreferrer" className="button-link job-detail-source-link">외부 공고 열기 <LucideIcon name="arrowRight" /></a>
                        <a href={`#/bookmarks/${job.id}/edit`} className="button-link job-detail-source-link">공고 수정 <LucideIcon name="pencil" /></a></div></header>
                    {job.description ? <p className="job-detail-raw-description">{job.description}</p>
                      : <p className="job-detail-raw-description">저장한 본문이 없습니다. 외부 공고에서 채용 조건을 확인해 주세요.</p>}
                    <section className="job-detail-content-row"><h4>근무 정보</h4><dl className="job-detail-conditions">
                      {job.location && <div><dt>근무 지역</dt><dd>{job.location}</dd></div>}
                      {job.employmentType && <div><dt>고용 형태</dt><dd>{job.employmentType}</dd></div>}
                      {job.careerLevel && <div><dt>경력 조건</dt><dd>{job.careerLevel}</dd></div>}
                      {!job.location && !job.employmentType && !job.careerLevel && <div><dd>입력한 근무 정보가 없습니다.</dd></div>}
                    </dl></section>
                    {job.note && <section className="job-detail-content-row"><h4>내 메모</h4><p>{job.note}</p></section>}
                  </div> : <ApplicationRegistration personalSavedJobId={job.id} status={applicationStatus} buttonStatusPicker onCreated={setApplicationStatus} />}
                </div>
              </section>
            </div>
            <aside className="job-detail-sidebar">
              <section className="card job-detail-side-card"><header><LucideIcon name="building" /><h3>기업 정보</h3></header>
                <div className="job-detail-company-line"><span className="job-detail-company-icon"><img src={building} alt="" aria-hidden="true" /></span><div><strong>{job.companyName}</strong><small>직접 등록 공고</small></div></div>
                <dl>{job.location && <div><dt>근무 지역</dt><dd>{job.location}</dd></div>}{job.employmentType && <div><dt>고용 형태</dt><dd>{job.employmentType}</dd></div>}</dl>
              </section>
              <section className="card job-detail-side-card"><header><LucideIcon name="fileText" /><h3>AI 분석</h3></header>
                <div className={`job-analysis${analysis?.status === 'COMPLETED' ? ' job-analysis--completed' : ''}`}>
                  {analysis?.status === 'COMPLETED' ? <><p>분석 완료</p><h4>필수 기술</h4><ul>{analysis.requiredSkills.length
                    ? analysis.requiredSkills.map(skill => <li key={`required-${skill}`}>{skill}</li>) : <li>추출된 기술 없음</li>}</ul>
                    <h4>우대 기술</h4><ul>{analysis.preferredSkills.length
                      ? analysis.preferredSkills.map(skill => <li key={`preferred-${skill}`}>{skill}</li>) : <li>추출된 기술 없음</li>}</ul></>
                    : <><p>{job.description ? '직접 입력한 공고 본문을 분석합니다.' : '공고 본문을 입력하면 분석할 수 있습니다.'}</p>
                      <button type="button" disabled={busy || !job.description} onClick={analyze}>{busy ? '분석 중…' : analysis?.status === 'FAILED' ? '다시 분석하기' : 'AI 공고분석'}</button></>}
                  {analysis?.status === 'FAILED' && <p>{analysis.failureReason || '분석에 실패했습니다.'}</p>}
                  {analysisError && <ErrorState message={analysisError} onRetry={() => setRetry(value => value + 1)} />}
                </div>
              </section>
            </aside>
          </div>}
  </div>;
}
