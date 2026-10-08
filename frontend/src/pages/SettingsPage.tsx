import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi } from '../api';
import { ApiError } from '../api/client';
import type { CurrentUser } from '../api/auth';
import { validatePasswordChange, passwordChangeError } from './password-change';

export function SettingsPage({ user, onLogout, loggingOut, onPasswordChanged, onSessionExpired }: {
  user: CurrentUser; onLogout: () => void; loggingOut: boolean;
  onPasswordChanged: () => void; onSessionExpired: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loggingOut) return;
    setPasswordError('');
    const validation = validatePasswordChange(currentPassword, newPassword, confirmation);
    if (validation) { setPasswordError(validation); return; }
    setSaving(true);
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
    } finally { setSaving(false); }
  }

  return <div className="settings-page">
    <section className="card">
      <span className="eyebrow">ACCOUNT</span><h2>계정 정보</h2>
      <p>현재 로그인한 계정의 이메일입니다.</p>
      <strong className="settings-email">{user.email}</strong>
      <div className="settings-actions"><a className="button-link" href="#/profile">프로필 수정</a><button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button></div>
    </section>
    <section className="card">
      <span className="eyebrow">SECURITY</span><h2>비밀번호 변경</h2>
      <p>변경 후 모든 기기에서 로그아웃됩니다. 새 비밀번호로 다시 로그인해 주세요.</p>
      <form className="settings-password-form" onSubmit={submitPassword} aria-busy={saving}>
        <fieldset disabled={saving || loggingOut}>
          <label htmlFor="current-password">현재 비밀번호</label>
          <input id="current-password" name="currentPassword" type="password" autoComplete="current-password"
            required maxLength={72} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
          <label htmlFor="new-password">새 비밀번호</label>
          <input id="new-password" name="newPassword" type="password" autoComplete="new-password"
            required minLength={8} maxLength={72} aria-describedby="new-password-help"
            value={newPassword} onChange={event => setNewPassword(event.target.value)} />
          <p id="new-password-help" className="field-help">8자 이상, UTF-8 기준 72바이트 이내이며 현재 비밀번호와 달라야 합니다.</p>
          <label htmlFor="new-password-confirmation">새 비밀번호 확인</label>
          <input id="new-password-confirmation" name="newPasswordConfirmation" type="password" autoComplete="new-password"
            required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
          <button className="button-primary" type="submit">{saving ? '변경 중…' : '비밀번호 변경'}</button>
        </fieldset>
      </form>
    </section>
    <section className="card">
      <span className="eyebrow">YOUR DATA</span><h2>취업 준비 기록</h2>
      <p>프로필, 프로젝트, 관심 공고, 지원 기록은 각각의 관리 화면에서 확인하고 수정할 수 있습니다.</p>
      <div className="settings-links"><a href="#/projects">프로젝트 관리 ↗</a><a href="#/bookmarks">관심 공고 ↗</a><a href="#/applications">지원 관리 ↗</a></div>
    </section>
    <p className="settings-note">알림과 계정 삭제 설정은 현재 제공되지 않습니다.</p>
  </div>;
}
