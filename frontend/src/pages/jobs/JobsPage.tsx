import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createJobsApi } from '../../api/jobs';
import type { JobDetail, JobPage, JobSummary } from '../../api/jobs';
import { Badge } from '../../components/PixelArt';
import { BookmarkButton } from '../../components/BookmarkButton';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import './jobs.css';

const jobs = createJobsApi(apiRequest);
const fields = ['q', 'company', 'location', 'careerLevel', 'employmentType', 'deadlineBefore'] as const;
const labels = ['검색어 (제목·회사)', '회사', '지역', '경력 조건', '고용 형태', '마감일 이전'];
const shown = (value: string | null) => value || '정보 없음';
export function Metadata({ job }: { job: JobSummary }) {
  return <dl className="job-metadata">
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
  const invalid = !Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(size) || size < 1 || size > 100 || !['latest', 'deadline'].includes(sort);
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
      sort: sort as 'latest' | 'deadline' }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, size, sort, invalid, retry]);
  const navigatePage = (next: number) => { const query = new URLSearchParams(search); query.set('page', String(next)); window.location.hash = `/jobs?${query}`; };
  return <div className="jobs-page">
    <form key={search} className="card job-search" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const query = new URLSearchParams();
      for (const [key, value] of values) if (String(value).trim()) query.set(key, String(value).trim());
      query.set('page', '0'); window.location.hash = `/jobs?${query}`;
    }}>
      <div className="job-filter-grid">{fields.map((field, i) => <label key={field}>{labels[i]}
        <input name={field} defaultValue={params.get(field) || ''} type={field === 'deadlineBefore' ? 'date' : 'text'} maxLength={200}
          placeholder={field === 'careerLevel' ? '예: 신입 (정확히 일치)' : field === 'employmentType' ? '예: 정규직 (정확히 일치)' : undefined} />
      </label>)}
        <label>정렬<select name="sort" defaultValue={sort}><option value="latest">최신순</option><option value="deadline">마감 임박순</option></select></label>
        <label>페이지당 공고<select name="size" defaultValue={size}><option value="20">20개</option><option value="50">50개</option><option value="100">100개</option></select></label>
      </div>
      <div className="job-actions"><button className="button-primary" type="submit">검색</button><a className="button-link" href="#/jobs">조건 초기화</a></div>
    </form>
    <section className="card" aria-label="공고 검색 결과" aria-busy={loading}>
      {loading ? <LoadingState message="저장된 공고를 검색하고 있습니다." /> : error ? <ErrorState message={error} onRetry={() => setRetry(v => v + 1)} /> : data && <>
        <p role="status">총 {data.totalElements}건 · {data.page + 1}페이지</p>
        {data.items.length === 0 ? <><EmptyState title="검색 결과가 없습니다." message="조건을 바꾸거나 다른 페이지를 확인해 주세요." />
          {page > 0 && <button onClick={() => navigatePage(0)}>첫 페이지로</button>}</> : <ul className="job-list">{data.items.map(job => <li key={job.id} className="job-card">
          <Badge icon="grid">{job.source}</Badge><p>{job.company.name}</p>
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
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setMissing(false); setData(undefined);
    if (!valid) { setError('공고 주소를 확인해 주세요.'); setLoading(false); return; }
    jobs.detail(id, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => {
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
        <Badge icon="grid">{data.source}</Badge><p>{data.company.name}</p><h2>{data.title}</h2>
        <Metadata job={data} /><p>게시일: {shown(data.postedDate)}</p>
        <a className="button-link button-primary" href={data.sourceUrl} target="_blank" rel="noopener noreferrer">외부 원문 보기 (새 창)</a>
        <BookmarkButton key={data.id} jobId={data.id} saved={data.bookmarked}
          onChange={saved => setData(current => current?.id === id ? { ...current, bookmarked: saved } : current)} />
        <h3>채용공고 원문</h3>{data.description ? <div className="job-description">{data.description}</div>
          : <p>저장된 본문이 없습니다. 외부 원문에서 채용 조건을 확인해 주세요.</p>}
      </>}
    </section></div>;
}
