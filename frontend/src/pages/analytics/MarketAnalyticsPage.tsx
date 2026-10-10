import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createAnalyticsApi } from '../../api/analytics';
import type { MarketDistribution, SkillDemandPage, SkillTrend } from '../../api/analytics';
import { createSkillsApi } from '../../api/skills';
import type { Skill } from '../../api/skills';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import art from '../../assets/redesign/ext-img-04-expanded-analytics.png';
import './market.css';

const api = createAnalyticsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const careerNames: Record<string, string> = { ENTRY: '신입', EXPERIENCED: '경력', ANY: '경력 무관', OTHER: '기타', UNKNOWN: '미상' };
const regionNames: Record<string, string> = { SEOUL: '서울', BUSAN: '부산', DAEGU: '대구', INCHEON: '인천', GWANGJU: '광주', DAEJEON: '대전', ULSAN: '울산', SEJONG: '세종', GYEONGGI: '경기', GANGWON: '강원', CHUNGBUK: '충북', CHUNGNAM: '충남', JEONBUK: '전북', JEONNAM: '전남', GYEONGBUK: '경북', GYEONGNAM: '경남', JEJU: '제주', NATIONWIDE_REMOTE: '전국·원격', OTHER: '기타·복수 지역', UNKNOWN: '미상' };
type Result<T> = { data?: T; error?: string };
const err = (e: unknown) => e instanceof Error ? e.message : '결과를 불러오지 못했습니다.';
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
export const isCalendarDate = (s: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

function Distribution({ title, result, names, retry }: { title: string; result: Result<MarketDistribution>; names: Record<string, string>; retry: () => void }) {
  return <section className="card market-section" aria-label={title}><h2>{title}</h2>
    {result.error ? <ErrorState message={result.error} onRetry={retry} /> : !result.data ? <LoadingState message={`${title}를 불러오고 있습니다.`} /> : <>
      <p>공용 수집 공고 {result.data.jobCount}건 · 분석 여부 무관 · 미상 포함</p>
      {result.data.insufficientSample && <p className="market-caution">표본 부족: 10건 미만이므로 시장의 대표값으로 해석하지 마세요.</p>}
      {result.data.jobCount === 0 ? <EmptyState title="조건에 맞는 공고가 없습니다." message="기간·출처·직무 조건을 바꿔 보세요." /> : <>
        <div className="market-chart" aria-hidden="true">{result.data.buckets.map(b => <span key={b.key} style={{ width: `${b.ratio * 100}%` }} />)}</div>
        <div className="market-table-wrap"><table><caption>{title}: 공용 공고 {result.data.jobCount}건 기준</caption><thead><tr><th scope="col">분류</th><th scope="col">공고 수</th><th scope="col">비율</th></tr></thead><tbody>
          {result.data.buckets.map(b => <tr key={b.key}><th scope="row">{names[b.key] || b.key}</th><td>{b.jobCount}건</td><td>{pct(b.ratio)}</td></tr>)}
        </tbody></table></div><p className="market-note">미상도 분모에 포함합니다. 복수 지역은 기타이며 반올림 때문에 비율 합계가 100%와 다를 수 있습니다.</p>
      </>}
    </>}
  </section>;
}

export function MarketAnalyticsPage({ location }: { location: string }) {
  const search = location.split('?')[1] || ''; const params = new URLSearchParams(search);
  const applied = { dateFrom: params.get('dateFrom') || '', dateTo: params.get('dateTo') || '', desiredRole: params.get('desiredRole') || '', source: params.get('source') || '', skillId: params.get('skillId') || '', interval: params.get('interval') === 'WEEK' ? 'WEEK' as const : 'MONTH' as const };
  const page = Math.max(0, Number(params.get('page') || 0) || 0);
  const [draft, setDraft] = useState(applied); const [formError, setFormError] = useState('');
  const [demand, setDemand] = useState<Result<SkillDemandPage>>({}); const [career, setCareer] = useState<Result<MarketDistribution>>({});
  const [regions, setRegions] = useState<Result<MarketDistribution>>({}); const [trend, setTrend] = useState<Result<SkillTrend>>({});
  const [skillQuery, setSkillQuery] = useState(''); const [choices, setChoices] = useState<Skill[]>([]); const [skillError, setSkillError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { setDraft(applied); setFormError(''); }, [search]);
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal;
    const filters = { dateFrom: applied.dateFrom || undefined, dateTo: applied.dateTo || undefined, desiredRole: applied.desiredRole || undefined, source: applied.source || undefined };
    const load = <T,>(promise: Promise<T>, set: (v: Result<T>) => void) => promise.then(data => { if (!signal.aborted) set({ data }); }).catch(e => { if (!signal.aborted) set({ error: err(e) }); });
    setDemand({}); setCareer({}); setRegions({}); setTrend({});
    void load(api.skills({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, desiredRole: filters.desiredRole, page }, signal), setDemand);
    void load(api.careerLevels(filters, signal), setCareer); void load(api.locations(filters, signal), setRegions);
    if (applied.skillId && applied.dateFrom && applied.dateTo) void load(api.trend({ ...filters, skillId: Number(applied.skillId), dateFrom: applied.dateFrom, dateTo: applied.dateTo, interval: applied.interval }, signal), setTrend);
    return () => controller.abort();
  }, [search, retry]);
  useEffect(() => {
    if (!skillQuery.trim()) { setChoices([]); setSkillError(''); return; }
    const controller = new AbortController();
    skills.search(skillQuery.trim(), 0, controller.signal).then(v => { if (!controller.signal.aborted) setChoices(v.items); }).catch(e => { if (!controller.signal.aborted) setSkillError(err(e)); });
    return () => controller.abort();
  }, [skillQuery]);
  const goPage = (n: number) => { const q = new URLSearchParams(search); q.set('page', String(n)); window.location.hash = `/analytics/skills?${q}`; };
  return <div className="market-page">
    <section className="card"><div className="market-intro"><div><h2>채용시장 분석</h2><p>집계마다 다른 표본과 필터를 확인하세요.</p></div><img src={art} alt="" aria-hidden="true" /></div>
      <form className="market-filters" onSubmit={e => {
        e.preventDefault(); const a = draft;
        if (!isCalendarDate(a.dateFrom) || !isCalendarDate(a.dateTo) || a.dateFrom && a.dateTo && a.dateFrom > a.dateTo
          || a.desiredRole.trim().length > 200 || a.source && !/^[A-Z0-9_]{1,100}$/.test(a.source)
          || a.skillId && (!/^\d+$/.test(a.skillId) || Number(a.skillId) <= 0 || !a.dateFrom || !a.dateTo || (Date.parse(a.dateTo) - Date.parse(a.dateFrom)) / 86400000 > 1830)) {
          setFormError('기간·출처·기술을 확인해 주세요. 추이는 양쪽 날짜와 최대 1830일 범위가 필요합니다.'); return;
        }
        setFormError(''); const q = new URLSearchParams();
        for (const key of ['dateFrom', 'dateTo', 'desiredRole', 'source', 'skillId'] as const) if (a[key].trim()) q.set(key, a[key].trim());
        if (a.skillId) q.set('interval', a.interval);
        const next = q.toString(); window.location.hash = `/analytics/skills${next ? `?${next}` : ''}`;
        if (next === search) setRetry(v => v + 1);
      }}>
        <label>게시 시작일<input type="date" value={draft.dateFrom} onChange={e => setDraft(v => ({ ...v, dateFrom: e.target.value }))} /></label>
        <label>게시 종료일<input type="date" value={draft.dateTo} onChange={e => setDraft(v => ({ ...v, dateTo: e.target.value }))} /></label>
        <label>직무명<input type="search" maxLength={200} value={draft.desiredRole} placeholder="공고 제목 검색" onChange={e => setDraft(v => ({ ...v, desiredRole: e.target.value }))} /></label>
        <label>출처 코드 (분포·추이)<input value={draft.source} maxLength={100} placeholder="전체" onChange={e => setDraft(v => ({ ...v, source: e.target.value.toUpperCase() }))} /></label>
        <label>추이 기술 검색<input type="search" value={skillQuery} onChange={e => setSkillQuery(e.target.value)} /></label>
        <label>추이 간격<select value={draft.interval} onChange={e => setDraft(v => ({ ...v, interval: e.target.value as 'WEEK' | 'MONTH' }))}><option value="MONTH">월</option><option value="WEEK">주</option></select></label>
        {skillQuery && <div className="market-choices">{skillError && <p role="alert">{skillError}</p>}{choices.map(s => <button type="button" key={s.id} onClick={() => { setDraft(v => ({ ...v, skillId: String(s.id) })); setSkillQuery(s.name); setChoices([]); }}>{s.name}</button>)}</div>}
        {draft.skillId && <p>선택 기술 ID {draft.skillId} <button type="button" onClick={() => { setDraft(v => ({ ...v, skillId: '' })); setSkillQuery(''); }}>해제</button></p>}
        <button type="submit">조건 적용</button>
      </form>{formError && <p role="alert" className="form-error">{formError}</p>}
      <p className="market-note">적용 조건: {applied.dateFrom || '시작 제한 없음'} ~ {applied.dateTo || '종료 제한 없음'} · 직무 {applied.desiredRole || '전체'} · 분포/추이 출처 {applied.source || '전체'}. 기술 수요에는 출처 필터가 적용되지 않습니다. 날짜는 게시일 기준이며 양 끝을 포함합니다.</p>
    </section>
    <section className="card market-section" aria-label="기술 수요"><h2>기술 수요</h2>
      {demand.error ? <ErrorState message={demand.error} onRetry={() => setRetry(v => v + 1)} /> : !demand.data ? <LoadingState message="기술 수요를 불러오고 있습니다." /> : <>
        <p>분석 완료 공고 {demand.data.analyzedJobCount}건 · 기술 {demand.data.totalElements}개 · 출처 필터 미적용</p>
        {demand.data.items.length === 0 ? <EmptyState title="표시할 기술이 없습니다." message="조건 또는 페이지를 바꿔 보세요." /> : <div className="market-table-wrap"><table><caption>기술 수요: 분석 완료 공고 기준</caption><thead><tr><th scope="col">기술</th><th scope="col">등장 공고</th><th scope="col">비율과 시각 표시</th></tr></thead><tbody>{demand.data.items.map(i => <tr key={i.skill.id}><th scope="row">{i.skill.name}</th><td>{i.jobCount} / {i.analyzedJobCount}건</td><td>{pct(i.ratio)}<div className="market-demand-bar" aria-hidden="true"><span style={{ width: `${i.ratio * 100}%` }} /></div></td></tr>)}</tbody></table></div>}
        <nav className="market-pagination" aria-label="기술 수요 페이지"><button type="button" disabled={page === 0} onClick={() => goPage(page - 1)}>이전</button><span>{page + 1}페이지</span><button type="button" disabled={(page + 1) * demand.data.size >= demand.data.totalElements} onClick={() => goPage(page + 1)}>다음</button></nav>
      </>}
    </section>
    <Distribution title="경력 분포" result={career} names={careerNames} retry={() => setRetry(v => v + 1)} />
    <Distribution title="지역 분포" result={regions} names={regionNames} retry={() => setRetry(v => v + 1)} />
    <section className="card market-section" aria-label="기술 추이"><h2>기술 추이</h2>
      {!applied.skillId || !applied.dateFrom || !applied.dateTo ? <EmptyState title="추이 조건을 선택해 주세요." message="기술과 게시 시작일·종료일을 지정해 주세요." />
        : trend.error ? <ErrorState message={trend.error} onRetry={() => setRetry(v => v + 1)} /> : !trend.data ? <LoadingState message="기술 추이를 불러오고 있습니다." /> : <>
          <p>기술 ID {trend.data.skillId} · {trend.data.interval === 'WEEK' ? '주간' : '월간'} · 게시일 있는 분석 완료 공고만 포함 · 필수/우대 중복 계산 없음</p>
          <div className="market-table-wrap"><table><caption>기간별 기술 추이와 구간별 표본</caption><thead><tr><th scope="col">기간 시작</th><th scope="col">분석 공고</th><th scope="col">기술 등장</th><th scope="col">비율</th><th scope="col">표본</th></tr></thead><tbody>{trend.data.periods.map(p => <tr key={p.periodStart}><th scope="row">{p.periodStart}</th><td>{p.analyzedJobCount}건</td><td>{p.jobCount}건</td><td>{p.ratio === null ? '계산 불가' : pct(p.ratio)}</td><td>{p.insufficientSample ? '부족' : '충분'}</td></tr>)}</tbody></table></div>
          <div className="market-trend-chart" aria-hidden="true">{trend.data.periods.map(p => <span key={p.periodStart} style={{ height: `${(p.ratio || 0) * 100}%` }} />)}</div>
          <p className="market-note">분모는 각 구간의 분석 완료 공고입니다. 0건 구간 비율은 계산 불가이고 10건 미만은 표본 부족입니다. 첫·끝 구간은 요청 날짜 안의 공고만 셉니다.</p>
        </>}
    </section>
  </div>;
}
