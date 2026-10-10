import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, authApi } from '../api';
import { ApiError, createApiClient } from '../api/client';
import type { CurrentUser } from '../api/auth';
import { createNotificationPreferencesApi } from '../api/notification-preferences';
import type { NotificationPreferences } from '../api/notification-preferences';
import { createAccountDeletionApi } from '../api/account-deletion';
import type { DeletionImpact } from '../api/account-deletion';
import { validatePasswordChange, passwordChangeError } from './password-change';
import { ErrorState, LoadingState } from '../components/States';
import settingsArt from '../assets/redesign/cur-14-settings.png';
import './settings.css';

const preferencesApi = createNotificationPreferencesApi(apiRequest);
// A wrong current password returns 401 without ending the session.
const deletionApi = createAccountDeletionApi(createApiClient(import.meta.env.VITE_API_BASE_URL || '/api'));
const message = (failure: unknown) => failure instanceof Error ? failure.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';

export function SettingsPage({ user, onLogout, loggingOut, onPasswordChanged, onSessionExpired }: {
  user: CurrentUser; onLogout: () => void; loggingOut: boolean;
  onPasswordChanged: () => void; onSessionExpired: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>();
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesError, setPreferencesError] = useState('');
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesRetry, setPreferencesRetry] = useState(0);
  const [impact, setImpact] = useState<DeletionImpact>();
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState('');
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [deletionError, setDeletionError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPreferencesLoading(true); setPreferencesError(''); setPreferences(undefined);
    preferencesApi.get(controller.signal).then(value => { if (!controller.signal.aborted) setPreferences(value); })
      .catch(failure => { if (!controller.signal.aborted) {
        if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
        else setPreferencesError(message(failure));
      } }).finally(() => { if (!controller.signal.aborted) setPreferencesLoading(false); });
    return () => controller.abort();
  }, [user.id, preferencesRetry]);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword || loggingOut) return;
    setPasswordError('');
    const validation = validatePasswordChange(currentPassword, newPassword, confirmation);
    if (validation) { setPasswordError(validation); return; }
    setSavingPassword(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      onPasswordChanged();
    } catch (failure) {
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      if (failure instanceof ApiError && failure.status === 401) {
        try {
          await authApi.probeSession();
          setPasswordError('현재 비밀번호가 올바르지 않습니다.');
        } catch (checkFailure) {
          if (checkFailure instanceof ApiError && checkFailure.status === 401) onSessionExpired();
          else setPasswordError(passwordChangeError(checkFailure));
        }
      } else setPasswordError(passwordChangeError(failure));
    } finally { setSavingPassword(false); }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences || savingPreferences) return;
    setPreferencesError(''); setPreferencesMessage(''); setSavingPreferences(true);
    try {
      setPreferences(await preferencesApi.save(preferences));
      setPreferencesMessage('앱 내 알림 수신 설정을 저장했습니다.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      else setPreferencesError(message(failure));
    } finally { setSavingPreferences(false); }
  }

  async function loadImpact() {
    if (impactLoading) return;
    setDeletionOpen(true); setImpactLoading(true); setImpactError(''); setImpact(undefined);
    try { setImpact(await deletionApi.impact()); }
    catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onSessionExpired();
      else setImpactError(message(failure));
    } finally { setImpactLoading(false); }
  }

  async function submitDeletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!impact || deleting || deletionConfirmation !== impact.confirmationText) return;
    setDeletionError('');
    if (new TextEncoder().encode(deletionPassword).length > 72) {
      setDeletionError('현재 비밀번호는 UTF-8 기준 72바이트 이내로 입력해 주세요.'); return;
    }
    setDeleting(true);
    try {
      await deletionApi.delete(deletionPassword, deletionConfirmation);
      setDeletionPassword(''); setDeletionConfirmation('');
      window.dispatchEvent(new Event('devjob:unauthorized'));
      window.location.hash = '/login?accountDeleted=1';
    } catch (failure) {
      setDeletionPassword('');
      if (failure instanceof ApiError && failure.status === 401) {
        try {
          await authApi.probeSession();
          setDeletionError('현재 비밀번호가 올바르지 않습니다. 계정과 기록은 유지됩니다.');
        } catch (checkFailure) {
          if (checkFailure instanceof ApiError && checkFailure.status === 401) onSessionExpired();
          else setDeletionError(message(checkFailure));
        }
      } else setDeletionError(`${message(failure)} 계정과 기록은 유지됩니다. 다시 확인해 주세요.`);
    } finally { setDeleting(false); }
  }

  return <div className="settings-page f02-settings">
    <section className="card f02-settings-intro"><div><span className="eyebrow">ACCOUNT SPACE</span><h2>계정과 기록 관리</h2><p>로그인 정보와 앱 내 알림을 관리하세요.</p></div><img src={settingsArt} alt="" aria-hidden="true" width="120" height="120" /></section>
    <section className="card"><span className="eyebrow">ACCOUNT</span><h2>계정 정보</h2>
      <p>현재 로그인한 계정의 이메일입니다.</p><strong className="settings-email">{user.email}</strong>
      <div className="settings-actions"><a className="button-link" href="#/profile">프로필 수정</a><button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button></div>
    </section>
    <section className="card"><span className="eyebrow">SECURITY</span><h2>비밀번호 변경</h2>
      <p>변경 후 모든 기기에서 로그아웃됩니다. 새 비밀번호로 다시 로그인해 주세요.</p>
      <form className="settings-password-form" onSubmit={submitPassword} aria-busy={savingPassword}><fieldset disabled={savingPassword || loggingOut}>
        <label htmlFor="current-password">현재 비밀번호</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={72} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
        <label htmlFor="new-password">새 비밀번호</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="new-password-help" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
        <p id="new-password-help" className="field-help">8자 이상, UTF-8 기준 72바이트 이내이며 현재 비밀번호와 달라야 합니다.</p>
        <label htmlFor="new-password-confirmation">새 비밀번호 확인</label><input id="new-password-confirmation" type="password" autoComplete="new-password" required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <button className="button-primary" type="submit">{savingPassword ? '변경 중…' : '비밀번호 변경'}</button>
      </fieldset></form>
    </section>
    <section className="card"><span className="eyebrow">IN APP</span><h2>알림 수신 설정</h2><p>면접 시작과 개인 할 일 기한 알림을 앱 내 목록에서 받을지 선택합니다.</p>
      {preferencesLoading ? <LoadingState message="알림 설정을 불러오고 있습니다." /> : preferences && <form className="f02-preferences-form" onSubmit={savePreferences} aria-busy={savingPreferences}>
        <label><input type="checkbox" checked={preferences.interviewReminder} disabled={savingPreferences} onChange={event => { setPreferences({ ...preferences, interviewReminder: event.target.checked }); setPreferencesMessage(''); }} /> 면접 시작 알림</label>
        <label><input type="checkbox" checked={preferences.todoReminder} disabled={savingPreferences} onChange={event => { setPreferences({ ...preferences, todoReminder: event.target.checked }); setPreferencesMessage(''); }} /> 개인 할 일 기한 알림</label>
        <button className="button-primary" disabled={savingPreferences} type="submit">{savingPreferences ? '저장 중…' : '수신 설정 저장'}</button>
      </form>}
      {preferencesError && <ErrorState message={preferencesError} onRetry={() => setPreferencesRetry(value => value + 1)} />}
      {preferencesMessage && <p role="status">{preferencesMessage}</p>}
    </section>
    <section className="card"><span className="eyebrow">YOUR DATA</span><h2>취업 준비 기록</h2>
      <p>프로필, 프로젝트, 관심 공고, 지원 기록은 각각의 관리 화면에서 확인하고 수정할 수 있습니다.</p>
      <div className="settings-links"><a href="#/projects">프로젝트 관리 ↗</a><a href="#/bookmarks">관심 공고 ↗</a><a href="#/applications">지원 관리 ↗</a></div>
    </section>
    <section className="card f02-danger"><span className="eyebrow">DELETE ACCOUNT</span><h2>계정 삭제</h2>
      <p>먼저 삭제되는 개인 기록과 유지되는 공용 데이터를 확인하세요.</p>
      {!deletionOpen && <button type="button" onClick={loadImpact}>삭제 영향 확인</button>}
      {deletionOpen && <><button type="button" onClick={() => { setDeletionOpen(false); setDeletionPassword(''); setDeletionConfirmation(''); setDeletionError(''); }} disabled={deleting}>닫기</button>
        {impactLoading && <LoadingState message="삭제 영향을 확인하고 있습니다." />}
        {impactError && <ErrorState message={impactError} onRetry={loadImpact} />}
        {impact && <><div className="f02-impact"><h3>삭제되는 내 기록</h3><ul>{impact.deletedResources.map(row => <li key={row.code}><span>{row.name}</span><strong>{row.count}건</strong></li>)}</ul>
          <h3>유지되는 공용 데이터</h3><ul>{impact.preservedSharedResources.map(item => <li key={item}>{item}</li>)}</ul>
          <p>{impact.processing}</p><p>{impact.recoverableInApp ? '앱 내 복구 가능' : '앱에서 복구할 수 없습니다.'}</p><p>{impact.externalDataNotice}</p></div>
          <form className="f02-deletion-form" onSubmit={submitDeletion} aria-busy={deleting}><fieldset disabled={deleting}>
            <legend>계정 삭제 재인증</legend><label htmlFor="deletion-password">현재 비밀번호</label>
            <input id="deletion-password" type="password" autoComplete="current-password" maxLength={72} required value={deletionPassword} onChange={event => setDeletionPassword(event.target.value)} />
            <label htmlFor="deletion-confirmation">확인 문구: {impact.confirmationText}</label>
            <input id="deletion-confirmation" type="text" autoComplete="off" required value={deletionConfirmation} onChange={event => setDeletionConfirmation(event.target.value)} />
            {deletionError && <p className="form-error" role="alert">{deletionError}</p>}
            <button className="f02-delete-button" type="submit" disabled={deletionConfirmation !== impact.confirmationText}>{deleting ? '삭제 중…' : '계정 영구 삭제'}</button>
          </fieldset></form></>}
      </>}
    </section>
  </div>;
}
