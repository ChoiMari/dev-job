import type { CurrentUser } from '../api/auth';

export function SettingsPage({ user, onLogout, loggingOut }: { user: CurrentUser; onLogout: () => void; loggingOut: boolean }) {
  return <div className="settings-page">
    <section className="card">
      <span className="eyebrow">ACCOUNT</span><h2>계정 정보</h2>
      <p>현재 로그인한 계정의 이메일입니다.</p>
      <strong className="settings-email">{user.email}</strong>
      <div className="settings-actions"><a className="button-link" href="#/profile">프로필 수정</a><button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button></div>
    </section>
    <section className="card">
      <span className="eyebrow">YOUR DATA</span><h2>취업 준비 기록</h2>
      <p>프로필, 프로젝트, 관심 공고, 지원 기록은 각각의 관리 화면에서 확인하고 수정할 수 있습니다.</p>
      <div className="settings-links"><a href="#/projects">프로젝트 관리 ↗</a><a href="#/bookmarks">관심 공고 ↗</a><a href="#/applications">지원 관리 ↗</a></div>
    </section>
    <p className="settings-note">알림, 비밀번호 변경, 계정 삭제 설정은 현재 제공되지 않습니다.</p>
  </div>;
}
