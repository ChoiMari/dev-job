export function PublicHome() {
  return <main id="main-content" tabIndex={-1} className="public-home">
    <header className="public-home-header">
      <a className="public-home-brand" href="#/" aria-current="page">DevJob</a>
      <nav aria-label="계정 메뉴">
        <a href="#/login">로그인</a>
        <a className="button-link button-primary" href="#/register">회원가입</a>
      </nav>
    </header>
    <section className="public-home-hero">
      <span className="eyebrow">MY CAREER SPACE</span>
      <h1>취업 준비의 다음 걸음을 한곳에서</h1>
      <p>채용공고를 살펴보고, 지원 과정을 기록하고, 내 역량을 정리해 보세요.</p>
      <div className="public-home-actions">
        <a className="button-link button-primary" href="#/register">시작하기 · 회원가입</a>
        <a className="button-link" href="#/login">기존 계정으로 로그인</a>
      </div>
    </section>
    <section className="public-home-features" aria-label="DevJob에서 할 수 있는 일">
      <article className="card"><h2>공고 탐색</h2><p>채용공고를 찾고 관심 공고를 모아 보세요.</p></article>
      <article className="card"><h2>지원 기록</h2><p>지원 상태와 다음 일정을 한곳에서 관리하세요.</p></article>
      <article className="card"><h2>역량 관리</h2><p>보유 기술과 프로젝트를 정리하고 부족한 역량을 살펴보세요.</p></article>
    </section>
  </main>;
}
