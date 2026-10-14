import { useEffect, useState } from 'react';
import { apiRequest } from '../../api';
import { ApiError } from '../../api/client';
import { createSavedJobsApi } from '../../api/saved-jobs';
import type { ManualSavedJob, ManualSavedJobInput } from '../../api/saved-jobs';
import { ErrorState, LoadingState } from '../../components/States';
import { LucideIcon } from '../../components/LucideIcon';
import savedBookmarkArt from '../../assets/jobs/saved-bookmark-filled.png';
import './jobs.css';
import './manual-job-form.css';

const savedJobs = createSavedJobsApi(apiRequest);
const optional = (form: FormData, name: string) => String(form.get(name) || '').trim() || null;
function formInput(form: FormData): ManualSavedJobInput {
  return {
    title: String(form.get('title') || '').trim(), companyName: String(form.get('companyName') || '').trim(),
    url: String(form.get('url') || '').trim(), role: optional(form, 'role'), location: optional(form, 'location'),
    employmentType: optional(form, 'employmentType'), careerLevel: optional(form, 'careerLevel'),
    deadlineDate: optional(form, 'deadlineDate'), description: optional(form, 'description'), note: optional(form, 'note'),
  };
}

export function ManualJobFormPage({ location }: { location: string }) {
  const path = location.split('?')[0];
  const match = /^\/bookmarks\/([1-9]\d*)\/edit$/.exec(path);
  const editing = Boolean(match);
  const id = match ? Number(match[1]) : null;
  const valid = path === '/bookmarks/new' || (id !== null && Number.isSafeInteger(id));
  const [job, setJob] = useState<ManualSavedJob>();
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [linkMessage, setLinkMessage] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!editing || id === null) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    savedJobs.detail(id, controller.signal).then(value => {
      if (!controller.signal.aborted) { setJob(value); setUrl(value.url); }
    }).catch(failure => {
      if (!controller.signal.aborted) setLoadError(failure instanceof Error ? failure.message : '공고를 불러오지 못했습니다.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [editing, id, retry]);

  const cancelHref = editing && id !== null ? `#/bookmarks/${id}` : '#/bookmarks';
  function checkLink() {
    try {
      const parsed = new URL(url.trim());
      setLinkMessage(['https:', 'http:'].includes(parsed.protocol) && parsed.hostname
        ? '사용할 수 있는 링크 형식입니다.' : 'http 또는 https 주소를 입력해 주세요.');
    } catch { setLinkMessage('올바른 채용공고 링크를 입력해 주세요.'); }
  }

  return <div className="jobs-page manual-job-page">
    <nav className="manual-job-breadcrumb" aria-label="현재 위치"><a href="#/bookmarks">관심 공고</a><LucideIcon name="chevronRight" /><span>{editing ? '공고 수정' : '공고 직접 등록'}</span></nav>
    <header className="manual-job-header"><img src={savedBookmarkArt} alt="" aria-hidden="true" /><div>
      <h1>{editing ? '공고 수정' : '공고 직접 등록'}</h1>
      <p>외부 사이트의 채용공고를 직접 등록하여 관심 공고로 관리할 수 있습니다.</p>
    </div></header>
    {!valid ? <ErrorState message="공고 주소를 확인해 주세요." />
      : loading ? <LoadingState message="직접 등록 공고를 불러오고 있습니다." />
        : loadError ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} />
          : <form key={job?.id || 'new'} className="manual-job-form" onSubmit={async event => {
            event.preventDefault(); if (saving) return;
            const input = formInput(new FormData(event.currentTarget));
            setSaving(true); setFormError('');
            try {
              if (editing && id !== null) await savedJobs.update(id, input);
              else await savedJobs.create(input);
              window.location.hash = editing && id !== null ? `/bookmarks/${id}` : '/bookmarks';
            } catch (failure) {
              setFormError(failure instanceof ApiError && failure.status === 409 ? '이미 저장한 URL입니다.'
                : failure instanceof Error ? failure.message : '공고를 저장하지 못했습니다.');
            } finally { setSaving(false); }
          }}>
            <fieldset disabled={saving}>
              <section className="manual-job-section">
                <div className="manual-job-fields">
                  <label>공고 제목 <em>*</em><input name="title" required maxLength={300} defaultValue={job?.title || ''} placeholder="예) 백엔드 개발자 (Java/Spring)" /></label>
                  <label>회사명 <em>*</em><input name="companyName" required maxLength={200} defaultValue={job?.companyName || ''} placeholder="예) 회사명을 입력하세요" /></label>
                  <div className="manual-job-wide manual-job-url"><label htmlFor="manual-job-url">공고 링크 <em>*</em></label><span className="manual-job-link-row"><input id="manual-job-url" name="url" type="url" required maxLength={2048} value={url} onChange={event => { setUrl(event.target.value); setLinkMessage(''); }} placeholder="예) https://www.example.com/recruit" /><button type="button" onClick={checkLink}><LucideIcon name="link" />링크 확인</button></span>
                    {linkMessage && <small role="status">{linkMessage}</small>}</div>
                  <label>근무 지역<input name="location" maxLength={200} list="manual-job-locations" defaultValue={job?.location || ''} placeholder="지역 선택 또는 입력" /></label>
                  <label>고용 형태<input name="employmentType" maxLength={120} list="manual-job-employment" defaultValue={job?.employmentType || ''} placeholder="고용 형태 선택 또는 입력" /></label>
                  <label>경력 조건<input name="careerLevel" maxLength={120} list="manual-job-careers" defaultValue={job?.careerLevel || ''} placeholder="경력 조건 선택 또는 입력" /></label>
                  <label>마감일<input name="deadlineDate" type="date" defaultValue={job?.deadlineDate || ''} /></label>
                  <label className="manual-job-wide">직무<input name="role" maxLength={120} defaultValue={job?.role || ''} placeholder="예) 백엔드 개발" /></label>
                </div>
              </section>
              <section className="manual-job-section"><div className="manual-job-section-heading"><LucideIcon name="fileText" /><div>
                <h2>공고 본문</h2><p>채용공고의 전체 내용을 입력해주세요. AI 분석에 사용됩니다.</p>
              </div></div>
                <label className="manual-job-full-label"><span className="saved-visually-hidden">공고 본문</span><textarea name="description" maxLength={12000} rows={6} defaultValue={job?.description || ''} placeholder="예) 채용 소개, 주요 업무, 자격 요건, 우대 사항 등 공고의 전체 내용을 입력하세요." /></label>
              </section>
              <section className="manual-job-section"><div className="manual-job-section-heading"><LucideIcon name="fileText" /><div>
                <h2>메모</h2><p>이 공고에 대한 개인적인 메모를 남길 수 있습니다. (선택)</p>
              </div></div>
                <label className="manual-job-full-label"><span className="saved-visually-hidden">메모</span><textarea name="note" maxLength={2000} rows={2} defaultValue={job?.note || ''} placeholder="예) 기술 스택이 잘 맞아서 관심 있음. 서류 마감 전에 이력서를 수정해서 지원하기." /></label>
              </section>
            </fieldset>
            {formError && <ErrorState message={formError} />}
            <div className="manual-job-actions"><a href={cancelHref}>취소</a><button type="submit" disabled={saving}><img src={savedBookmarkArt} alt="" aria-hidden="true" />{saving ? '저장 중…' : editing ? '저장' : '등록'}</button></div>
          </form>}
    <datalist id="manual-job-locations"><option value="서울" /><option value="경기" /><option value="인천" /><option value="부산" /><option value="대구" /><option value="대전" /><option value="광주" /><option value="전국" /><option value="원격" /></datalist>
    <datalist id="manual-job-employment"><option value="정규직" /><option value="계약직" /><option value="인턴" /><option value="프리랜서" /></datalist>
    <datalist id="manual-job-careers"><option value="신입" /><option value="경력무관" /><option value="1년 이하" /><option value="1~3년" /><option value="3~5년" /><option value="5년 이상" /></datalist>
  </div>;
}
