import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { apiRequest, authApi } from '../api';
import { ApiError, createApiClient } from '../api/client';
import type { CurrentUser } from '../api/auth';
import { createNotificationPreferencesApi } from '../api/notification-preferences';
import type { NotificationPreferences } from '../api/notification-preferences';
import type { NotificationPreferenceKey } from '../api/notification-preferences';
import { createAccountDeletionApi } from '../api/account-deletion';
import type { DeletionImpact } from '../api/account-deletion';
import { validatePasswordChange, passwordChangeError } from './password-change';
import { ErrorState, LoadingState } from '../components/States';
import { LucideIcon } from '../components/LucideIcon';
import type { LucideIconName } from '../components/LucideIcon';
import './settings.css';

const preferencesApi = createNotificationPreferencesApi(apiRequest);
// A wrong current password returns 401 without ending the session.
const deletionApi = createAccountDeletionApi(createApiClient(import.meta.env.VITE_API_BASE_URL || '/api'));
const message = (failure: unknown) => failure instanceof Error ? failure.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
type SettingsTab = 'notifications' | 'password' | 'account';
type PreferenceRow = { key: NotificationPreferenceKey; title: string; description: string; icon: LucideIconName; tone: string };
const preferenceGroups: { title: string; icon: LucideIconName; rows: PreferenceRow[] }[] = [
  { title: '채용공고 알림', icon: 'bell', rows: [
    { key: 'newJob', title: '새로운 공고 등록 알림', description: '관심 직무·기술과 관련된 새로운 공고가 등록되면 알려드립니다.', icon: 'briefcase', tone: 'orange' },
    { key: 'aiJobRecommendation', title: 'AI 맞춤 공고 추천 알림', description: '내 이력서와 유사한 공고를 추천받으면 알려드립니다.', icon: 'star', tone: 'amber' },
    { key: 'savedJobUpdate', title: '관심 공고 업데이트 알림', description: '저장한 공고의 마감일, 업데이트 등이 있을 때 알려드립니다.', icon: 'bookmark', tone: 'pink' },
  ] },
  { title: '분석 결과 알림', icon: 'chartBar', rows: [
    { key: 'documentAnalysis', title: '이력서·자기소개서 분석 완료 알림', description: '문서 분석이 완료되면 알려드립니다.', icon: 'fileText', tone: 'purple' },
    { key: 'matchAnalysis', title: '매칭 분석 결과 알림', description: '공고와의 역량 매칭 분석이 완료되면 알려드립니다.', icon: 'target', tone: 'rose' },
    { key: 'semanticRecommendation', title: '의미 기반 추천 결과 알림', description: '맞춤 공고 추천 결과가 준비되면 알려드립니다.', icon: 'search', tone: 'mint' },
  ] },
  { title: '기타 알림', icon: 'message', rows: [
    { key: 'learningGoalReminder', title: '학습 목표 리마인드 알림', description: '설정한 목표의 마감일이 다가오면 알려드립니다.', icon: 'clock', tone: 'indigo' },
    { key: 'characterActivity', title: '캐릭터 활동/퀘스트 알림', description: '퀘스트 완료, 보상 수령 가능 시 알려드립니다.', icon: 'smile', tone: 'amber' },
    { key: 'serviceNotice', title: '서비스 공지 알림', description: '중요한 서비스 공지사항을 알려드립니다.', icon: 'flag', tone: 'blue' },
  ] },
  { title: '일정 알림', icon: 'calendar', rows: [
    { key: 'interviewReminder', title: '면접 시작 알림', description: '다가오는 면접 일정을 앱에서 알려드립니다.', icon: 'calendar', tone: 'indigo' },
    { key: 'todoReminder', title: '개인 할 일 기한 알림', description: '기한이 가까운 개인 할 일을 알려드립니다.', icon: 'clipboardList', tone: 'blue' },
  ] },
];

export function SettingsPage({ user, onLogout, loggingOut, onPasswordChanged, onSessionExpired }: {
  user: CurrentUser; onLogout: () => void; loggingOut: boolean;
  onPasswordChanged: () => void; onSessionExpired: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [tab, setTab] = useState<SettingsTab>('notifications');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
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

  async function savePreference(key: NotificationPreferenceKey, checked: boolean) {
    if (!preferences || savingPreferences) return;
    const previous = preferences;
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    setPreferencesError(''); setPreferencesMessage(''); setSavingPreferences(true);
    try {
      setPreferences(await preferencesApi.save(next));
      setPreferencesMessage('알림 설정이 저장되었습니다.');
    } catch (failure) {
      setPreferences(previous);
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

  const passwordField = (id: string, label: string, value: string, onChange: (value: string) => void, autoComplete: string) =>
    <div className="settings-field"><label htmlFor={id}>{label} <span>*</span></label><div className="settings-password-input">
      <input id={id} type={visiblePasswords[id] ? 'text' : 'password'} autoComplete={autoComplete} required
        minLength={id === 'new-password' ? 8 : undefined} maxLength={72} value={value}
        placeholder={label + '를 입력하세요.'} onChange={event => onChange(event.target.value)} />
      <button type="button" className="settings-visibility" aria-label={visiblePasswords[id] ? label + ' 숨기기' : label + ' 표시'}
        onClick={() => setVisiblePasswords(current => ({ ...current, [id]: !current[id] }))}>
        <LucideIcon name={visiblePasswords[id] ? 'eyeOff' : 'eye'} />
      </button>
    </div></div>;

  return <div className="settings-page f02-settings">
    <header className="settings-heading"><span className="settings-heading-icon"><LucideIcon name="cog" /></span>
      <div><h1>설정</h1><p>계정과 알림, 보안을 관리하세요.</p></div></header>
    <div className="settings-tabs" role="tablist" aria-label="설정 메뉴">
      <button type="button" role="tab" aria-selected={tab === 'notifications'} onClick={() => setTab('notifications')}>알림 설정</button>
      <button type="button" role="tab" aria-selected={tab === 'password'} onClick={() => setTab('password')}>비밀번호 변경</button>
      <button type="button" role="tab" aria-selected={tab === 'account'} onClick={() => setTab('account')}>계정 관리</button>
    </div>
    {tab === 'notifications' && <section className="settings-panel" role="tabpanel">
      <div className="settings-panel-title"><LucideIcon name="bell" /><div><h2>알림 설정</h2><p>필요한 알림만 선택해 보세요. 변경 내용은 즉시 저장됩니다.</p></div></div>
      {preferencesLoading ? <LoadingState message="알림 설정을 불러오고 있습니다." /> : preferences && <div className="settings-preference-groups">
        {preferenceGroups.map(group => <div className="settings-preference-group" key={group.title}>
          <h3><LucideIcon name={group.icon} />{group.title}</h3>
          {group.rows.map(row => <label className="settings-preference-row" key={row.key}>
            <span className={`settings-preference-icon tone-${row.tone}`}><LucideIcon name={row.icon} /></span>
            <span className="settings-preference-copy"><strong>{row.title}</strong><small>{row.description}</small></span>
            <input type="checkbox" className="settings-switch" checked={preferences[row.key]} disabled={savingPreferences}
              onChange={event => savePreference(row.key, event.target.checked)} />
          </label>)}
        </div>)}
      </div>}
      {preferencesError && <ErrorState message={preferencesError} onRetry={() => setPreferencesRetry(value => value + 1)} />}
      {preferencesMessage && <p className="settings-status" role="status">{preferencesMessage}</p>}
      <p className="settings-delivery-note">새 알림 항목은 수신 설정이 저장되며, 알림 발송은 추후 연결됩니다.</p>
      <a className="settings-notification-link" href="#/notifications">알림 목록 보기 <LucideIcon name="arrowRight" /></a>
    </section>}
    {tab === 'password' && <section className="settings-panel settings-panel--compact" role="tabpanel">
      <div className="settings-panel-title"><LucideIcon name="lock" /><div><h2>비밀번호 변경</h2>
        <p>안전한 계정을 위해 정기적으로 비밀번호를 변경하세요.</p></div></div>
      <form className="settings-password-form" onSubmit={submitPassword} aria-busy={savingPassword}>
        <fieldset disabled={savingPassword || loggingOut}>
          {passwordField('current-password', '현재 비밀번호', currentPassword, setCurrentPassword, 'current-password')}
          {passwordField('new-password', '새 비밀번호', newPassword, setNewPassword, 'new-password')}
          <ul id="new-password-help" className="settings-password-rules">
            <li className={newPassword.length >= 8 ? 'is-met' : ''}><LucideIcon name="check" />8자 이상 입력하세요.</li>
            <li><LucideIcon name="info" />UTF-8 기준 72바이트 이내로 입력하세요.</li>
            <li className={!!newPassword && newPassword !== currentPassword ? 'is-met' : ''}><LucideIcon name="check" />현재 비밀번호와 다른 비밀번호를 입력하세요.</li>
          </ul>
          {passwordField('new-password-confirmation', '새 비밀번호 확인', confirmation, setConfirmation, 'new-password')}
          <p className="settings-security-note">변경 후 모든 기기에서 로그아웃됩니다. 새 비밀번호로 다시 로그인해 주세요.</p>
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
          <button className="button-primary settings-submit" type="submit">{savingPassword ? '변경 중…' : '비밀번호 변경하기'}</button>
        </fieldset>
      </form>
    </section>}
    {tab === 'account' && <section className="settings-panel settings-panel--compact" role="tabpanel">
      <div className="settings-panel-title"><LucideIcon name="userRound" /><div><h2>계정 관리</h2>
        <p>계정 삭제 시 어떤 데이터가 삭제되는지 미리 확인할 수 있습니다.</p></div></div>
      <div className="settings-danger-notice"><LucideIcon name="info" /><div><strong>계정 삭제</strong><span>계정을 삭제하면 복구할 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.</span></div></div>
      <div className="settings-account-row"><span className="settings-step">1</span><div><strong>삭제 영향 확인</strong><small>계정 삭제 시 삭제되는 데이터 목록을 미리 확인할 수 있습니다.</small></div>
        <button type="button" onClick={loadImpact} disabled={impactLoading}>삭제 영향 보기</button></div>
      <div className="settings-account-row"><span className="settings-step">2</span><div><strong>계정 삭제</strong><small>삭제 내용을 확인한 후 계정을 삭제할 수 있습니다.</small></div>
        <button type="button" className="settings-danger-button" onClick={() => { if (!impact) loadImpact(); else setDeletionOpen(true); }}>계정 삭제하기</button></div>
      {deletionOpen && <div className="settings-deletion-details"><button type="button" onClick={() => { setDeletionOpen(false); setDeletionPassword(''); setDeletionConfirmation(''); setDeletionError(''); }} disabled={deleting}>닫기</button>
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
      </div>}
      <div className="settings-account-links"><strong>현재 계정</strong><span>{user.email}</span><a href="#/profile">프로필 수정</a>
        <button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button></div>
      <div className="settings-record-links"><a href="#/projects">프로젝트 관리</a><a href="#/bookmarks">관심 공고</a><a href="#/applications">지원 관리</a></div>
    </section>}
  </div>;
}
