import { useState } from 'react';
import { apiRequest } from '../api';
import { ApiError } from '../api/client';
import { createApplicationsApi } from '../api/applications';
import type { CreateApplication } from '../api/applications';
import { scheduleInput, statusLabels } from '../api/application-status';
import { ErrorState } from './States';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import type { ApplicationStatus } from '../api/application-status';
import '../pages/applications/applications.css';

const applications = createApplicationsApi(apiRequest);
export function ApplicationRegistration({ jobId, personalSavedJobId, status, onCreated, buttonStatusPicker = false }: {
  jobId?: number; personalSavedJobId?: number; status: ApplicationStatus | null; onCreated: (status: ApplicationStatus) => void;
  buttonStatusPicker?: boolean;
}) {
  const [initial, setInitial] = useState<CreateApplication['status']>('PLANNED');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (status) return <section className="application-registration">
    <h3>내 지원 현황</h3><ApplicationStatusBadge status={status} />
    <p>지원 관리에서 메모·일정을 수정하고 다음 단계와 이력을 확인할 수 있습니다.</p>
    <a className="button-link" href="#/applications">지원 관리로</a>
  </section>;
  return <section className="application-registration">
    <h3>지원 기록</h3><p>실제 지원은 외부 원문에서 진행하고, 준비 상황을 여기에 기록하세요.</p>
    {!open ? <button type="button" onClick={() => setOpen(true)}>지원 등록하기</button> : <form className="application-form" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const values = new FormData(event.currentTarget); setBusy(true); setError('');
      try {
        const saved = await applications.create({ jobId, personalSavedJobId, status: initial,
          appliedDate: initial === 'APPLIED' ? String(values.get('appliedDate')) : null,
          note: String(values.get('note') || '') || null, nextScheduleAt: scheduleInput(String(values.get('nextScheduleAt') || '')) });
        onCreated(saved.currentStatus);
      } catch (failure) {
        setError(failure instanceof ApiError && failure.status === 409 ? '이미 등록된 공고입니다. 지원 관리에서 확인해 주세요.'
          : failure instanceof Error ? failure.message : '지원 등록에 실패했습니다.');
      } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}><legend>지원 등록 정보</legend>
        {buttonStatusPicker ? <div className="application-status-field"><span id="registration-status-label">초기 상태</span>
          <div className="application-status-options" role="group" aria-labelledby="registration-status-label">
            {(['PLANNED', 'APPLIED'] as const).map(value => <button key={value} type="button"
              aria-pressed={initial === value} onClick={() => setInitial(value)}>{statusLabels[value]}</button>)}
          </div>
        </div> : <label>초기 상태<select value={initial} onChange={event => setInitial(event.target.value as CreateApplication['status'])}>
          {(['PLANNED', 'APPLIED'] as const).map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
        </select></label>}
        {initial === 'APPLIED' && <label>지원일<input name="appliedDate" type="date" required /></label>}
        <label>다음 확인 일정 (선택)<input name="nextScheduleAt" type="datetime-local" />
          <small>서류 결과 확인이나 면접 준비처럼 다음에 챙길 날짜와 시간입니다.</small>
        </label>
        <label htmlFor="registration-note">메모</label><textarea id="registration-note" name="note" maxLength={2000} rows={3} />
        <div className="application-actions"><button className="button-primary" type="submit">{busy ? '등록 중…' : '지원 기록 저장'}</button>
          <button type="button" onClick={() => setOpen(false)}>취소</button></div>
      </fieldset>
      {error && <><ErrorState message={error} /><a className="button-link" href="#/applications">지원 관리로</a></>}
    </form>}
  </section>;
}
