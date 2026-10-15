import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { apiRequest } from '../api';
import type { CurrentUser } from '../api/auth';
import { createCharacterApi } from '../api/character';
import type { CharacterState } from '../api/character';
import { characterAppearanceUrl } from './CharacterLayers';
import { PixelIcon } from './PixelArt';
import { LucideIcon } from './LucideIcon';
import brandWordmark from '../assets/redesign/brand-devjob-wordmark-dark.png';
import jobDetailCat from '../assets/redesign/interview-planner-cat.png';

const characters = createCharacterApi(apiRequest);

const groups = [
  { label: '시작하기', links: [
    { href: '#/', label: '대시보드', icon: 'layoutDashboard', active: (path: string) => path === '/' },
    { href: '#/jobs', label: '채용공고', icon: 'briefcase', active: (path: string) => path === '/jobs' || path.startsWith('/jobs/') },
    { href: '#/bookmarks', label: '관심 공고', icon: 'bookmark', active: (path: string) => path.startsWith('/bookmarks') },
    { href: '#/recommendations', label: 'AI 공고 비교', icon: 'search', active: (path: string) => path.startsWith('/recommendations') },
  ] },
  { label: '나의 취업 준비', links: [
    { href: '#/applications', label: '지원 관리', icon: 'clipboardList', active: (path: string) => path.startsWith('/applications') },
    { href: '#/interviews', label: '면접 일정', icon: 'calendar', active: (path: string) => path.startsWith('/interviews') },
    { href: '#/todos', label: '내 할 일', icon: 'list', active: (path: string) => path.startsWith('/todos') },
    { href: '#/companies', label: '기업 관리', icon: 'building', active: (path: string) => path.startsWith('/companies') },
    { href: '#/profile', label: '내 프로필', icon: 'userRound', active: (path: string) => path === '/profile' },
    { href: '#/projects', label: '프로젝트 관리', icon: 'folderKanban', active: (path: string) => path.startsWith('/projects') },
    { href: '#/resumes', label: '이력서', icon: 'fileText', active: (path: string) => path.startsWith('/resumes') },
    { href: '#/cover-letters', label: '자기소개서', icon: 'pencil', active: (path: string) => path.startsWith('/cover-letters') },
  ] },
  { label: '인사이트', links: [
    { href: '#/analytics/skills', label: '채용시장 분석', icon: 'chartBar', active: (path: string) => path === '/analytics/skills' },
    { href: '#/learning-goals', label: '역량 분석 기반 학습', icon: 'flag', active: (path: string) => path.startsWith('/learning-goals') },
    { href: '#/character', label: '내 캐릭터', icon: 'smile', active: (path: string) => path === '/character' },
    { href: '#/notifications', label: '알림', icon: 'bell', active: (path: string) => path === '/notifications' },
    { href: '#/settings', label: '설정', icon: 'cog', active: (path: string) => path === '/settings' },
  ] },
] as const;

// Lucide ArrowLeft/ArrowRight paths, Copyright Lucide Icons and Contributors (ISC).
function SidebarArrow({ direction }: { direction: 'left' | 'right' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    {direction === 'right' ? <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>
      : <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>}
  </svg>;
}

export function Layout({ title, path, children, user, nickname, onLogout, loggingOut }: {
  title: string; path: string; children: ReactNode; user: CurrentUser; nickname: string | null; onLogout: () => void; loggingOut: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
  return <div className={`app-layout${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={event => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>본문으로 이동</a>
    <header className="header">
      <a className="brand" href="#/" aria-label="DevJob 대시보드"><img src={brandWordmark} alt="DevJob" /></a>
      <div className="account-controls">
        <a className={`account-avatar${bunnyOutfit ? ' is-bunny-outfit' : ''}`} href="#/character" aria-label="내 캐릭터 보기">{characterImage}</a>
        <span className="account-email">{nickname || user.email}</span>
        <a className="account-notifications" href="#/notifications" aria-current={path === '/notifications' ? 'page' : undefined}>
          <LucideIcon name="bell" /><span>알림</span>
        </a>
        <button className="account-logout" type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button>
      </div>
    </header>
    <aside className="sidebar max-lg:py-2!">
      <div className="sidebar-toolbar max-lg:mb-0! max-lg:min-h-12!">
        <span className="sidebar-toolbar-title text-xs!">메뉴</span>
        <button className="sidebar-collapse-toggle transition-colors! focus-visible:outline-2! focus-visible:outline-offset-2!" type="button" aria-expanded={!sidebarCollapsed}
          aria-controls="main-navigation" aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={() => setSidebarCollapsed(value => !value)}>
          <SidebarArrow direction={sidebarCollapsed ? 'right' : 'left'} />
        </button>
        <button className="menu-toggle transition-colors! focus-visible:outline-2! focus-visible:outline-offset-2!" type="button" aria-expanded={menuOpen} aria-controls="main-navigation"
          aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'} onClick={() => setMenuOpen(value => !value)}>
          <SidebarArrow direction={menuOpen ? 'left' : 'right'} />
        </button>
      </div>
      <nav id="main-navigation" className={`${menuOpen ? 'is-open' : ''} max-lg:pt-2!`} aria-label="주요 메뉴">
        {groups.map(group => <div className="nav-group gap-1!" key={group.label}>
          {group.links.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} aria-label={link.label}
            title={sidebarCollapsed ? link.label : undefined} aria-current={link.active(path) ? 'page' : undefined}
            className="rounded-[2px]! transition-[background-color,box-shadow,transform]! duration-150! hover:translate-x-0.5! active:translate-x-0! active:scale-[0.98]! active:bg-[#52618e]! active:shadow-[inset_0_0_0_2px_#d7bdff]! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-[var(--sidebar-highlight)]!">
            <LucideIcon name={link.icon} className={`size-[18px]! flex-none! ${link.active(path) ? 'text-[#e2caff]!' : 'text-[#a8bdf0]!'}`} /><span className="sidebar-link-label">{link.label}</span>
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
      {path !== '/' && path !== '/profile' && path !== '/character' && path !== '/settings' && path !== '/analytics/skills' && !path.startsWith('/learning-goals') && !path.startsWith('/interviews/') && !path.startsWith('/jobs/') && !path.startsWith('/recommendations')
        && <div className="page-heading"><span className="eyebrow">MY CAREER SPACE</span><h1>{title}</h1>{path === '/jobs' && <img className="job-search-banner-cat" src={jobDetailCat} alt="" aria-hidden="true" />}</div>}
      {children}
    </main>
  </div>;
}
