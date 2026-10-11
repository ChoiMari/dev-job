import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api';
import type { CurrentUser } from '../api/auth';
import { createCharacterApi } from '../api/character';
import type { CharacterState } from '../api/character';
import { characterAppearanceUrl } from './CharacterLayers';
import { PixelIcon } from './PixelArt';
import brandWordmark from '../assets/redesign/brand-devjob-wordmark-dark.png';

const characters = createCharacterApi(apiRequest);

const groups = [
  { label: '시작하기', links: [
    { href: '#/', label: '대시보드', icon: 'home', active: (path: string) => path === '/' },
    { href: '#/jobs', label: '채용공고', icon: 'jobs', active: (path: string) => path === '/jobs' || path.startsWith('/jobs/') },
    { href: '#/bookmarks', label: '관심 공고', icon: 'bookmark', active: (path: string) => path.startsWith('/bookmarks') },
    { href: '#/recommendations', label: '의미 기반 추천', icon: 'spark', active: (path: string) => path.startsWith('/recommendations') },
  ] },
  { label: '나의 취업 준비', links: [
    { href: '#/applications', label: '지원 관리', icon: 'calendar', active: (path: string) => path.startsWith('/applications') },
    { href: '#/interviews', label: '면접 일정', icon: 'calendar', active: (path: string) => path.startsWith('/interviews') },
    { href: '#/todos', label: '내 할 일', icon: 'check', active: (path: string) => path.startsWith('/todos') },
    { href: '#/companies', label: '기업 관리', icon: 'grid', active: (path: string) => path.startsWith('/companies') },
    { href: '#/profile', label: '내 프로필', icon: 'profile', active: (path: string) => path === '/profile' },
    { href: '#/projects', label: '프로젝트 관리', icon: 'folder', active: (path: string) => path.startsWith('/projects') },
    { href: '#/resumes', label: '이력서', icon: 'folder', active: (path: string) => path.startsWith('/resumes') },
    { href: '#/cover-letters', label: '자기소개서', icon: 'folder', active: (path: string) => path.startsWith('/cover-letters') },
  ] },
  { label: '인사이트', links: [
    { href: '#/skill-gap', label: '역량 분석', icon: 'spark', active: (path: string) => path === '/skill-gap' },
    { href: '#/analytics/skills', label: '채용시장 분석', icon: 'chart', active: (path: string) => path === '/analytics/skills' },
    { href: '#/learning-goals', label: '학습 목표', icon: 'check', active: (path: string) => path.startsWith('/learning-goals') },
    { href: '#/character', label: '내 캐릭터', icon: 'grid', active: (path: string) => path === '/character' },
    { href: '#/notifications', label: '알림', icon: 'calendar', active: (path: string) => path === '/notifications' },
    { href: '#/settings', label: '설정', icon: 'profile', active: (path: string) => path === '/settings' },
  ] },
] as const;

export function Layout({ title, path, children, user, onLogout, loggingOut }: {
  title: string; path: string; children: ReactNode; user: CurrentUser; onLogout: () => void; loggingOut: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [character, setCharacter] = useState<CharacterState>();
  useEffect(() => {
    const controller = new AbortController();
    setCharacter(undefined);
    characters.state(controller.signal).then(value => {
      if (!controller.signal.aborted) setCharacter(value);
    }).catch(() => { if (!controller.signal.aborted) setCharacter(undefined); });
    return () => controller.abort();
  }, [user.id, path]);
  useEffect(() => {
    const update = (event: Event) => setCharacter((event as CustomEvent<CharacterState>).detail);
    window.addEventListener('devjob:character-updated', update);
    return () => window.removeEventListener('devjob:character-updated', update);
  }, []);
  const appearance = character && characterAppearanceUrl(character.equipment);
  const bunnyOutfit = character?.equipment.OUTFIT === 'BUNNY';
  const characterImage = appearance ? <img src={appearance} alt="" aria-hidden="true" /> : <PixelIcon name="profile" />;
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>본문으로 이동</a>
    <header className="header">
      <a className="brand" href="#/" aria-label="DevJob 대시보드"><img src={brandWordmark} alt="DevJob" /></a>
      <div className="account-controls">
        <a className={`account-avatar${bunnyOutfit ? ' is-bunny-outfit' : ''}`} href="#/character" aria-label="내 캐릭터 보기">{characterImage}</a>
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
          {group.links.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-current={link.active(path) ? 'page' : undefined}>
            <PixelIcon name={link.icon} />{link.label}
          </a>)}
        </div>)}
      </nav>
      <a className="sidebar-companion" href="#/character" aria-label={character ? `내 캐릭터, 레벨 ${character.progress.level}, 경험치 ${character.progress.levelExp}/${character.progress.nextLevelExp}` : '내 캐릭터 보기'}>
        <span className={`sidebar-companion-image${bunnyOutfit ? ' is-bunny-outfit' : ''}`}>{characterImage}</span>
        <span className="sidebar-companion-info"><strong>{character ? `Lv.${character.progress.level}` : '캐릭터 보기'}</strong>
          {character ? <><small>EXP {character.progress.levelExp}/{character.progress.nextLevelExp}</small><span className="sidebar-exp-track"><span style={{ width: `${100 * character.progress.levelExp / character.progress.nextLevelExp}%` }} /></span></> : <small>캐릭터 보러가기</small>}
        </span>
      </a>
    </aside>
    <main id="main-content" tabIndex={-1} className="main-content">
      {path !== '/' && <div className="page-heading"><span className="eyebrow">MY CAREER SPACE</span><h1>{title}</h1></div>}
      {children}
    </main>
  </div>;
}
