import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CurrentUser } from '../api/auth';
import { PixelCharacter, PixelIcon } from './PixelArt';

export function Layout({ title, path, children, user, onLogout, loggingOut }: {
  title: string; path: string; children: ReactNode; user: CurrentUser; onLogout: () => void; loggingOut: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>본문으로 이동</a>
    <header className="header"><a className="brand" href="#/"><PixelIcon name="home" />DEVJOB</a><span className="header-title">{title}</span>
      <div className="account-controls"><span className="account-avatar"><PixelCharacter /></span><span className="account-email">{user.email}</span>
        <button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button>
      </div>
    </header>
    <aside className="sidebar">
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation"
        onClick={() => setMenuOpen(value => !value)}><PixelIcon name="menu" />{menuOpen ? '메뉴 닫기' : '메뉴 열기'}</button>
      <nav id="main-navigation" className={menuOpen ? 'is-open' : ''} aria-label="주요 메뉴">
        <a href="#/" onClick={() => setMenuOpen(false)} aria-current={path === '/' ? 'page' : undefined}><PixelIcon name="home" />대시보드</a>
        <a href="#/profile" onClick={() => setMenuOpen(false)} aria-current={path === '/profile' ? 'page' : undefined}><PixelIcon name="grid" />내 프로필</a>
        <a href="#/projects" onClick={() => setMenuOpen(false)} aria-current={path === '/projects' || path.startsWith('/projects/') ? 'page' : undefined}><PixelIcon name="grid" />프로젝트 관리</a>
        <a href="#/states" onClick={() => setMenuOpen(false)} aria-current={path === '/states' ? 'page' : undefined}><PixelIcon name="grid" />공통 상태 확인</a>
        <a href="#/jobs" onClick={() => setMenuOpen(false)} aria-current={path === '/jobs' || path.startsWith('/jobs/') ? 'page' : undefined}><PixelIcon name="grid" />채용공고</a>
        <a href="#/bookmarks" onClick={() => setMenuOpen(false)} aria-current={path === '/bookmarks' ? 'page' : undefined}><PixelIcon name="check" />관심 공고</a>
        <a href="#/applications" onClick={() => setMenuOpen(false)} aria-current={path === '/applications' || path.startsWith('/applications/') ? 'page' : undefined}><PixelIcon name="grid" />지원 관리</a>
        <a href="#/analytics/skills" onClick={() => setMenuOpen(false)} aria-current={path === '/analytics/skills' ? 'page' : undefined}><PixelIcon name="grid" />채용시장 분석</a>
        <a href="#/skill-gap" onClick={() => setMenuOpen(false)} aria-current={path === '/skill-gap' ? 'page' : undefined}><PixelIcon name="grid" />역량 분석</a>
      </nav>
      <p className="sidebar-note">한 걸음씩 준비하는<br />나의 다음 커리어</p>
    </aside>
    <main id="main-content" tabIndex={-1} className="main-content">
      <h1>{title}</h1>{children}
    </main>
  </div>;
}
