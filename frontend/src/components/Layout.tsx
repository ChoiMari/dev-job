import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CurrentUser } from '../api/auth';
import { PixelCharacter, PixelIcon } from './PixelArt';

const groups = [
  { label: '시작하기', links: [
    { href: '#/', label: '대시보드', icon: 'home', active: (path: string) => path === '/' },
    { href: '#/jobs', label: '채용공고', icon: 'jobs', active: (path: string) => path === '/jobs' || path.startsWith('/jobs/') },
    { href: '#/bookmarks', label: '관심 공고', icon: 'bookmark', active: (path: string) => path === '/bookmarks' },
  ] },
  { label: '나의 취업 준비', links: [
    { href: '#/applications', label: '지원 관리', icon: 'calendar', active: (path: string) => path.startsWith('/applications') },
    { href: '#/todos', label: '내 할 일', icon: 'check', active: (path: string) => path.startsWith('/todos') },
    { href: '#/companies', label: '기업 관리', icon: 'grid', active: (path: string) => path.startsWith('/companies') },
    { href: '#/profile', label: '내 프로필', icon: 'profile', active: (path: string) => path === '/profile' },
    { href: '#/projects', label: '프로젝트 관리', icon: 'folder', active: (path: string) => path.startsWith('/projects') },
  ] },
  { label: '인사이트', links: [
    { href: '#/skill-gap', label: '역량 분석', icon: 'spark', active: (path: string) => path === '/skill-gap' },
    { href: '#/analytics/skills', label: '채용시장 분석', icon: 'chart', active: (path: string) => path === '/analytics/skills' },
    { href: '#/character', label: '내 캐릭터', icon: 'grid', active: (path: string) => path === '/character' },
    { href: '#/settings', label: '설정', icon: 'profile', active: (path: string) => path === '/settings' },
  ] },
] as const;

export function Layout({ title, path, children, user, onLogout, loggingOut }: {
  title: string; path: string; children: ReactNode; user: CurrentUser; onLogout: () => void; loggingOut: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>본문으로 이동</a>
    <header className="header">
      <a className="brand" href="#/"><span className="brand-mark"><PixelIcon name="spark" /></span><span>DevJob<small>CAREER STUDIO</small></span></a>
      <span className="header-title">오늘도 한 걸음, 내 커리어를 향해</span>
      <div className="account-controls">
        <span className="account-avatar"><PixelCharacter /></span>
        <span className="account-email">{user.email}</span>
        <button type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button>
      </div>
    </header>
    <aside className="sidebar">
      <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(value => !value)}>
        <PixelIcon name="menu" />{menuOpen ? '메뉴 닫기' : '메뉴 열기'}
      </button>
      <nav id="main-navigation" className={menuOpen ? 'is-open' : ''} aria-label="주요 메뉴">
        {groups.map(group => <div className="nav-group" key={group.label}>
          <span className="nav-group-label">{group.label}</span>
          {group.links.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-current={link.active(path) ? 'page' : undefined}>
            <PixelIcon name={link.icon} />{link.label}
          </a>)}
        </div>)}
      </nav>
      <div className="sidebar-companion" aria-hidden="true"><PixelCharacter /><p>작은 기록이 모여<br /><strong>다음 기회가 돼요.</strong></p></div>
    </aside>
    <main id="main-content" tabIndex={-1} className="main-content">
      {path !== '/' && <div className="page-heading"><span className="eyebrow">MY CAREER SPACE</span><h1>{title}</h1></div>}
      {children}
    </main>
  </div>;
}
