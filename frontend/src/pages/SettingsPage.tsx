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
import deletionCat from '../assets/illustrations/settings-deletion-cat.png';
import deletionSecurity from '../assets/illustrations/settings-deletion-security.png';
import './settings.css';

const preferencesApi = createNotificationPreferencesApi(apiRequest);
// A wrong current password returns 401 without ending the session.
const deletionApi = createAccountDeletionApi(createApiClient(import.meta.env.VITE_API_BASE_URL || '/api'));
const message = (failure: unknown) => failure instanceof Error ? failure.message : '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
type SettingsTab = 'notifications' | 'password' | 'account';
type PreferenceRow = { key: NotificationPreferenceKey; title: string; description: string; icon: LucideIconName; tone: string };
const preferenceGroups: { title: string; icon: LucideIconName; rows: PreferenceRow[] }[] = [
  { title: '채용공고 알림', icon: 'bell', rows: [
    { key: 'newJob', title: '새로운 공고 등록 알림', description: '보유 기술과 일치하는 새 공고가 등록되면 알려드립니다.', icon: 'briefcase', tone: 'orange' },
    { key: 'aiJobRecommendation', title: '맞춤 공고 추천 알림', description: '보유 기술과 맞는 공고가 추천되면 알려드립니다.', icon: 'star', tone: 'amber' },
    { key: 'savedJobUpdate', title: '관심 공고 업데이트 알림', description: '저장한 공고의 마감일, 업데이트 등이 있을 때 알려드립니다.', icon: 'bookmark', tone: 'pink' },
  ] },
  { title: '분석 결과 알림', icon: 'chartBar', rows: [
    { key: 'documentAnalysis', title: '이력서·자기소개서 분석 완료 알림', description: '문서 분석이 완료되면 알려드립니다.', icon: 'fileText', tone: 'purple' },
    { key: 'matchAnalysis', title: '공고 분석 결과 알림', description: '요청한 수집 공고 또는 직접 등록 공고의 기술 분석이 완료되면 알려드립니다.', icon: 'target', tone: 'rose' },
    { key: 'semanticRecommendation', title: 'AI 공고 비교 결과 알림', description: '내 이력서·자기소개서와 선택한 공고의 비교가 완료되면 알려드립니다.', icon: 'search', tone: 'mint' },
  ] },
  { title: '기타 알림', icon: 'message', rows: [
    { key: 'learningGoalReminder', title: '학습 목표 리마인드 알림', description: '미완료 목표에 7일간 활동이 없으면 매주 알려드립니다.', icon: 'clock', tone: 'indigo' },
    { key: 'characterActivity', title: '캐릭터 활동/퀘스트 알림', description: '경험치를 얻거나 퀘스트 보상을 받으면 알려드립니다.', icon: 'smile', tone: 'amber' },
    { key: 'serviceNotice', title: '서비스 공지 알림', description: '중요한 서비스 공지사항을 알려드립니다.', icon: 'flag', tone: 'blue' },
  ] },
  { title: '일정 알림', icon: 'calendar', rows: [
    { key: 'interviewReminder', title: '면접 시작 알림', description: '다가오는 면접 일정을 앱에서 알려드립니다.', icon: 'calendar', tone: 'indigo' },
    { key: 'todoReminder', title: '개인 할 일 기한 알림', description: '기한이 가까운 개인 할 일을 알려드립니다.', icon: 'clipboardList', tone: 'blue' },
  ] },
];

const impactIcons: Record<string, { icon: LucideIconName; tone: string }> = {
  semantic_recommendation: { icon: 'search', tone: 'purple' }, document_analysis: { icon: 'fileText', tone: 'blue' },
  resume_version: { icon: 'lock', tone: 'purple' }, cover_letter_version: { icon: 'lock', tone: 'purple' },
  resume: { icon: 'fileText', tone: 'blue' }, cover_letter: { icon: 'fileText', tone: 'blue' },
  notification: { icon: 'bell', tone: 'orange' }, notification_preference: { icon: 'cog', tone: 'blue' },
  interview_schedule: { icon: 'calendar', tone: 'blue' }, application_status_history: { icon: 'clock', tone: 'purple' },
  application: { icon: 'fileText', tone: 'blue' }, user_ai_skill_candidate: { icon: 'star', tone: 'orange' },
  personal_saved_job_analysis: { icon: 'target', tone: 'purple' }, personal_saved_job: { icon: 'bookmark', tone: 'pink' },
  project_skill: { icon: 'link', tone: 'mint' }, project: { icon: 'folderKanban', tone: 'mint' },
  bookmark: { icon: 'bookmark', tone: 'pink' }, user_ai_analysis_request: { icon: 'chartBar', tone: 'blue' },
  user_custom_skill: { icon: 'plus', tone: 'mint' }, user_skill: { icon: 'chartBar', tone: 'purple' },
  profiles: { icon: 'userRound', tone: 'blue' }, personal_todo: { icon: 'check', tone: 'mint' },
  interested_company_tag: { icon: 'tag', tone: 'orange' }, interested_company: { icon: 'building', tone: 'blue' },
  personal_company_tag: { icon: 'tag', tone: 'orange' }, learning_goal: { icon: 'target', tone: 'purple' },
  character_activity: { icon: 'star', tone: 'orange' }, character_reward: { icon: 'star', tone: 'pink' },
  character_equipment: { icon: 'shirt', tone: 'blue' }, users: { icon: 'lock', tone: 'purple' },
};

export function SettingsPage({ user, loggingOut, onPasswordChanged, onSessionExpired }: {
  user: CurrentUser; loggingOut: boolean;
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

  function closeDeletionDetails() {
    setDeletionOpen(false); setDeletionPassword(''); setDeletionConfirmation(''); setDeletionError('');
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
    {tab === 'account' && <section className={`settings-panel settings-panel--compact${deletionOpen ? ' settings-panel--deletion-open' : ''}`} role="tabpanel">
      <div className="settings-panel-title"><LucideIcon name="userRound" /><div><h2>계정 관리</h2>
        <p>계정 삭제 시 어떤 데이터가 삭제되는지 미리 확인할 수 있습니다.</p></div></div>
      <div className="settings-danger-notice"><LucideIcon name="info" /><div><strong>계정 삭제</strong><span>계정을 삭제하면 복구할 수 없으며, 모든 데이터가 영구적으로 삭제됩니다.</span></div></div>
      <div className="settings-account-row"><span className="settings-step">1</span><div><strong>삭제 영향 확인</strong><small>계정 삭제 시 삭제되는 데이터 목록을 미리 확인할 수 있습니다.</small></div></div>
      <div className="settings-account-row"><span className="settings-step">2</span><div><strong>계정 삭제</strong><small>삭제 내용을 확인한 후 계정을 삭제할 수 있습니다.</small></div>
        <button type="button" className="settings-danger-button" onClick={() => { if (!impact) loadImpact(); else setDeletionOpen(true); }}>계정 삭제하기</button></div>
      {deletionOpen && <div className="settings-deletion-details">
        {impactLoading && <LoadingState message="삭제 영향을 확인하고 있습니다." />}
        {impactError && <ErrorState message={impactError} onRetry={loadImpact} />}
        {impact && <>
          <div className="settings-deletion-hero"><img src={deletionCat} alt="" /><div><h3>계정을 삭제하면<br />내 <em>모든 개인 기록이 삭제됩니다.</em></h3>
            <p>지금까지의 기록과 설정이 운영 DB에서 즉시 삭제되며,<br />앱에서 복구할 수 없습니다.</p></div></div>
          <div className="f02-impact"><div className="f02-impact-heading"><span className="f02-impact-heading-icon"><LucideIcon name="trash" /></span>
            <div><h3>삭제되는 내 기록</h3><p>아래 항목의 모든 개인 데이터가 즉시 삭제됩니다.</p></div>
            <strong>총 {impact.deletedResources.length}개 항목</strong></div>
            <div className="f02-impact-grid">{Array.from({ length: 3 }, (_, column) =>
              <ul key={column}>{impact.deletedResources.slice(column * Math.ceil(impact.deletedResources.length / 3), (column + 1) * Math.ceil(impact.deletedResources.length / 3)).map(row => {
                const appearance = impactIcons[row.code] ?? { icon: 'fileText' as const, tone: 'blue' };
                return <li key={row.code}><span className={`f02-impact-icon tone-${appearance.tone}`}><LucideIcon name={appearance.icon} /></span>
                  <span>{row.name}</span><strong>{row.count}건</strong></li>;
              })}</ul>)}</div>
          </div>
          <div className="settings-deletion-warning"><h3><LucideIcon name="info" />탈퇴 후에는 계정을 복구할 수 없습니다.</h3>
            <strong>삭제된 개인 정보와 활동 기록은 되돌릴 수 없습니다.</strong>
            <p>{impact.externalDataNotice}</p>
          </div>
          <form className="f02-deletion-form" onSubmit={submitDeletion} aria-busy={deleting}><fieldset disabled={deleting} aria-label="계정 삭제 재인증">
            <div className="f02-deletion-form-heading"><span><LucideIcon name="lock" /></span><div><h3>계정 삭제 재인증</h3><p>계정 보안을 위해 현재 비밀번호와 확인 문구를 입력해 주세요.</p></div>
              <img src={deletionSecurity} alt="" /></div>
            <div className="f02-deletion-fields"><div className="settings-field"><label htmlFor="deletion-password">현재 비밀번호</label><div className="settings-password-input">
              <input id="deletion-password" type={visiblePasswords['deletion-password'] ? 'text' : 'password'} autoComplete="current-password" maxLength={72} required value={deletionPassword} onChange={event => setDeletionPassword(event.target.value)} />
              <button type="button" className="settings-visibility" aria-label={visiblePasswords['deletion-password'] ? '현재 비밀번호 숨기기' : '현재 비밀번호 표시'}
                onClick={() => setVisiblePasswords(current => ({ ...current, 'deletion-password': !current['deletion-password'] }))}><LucideIcon name={visiblePasswords['deletion-password'] ? 'eyeOff' : 'eye'} /></button></div></div>
              <div className="settings-field"><label htmlFor="deletion-confirmation">확인 문구 <small>계속하려면 ‘{impact.confirmationText}’를 입력하세요.</small></label>
                <input id="deletion-confirmation" type="text" autoComplete="off" required placeholder={impact.confirmationText} value={deletionConfirmation} onChange={event => setDeletionConfirmation(event.target.value)} /></div></div>
            {deletionError && <p className="form-error" role="alert">{deletionError}</p>}
            <div className="f02-deletion-actions"><button type="button" className="f02-deletion-cancel" onClick={closeDeletionDetails}>취소</button>
              <button className="f02-delete-button" type="submit" disabled={deletionConfirmation !== impact.confirmationText}>{deleting ? '삭제 중…' : '모든 기록 삭제하고 계정 탈퇴하기'}</button></div>
          </fieldset></form></>}
      </div>}
      {!deletionOpen && <div className="settings-account-links"><strong>현재 계정</strong><span>{user.email}</span></div>}
    </section>}
  </div>;
}
