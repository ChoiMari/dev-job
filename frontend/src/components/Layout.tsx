import type { ReactNode } from 'react';

export function Layout({ title, path, children }: { title: string; path: string; children: ReactNode }) {
  return <div className="app-layout">
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }}>본문으로 이동</a>
    <header className="header"><a className="brand" href="#/">DEVJOB</a><span>{title}</span></header>
    <aside className="sidebar">
      <nav aria-label="주요 메뉴">
        <a href="#/" aria-current={path === '/' ? 'page' : undefined}><span aria-hidden="true">⌂</span> 기본 화면</a>
        <a href="#/states" aria-current={path === '/states' ? 'page' : undefined}><span aria-hidden="true">◇</span> 공통 상태 확인</a>
      </nav>
    </aside>
    <main id="main-content" tabIndex={-1} className="main-content">
      <h1>{title}</h1>{children}
    </main>
  </div>;
}
