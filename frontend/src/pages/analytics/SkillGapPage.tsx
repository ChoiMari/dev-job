import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createSkillGapApi } from '../../api/skill-gap';
import type { SkillGap } from '../../api/skill-gap';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './skill-gap.css';

const api = createSkillGapApi(apiRequest);
const reasons: Record<string, { title: string; message: string }> = {
  USER_SKILLS_EMPTY: { title: '등록된 기술이 없습니다.', message: '프로필이나 프로젝트에 기술을 추가하면 부족한 기술을 비교할 수 있습니다.' },
  INSUFFICIENT_SAMPLE: { title: '분석 공고가 부족합니다.', message: '이 직무의 분석 완료 공고가 5건 이상 모이면 순위를 볼 수 있습니다.' },
  NO_JOB_SKILLS: { title: '비교할 공고 기술이 없습니다.', message: '분석 완료 공고에서 기술이 추출되면 순위를 볼 수 있습니다.' },
};

export function SkillGapPage({ location }: { location: string }) {
  const desiredRole = new URLSearchParams(location.split('?')[1] || '').get('desiredRole') || '';
  const [draft, setDraft] = useState(desiredRole);
  const [data, setData] = useState<SkillGap>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { setDraft(desiredRole); setFormError(''); }, [desiredRole]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    api.get(desiredRole || undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '역량 분석을 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [desiredRole, retry]);
  const unavailable = data && !data.available ? reasons[data.reason || ''] || {
    title: '역량을 비교할 수 없습니다.', message: '내 기술과 분석 공고를 확인해 주세요.',
  } : null;
  return <div className="skill-gap-page">
    <section className="card">
      <p>내 기술과 분석 완료 공고의 요구 기술을 비교합니다.</p>
      <form className="skill-gap-filter" onSubmit={event => {
        event.preventDefault();
        const role = draft.trim();
        if (role.length > 200) { setFormError('직무명은 200자 이내로 입력해 주세요.'); return; }
        setFormError('');
        window.location.hash = `/skill-gap${role ? `?desiredRole=${encodeURIComponent(role)}` : ''}`;
        if (role === desiredRole) setRetry(value => value + 1);
      }}>
        <label>목표 직무<input type="search" maxLength={200} value={draft}
          placeholder="비우면 프로필의 희망 직무 사용" onChange={event => setDraft(event.target.value)} /></label>
        <button type="submit">순위 보기</button>
      </form>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <p className="skill-gap-note">직무명은 공고 제목에서 찾습니다. 희망 직무도 없으면 전체 분석 완료 공고를 비교합니다.</p>
    </section>
    <section className="card" aria-label="부족한 기술 순위" aria-busy={loading}>
      {loading ? <LoadingState message="부족한 기술을 분석하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
        <h2>부족한 기술 TOP 5</h2>
        <p role="status">비교 직무: {data.desiredRole || '전체 공고'} · 분석 완료 공고 {data.analyzedJobCount}건</p>
        {data.provisional && <p className="skill-gap-caution">표본 적음 · 순위는 분석 공고가 더 모이면 달라질 수 있습니다.</p>}
        {unavailable ? <><EmptyState title={unavailable.title} message={unavailable.message} />
          <a href={data.reason === 'USER_SKILLS_EMPTY' ? '#/profile' : '#/jobs'}>
            {data.reason === 'USER_SKILLS_EMPTY' ? '내 기술 등록하기' : '채용공고 보기'}</a></>
          : data.items.length === 0 ? <EmptyState title="부족한 기술이 없습니다." message="비교한 공고의 기술을 모두 등록했습니다." />
            : <ol className="skill-gap-list">{data.items.map((item, index) => <li key={item.skill.id}>
              <span className="skill-gap-rank">{index + 1}위</span>
              <strong>{item.skill.name}</strong>
              <span>등장률 {Math.round(item.demandRatio * 100)}%</span>
              <span>필수 {item.requiredJobCount}건 / 우대 {item.preferredJobCount}건</span>
            </li>)}</ol>}
        {data.available && data.totalMissingSkills > 5 && <p className="skill-gap-note">전체 부족 기술 {data.totalMissingSkills}개 중 상위 5개를 표시합니다.</p>}
        <p className="skill-gap-note">등장률은 선택한 조건의 분석 완료 공고 표본을 기준으로 합니다. 전체 채용시장의 비율은 아닙니다.</p>
        <a href="#/analytics/skills">시장 기술 수요 자세히 보기</a>
      </>}
    </section>
  </div>;
}
