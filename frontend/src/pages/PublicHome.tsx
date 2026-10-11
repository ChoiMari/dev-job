import './public-home.css';
import publicScene from '../assets/redesign/cur-15-developer-at-work.png';
import brandWordmark from '../assets/redesign/brand-devjob-wordmark-dark.png';
import { PixelIcon } from '../components/PixelArt';

export function PublicHome() {
  return <main id="main-content" tabIndex={-1} className="public-home">
    <header className="public-home-header">
      <a className="public-home-brand" href="#/" aria-current="page"><img src={brandWordmark} alt="DevJob" width="150" height="44" /></a>
      <nav aria-label="계정 메뉴">
        <a href="#/login">로그인</a>
        <a className="button-link button-primary" href="#/register">회원가입</a>
      </nav>
    </header>
    <section className="public-home-hero" aria-labelledby="public-home-title">
      <div className="public-home-copy">
        <span className="public-home-kicker"><PixelIcon name="spark" /> DEVELOPER CAREER SPACE</span>
        <h1 id="public-home-title">개발자 취업 준비,<br />한 걸음씩 쌓아가요</h1>
        <p>공고 탐색부터 지원 기록, 역량 관리까지. 개발자 취업 준비를 한곳에서 이어 보세요.</p>
        <div className="public-home-path" aria-label="DevJob 사용 흐름">
          <span>공고 탐색</span><span aria-hidden="true">→</span>
          <span>지원 관리</span><span aria-hidden="true">→</span>
          <span>역량 성장</span>
        </div>
      </div>
      <div className="public-home-art">
        <img className="public-home-scene" src={publicScene} alt="" aria-hidden="true" width="1672" height="941"
          onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
        <span className="public-home-art-label" aria-hidden="true"><PixelIcon name="spark" /> YOUR NEXT STEP</span>
      </div>
    </section>
    <section className="public-home-journey" aria-labelledby="public-home-journey-title">
      <div className="public-home-section-heading">
        <span className="public-home-section-tag">01 / CAREER TOOLKIT</span>
        <h2 id="public-home-journey-title">개발자 취업의 전 과정을 한곳에서</h2>
        <p>찾고, 기록하고, 다음에 무엇을 할지 정리할 수 있어요.</p>
      </div>
      <div className="public-home-features">
        <article className="public-home-feature">
          <span className="public-home-feature-icon"><PixelIcon name="jobs" /></span>
          <span className="public-home-feature-number">01</span>
          <h3>맞는 공고 찾기</h3>
          <p>채용공고를 탐색하고 관심 공고를 모아 비교해 보세요.</p>
          <span className="public-home-feature-foot">공고 탐색 · 관심 공고</span>
        </article>
        <article className="public-home-feature">
          <span className="public-home-feature-icon"><PixelIcon name="calendar" /></span>
          <span className="public-home-feature-number">02</span>
          <h3>지원 과정 기록하기</h3>
          <p>지원 상태와 면접 일정, 다음 할 일을 함께 관리하세요.</p>
          <span className="public-home-feature-foot">지원 기록 · 면접 · 알림</span>
        </article>
        <article className="public-home-feature">
          <span className="public-home-feature-icon"><PixelIcon name="chart" /></span>
          <span className="public-home-feature-number">03</span>
          <h3>내 역량 키워가기</h3>
          <p>기술과 프로젝트를 정리하고 학습 목표를 세워 보세요.</p>
          <span className="public-home-feature-foot">프로필 · 기술 · 학습 목표</span>
        </article>
      </div>
    </section>
    <section className="public-home-more" aria-labelledby="public-home-more-title">
      <div>
        <span className="public-home-section-tag">02 / MORE TO EXPLORE</span>
        <h2 id="public-home-more-title">준비한 내용을 다음 선택으로 연결해요</h2>
        <p>이력서와 자기소개서를 버전별로 정리하고, 분석과 추천 결과를 참고해 다음 공고를 살펴볼 수 있어요.</p>
      </div>
      <ul>
        <li><PixelIcon name="folder" /> 문서 버전 관리</li>
        <li><PixelIcon name="spark" /> 문서 분석 · 공고 추천</li>
        <li><PixelIcon name="check" /> 학습 목표 · 성장 기록</li>
      </ul>
    </section>
  </main>;
}
