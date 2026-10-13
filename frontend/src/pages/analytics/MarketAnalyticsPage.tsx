import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createAnalyticsApi } from '../../api/analytics';
import type { MarketDistribution, SkillDemandPage, SkillTrend } from '../../api/analytics';
import { createSkillsApi } from '../../api/skills';
import type { Skill } from '../../api/skills';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import koreaProvinces from '../../assets/korea-provinces.svg';
import './market.css';

const api = createAnalyticsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const colors = ['#3184f8', '#2ecba1', '#ffbd49', '#f765aa', '#9161ed', '#82b8f7', '#a5adef'];
const careerOrder = ['ENTRY', 'JUNIOR', 'MIDDLE', 'SENIOR'] as const;
const careerColors: Record<string, string> = {
  ENTRY: '#3184f8', JUNIOR: '#2ecba1', MIDDLE: '#ffbd49', SENIOR: '#f765aa', UNCLASSIFIED: '#c5d0e2',
};
const careerNames: Record<string, string> = {
  ENTRY: '신입', JUNIOR: '주니어 (1~3년)', MIDDLE: '미들 (4~7년)', SENIOR: '시니어 (8년 이상)',
  UNCLASSIFIED: '분류 불가',
};
const regionNames: Record<string, string> = {
  SEOUL: '서울', BUSAN: '부산', DAEGU: '대구', INCHEON: '인천', GWANGJU: '광주', DAEJEON: '대전',
  ULSAN: '울산', SEJONG: '세종', GYEONGGI: '경기', GANGWON: '강원', CHUNGBUK: '충북',
  CHUNGNAM: '충남', JEONBUK: '전북', JEONNAM: '전남', GYEONGBUK: '경북', GYEONGNAM: '경남',
  JEJU: '제주', NATIONWIDE_REMOTE: '전국·원격', OTHER: '기타·복수 지역', UNKNOWN: '미상',
};
type Result<T> = { data?: T; error?: string };
type Series = { name: string; periods: SkillTrend['periods']; color: string };
type Growth = { jobs: number | null; skills: number | null; rising: { name: string; rate: number } | null };
const number = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const percent = (value: number) => (value * 100).toFixed(1) + '%';
const errorText = (value: unknown) => value instanceof Error ? value.message : '결과를 불러오지 못했습니다.';
const dateShift = (date: string, days: number) => {
  const value = new Date(date + 'T00:00:00Z');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const isCalendarDate = (value: string) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value + 'T00:00:00Z'))
  && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

function Change({ value, label }: { value: number | null | undefined; label: string }) {
  return <span className={'market-change' + (value !== undefined && value !== null && value < 0 ? ' market-change--down' : '')}>
    {value === undefined ? '계산 중' : value === null ? '비교 자료 부족' : (value >= 0 ? '▲ ' : '▼ ') + Math.abs(value).toFixed(1) + '%'}
    <small>{label}</small>
  </span>;
}

function KoreaMap() {
  return <img className="market-korea-map" src={koreaProvinces} alt="" aria-hidden="true" />;
}

function TrendChart({ series }: { series: Series[] }) {
  const periods = series[0]?.periods || [];
  const x = (index: number) => 42 + (index * 420) / Math.max(1, periods.length - 1);
  const y = (ratio: number) => 145 - ratio * 118;
  const line = (items: SkillTrend['periods']) => {
    let drawing = false;
    return items.map((period, index) => {
      if (period.ratio === null) { drawing = false; return ''; }
      const segment = (drawing ? ' L ' : ' M ') + x(index).toFixed(1) + ' ' + y(period.ratio).toFixed(1);
      drawing = true;
      return segment;
    }).join('');
  };
  return <div className="market-trend-visual">
    <svg viewBox="0 0 490 174" role="img" aria-label="주요 기술의 기간별 등장 비율 선 그래프">
      {[0, .25, .5, .75, 1].map(value => <g key={value}>
        <line x1="42" x2="465" y1={y(value)} y2={y(value)} stroke="#e7eef9" />
        <text x="32" y={y(value) + 3} textAnchor="end">{Math.round(value * 100)}%</text>
      </g>)}
      {periods.map((period, index) => (index % Math.max(1, Math.ceil(periods.length / 7)) === 0 || index === periods.length - 1)
        && <text key={period.periodStart} x={x(index)} y="166" textAnchor="middle">{period.periodStart.slice(5, 7)}월</text>)}
      {series.map(item => <g key={item.name}>
        <path d={line(item.periods)} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {item.periods.map((period, index) => period.ratio === null ? null
          : <circle key={period.periodStart} cx={x(index)} cy={y(period.ratio)} r="2.6" fill={item.color} />)}
      </g>)}
    </svg>
    <div className="market-trend-legend">{series.map(item =>
      <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
  </div>;
}

export function MarketAnalyticsPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const applied = {
    dateFrom: params.get('dateFrom') || '', dateTo: params.get('dateTo') || '',
    desiredRole: params.get('desiredRole') || '', source: params.get('source') || '',
    skillId: params.get('skillId') || '', interval: params.get('interval') === 'WEEK' ? 'WEEK' as const : 'MONTH' as const,
  };
  const page = Math.max(0, Number(params.get('page') || 0) || 0);
  const [draft, setDraft] = useState(applied);
  const [formError, setFormError] = useState('');
  const [demand, setDemand] = useState<Result<SkillDemandPage>>({});
  const [career, setCareer] = useState<Result<MarketDistribution>>({});
  const [regions, setRegions] = useState<Result<MarketDistribution>>({});
  const [trends, setTrends] = useState<Result<Series[]>>({});
  const [growth, setGrowth] = useState<Growth>();
  const [skillQuery, setSkillQuery] = useState('');
  const [choices, setChoices] = useState<Skill[]>([]);
  const [skillError, setSkillError] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('skills');
  const [seriesCount, setSeriesCount] = useState(5);
  const [retry, setRetry] = useState(0);

  useEffect(() => { setDraft(applied); setFormError(''); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const filters = {
      dateFrom: applied.dateFrom || undefined, dateTo: applied.dateTo || undefined,
      desiredRole: applied.desiredRole || undefined, source: applied.source || undefined,
    };
    const load = <T,>(promise: Promise<T>, setter: (value: Result<T>) => void) => promise
      .then(data => { if (!signal.aborted) setter({ data }); })
      .catch(failure => { if (!signal.aborted) setter({ error: errorText(failure) }); });
    setDemand({}); setCareer({}); setRegions({}); setTrends({}); setGrowth(undefined);
    const demandPromise = api.skills({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, desiredRole: filters.desiredRole, page: 0, size: 100 }, signal);
    void load(demandPromise, setDemand);
    void load(api.careerLevels(filters, signal), setCareer);
    void load(api.locations(filters, signal), setRegions);

    const today = new Date().toISOString().slice(0, 10);
    const periodTo = isCalendarDate(applied.dateTo) && applied.dateTo ? applied.dateTo : today;
    const periodFrom = isCalendarDate(applied.dateFrom) && applied.dateFrom ? applied.dateFrom : dateShift(periodTo, -29);
    if (periodFrom <= periodTo) {
      const duration = Math.max(1, Math.round((Date.parse(periodTo) - Date.parse(periodFrom)) / 86400000) + 1);
      const priorTo = dateShift(periodFrom, -1);
      const priorFrom = dateShift(priorTo, -(duration - 1));
      const recent = { ...filters, dateFrom: periodFrom, dateTo: periodTo };
      const prior = { ...filters, dateFrom: priorFrom, dateTo: priorTo };
      void Promise.all([
        api.careerLevels(recent, signal), api.careerLevels(prior, signal),
        api.skills({ dateFrom: recent.dateFrom, dateTo: recent.dateTo, desiredRole: filters.desiredRole, page: 0, size: 100 }, signal),
        api.skills({ dateFrom: prior.dateFrom, dateTo: prior.dateTo, desiredRole: filters.desiredRole, page: 0, size: 100 }, signal),
      ]).then(([newJobs, oldJobs, newSkills, oldSkills]) => {
        if (signal.aborted) return;
        const change = (current: number, previous: number) => previous > 0 ? (current - previous) / previous * 100 : null;
        const older = new Map(oldSkills.items.map(item => [item.skill.id, item]));
        const rising = newJobs.jobCount >= 10 && oldJobs.jobCount >= 10
          ? newSkills.items.map(item => {
            const before = older.get(item.skill.id);
            return before && before.jobCount >= 2 && before.ratio > 0
              ? { name: item.skill.name, rate: (item.ratio - before.ratio) / before.ratio * 100 } : null;
          }).filter((item): item is { name: string; rate: number } => item !== null && item.rate > 0)
            .sort((a, b) => b.rate - a.rate)[0] || null : null;
        setGrowth({ jobs: change(newJobs.jobCount, oldJobs.jobCount),
          skills: change(newSkills.totalElements, oldSkills.totalElements), rising });
      }).catch(() => { if (!signal.aborted) setGrowth({ jobs: null, skills: null, rising: null }); });
    }

    void demandPromise.then(async data => {
      const rangeTo = periodTo;
      const rangeFrom = applied.dateFrom || dateShift(rangeTo, -364);
      if (!isCalendarDate(rangeFrom) || rangeFrom > rangeTo
        || (Date.parse(rangeTo) - Date.parse(rangeFrom)) / 86400000 > 1830) {
        if (!signal.aborted) setTrends({ error: '기술 추이는 최대 5년의 시작일과 종료일을 선택해 주세요.' });
        return;
      }
      const selected = data.items.find(item => String(item.skill.id) === applied.skillId);
      const selectedSkill = applied.skillId && !selected
        ? { skill: { id: Number(applied.skillId), name: skillQuery || '선택 기술 #' + applied.skillId } }
        : selected;
      const top = selectedSkill ? [selectedSkill, ...data.items.filter(item => item.skill.id !== selectedSkill.skill.id)].slice(0, 5)
        : data.items.slice(0, 5);
      if (!top.length) { if (!signal.aborted) setTrends({ data: [] }); return; }
      const results = await Promise.allSettled(top.map((item, index) =>
        api.trend({ ...filters, dateFrom: rangeFrom, dateTo: rangeTo, skillId: item.skill.id, interval: applied.interval }, signal)
          .then(result => ({ name: item.skill.name, periods: result.periods, color: colors[index] }))));
      if (signal.aborted) return;
      const available = results.filter((result): result is PromiseFulfilledResult<Series> => result.status === 'fulfilled')
        .map(result => result.value);
      setTrends(available.length ? { data: available } : { error: '기술 추이를 불러오지 못했습니다.' });
    }).catch(() => { if (!signal.aborted) setTrends({ error: '기술 추이를 불러오지 못했습니다.' }); });
    return () => controller.abort();
  }, [search, retry]);
  useEffect(() => {
    if (!skillQuery.trim()) { setChoices([]); setSkillError(''); return; }
    const controller = new AbortController();
    void skills.search(skillQuery.trim(), 0, controller.signal).then(result => {
      if (!controller.signal.aborted) setChoices(result.items);
    }).catch(failure => { if (!controller.signal.aborted) setSkillError(errorText(failure)); });
    return () => controller.abort();
  }, [skillQuery]);

  const goPage = (next: number) => {
    const query = new URLSearchParams(search);
    query.set('page', String(next));
    window.location.hash = '/analytics/skills?' + query;
  };
  const visible = demand.data?.items.filter(item => item.skill.name.toLocaleLowerCase().includes(listQuery.trim().toLocaleLowerCase())) || [];
  const rows = visible.slice(page * 10, page * 10 + 10);
  const highest = demand.data?.items[0];
  const careerBuckets: MarketDistribution['buckets'] = careerOrder.map(key => career.data?.buckets.find(bucket => bucket.key === key)
    || { key, jobCount: 0, ratio: 0 });
  const unclassifiedCount = career.data?.buckets.filter(bucket => !careerOrder.some(key => key === bucket.key))
    .reduce((sum, bucket) => sum + bucket.jobCount, 0) || 0;
  if (unclassifiedCount) careerBuckets.push({ key: 'UNCLASSIFIED', jobCount: unclassifiedCount,
    ratio: unclassifiedCount / (career.data?.jobCount || 1) });
  let donutStart = 0;
  const donutStops = careerBuckets.map(bucket => {
    const end = donutStart + bucket.jobCount / Math.max(1, career.data?.jobCount || 0) * 100;
    const stop = careerColors[bucket.key] + ' ' + donutStart + '% ' + end + '%';
    donutStart = end;
    return stop;
  });
  const orderedRegions = [...(regions.data?.buckets || [])].sort((a, b) => b.jobCount - a.jobCount);
  const topRegions = orderedRegions.slice(0, 5);
  const restCount = orderedRegions.slice(5).reduce((sum, bucket) => sum + bucket.jobCount, 0);
  if (restCount && regions.data) topRegions.push({ key: 'REST', jobCount: restCount, ratio: restCount / regions.data.jobCount });
  const nav = (section: string) => {
    setActiveSection(section);
    document.getElementById('market-' + section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <div className="market-page">
    <header className="market-header">
      <span className="market-header-icon"><LucideIcon name="chartBar" /></span>
      <div><h1>채용시장 분석</h1><p>실제 채용 데이터를 기반으로 최신 채용 트렌드와 수요를 분석해보세요.</p></div>
      <button type="button" className="market-guide-button" onClick={() => setInfoOpen(value => !value)}
        aria-expanded={infoOpen}><LucideIcon name="info" />데이터 기준 안내</button>
    </header>
    {infoOpen && <aside className="market-guide" role="note">
      <strong>데이터 기준</strong>
      <p>전체 공고·경력·지역은 저장된 공용 채용공고 기준입니다. 기술 수요와 추이는 AI 분석이 완료된 공고 기준이며 두 집계의 표본은 다릅니다. 증감률은 선택 기간과 직전 같은 길이의 기간을 비교합니다. 기술 수요에는 출처 필터가 적용되지 않습니다.</p>
    </aside>}
    <nav className="market-tabs" aria-label="채용시장 분석 항목">
      {[
        ['skills', '기술 수요'], ['career', '경력 수준'], ['regions', '지역 분포'], ['trends', '기술 추세'],
      ].map(([key, label]) => <button key={key} type="button" className={activeSection === key ? 'is-active' : ''}
        aria-current={activeSection === key ? 'page' : undefined} onClick={() => nav(key)}>{label}</button>)}
    </nav>
    <details className="market-filter-panel">
      <summary><LucideIcon name="sliders" />조건 설정
        {(applied.dateFrom || applied.dateTo || applied.desiredRole || applied.source || applied.skillId) && <span>적용 중</span>}</summary>
      <form className="market-filters" onSubmit={event => {
        event.preventDefault();
        if (!isCalendarDate(draft.dateFrom) || !isCalendarDate(draft.dateTo)
          || draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo
          || draft.desiredRole.trim().length > 200 || draft.source && !/^[A-Z0-9_]{1,100}$/.test(draft.source)
          || draft.skillId && (!/^\d+$/.test(draft.skillId) || Number(draft.skillId) <= 0)) {
          setFormError('기간·출처·기술 조건을 확인해 주세요.'); return;
        }
        setFormError('');
        const query = new URLSearchParams();
        for (const key of ['dateFrom', 'dateTo', 'desiredRole', 'source', 'skillId'] as const)
          if (draft[key].trim()) query.set(key, draft[key].trim());
        if (draft.skillId) query.set('interval', draft.interval);
        const next = query.toString();
        window.location.hash = '/analytics/skills' + (next ? '?' + next : '');
        if (next === search) setRetry(value => value + 1);
      }}>
        <label>게시 시작일<input type="date" value={draft.dateFrom} onChange={event => setDraft(value => ({ ...value, dateFrom: event.target.value }))} /></label>
        <label>게시 종료일<input type="date" value={draft.dateTo} onChange={event => setDraft(value => ({ ...value, dateTo: event.target.value }))} /></label>
        <label>직무명<input type="search" maxLength={200} value={draft.desiredRole} placeholder="공고 제목 검색" onChange={event => setDraft(value => ({ ...value, desiredRole: event.target.value }))} /></label>
        <label>출처 코드<input value={draft.source} maxLength={100} placeholder="전체" onChange={event => setDraft(value => ({ ...value, source: event.target.value.toUpperCase() }))} /></label>
        <label>추이 기술 검색<input type="search" value={skillQuery} onChange={event => setSkillQuery(event.target.value)} /></label>
        <label>추이 간격<select value={draft.interval} onChange={event => setDraft(value => ({ ...value, interval: event.target.value as 'WEEK' | 'MONTH' }))}>
          <option value="MONTH">월별</option><option value="WEEK">주별</option></select></label>
        {skillQuery && <div className="market-choices">{skillError && <p role="alert">{skillError}</p>}
          {choices.map(item => <button type="button" key={item.id} onClick={() => {
            setDraft(value => ({ ...value, skillId: String(item.id) })); setSkillQuery(item.name); setChoices([]);
          }}>{item.name}</button>)}</div>}
        {draft.skillId && <p className="market-selected-skill">선택 기술 ID {draft.skillId}
          <button type="button" onClick={() => { setDraft(value => ({ ...value, skillId: '' })); setSkillQuery(''); }}>해제</button></p>}
        <button type="submit" className="market-apply-button">조건 적용</button>
      </form>
      {formError && <p role="alert" className="form-error">{formError}</p>}
    </details>
    <main className="market-dashboard">
      <div className="market-overview-head" id="market-skills">
        <div><h2>기술 수요 현황</h2><p>현재 채용공고에서 많이 요구하는 기술을 확인할 수 있습니다.</p></div>
        <label className="market-search"><LucideIcon name="search" /><span className="sr-only">기술명 검색</span>
          <input value={listQuery} onChange={event => { setListQuery(event.target.value); if (page) goPage(0); }}
            placeholder="기술명을 검색하세요. (예: Java, Python, React)" /></label>
      </div>
      <div className="market-metrics">
        <div className="market-metric"><span>전체 채용공고 수</span><div><strong>{career.data ? number(career.data.jobCount) : '—'}</strong><Change value={growth?.jobs} label="직전 기간 대비" /></div></div>
        <div className="market-metric"><span>분석된 기술 수</span><div><strong>{demand.data ? number(demand.data.totalElements) : '—'}</strong><Change value={growth?.skills} label="직전 기간 대비" /></div></div>
        <div className="market-metric"><span>가장 수요가 높은 기술</span><strong>{highest?.skill.name || '—'} {highest && <span aria-hidden="true">🔥</span>}</strong><small>채용공고 {highest ? number(highest.jobCount) : '—'}건 · 분석 완료 공고 기준</small></div>
        <div className="market-metric"><span>가장 빠르게 성장 중인 기술</span><strong>{growth === undefined ? '—' : growth.rising?.name || '비교 자료 부족'}</strong>
          <small>{growth?.rising ? '▲ ' + growth.rising.rate.toFixed(1) + '% · 등장 비율 변화' : '비교 가능한 기간·표본 필요'}</small></div>
      </div>
      <div className="market-panels">
        <section className="market-panel market-panel--skills" aria-label="기술별 채용 수요">
          <div className="market-panel-head"><h3>기술별 채용 수요 TOP 10</h3><span>분석 완료 {number(demand.data?.analyzedJobCount || 0)}건</span></div>
          {demand.error ? <ErrorState message={demand.error} onRetry={() => setRetry(value => value + 1)} />
            : !demand.data ? <LoadingState message="기술 수요를 불러오고 있습니다." />
              : rows.length === 0 ? <EmptyState title="표시할 기술이 없습니다." message="검색어 또는 조건을 바꿔 보세요." />
                : <><div className="market-rank-heading"><span>순위</span><span>기술명</span><span>채용공고 수</span><span>비중</span></div>
                  <ol className="market-rank-list">{rows.map((item, index) => <li key={item.skill.id}>
                    <span className="market-rank-number">{page * 10 + index + 1}</span>
                    <span className="market-rank-name">{item.skill.name}</span>
                    <span className="market-rank-bar"><i style={{ width: Math.max(2, item.ratio * 100) + '%', background: colors[(page * 10 + index) % colors.length] }} /></span>
                    <span className="market-rank-count">{number(item.jobCount)}</span>
                    <span className="market-rank-ratio">{percent(item.ratio)}</span>
                  </li>)}</ol>
                  {visible.length > 10 && <nav className="market-pagination" aria-label="기술 수요 페이지">
                    <button type="button" disabled={page === 0} onClick={() => goPage(page - 1)}>이전</button>
                    <span>{page + 1} / {Math.ceil(visible.length / 10)}</span>
                    <button type="button" disabled={(page + 1) * 10 >= visible.length} onClick={() => goPage(page + 1)}>다음</button>
                  </nav>}</>}
        </section>
        <section className="market-panel market-panel--career" id="market-career" aria-label="경력 수준별 기술 수요 비중">
          <div className="market-panel-head"><h3>경력 수준별 채용공고 비중</h3></div>
          {career.error ? <ErrorState message={career.error} onRetry={() => setRetry(value => value + 1)} />
            : !career.data ? <LoadingState message="경력 분포를 불러오고 있습니다." />
              : career.data.jobCount === 0 ? <EmptyState title="경력 분포가 없습니다." message="조건을 바꿔 보세요." />
                : <><div className="market-career-body"><div className="market-donut" style={{ background: 'conic-gradient(' + donutStops.join(',') + ')' }}>
                  <div><strong>{number(career.data.jobCount)}</strong><span>채용공고</span></div></div>
                  <ul className="market-career-legend">{careerBuckets.filter(bucket => bucket.key !== 'UNCLASSIFIED').map(bucket => <li key={bucket.key}>
                    <i style={{ background: careerColors[bucket.key] }} /><span>{careerNames[bucket.key] || bucket.key}</span>
                    <strong>{percent(bucket.ratio)} <small>({number(bucket.jobCount)}건)</small></strong>
                  </li>)}</ul></div>
                  {unclassifiedCount > 0 && <p className="market-unclassified">분류 불가 {number(unclassifiedCount)}건 ({percent(unclassifiedCount / career.data.jobCount)}) · 연차가 명확하지 않은 공고</p>}
                  {career.data.insufficientSample && <p className="market-caution">표본 10건 미만: 시장 대표값으로 해석하지 마세요.</p>}</>}
        </section>
        <section className="market-panel market-panel--regions" id="market-regions" aria-label="지역별 채용 수요 분포">
          <div className="market-panel-head"><h3>지역별 채용 수요 분포</h3></div>
          {regions.error ? <ErrorState message={regions.error} onRetry={() => setRetry(value => value + 1)} />
            : !regions.data ? <LoadingState message="지역 분포를 불러오고 있습니다." />
              : regions.data.jobCount === 0 ? <EmptyState title="지역 분포가 없습니다." message="조건을 바꿔 보세요." />
                : <div className="market-region-body"><KoreaMap /><ul>{topRegions.map((bucket, index) =>
                  <li key={bucket.key}><span>{bucket.key === 'REST' ? '그 외' : regionNames[bucket.key] || bucket.key}</span>
                    <div><i style={{ width: Math.max(2, bucket.ratio / Math.max(.01, topRegions[0]?.ratio || 1) * 100) + '%',
                      background: index === 0 ? '#5d9df8' : '#a4bdf7' }} /></div>
                    <strong>{percent(bucket.ratio)} <small>({number(bucket.jobCount)}건)</small></strong></li>)}</ul></div>}
        </section>
        <section className="market-panel market-panel--trends" id="market-trends" aria-label="기술 추이">
          <div className="market-panel-head"><div><h3>기술 트렌드 ({applied.dateFrom || applied.dateTo ? '선택 기간' : '최근 1년'})</h3><small>분석 완료 공고에서 기술 등장 비율</small></div>
            <label className="market-series-count"><span className="sr-only">표시 기술 수</span><select value={seriesCount}
              onChange={event => setSeriesCount(Number(event.target.value))}><option value="5">주요 기술 5개</option>
              <option value="3">주요 기술 3개</option></select></label></div>
          {trends.error ? <ErrorState message={trends.error} onRetry={() => setRetry(value => value + 1)} />
            : !trends.data ? <LoadingState message="기술 추이를 불러오고 있습니다." />
              : trends.data.length === 0 ? <EmptyState title="추이 데이터가 없습니다." message="분석 완료 공고가 필요합니다." />
                : <TrendChart series={trends.data.slice(0, seriesCount)} />}
          <p className="market-trend-note">각 기간의 분석 완료 공고가 분모입니다. 표본이 없는 기간은 선을 연결하지 않습니다.</p>
        </section>
      </div>
    </main>
  </div>;
}
