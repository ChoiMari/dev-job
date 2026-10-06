import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { createAnalysisApi } from '../api/analysis';
import type { Analysis } from '../api/analysis';
import { ErrorState } from './States';

const api = createAnalysisApi(apiRequest);
export function JobAnalysis({ jobId, initialStatus }: { jobId: number; initialStatus: string | null }) {
  const [analysis, setAnalysis] = useState<Analysis>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!initialStatus) return;
    const controller = new AbortController();
    api.get(jobId, controller.signal).then(setAnalysis).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '분석을 불러오지 못했습니다.');
    });
    return () => controller.abort();
  }, [jobId, initialStatus]);
  useEffect(() => {
    if (analysis?.status !== 'PENDING') return;
    let active = true;
    const timer = window.setInterval(() => api.get(jobId).then(value => {
      if (active) { setAnalysis(value); setError(''); }
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : '분석 상태를 확인하지 못했습니다.'); }), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [jobId, analysis?.status]);
  const run = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { setAnalysis(await api.request(jobId)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : '분석 요청에 실패했습니다.'); }
    finally { setBusy(false); }
  };
  return <section className="job-analysis" aria-live="polite">
    <h3>AI 공고 분석</h3>
    {!analysis && !initialStatus && <><p>공고 원문에서 필수·우대 기술을 추출합니다.</p>
      <button type="button" className="button-primary" disabled={busy} onClick={run}>{busy ? '요청 중…' : '분석하기'}</button></>}
    {analysis?.status === 'PENDING' && <p role="status">분석 중입니다. 이 화면에서 결과를 확인할 수 있습니다.</p>}
    {analysis?.status === 'FAILED' && <><p>{analysis.failureReason}</p>
      <button type="button" disabled={busy} onClick={run}>{busy ? '요청 중…' : '다시 분석하기'}</button></>}
    {analysis?.status === 'COMPLETED' && <>
      <p>분석 완료</p>
      <h4>필수 기술</h4>{analysis.requiredSkills.length ? <ul>{analysis.requiredSkills.map(s => <li key={s.id}>{s.name}</li>)}</ul> : <p>추출된 기술이 없습니다.</p>}
      <h4>우대 기술</h4>{analysis.preferredSkills.length ? <ul>{analysis.preferredSkills.map(s => <li key={s.id}>{s.name}</li>)}</ul> : <p>추출된 기술이 없습니다.</p>}
    </>}
    {error && <ErrorState message={error} onRetry={() => {
      setError(''); if (initialStatus || analysis) api.get(jobId).then(setAnalysis).catch(failure => setError(failure instanceof Error ? failure.message : '분석을 불러오지 못했습니다.'));
      else void run();
    }} />}
  </section>;
}
