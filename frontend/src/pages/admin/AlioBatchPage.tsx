import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createAlioBatchApi } from '../../api/alio-batch';
import type { AlioBatchStatus } from '../../api/alio-batch';
import { ErrorState, LoadingState } from '../../components/States';
import art from '../../assets/redesign/ext-img-07-source-exploration.png';
import './alio-batch.css';

const batch = createAlioBatchApi(apiRequest);
const labels: Record<AlioBatchStatus['status'], string> = {
  IDLE: '실행 전', RUNNING: '진행 중', COMPLETED: '완료', PARTIAL_FAILURE: '일부 실패',
  SOURCE_FAILED: '제공기관 조회 실패', STORAGE_FAILED: '저장 실패',
};
const date = (value: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '—';
const message = (error: unknown) => error instanceof Error ? error.message : '배치 상태를 확인하지 못했습니다.';

export function AlioBatchPage() {
  const [status, setStatus] = useState<AlioBatchStatus>();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setDenied(false); setStatus(undefined);
    batch.status(controller.signal).then(value => { if (!controller.signal.aborted) setStatus(value); })
      .catch(failure => { if (!controller.signal.aborted) {
        if (failure instanceof ApiError && failure.status === 403) setDenied(true);
        else setError(message(failure));
      } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (status?.status !== 'RUNNING' || denied) return;
    let active = true;
    const timer = window.setInterval(() => {
      batch.status().then(value => { if (active) { setStatus(value); setActionError(''); } })
        .catch(failure => { if (active) {
          if (failure instanceof ApiError && failure.status === 403) { setDenied(true); setStatus(undefined); }
          else setActionError(`진행 상태를 갱신하지 못했습니다. ${message(failure)}`);
        } });
    }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [status?.status, denied]);
  async function start() {
    if (!status || denied || status.status === 'RUNNING' || inFlight.current) return;
    inFlight.current = true; setBusy(true); setActionError(''); setNotice('');
    try { const value = await batch.start(); if (mounted.current) { setStatus(value); setNotice('관리자 전체 배치를 시작했습니다.'); } }
    catch (failure) { if (mounted.current) {
      if (failure instanceof ApiError && failure.status === 403) { setDenied(true); setStatus(undefined); }
      else if (failure instanceof ApiError && failure.status === 409) { setActionError('이미 실행 중인 배치가 있습니다. 최신 상태를 조회해 주세요.'); setRetry(value => value + 1); }
      else if (failure instanceof ApiError && failure.status === 503) setActionError('배치를 시작할 수 없습니다. ALIO 키 또는 실행기 상태를 확인한 뒤 다시 시도해 주세요.');
      else setActionError(message(failure));
    } }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <div className="alio-batch-page">
    <section className="card alio-batch-hero"><div><span className="eyebrow">ADMIN OPERATION</span><h2>ALIO 전체 수집 배치</h2>
      <p>관리자가 명시적으로 시작하는 정보통신 NCS 공고 전체 수집입니다. 사용자용 ALIO 수집과 별도이며 자동으로 실행되지 않습니다.</p></div>
      <img src={art} alt="" aria-hidden="true" width="132" height="132" /></section>
    <section className="card" aria-labelledby="alio-batch-title"><h2 id="alio-batch-title">배치 상태</h2>
      {loading ? <LoadingState message="관리자 배치 권한과 상태를 확인하고 있습니다." />
        : denied ? <div role="alert"><h3>권한이 없습니다.</h3><p>이 계정은 관리자 ALIO 배치 상태 조회 및 실행 권한이 없습니다.</p></div>
          : error ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} />
            : status && <>
              <p className={`alio-batch-state status-${status.status.toLowerCase()}`} role="status">{labels[status.status]}</p>
              {status.status === 'RUNNING' && <p>진행 중입니다. 이 화면은 상태만 주기적으로 조회하며 배치를 다시 시작하지 않습니다.</p>}
              {status.status === 'PARTIAL_FAILURE' && <p role="alert">일부 공고를 처리하지 못했습니다. 저장된 공고는 유지됩니다.</p>}
              {(status.status === 'SOURCE_FAILED' || status.status === 'STORAGE_FAILED') && <p role="alert">배치가 실패했습니다. 아래 오류와 누적 처리 수를 확인해 주세요.</p>}
              {status.sourceError && <p className="alio-batch-error" role="alert">오류 코드: {status.sourceError}</p>}
              <dl className="alio-batch-details"><div><dt>실행 ID</dt><dd>{status.runId ?? '—'}</dd></div>
                <div><dt>시작</dt><dd>{date(status.startedAt)}</dd></div><div><dt>최근 갱신</dt><dd>{date(status.updatedAt)}</dd></div>
                <div><dt>종료</dt><dd>{date(status.finishedAt)}</dd></div></dl>
              <div className="alio-batch-counts"><div><strong>{status.processedPages}</strong><span>처리 페이지</span></div>
                <div><strong>{status.created}</strong><span>신규</span></div><div><strong>{status.duplicates}</strong><span>중복·갱신</span></div>
                <div><strong>{status.rejected}</strong><span>제외</span></div><div><strong>{status.failed}</strong><span>실패</span></div></div>
              {notice && <p role="status">{notice}</p>}{actionError && <p className="form-error" role="alert">{actionError}</p>}
              <div className="alio-batch-actions"><button type="button" onClick={() => setRetry(value => value + 1)} disabled={busy}>상태 새로고침</button>
                <button className="button-primary" type="button" onClick={() => void start()} disabled={busy || status.status === 'RUNNING'}>{busy ? '시작 요청 중…' : '전체 배치 시작'}</button></div>
              <p className="alio-batch-note">시작 버튼을 누를 때만 POST 요청을 보냅니다. 이미 저장된 공고·북마크·지원 기록은 배치 실패와 별도로 조회할 수 있습니다.</p>
            </>}
    </section>
  </div>;
}
