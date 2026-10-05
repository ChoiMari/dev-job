import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { createBookmarksApi } from '../../api/bookmarks';
import type { BookmarkPage } from '../../api/bookmarks';
import { BookmarkButton } from '../../components/BookmarkButton';
import { Badge } from '../../components/PixelArt';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { Metadata } from './JobsPage';
import './jobs.css';

const bookmarks = createBookmarksApi(apiRequest);
export function BookmarksPage({ location }: { location: string }) {
  const search = location.split('?')[1] || '';
  const params = new URLSearchParams(search);
  const page = Number(params.get('page') || 0);
  const size = Number(params.get('size') || 20);
  const [data, setData] = useState<BookmarkPage>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const navigatePage = (next: number) => {
    const query = new URLSearchParams(search); query.set('page', String(next));
    window.location.hash = `/bookmarks?${query}`;
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(undefined);
    bookmarks.list(page, size, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : '관심 공고를 불러오지 못했습니다.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, page, size, retry]);
  return <div className="jobs-page"><a className="button-link" href="#/jobs">채용공고 찾아보기</a>
    <section className="card" aria-label="관심 공고 목록" aria-busy={loading}>
      {loading ? <LoadingState message="관심 공고를 불러오고 있습니다." />
        : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : data && <>
          <p role="status">총 {data.totalElements}건 · {data.page + 1}페이지</p>
          {data.items.length === 0 ? <><EmptyState title={data.totalElements ? '이 페이지에 공고가 없습니다.' : '저장한 관심 공고가 없습니다.'}
            message="채용공고에서 관심 있는 공고를 저장해 보세요." />
            {page > 0 && <button onClick={() => navigatePage(0)}>첫 페이지로</button>}</>
            : <ul className="job-list">{data.items.map(item => <li className="job-card" key={item.id}>
              <Badge icon="check" tone="success">저장됨</Badge><p>{item.job.company.name}</p>
              <h2><a href={`#/jobs/${item.job.id}?${new URLSearchParams({ origin: 'bookmarks', from: search })}`}>{item.job.title}</a></h2>
              <Metadata job={item.job} /><p>저장일: {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
              <BookmarkButton jobId={item.job.id} saved={item.job.bookmarked} onChange={saved => {
                if (!saved) {
                  if (data.items.length === 1 && page > 0) navigatePage(page - 1);
                  else setRetry(value => value + 1);
                }
              }} />
            </li>)}</ul>}
          <nav className="job-actions job-pagination" aria-label="관심 공고 페이지">
            <button disabled={page === 0} onClick={() => navigatePage(page - 1)}>이전 페이지</button>
            <button disabled={(page + 1) * size >= data.totalElements} onClick={() => navigatePage(page + 1)}>다음 페이지</button>
          </nav>
        </>}
    </section></div>;
}
