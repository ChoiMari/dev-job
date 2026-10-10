import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { createNotificationsApi, notificationSource } from '../../api/notifications';
import type { NotificationPage } from '../../api/notifications';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import art from '../../assets/redesign/ext-img-01-account-settings.png';
import './notifications.css';

const notifications = createNotificationsApi(apiRequest);
const message = (error: unknown) => error instanceof Error ? error.message : '알림을 처리하지 못했습니다.';
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function NotificationsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<NotificationPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<number>();
  const [retry, setRetry] = useState(0);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setResult(undefined);
    notifications.list(page, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      if (page > 0 && !value.items.length && value.totalElements <= page * value.size) setPage(value => value - 1);
      else setResult(value);
    }).catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  async function markRead(id: number) {
    if (busy.current) return;
    busy.current = true; setBusyId(id); setActionError('');
    try {
      await notifications.markRead(id);
      if (mounted.current) setRetry(value => value + 1);
    } catch (failure) { if (mounted.current) setActionError(message(failure)); }
    finally { busy.current = false; if (mounted.current) setBusyId(undefined); }
  }
  return <div className="notifications-page">
    <section className="card notifications-hero"><div><span className="eyebrow">IN APP</span><h2>앱 내 알림</h2>
      <p>면접 시작과 개인 할 일 기한을 알려드립니다. 종류별 수신은 설정에서 선택할 수 있습니다.</p>
      <a className="button-link" href="#/settings">알림 수신 설정</a></div>
      <img src={art} alt="" aria-hidden="true" width="132" height="132" /></section>
    <section className="card" aria-labelledby="notifications-title"><h2 id="notifications-title">알림 목록</h2>
      {actionError && <p role="alert" className="form-error">{actionError}</p>}
      {loading ? <LoadingState message="알림을 불러오고 있습니다." /> : error
        ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : result && <>
          {result.items.length ? <ul className="notifications-list">{result.items.map(item => <li key={item.id} className={item.readAt ? 'is-read' : 'is-unread'}>
            <div className="notifications-item-main"><span className="notifications-kind">{item.type === 'INTERVIEW_REMINDER' ? '면접 시작' : '개인 할 일 기한'}</span>
              <span className="notifications-read">{item.readAt ? '읽음' : '읽지 않음'}</span>
              <h3>{item.subject}</h3><p>예정: <time dateTime={item.scheduledAt}>{date(item.scheduledAt)}</time></p>
              <p>알림 생성: <time dateTime={item.createdAt}>{date(item.createdAt)}</time></p>
              {item.readAt && <p>읽은 시각: <time dateTime={item.readAt}>{date(item.readAt)}</time></p>}</div>
            <div className="notifications-actions"><a href={notificationSource(item)}>{item.type === 'INTERVIEW_REMINDER' ? '면접 일정 보기' : '할 일 보기'}</a>
              {!item.readAt && <button type="button" disabled={busyId !== undefined} onClick={() => void markRead(item.id)}>{busyId === item.id ? '처리 중…' : '읽음 처리'}</button>}</div>
          </li>)}</ul> : <EmptyState title="표시할 알림이 없습니다." message="새 면접 또는 할 일 알림이 생성되면 이곳에 표시됩니다." />}
          <nav className="notifications-pagination" aria-label="알림 페이지"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
            <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
            <button type="button" disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></nav>
        </>}
    </section>
  </div>;
}
