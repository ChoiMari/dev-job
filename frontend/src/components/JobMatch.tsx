import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { createMatchApi } from '../api/match';
import type { JobMatch as Match, SkillGroup } from '../api/match';
import { ErrorState, LoadingState } from './States';

const api = createMatchApi(apiRequest);
function Group({ title, value }: { title: string; value: SkillGroup }) {
  return <div><h4>{title} ({value.matched.length}/{value.total})</h4>
    <p>일치: {value.matched.length ? value.matched.map(skill => skill.name).join(', ') : '없음'}</p>
    <p>부족: {value.missing.length ? value.missing.map(skill => skill.name).join(', ') : '없음'}</p></div>;
}
export function JobMatch({ jobId, analysisStatus }: { jobId: number; analysisStatus: string | null }) {
  const [match, setMatch] = useState<Match>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (analysisStatus !== 'COMPLETED') return;
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get(jobId, controller.signal).then(setMatch).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '역량을 비교하지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [jobId, analysisStatus, retry]);
  useEffect(() => {
    if (analysisStatus !== 'COMPLETED') return;
    const refresh = () => setRetry(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [analysisStatus]);
  return <section className="job-analysis" aria-label="내 역량 비교">
    <h3>내 역량 비교</h3>
    {analysisStatus !== 'COMPLETED' ? <p>공고 분석이 완료되면 비교 결과를 확인할 수 있습니다.</p>
      : loading ? <LoadingState message="역량을 비교하고 있습니다." />
      : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
      : match?.available ? <><p>기술 일치도 {match.matchRate}% · 합격 확률이 아닙니다.</p>
        <Group title="필수 기술" value={match.required} /><Group title="우대 기술" value={match.preferred} /></>
      : match ? <p>{match.reason === 'NO_JOB_SKILLS' ? '분석된 기술이 없어 비교할 수 없습니다.'
        : '보유 기술과 프로젝트 기술을 등록하면 비교할 수 있습니다.'}</p> : null}
  </section>;
}
