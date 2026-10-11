import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createJobsApi } from '../../api/jobs';
import type { JobDetail, JobPage, JobSummary } from '../../api/jobs';
import { Badge } from '../../components/PixelArt';
import { BookmarkButton } from '../../components/BookmarkButton';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { isApplicationStatus } from '../../api/application-status';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { JobAnalysis } from '../../components/JobAnalysis';
import { JobMatch } from '../../components/JobMatch';
import { createSkillsApi } from '../../api/skills';
import type { SkillPage } from '../../api/skills';
import './jobs.css';
import jobResultsCompanion from '../../assets/redesign/cur-20-job-results-companion.png';
import jobDetailArt from '../../assets/redesign/ext-img-07-source-exploration.png';

const jobs = createJobsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const fields = ['q', 'company', 'location', 'careerLevel', 'employmentType', 'deadlineBefore'] as const;
const roleLabels: Record<string, string> = { DEVELOPMENT: '개발', DATA_AI: '데이터·AI', SECURITY: '보안', INFRA: '클라우드·인프라', IT_OPERATIONS: '전산·IT 운영' };
const roleOptions = [{ value: '', label: '전체' }, ...Object.entries(roleLabels).map(([value, label]) => ({ value, label }))];
const regionOptions = ['전국', '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const careerOptions = [
  { value: 'NEW', label: '신입' }, { value: 'ANY', label: '경력무관' }, { value: 'UP_TO_1', label: '1년 이하' },
  { value: 'YEARS_1_3', label: '1~3년' }, { value: 'YEARS_3_5', label: '3~5년' }, { value: 'OVER_5', label: '5년 이상' },
];
const employmentOptions = ['', '정규직', '계약직', '인턴', '파견직'];
const deadlineOptions = [{ days: 0, label: '오늘' }, { days: 3, label: '3일 이내' }, { days: 7, label: '7일 이내' }, { days: 30, label: '30일 이내' }];
function localDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function DeadlineFilter({ initial }: { initial: string }) {
  const [deadline, setDeadline] = useState(initial);
  return <div className="job-filter-section"><span className="job-filter-label">마감일 이전</span>
    <div className="job-preset-list">{deadlineOptions.map(option => {
      const value = localDateAfter(option.days);
      return <button key={option.days} type="button" className="job-filter-chip" aria-pressed={deadline === value}
        onClick={() => setDeadline(current => current === value ? '' : value)}>{option.label}</button>;
    })}</div>
    <input name="deadlineBefore" type="hidden" value={deadline} />
    {deadline && !deadlineOptions.some(option => localDateAfter(option.days) === deadline) && <p className="job-filter-note">기존 마감 조건: {deadline} <button type="button" onClick={() => setDeadline('')}>해제</button></p>}
  </div>;
}
function RegionFilter({ initial }: { initial: string }) {
  return <div className="job-filter-section"><label htmlFor="job-location">근무 지역</label>
    <select id="job-location" name="location" defaultValue={initial}>
      {regionOptions.map(option => <option key={option} value={option === '전국' ? '' : option}>{option}</option>)}
      {initial && !regionOptions.includes(initial) && <option value={initial}>{initial}</option>}
    </select>
  </div>;
}
function CareerFilter({ initial }: { initial: string }) {
  const [selected, setSelected] = useState(initial ? initial.split(',') : []);
  return <fieldset className="job-filter-section"><legend>경력 조건</legend>
    <div className="job-checkbox-list">{careerOptions.map(option => <label key={option.value} className="job-checkbox-option">
      <input type="checkbox" checked={selected.includes(option.value)} onChange={() => setSelected(current => current.includes(option.value)
        ? current.filter(value => value !== option.value) : [...current, option.value])} />{option.label}
    </label>)}</div>
    <input name="careerBands" type="hidden" value={selected.join(',')} />
  </fieldset>;
}
function EmploymentFilter({ initial }: { initial: string }) {
  return <fieldset className="job-filter-section"><legend>고용 형태</legend><div className="job-preset-list job-employment-options">
    {employmentOptions.map(option => <label key={option} className="job-radio-chip"><input type="radio" name="employmentType" value={option}
      defaultChecked={initial === option} /><span>{option || '전체'}</span></label>)}
    {initial && !employmentOptions.includes(initial) && <label className="job-radio-chip"><input type="radio" name="employmentType" value={initial}
      defaultChecked /><span>{initial}</span></label>}
  </div></fieldset>;
}
const shown = (value: string | null) => value || '정보 없음';
const sourceLabel = (source: string) => source === 'ALIO_RECRUITMENT' ? '공공기관 채용'
  : source === 'WORK24_OPEN_RECRUITMENT' ? '고용24' : source;
function SkillFilter({ initial }: { initial: string }) {
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [result, setResult] = useState<SkillPage>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!searched) return;
    const controller = new AbortController(); setError('');
    skills.search(searched, 0, controller.signal).then(setResult).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '기술 검색에 실패했습니다.');
    });
    return () => controller.abort();
  }, [searched, retry]);
  return <div className="job-skill-filter"><label htmlFor="job-skill-query">기술 스택</label>
    <div className="job-skill-search"><input id="job-skill-query" value={query} maxLength={100} placeholder="기술 이름 검색" onChange={event => setQuery(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setSearched(query.trim()); setRetry(value => value + 1); } }} />
      <button type="button" onClick={() => { setSearched(query.trim()); setRetry(value => value + 1); }}>찾기</button></div>
    <input type="hidden" name="skillId" value={selected} />
    {selected && <p className="job-skill-selection">선택한 기술 #{selected} <button type="button" onClick={() => setSelected('')}>해제</button></p>}
    {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
    {result && !error && <ul className="job-skill-results">{result.items.map(skill => <li key={skill.id}><button type="button" className="job-filter-chip" aria-pressed={selected === String(skill.id)} onClick={() => setSelected(String(skill.id))}>{skill.name}</button></li>)}</ul>}
    {result && !error && result.items.length === 0 && <p>일치하는 기술이 없습니다.</p>}
    {result && result.totalElements > result.size && <p>처음 {result.size}개 결과입니다. 검색어를 구체적으로 입력해 주세요.</p>}
  </div>;
}
export function Metadata({ job }: { job: JobSummary }) {
  return <dl className="job-metadata">
    <div><dt>직무</dt><dd>{job.role ? roleLabels[job.role] || job.role : '정보 없음'}</dd></div>
    <div><dt>지역</dt><dd>{shown(job.location)}</dd></div>
    <div><dt>경력</dt><dd>{shown(job.careerRequirement)}</dd></div>
    <div><dt>고용 형태</dt><dd>{shown(job.employmentType)}</dd></div>
    <div><dt>마감일</dt><dd>{shown(job.deadlineDate)}</dd></div>
  </dl>;
}
export function JobsPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') || 0);
  const size = Number(params.get('size') || 20);
  const sort = params.get('sort') || 'latest';
  const skillId = params.get('skillId');
  const minMatchRate = params.get('minMatchRate');
  const careerBands = params.get('careerBands') || '';
  const applicationStatus = params.get('applicationStatus');
  const source = params.get('source') || '';
  const role = params.get('role') || '';
  const itOnly = params.get('itOnly') === 'true';
  const legacyFilterApplied = Boolean(params.get('company') || params.get('careerLevel') || applicationStatus || source || params.has('itOnly') || params.has('sort') || params.has('size'));
  const invalid = !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100 || page * size > 2147483647 || !['latest', 'deadline', 'matchRate'].includes(sort)
    || (skillId !== null && (!/^[1-9]\d*$/.test(skillId) || !Number.isSafeInteger(Number(skillId))))
    || (minMatchRate !== null && (!/^\d{1,3}$/.test(minMatchRate) || Number(minMatchRate) > 100))
    || (careerBands !== '' && (careerBands.split(',').length > careerOptions.length
      || careerBands.split(',').some(value => !careerOptions.some(option => option.value === value))
      || new Set(careerBands.split(',')).size !== careerBands.split(',').length))
    || (applicationStatus !== null && !isApplicationStatus(applicationStatus))
    || (role !== '' && !Object.hasOwn(roleLabels, role))
    || (source !== '' && !/^[A-Z0-9_]{1,100}$/.test(source));
  const [data, setData] = useState<JobPage>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    if (invalid) { setError('검색 주소의 페이지·정렬값을 확인해 주세요.'); setLoading(false); return; }
    const values = new URLSearchParams(search);
    jobs.list({ ...Object.fromEntries(fields.map(key => [key, values.get(key) || undefined])), page, size,
      sort: sort as 'latest' | 'deadline' | 'matchRate', skillId: skillId ? Number(skillId) : undefined,
      minMatchRate: minMatchRate === null ? undefined : Number(minMatchRate),
      applicationStatus: isApplicationStatus(applicationStatus) ? applicationStatus : undefined, itOnly,
      source: source || undefined, role: role || undefined, careerBands: careerBands || undefined }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, size, sort, skillId, minMatchRate, careerBands, applicationStatus, itOnly, source, role, invalid, retry]);
  const navigatePage = (next: number) => { const query = new URLSearchParams(search); query.set('page', String(next)); window.location.hash = `/jobs?${query}`; };
  return <div className="jobs-page jobs-page--search">
    <form key={`${search}-${resetKey}`} className="card job-search" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const query = new URLSearchParams();
      for (const [key, value] of values) if (String(value).trim()) query.set(key, String(value).trim());
      query.set('page', '0'); window.location.hash = `/jobs?${query}`;
    }}>
      <div className="job-filter-heading"><h2>상세 필터</h2><button type="button" onClick={() => {
        if (search) window.location.hash = '/jobs'; else setResetKey(value => value + 1);
      }}>초기화</button></div>
      {legacyFilterApplied && <p className="job-legacy-filter-note">이전 검색 주소의 추가 조건이 적용 중입니다. 초기화하거나 새로 검색하면 해제됩니다.</p>}
      <div className="job-filter-section job-keyword-filter"><label htmlFor="job-query">키워드 검색</label><input id="job-query" name="q" type="search" maxLength={200}
        defaultValue={params.get('q') || ''} placeholder="직무, 기술, 회사, 공고 제목" /></div>
      <fieldset className="job-filter-section job-role-filter"><legend>직무</legend><div className="job-preset-list job-role-options">
        {roleOptions.map(option => <label key={option.value} className="job-radio-chip"><input type="radio" name="role" value={option.value} defaultChecked={role === option.value} />
          <span>{option.label}</span></label>)}
      </div></fieldset>
      <CareerFilter initial={careerBands} />
      <EmploymentFilter initial={params.get('employmentType') || ''} />
      <RegionFilter initial={params.get('location') || ''} />
      <DeadlineFilter initial={params.get('deadlineBefore') || ''} />
      <SkillFilter initial={skillId || ''} />
      <div className="job-filter-section"><label>최소 기술 일치도 (%)<input name="minMatchRate" type="number" min="0" max="100" defaultValue={minMatchRate || ''} /></label>
        <small className="job-filter-help">내 기술과 공고 AI 분석이 완료된 경우에만 계산됩니다.</small></div>
      <button className="button-primary job-filter-submit" type="submit">검색하기</button>
    </form>
    <section className="card job-search-results" aria-label="공고 검색 결과" aria-busy={loading}>
      <div className="job-search-heading job-hero job-results-hero"><div><p className="job-eyebrow">JOB EXPLORER</p><h2>채용공고 탐색</h2>
        <p>저장된 공고에서 조건에 맞는 기회를 찾으세요.</p></div>
        <img src={jobResultsCompanion} alt="" aria-hidden="true" /></div>
      {loading ? <LoadingState message="저장된 공고를 검색하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} /> : data && <>
        <p className="job-result-summary" role="status"><span>검색 결과 <strong>{data.totalElements}</strong>건</span><span>{data.page + 1}페이지 · {itOnly ? 'IT 직무' : '전체 저장 공고'}</span></p>
        {data.items.length === 0 ? <><EmptyState title="검색 결과가 없습니다." message="조건을 바꾸거나 다른 페이지를 확인해 주세요." />
          {page > 0 && <button onClick={() => navigatePage(0)}>첫 페이지로</button>}</> : <ul className="job-list job-results-list">{data.items.map(job => <li key={job.id} className="job-card job-result-card">
          <div className="job-result-main"><div className="job-card-top"><p className="job-company">{job.company.name}</p><Badge icon="grid">{sourceLabel(job.source)}</Badge>{job.applicationStatus && <ApplicationStatusBadge status={job.applicationStatus} />}</div>
          <h2><a href={`#/jobs/${job.id}?${new URLSearchParams({ from: search })}`}>{job.title}</a></h2>
          <div className="job-result-facts">{job.role && <span>{roleLabels[job.role] || job.role}</span>}{job.location && <span>{job.location}</span>}{job.careerRequirement && <span>{job.careerRequirement}</span>}{job.employmentType && <span>{job.employmentType}</span>}{job.matchRate !== null && <span>기술 일치도 {job.matchRate}%</span>}</div></div>
          <div className="job-result-side">{job.deadlineDate && <span className="job-result-deadline">마감 {job.deadlineDate}</span>}
          <BookmarkButton icon="image" jobId={job.id} saved={job.bookmarked} onChange={saved => setData(current => current && ({
            ...current, items: current.items.map(item => item.id === job.id ? { ...item, bookmarked: saved } : item),
          }))} /></div>
        </li>)}</ul>}
        <nav className="job-actions job-pagination" aria-label="공고 페이지">
          <button disabled={page === 0} onClick={() => navigatePage(page - 1)}>이전 페이지</button>
          <button disabled={(page + 1) * size >= data.totalElements} onClick={() => navigatePage(page + 1)}>다음 페이지</button>
        </nav>
      </>}
    </section>
  </div>;
}

export function JobDetailPage({ location }: { location: string }) {
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
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setMissing(false); setData(undefined);
    if (!valid) { setError('공고 주소를 확인해 주세요.'); setLoading(false); return; }
    jobs.detail(id, controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setAnalysisStatus(value.analysis && typeof value.analysis === 'object' && 'status' in value.analysis ? String(value.analysis.status) : null); } }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 404) setMissing(true);
      else setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, valid, retry]);
  return <div className="jobs-page"><a className="button-link" href={back}>← {origin === 'bookmarks' ? '관심 공고 목록' : '채용공고 목록'}</a>
    <section className="card" aria-busy={loading}>{loading ? <LoadingState message="공고 상세를 불러오고 있습니다." />
      : missing ? <EmptyState title="공고를 찾을 수 없습니다." message="삭제되었거나 존재하지 않는 공고입니다. 목록에서 다시 선택해 주세요." />
      : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} /> : data && <>
        <div className="job-detail-intro job-hero"><div><p className="job-eyebrow">COLLECTED JOB</p><Badge icon="grid">{sourceLabel(data.source)}</Badge><p className="job-company">{data.company.name}</p><h2>{data.title}</h2></div><img src={jobDetailArt} alt="" aria-hidden="true" /></div>
        <Metadata job={data} /><p>게시일: {shown(data.postedDate)}</p>
        <div className="job-source-actions"><a className="button-link button-primary" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">외부 원문 열기 (새 창)</a><p>외부 사이트에서 지원하는 행동과 이 앱에 지원 이력을 기록하는 행동은 별개입니다.</p></div>
        <BookmarkButton key={`${data.id}-bookmark`} jobId={data.id} saved={data.bookmarked}
          onChange={saved => setData(current => current?.id === id ? { ...current, bookmarked: saved } : current)} />
        <ApplicationRegistration key={`${data.id}-application`} jobId={data.id} status={data.applicationStatus}
          onCreated={applicationStatus => setData(current => current?.id === id ? { ...current, applicationStatus } : current)} />
        <JobAnalysis key={`${data.id}-analysis`} jobId={data.id} canRequest={data.bookmarked}
          initialStatus={data.analysis && typeof data.analysis === 'object' && 'status' in data.analysis ? String(data.analysis.status) : null} onStatusChange={setAnalysisStatus} />
        <JobMatch key={`${data.id}-match`} jobId={data.id} analysisStatus={analysisStatus} />
        <h3>{data.source === 'ALIO_RECRUITMENT' ? '제공된 채용 내용' : '채용공고 원문'}</h3>{data.description ? <div className="job-description">{data.description}</div>
          : <p>저장된 본문이 없습니다. 외부 원문에서 채용 조건을 확인해 주세요.</p>}
        {data.recruitment && <>
          <h3>전형 단계</h3>
          {data.recruitment.steps.length ? <ol className="job-recruitment-list">{data.recruitment.steps.map(step =>
            <li key={step.externalId}><strong>{step.title}</strong>
              {step.openings !== null && <span>채용 {step.openings}명</span>}
              {step.applicants !== null && <span>지원 {step.applicants}명</span>}
              {step.competitionRate && <span>경쟁률 {step.competitionRate}</span>}
              {step.eventDate && <span>기준일 {step.eventDate}</span>}
            </li>)}</ol> : <p>제공된 전형 단계가 없습니다.</p>}
          <h3>첨부파일</h3>
          {data.recruitment.attachments.length ? <ul className="job-recruitment-list">{data.recruitment.attachments.map(file =>
            <li key={file.externalId}><a href={file.url} target="_blank" rel="noopener noreferrer">{file.name} (새 창)</a></li>)}</ul>
            : <p>제공된 첨부파일이 없습니다.</p>}
        </>}
      </>}
    </section></div>;
}
