import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { createAnalysisApi } from '../api/analysis';
import type { Analysis } from '../api/analysis';
import { ApiError } from '../api/client';
import { ErrorState } from './States';

const api = createAnalysisApi(apiRequest);
export function JobAnalysis({ jobId, initialStatus, canRequest, onStatusChange }: { jobId: number; initialStatus: string | null; canRequest: boolean; onStatusChange?: (status: string) => void }) {
  const [analysis, setAnalysis] = useState<Analysis>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    if (!initialStatus) return;
    const controller = new AbortController();
    api.get(jobId, controller.signal).then(value => { setAnalysis(value); onStatusChange?.(value.status); }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '분석을 불러오지 못했습니다.');
    });
    return () => controller.abort();
  }, [jobId, initialStatus]);
  useEffect(() => {
    if (analysis?.status !== 'PENDING') return;
    let active = true;
    const timer = window.setInterval(() => api.get(jobId).then(value => {
      if (active) { setAnalysis(value); onStatusChange?.(value.status); setError(''); }
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : '분석 상태를 확인하지 못했습니다.'); }), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, analysis?.status]);
  const run = async () => {
    if (busy || !canRequest) return;
    setBusy(true); setError('');
    try { const value = await api.request(jobId); setAnalysis(value); onStatusChange?.(value.status); setLinked(value.status === 'COMPLETED'); }
    catch (failure) { setError(failure instanceof ApiError && failure.status === 503
      ? 'AI 서비스 키가 설정되지 않았습니다. 서버 설정 후 다시 시도해 주세요.' : failure instanceof Error ? failure.message : '분석 요청에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  return <section className={`job-analysis${analysis?.status === 'COMPLETED' ? ' job-analysis--completed' : ''}`} aria-live="polite">
    <h3>AI 공고 분석</h3>
    {!analysis && !initialStatus && <><p>{canRequest ? '공고 원문에서 필수·우대 기술을 추출합니다.' : 'AI 분석은 관심 공고로 저장한 뒤 요청할 수 있습니다.'}</p>
      <button type="button" className="button-primary" disabled={busy || !canRequest} onClick={run}>{busy ? '요청 중…' : 'AI 분석하기'}</button></>}
    {analysis?.status === 'PENDING' && <p role="status">분석 중입니다. 이 화면에서 결과를 확인할 수 있습니다.</p>}
    {analysis?.status === 'FAILED' && <><p>{analysis.failureReason}</p>
      <button type="button" disabled={busy || !canRequest} onClick={run}>{busy ? '요청 중…' : '다시 분석하기'}</button></>}
    {analysis?.status === 'COMPLETED' && <>
      <p>분석 완료</p>
      <h4>필수 기술</h4>{analysis.requiredSkills.length ? <ul>{analysis.requiredSkills.map(s => <li key={s.id}>{s.name}</li>)}</ul> : <p>추출된 기술이 없습니다.</p>}
      <h4>우대 기술</h4>{analysis.preferredSkills.length ? <ul>{analysis.preferredSkills.map(s => <li key={s.id}>{s.name}</li>)}</ul> : <p>추출된 기술이 없습니다.</p>}
      {canRequest && <button type="button" className="button-primary" disabled={busy} onClick={run}>{busy ? '요청 중…' : 'AI 분석하기'}</button>}
      {linked && <p role="status">분석 기술을 내 프로필의 AI 후보에 반영했습니다.</p>}
    </>}
    {error && <ErrorState message={error} onRetry={() => {
      setError(''); if (initialStatus || analysis) api.get(jobId).then(value => { setAnalysis(value); onStatusChange?.(value.status); }).catch(failure => setError(failure instanceof Error ? failure.message : '분석을 불러오지 못했습니다.'));
      else void run();
    }} />}
  </section>;
}
