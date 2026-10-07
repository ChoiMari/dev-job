import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createJobsApi } from '../../api/jobs';
import type { JobDetail, JobPage, JobSummary } from '../../api/jobs';
import { Badge } from '../../components/PixelArt';
import { BookmarkButton } from '../../components/BookmarkButton';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { applicationStatuses, statusLabels, isApplicationStatus } from '../../api/application-status';
import { ApplicationStatusBadge } from '../../components/ApplicationStatusBadge';
import { ApplicationRegistration } from '../../components/ApplicationRegistration';
import { JobAnalysis } from '../../components/JobAnalysis';
import { JobMatch } from '../../components/JobMatch';
import { createSkillsApi } from '../../api/skills';
import type { SkillPage } from '../../api/skills';
import './jobs.css';
import jobSearchArt from '../../assets/illustrations/job-search.png';
import jobDetailArt from '../../assets/illustrations/job-detail.png';

const jobs = createJobsApi(apiRequest);
const skills = createSkillsApi(apiRequest);
const fields = ['q', 'company', 'location', 'careerLevel', 'employmentType', 'deadlineBefore'] as const;
const labels = ['개발자 검색 (제목·회사, 3자 이상 본문)', '회사', '지역', '경력 조건', '고용 형태', '마감일 이전'];
const roleLabels: Record<string, string> = { DEVELOPMENT: '개발', DATA_AI: '데이터·AI', SECURITY: '보안', INFRA: '클라우드·인프라', IT_OPERATIONS: '전산·IT 운영' };
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
  return <div className="job-skill-filter"><label>기술 검색<input value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /></label>
    <button type="button" onClick={() => { setSearched(query.trim()); setRetry(value => value + 1); }}>기술 찾기</button>
    <input type="hidden" name="skillId" value={selected} />
    {selected && <p>선택한 기술 ID: {selected} <button type="button" onClick={() => setSelected('')}>선택 해제</button></p>}
    {error && <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />}
    {result && !error && <ul>{result.items.map(skill => <li key={skill.id}><button type="button" onClick={() => setSelected(String(skill.id))}>{skill.name} 선택</button></li>)}</ul>}
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
  const applicationStatus = params.get('applicationStatus');
  const source = params.get('source') || '';
  const role = params.get('role') || '';
  const itOnly = params.get('itOnly') !== 'false';
  const invalid = !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100 || !['latest', 'deadline', 'matchRate'].includes(sort)
    || (skillId !== null && (!/^[1-9]\d*$/.test(skillId) || !Number.isSafeInteger(Number(skillId))))
    || (minMatchRate !== null && (!/^\d{1,3}$/.test(minMatchRate) || Number(minMatchRate) > 100))
    || (applicationStatus !== null && !isApplicationStatus(applicationStatus))
    || (role !== '' && !(role in roleLabels));
  const [data, setData] = useState<JobPage>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    if (invalid) { setError('검색 주소의 페이지·정렬값을 확인해 주세요.'); setLoading(false); return; }
    const values = new URLSearchParams(search);
    jobs.list({ ...Object.fromEntries(fields.map(key => [key, values.get(key) || undefined])), page, size,
      sort: sort as 'latest' | 'deadline' | 'matchRate', skillId: skillId ? Number(skillId) : undefined,
      minMatchRate: minMatchRate === null ? undefined : Number(minMatchRate),
      applicationStatus: isApplicationStatus(applicationStatus) ? applicationStatus : undefined, itOnly,
      source: source || undefined, role: role || undefined }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, size, sort, skillId, minMatchRate, applicationStatus, itOnly, source, role, invalid, retry]);
  const navigatePage = (next: number) => { const query = new URLSearchParams(search); query.set('page', String(next)); window.location.hash = `/jobs?${query}`; };
  return <div className="jobs-page">
    <form key={search} className="card job-search" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const query = new URLSearchParams();
      for (const [key, value] of values) if (String(value).trim()) query.set(key, String(value).trim());
      query.set('page', '0'); window.location.hash = `/jobs?${query}`;
    }}>
      <div className="job-search-heading"><div><h2>채용공고 탐색</h2><p>저장된 개발 직무 공고를 검색하세요.</p></div><img src={jobSearchArt} alt="" aria-hidden="true" width="96" height="96" /></div>
      <div className="job-filter-grid">{fields.map((field, i) => <label key={field}>{labels[i]}
        <input name={field} defaultValue={params.get(field) || ''} type={field === 'deadlineBefore' ? 'date' : 'text'} maxLength={200}
          placeholder={field === 'careerLevel' ? '예: 신입 (정확히 일치)' : field === 'employmentType' ? '예: 정규직 (정확히 일치)' : undefined} />
      </label>)}
        <label>직무<select name="role" defaultValue={role}><option value="">전체 직무</option>
          {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>출처<select name="source" defaultValue={source}><option value="">전체</option>
          <option value="ALIO_RECRUITMENT">공공기관</option><option value="WORK24_OPEN_RECRUITMENT">고용24</option>
        </select></label>
        <label>직무 범위<select name="itOnly" defaultValue={itOnly ? 'true' : 'false'}><option value="true">SW·데이터·보안 중심</option><option value="false">전체 저장 공고</option></select></label>
        <SkillFilter initial={skillId || ''} />
        <label>최소 기술 일치도 (%)<input name="minMatchRate" type="number" min="0" max="100" defaultValue={minMatchRate || ''} /></label>
        <label>정렬<select name="sort" defaultValue={sort}><option value="latest">최신순</option><option value="deadline">마감 임박순</option><option value="matchRate">기술 일치도 높은순</option></select></label>
        <label>내 지원 상태<select name="applicationStatus" defaultValue={applicationStatus || ''}><option value="">전체 공고</option>
          {applicationStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}
        </select></label>
        <label>페이지당 공고<select name="size" defaultValue={size}><option value="20">20개</option><option value="50">50개</option><option value="100">100개</option></select></label>
      </div>
      <div className="job-actions"><button className="button-primary" type="submit">검색</button><a className="button-link" href="#/jobs">조건 초기화</a></div>
    </form>
    <section className="card" aria-label="공고 검색 결과" aria-busy={loading}>
      {loading ? <LoadingState message="저장된 공고를 검색하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} /> : data && <>
        <p role="status">총 {data.totalElements}건 · {data.page + 1}페이지</p>
        {data.items.length === 0 ? <><EmptyState title="검색 결과가 없습니다." message="조건을 바꾸거나 다른 페이지를 확인해 주세요." />
          {page > 0 && <button onClick={() => navigatePage(0)}>첫 페이지로</button>}</> : <ul className="job-list">{data.items.map(job => <li key={job.id} className="job-card">
          <Badge icon="grid">{sourceLabel(job.source)}</Badge>{job.applicationStatus && <ApplicationStatusBadge status={job.applicationStatus} />}<p>{job.company.name}</p>
          <p>{job.matchRate === null ? '기술 일치도 계산 전' : `기술 일치도 ${job.matchRate}%`}</p>
          <h2><a href={`#/jobs/${job.id}?${new URLSearchParams({ from: search })}`}>{job.title}</a></h2><Metadata job={job} />
          <BookmarkButton jobId={job.id} saved={job.bookmarked} onChange={saved => setData(current => current && ({
            ...current, items: current.items.map(item => item.id === job.id ? { ...item, bookmarked: saved } : item),
          }))} />
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
        <div className="job-detail-intro"><div><Badge icon="grid">{sourceLabel(data.source)}</Badge><p>{data.company.name}</p><h2>{data.title}</h2></div><img src={jobDetailArt} alt="" aria-hidden="true" width="96" height="96" /></div>
        <Metadata job={data} /><p>게시일: {shown(data.postedDate)}</p>
        <a className="button-link button-primary" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">{data.source === 'ALIO_RECRUITMENT' ? '제공된 출처 사이트 열기 (새 창)' : '외부 원문 보기 (새 창)'}</a>
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
