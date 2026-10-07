import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createAnalyticsApi } from '../../api/analytics';
import type { SkillDemandPage } from '../../api/analytics';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './market.css';
import marketBarsArt from '../../assets/illustrations/market-bars.png';

const analytics = createAnalyticsApi(apiRequest);
const validDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));

export function MarketAnalyticsPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const dateFrom = params.get('dateFrom') || '';
  const dateTo = params.get('dateTo') || '';
  const desiredRole = params.get('desiredRole') || '';
  const page = Number(params.get('page') || 0);
  const [draft, setDraft] = useState({ dateFrom, dateTo, desiredRole });
  const [formError, setFormError] = useState('');
  const [data, setData] = useState<SkillDemandPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { setDraft({ dateFrom, dateTo, desiredRole }); setFormError(''); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    analytics.skills({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      desiredRole: desiredRole || undefined, page }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '시장 기술 수요를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, retry]);
  const navigate = (next: number) => {
    const query = new URLSearchParams(search);
    query.set('page', String(next));
    window.location.hash = `/analytics/skills?${query}`;
  };
  return <div className="market-page">
    <section className="card"><div className="market-intro"><p>AI 분석이 완료된 저장 공고에서 기술 수요를 집계합니다.</p><img src={marketBarsArt} alt="" aria-hidden="true" width="96" height="96" /></div>
      <form className="market-filters" onSubmit={event => {
        event.preventDefault();
        if (!validDate(draft.dateFrom) || !validDate(draft.dateTo) || draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo
          || draft.desiredRole.trim().length > 200) { setFormError('기간과 직무명을 확인해 주세요.'); return; }
        setFormError('');
        const query = new URLSearchParams();
        if (draft.dateFrom) query.set('dateFrom', draft.dateFrom);
        if (draft.dateTo) query.set('dateTo', draft.dateTo);
        if (draft.desiredRole.trim()) query.set('desiredRole', draft.desiredRole.trim());
        window.location.hash = `/analytics/skills${query.size ? `?${query}` : ''}`;
        if (search === query.toString()) setRetry(value => value + 1);
      }}>
        <label>게시 시작일<input type="date" value={draft.dateFrom} onChange={event => setDraft(value => ({ ...value, dateFrom: event.target.value }))} /></label>
        <label>게시 종료일<input type="date" value={draft.dateTo} onChange={event => setDraft(value => ({ ...value, dateTo: event.target.value }))} /></label>
        <label>직무명<input type="search" maxLength={200} value={draft.desiredRole} placeholder="공고 제목에 포함된 단어"
          onChange={event => setDraft(value => ({ ...value, desiredRole: event.target.value }))} /></label>
        <button type="submit">수요 조회</button>
      </form>
      {formError && <p role="alert" className="form-error">{formError}</p>}
    </section>
    <section className="card" aria-label="기술 수요 결과" aria-busy={loading}>
      {loading ? <LoadingState message="기술 수요를 불러오고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
        <p role="status">분석 공고 {data.analyzedJobCount}건 · 기술 {data.totalElements}개</p>
        <p className="market-note">이 수치는 선택한 조건의 분석 완료 공고 표본을 나타냅니다. 전체 채용시장의 비율은 아닙니다.</p>
        {data.items.length === 0 ? <><EmptyState title={data.totalElements ? '이 페이지에 기술이 없습니다.' : '조건에 맞는 분석 결과가 없습니다.'}
          message="기간이나 직무명을 바꾸거나, 공고 상세에서 AI 분석을 완료해 보세요." />
          {page > 0 && <button type="button" onClick={() => navigate(0)}>첫 페이지로</button>}</>
          : <ol className="market-list">{data.items.map(item => <li key={item.skill.id}>
            <div className="market-row"><strong>{item.skill.name}</strong><span>{item.jobCount} / {item.analyzedJobCount}건 · {(item.ratio * 100).toFixed(1)}%</span></div>
            <div className="market-bar" aria-hidden="true"><span style={{ width: `${item.ratio * 100}%` }} /></div>
          </li>)}</ol>}
        <nav className="market-pagination" aria-label="기술 수요 페이지">
          <button type="button" disabled={page === 0} onClick={() => navigate(page - 1)}>이전 페이지</button>
          <span>{page + 1}페이지</span>
          <button type="button" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => navigate(page + 1)}>다음 페이지</button>
        </nav>
      </>}
    </section>
  </div>;
}
