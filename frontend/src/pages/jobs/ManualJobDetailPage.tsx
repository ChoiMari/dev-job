import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createSavedJobsApi } from '../../api/saved-jobs';
import type { ManualSavedJob } from '../../api/saved-jobs';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import type { ApplicationStatus } from '../../api/application-status';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import savedJobsArt from '../../assets/redesign/cur-05-saved-jobs.png';
import './jobs.css';

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
  return <div className="jobs-page">{onBack ? <button type="button" onClick={onBack}>← 관심 공고 목록</button>
    : <a className="button-link" href="#/bookmarks">← 관심 공고 목록</a>}
    <section className="card" aria-busy={loading}>{loading ? <LoadingState message="직접 등록 공고를 불러오고 있습니다." />
      : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : !job ? <EmptyState title="공고가 없습니다." /> : <>
        <div className="job-detail-intro job-hero"><div><p className="job-eyebrow">MANUAL JOB</p><p>직접 등록한 개인 공고</p><p className="job-company">{job.companyName}</p><h2>{job.title}</h2></div><img src={savedJobsArt} alt="" aria-hidden="true" /></div>
        <dl className="job-metadata"><div><dt>직무</dt><dd>{job.role || '정보 없음'}</dd></div><div><dt>지역</dt><dd>{job.location || '정보 없음'}</dd></div>
          <div><dt>경력</dt><dd>{job.careerLevel || '정보 없음'}</dd></div><div><dt>마감일</dt><dd>{job.deadlineDate || '정보 없음'}</dd></div></dl>
        <div className="job-source-actions"><a className="button-link button-primary" href={job.url} target="_blank" rel="noopener noreferrer">외부 원문 열기 (새 창)</a>
          <p>이 링크는 외부 공고를 엽니다. 아래 지원 기록은 이 앱 안에서 별도로 관리합니다.</p></div>
        <ApplicationRegistration personalSavedJobId={job.id} status={applicationStatus} onCreated={setApplicationStatus} />
        <section className="job-analysis"><h3>개인 공고 AI 분석</h3><p>직접 입력한 본문만 분석합니다. 외부 URL은 읽지 않습니다.</p>
          <button type="button" disabled={busy || !job.description || analysis?.status === 'COMPLETED'} onClick={analyze}>{busy ? '분석 중…' : analysis?.status === 'FAILED' ? '다시 분석하기' : 'AI 공고분석'}</button>
          {!job.description && <p>목록의 수정 버튼에서 공고 본문을 입력해 주세요.</p>}
          {analysis?.status === 'COMPLETED' && <><p>분석 완료</p><p>필수 기술: {analysis.requiredSkills.join(', ') || '추출된 기술 없음'}</p>
            <p>우대 기술: {analysis.preferredSkills.join(', ') || '추출된 기술 없음'}</p></>}
          {analysis?.status === 'FAILED' && <p>{analysis.failureReason || '분석에 실패했습니다.'}</p>}
          {analysisError && <ErrorState message={analysisError} onRetry={() => setRetry(value => value + 1)} />}</section>
        {job.note && <section><h3>내 메모</h3><p className="job-description">{job.note}</p></section>}
        <section><h3>저장한 공고 본문</h3>{job.description ? <div className="job-description">{job.description}</div> : <p>저장한 본문이 없습니다.</p>}</section>
      </>}</section></div>;
}
