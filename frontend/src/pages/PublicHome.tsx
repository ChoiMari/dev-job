import './public-home.css';
import brandWordmark from '../assets/redesign/brand-devjob-wordmark-dark.png';
import lightWordmark from '../assets/redesign/brand-devjob-wordmark-light.png';
import welcomeBanner from '../assets/illustrations/public-home-welcome-banner.png';
import storyPreparation from '../assets/illustrations/public-home-story-preparation-v3.png';
import storyMatch from '../assets/illustrations/public-home-story-match-v3.png';
import storyGrowth from '../assets/illustrations/public-home-story-growth-v3.png';
import storyJourney from '../assets/illustrations/public-home-story-journey-v3.png';

const storyImages = [storyPreparation, storyMatch, storyGrowth, storyJourney];
const serviceIcons = Object.values(import.meta.glob('../assets/illustrations/public-home-service-*.png', { eager: true, query: '?url', import: 'default' })) as string[];

const services = [
  ['채용 공고', '다양한 공고를 검색하고 관심 공고를 저장해요.'],
  ['내 지원 현황', '지원한 공고의 진행 상태를 한눈에 확인해요.'],
  ['할 일 관리', '면접 준비, 서류 작성 등 할 일을 관리해요.'],
  ['기업 관리', '관심 기업을 저장하고 정보를 관리해요.'],
  ['프로젝트', '나의 프로젝트 경험을 기록해요.'],
  ['이력서', '이력서를 작성하고 AI 분석을 받아요.'],
  ['자기소개서', '자기소개서를 작성하고 AI 분석을 받아요.'],
  ['AI 공고 비교', '내 문서와 공고를 비교해 맞춤 공고를 추천받아요.'],
  ['역량 분석 & 학습 목표', '부족한 기술을 확인하고 학습 목표를 설정해요.'],
  ['알림', '면접 일정, 분석 결과 등 중요한 소식을 받아요.'],
  ['내 캐릭터', '활동으로 보상을 받고 캐릭터를 꾸며요.'],
  ['설정', '알림 설정, 비밀번호 변경 등 계정을 관리해요.'],
] as const;

const stories = [
  ['체계적인 취업 준비', '공고 탐색부터 지원, 면접, 학습까지 취업에 필요한 모든 과정을 한 곳에서 관리할 수 있어요.'],
  ['나에게 맞는 맞춤 지원', '보유 기술과 문서를 기반으로 적합한 공고를 추천받고, AI 분석으로 더 효율적으로 준비해요.'],
  ['성장을 위한 기록', '프로젝트, 기술, 학습 목표를 기록하며 오늘보다 더 나은 내일을 만들어가요.'],
  ['함께하는 취업 여정', '중요한 일정과 결과를 놓치지 않도록 알림으로 알려주고, 귀여운 캐릭터가 항상 응원해요.'],
] as const;

export function PublicHome() {
  return <main id="main-content" tabIndex={-1} className="public-home">
    <header className="public-home-header">
      <a className="public-home-brand" href="#/" aria-current="page"><img src={brandWordmark} alt="DevJob" /></a>
      <nav aria-label="계정 메뉴">
        <a className="public-home-login" href="#/login">로그인</a>
        <a className="public-home-register" href="#/register">회원가입</a>
      </nav>
    </header>
    <section className="public-home-hero" aria-labelledby="public-home-title">
      <div className="public-home-hero-copy">
        <img className="public-home-hero-logo" src={lightWordmark} alt="" aria-hidden="true" />
        <h1 id="public-home-title">더 나은 내일을 위한<br />당신의 취업 여정 <br className="public-home-mobile-break" />파트너입니다.</h1>
        <p>공고 탐색부터 지원 관리, 역량 분석과 학습까지<br className="public-home-desktop-break" /> 개발자의 취업 준비를 한 곳에서 도와드려요.</p>
      </div>
    </section>
    <div className="public-home-content">
      <aside className="public-home-welcome">
        <img className="public-home-welcome-banner" src={welcomeBanner} alt="" aria-hidden="true" />
        <div><strong>지금, 당신의 취업 여정을 더 체계적으로 시작해보세요.</strong><span>DevJob은 취업 준비의 모든 단계를 함께합니다.</span></div>
      </aside>
      <section className="public-home-services" aria-labelledby="public-home-services-title">
        <div className="public-home-section-heading"><h2 id="public-home-services-title"><span className="public-home-heading-icon public-home-heading-sprout" aria-hidden="true" />서비스 개요</h2><p>취업 준비에 필요한 다양한 기능을 한 곳에서 제공해요.</p></div>
        <div className="public-home-service-grid">
          {services.map(([title, description], index) => <article className="public-home-service" key={title}>
            <img className="public-home-service-icon" src={serviceIcons[index]} alt="" aria-hidden="true" />
            <h3>{title}</h3><p>{description}</p>
          </article>)}
        </div>
      </section>
      <section className="public-home-stories" aria-labelledby="public-home-stories-title">
        <div className="public-home-section-heading public-home-stories-heading"><h2 id="public-home-stories-title"><span className="public-home-heading-icon public-home-heading-heart" aria-hidden="true" />이 서비스 소개</h2><p>개발자의 취업 준비를 더 쉽고, 더 효율적으로 만들어드려요.</p></div>
        <div className="public-home-story-grid">
          {stories.map(([title, description], index) => <article className="public-home-story" key={title}>
            <img className="public-home-story-image" src={storyImages[index]} alt="" aria-hidden="true" />
            <div className="public-home-story-copy"><h3>{title}</h3><p>{description}</p></div>
          </article>)}
        </div>
      </section>
    </div>
    <footer className="public-home-footer"><p>지금 바로 DevJob과 함께</p><strong>더 나은 내일을 준비해보세요.</strong></footer>
  </main>;
}
