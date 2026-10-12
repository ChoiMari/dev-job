import { useState } from 'react';
import { apiRequest } from '../api';
import { ApiError } from '../api/client';
import { createApplicationsApi } from '../api/applications';
import { newApplicationStatuses, scheduleInput, statusLabels } from '../api/application-status';
import { ErrorState } from './States';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import type { ApplicationStatus } from '../api/application-status';
import '../pages/applications/applications.css';

const applications = createApplicationsApi(apiRequest);
export function ApplicationRegistration({ jobId, personalSavedJobId, status, onCreated, compact = false }: {
  jobId?: number; personalSavedJobId?: number; status: ApplicationStatus | null; onCreated: (status: ApplicationStatus) => void; compact?: boolean;
}) {
  const [initial, setInitial] = useState<typeof newApplicationStatuses[number]>('PLANNED');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (status) return <section className="application-registration">
    <h3>내 지원 현황</h3><ApplicationStatusBadge status={status} />
    <p>지원 관리에서 메모·일정과 진행 상태를 수정할 수 있습니다.</p>
    <a className="button-link" href="#/applications">지원 관리로</a>
  </section>;
  return <section className={`application-registration${compact ? ' application-registration--compact' : ''}`}>
    {!compact && <><h3>지원 기록</h3><p>실제 지원은 외부 원문에서 진행하고, 준비 상황을 여기에 기록하세요.</p></>}
    {!open ? <button type="button" onClick={() => setOpen(true)}>지원 등록하기</button> : <form className="application-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const values = new FormData(event.currentTarget); setBusy(true); setError('');
      try {
        const saved = await applications.create({ jobId, personalSavedJobId, status: initial,
          appliedDate: initial === 'PLANNED' ? null : String(values.get('appliedDate') || '') || null,
          note: String(values.get('note') || '') || null, nextScheduleAt: scheduleInput(String(values.get('nextScheduleAt') || '')) });
        onCreated(saved.currentStatus);
      } catch (failure) {
        setError(failure instanceof ApiError && failure.status === 409 ? '이미 등록된 공고입니다. 지원 관리에서 확인해 주세요.'
          : failure instanceof Error ? failure.message : '지원 등록에 실패했습니다.');
      } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}><legend>지원 등록 정보</legend>
        <div className="application-registration-fields">
          <label><span className="application-registration-field-title">지원일 {initial !== 'PLANNED' && initial !== 'WITHDRAWN' && <b aria-hidden="true">*</b>}</span>
            <input name="appliedDate" type="date" required={initial !== 'PLANNED' && initial !== 'WITHDRAWN'} disabled={initial === 'PLANNED'} />
            <small>{initial === 'PLANNED' ? '지원 예정 상태에서는 입력하지 않습니다.' : initial === 'WITHDRAWN' ? '실제 지원했다면 날짜를 입력해 주세요.' : '실제 지원한 날짜를 선택해 주세요.'}</small>
          </label>
          <label><span className="application-registration-field-title">진행 상태 <b aria-hidden="true">*</b></span><select value={initial} onChange={event => setInitial(event.target.value as typeof initial)}>
            {newApplicationStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </select></label>
          <label className="application-registration-wide">다음 확인 일정 (선택)<input name="nextScheduleAt" type="datetime-local" /></label>
          <label className="application-registration-wide">메모 (선택)<textarea name="note" maxLength={2000} rows={3} placeholder="지원 경로, 확인할 내용 등을 기록하세요." /></label>
        </div>
        <div className="application-actions"><button className="button-primary" type="submit">{busy ? '등록 중…' : '지원 기록 저장'}</button>
          <button type="button" onClick={() => setOpen(false)}>취소</button></div>
      </fieldset>
      {error && <><ErrorState message={error} /><a className="button-link" href="#/applications">지원 관리로</a></>}
    </form>}
  </section>;
}
