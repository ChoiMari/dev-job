import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { companyLink, createCompaniesApi } from '../../api/companies';
import type { CompanyInput, CompanyPage, CompanyStatus, InterestedCompany } from '../../api/companies';
import { Badge } from '../../components/PixelArt';
import { EmptyState, ErrorState, LoadingState, SuccessState } from '../../components/States';
import companyArt from '../../assets/redesign/ext-img-05a-companies.png';
import './companies.css';

const companies = createCompaniesApi(apiRequest);
const blank: CompanyInput = { name: '', websiteUrl: null, note: null, status: 'INTERESTED' };
const labels: Record<CompanyStatus, string> = {
  INTERESTED: '관심', RESEARCHING: '조사 중', ARCHIVED: '보관',
};
const message = (error: unknown) => error instanceof Error ? error.message : '기업 기록을 처리하지 못했습니다.';
const displayDate = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));

export function CompaniesPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  if (path === '/companies') return <CompanyList />;
  if (path === '/companies/new') return <CompanyEditor />;
  const match = /^\/companies\/([1-9]\d*)$/.exec(path);
  const id = match ? Number(match[1]) : 0;
  return Number.isSafeInteger(id) && id > 0 ? <CompanyEditor id={id} /> : <section className="card">
    <EmptyState title="기업 주소를 확인해 주세요." /><a className="button-link" href="#/companies">기업 목록으로</a>
  </section>;
}

function CompanyList() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<CompanyPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setResult(undefined);
    companies.list(page, controller.signal).then(value => { if (!controller.signal.aborted) setResult(value); })
      .catch(failure => { if (!controller.signal.aborted) setError(message(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  return <section className="card companies-page">
    <div className="company-hero"><div><span className="eyebrow">COMPANY NOTES</span><h2>관심 기업</h2>
      <p>나만의 기업 조사 기록을 관리하세요.</p></div><img src={companyArt} alt="" aria-hidden="true" width="140" height="140" /></div>
    <div className="company-actions"><Badge tone="primary" icon="grid">나의 기업 기록</Badge>
      <a className="button-link button-primary" href="#/companies/new">관심 기업 등록</a></div>
    <p>관심 기업을 따로 기록하고 메모와 관리 상태를 정리하세요. 채용공고의 회사와 자동으로 연결되지 않습니다.</p>
    {loading ? <LoadingState message="기업 목록을 불러오고 있습니다." /> : error
      ? <ErrorState message={error} onRetry={() => setRetry(value => value + 1)} /> : result && <>
        {result.items.length === 0 ? <EmptyState title={page === 0 ? '등록한 관심 기업이 없습니다.' : '이 페이지에 기업이 없습니다.'}
          message={page === 0 ? '관심 기업 등록 버튼으로 첫 기업을 기록해 보세요.' : '이전 페이지를 확인해 주세요.'} />
          : <ul className="company-list" aria-label="내 관심 기업 목록">{result.items.map(item => <li key={item.id}>
            <div className="company-list-heading"><h2><a href={'#/companies/' + item.id}>{item.name}</a></h2>
              <Badge tone="primary">{labels[item.status]}</Badge></div>
            <p>{item.websiteUrl ?? '웹사이트 없음'} · 기록 #{item.id}</p>
            {item.note && <p className="company-note">{item.note}</p>}
            <small>수정 {displayDate(item.updatedAt)}</small>
          </li>)}</ul>}
        <div className="company-actions"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
          <span role="status">총 {result.totalElements}건 · {page + 1}페이지</span>
          <button type="button" disabled={(page + 1) * result.size >= result.totalElements} onClick={() => setPage(value => value + 1)}>다음</button></div>
      </>}
  </section>;
}

function CompanyEditor({ id }: { id?: number }) {
  const [company, setCompany] = useState<InterestedCompany>();
  const [form, setForm] = useState<CompanyInput>(blank);
  const [editing, setEditing] = useState(!id);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [loadStatus, setLoadStatus] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function accept(value: InterestedCompany) {
    setCompany(value);
    setForm({ name: value.name, websiteUrl: value.websiteUrl, note: value.note, status: value.status });
  }
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    companies.get(id, controller.signal).then(value => { if (!controller.signal.aborted) accept(value); })
      .catch(failure => { if (!controller.signal.aborted) {
        setLoadError(message(failure)); setLoadStatus(failure instanceof ApiError ? failure.status : 0);
      } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, retry]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current) return;
    setError(''); setSuccess('');
    const name = form.name.trim();
    if (!name) { setError('기업명을 입력해 주세요.'); return; }
    const websiteUrl = form.websiteUrl?.trim() || null;
    if (websiteUrl && !companyLink(websiteUrl)) { setError('웹사이트는 사용자 정보와 #이 없는 http 또는 https 주소로 입력해 주세요.'); return; }
    inFlight.current = true; setBusy(true);
    try {
      const input = { ...form, name, websiteUrl, note: form.note?.trim() || null };
      const value = id ? await companies.update(id, input) : await companies.create(input);
      if (!mounted.current) return;
      if (!id) window.location.hash = '/companies/' + value.id;
      else { accept(value); setEditing(false); setSuccess('기업 기록을 저장했습니다.'); }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof ApiError && failure.status === 409
        ? '이 웹사이트는 내 관심 기업에 이미 등록되어 있습니다.' : message(failure));
    } finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (!id || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await companies.remove(id); if (mounted.current) window.location.hash = '/companies'; }
    catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="card companies-page">
    <a className="button-link" href="#/companies">← 관심 기업 목록</a>
    {loading ? <LoadingState message="기업 기록을 불러오고 있습니다." /> : loadError
      ? loadStatus === 404 || loadStatus === 403
        ? <EmptyState title={loadStatus === 404 ? '기업 기록을 찾을 수 없습니다.' : '접근 권한이 없습니다.'} message={loadError} />
        : <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
      : <>
        {success && <SuccessState title={success} compact />}
        {error && <p role="alert" className="form-error">{error}</p>}
        {editing ? <form className="company-form" onSubmit={save}>
          <h2>{id ? '관심 기업 수정' : '관심 기업 등록'}</h2>
          <p>같은 이름의 다른 기업도 따로 등록할 수 있습니다. 웹사이트 주소가 같으면 중복 등록할 수 없습니다.</p>
          <fieldset disabled={busy}>
            <label>기업명 *<input name="name" required maxLength={200} value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label>웹사이트<input name="websiteUrl" type="url" maxLength={2048} placeholder="https://example.com"
              value={form.websiteUrl ?? ''} onChange={event => setForm(current => ({ ...current, websiteUrl: event.target.value || null }))} /></label>
            <label>관리 상태 *<select name="status" value={form.status}
              onChange={event => setForm(current => ({ ...current, status: event.target.value as CompanyStatus }))}>
              <option value="INTERESTED">관심</option><option value="RESEARCHING">조사 중</option><option value="ARCHIVED">보관</option>
            </select></label>
            <label>내 메모<textarea name="note" rows={5} maxLength={2000} value={form.note ?? ''}
              onChange={event => setForm(current => ({ ...current, note: event.target.value || null }))} /></label>
          </fieldset>
          <div className="company-actions"><button className="button-primary" type="submit" disabled={busy}>{busy ? '저장 중…' : '기업 기록 저장'}</button>
            {id && <button type="button" disabled={busy} onClick={() => {
              if (company) accept(company); setEditing(false); setError('');
            }}>수정 취소</button>}</div>
        </form> : company && <>
          <div className="company-list-heading"><h2>{company.name}</h2><Badge tone="primary">{labels[company.status]}</Badge></div>
          <p>관심 기업 기록 #{company.id} · 수정 {displayDate(company.updatedAt)}</p>
          <dl className="company-detail">
            <div><dt>웹사이트</dt><dd>{company.websiteUrl && companyLink(company.websiteUrl)
              ? <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">기업 웹사이트 보기 (새 창)</a> : '등록하지 않음'}</dd></div>
            <div><dt>내 메모</dt><dd className="company-note">{company.note ?? '등록한 메모가 없습니다.'}</dd></div>
          </dl>
          <p className="company-help">이 기록은 수집 공고의 회사 정보와 자동으로 연결되지 않습니다.</p>
          <div className="company-actions"><button type="button" disabled={busy} onClick={() => {
            setEditing(true); setConfirmDelete(false); setSuccess(''); setError('');
          }}>기업 기록 수정</button>
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)}>기업 기록 삭제</button></div>
          {confirmDelete && <div className="company-delete" role="group" aria-label="기업 기록 삭제 확인">
            <p>“{company.name}”의 내 기록을 삭제할까요? 수집된 채용공고와 지원 기록은 유지됩니다.</p>
            <div className="company-actions"><button type="button" disabled={busy} onClick={() => void remove()}>{busy ? '삭제 중…' : '삭제 확인'}</button>
              <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>삭제 취소</button></div>
          </div>}
        </>}
      </>}
  </section>;
}
