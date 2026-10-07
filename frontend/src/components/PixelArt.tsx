import type { ReactNode } from 'react';

const icons = {
  home: 'M7 1h2v2h2v2h2v2h2v2h-2v6H3V9H1V7h2V5h2V3h2zM5 9v4h2V9h2v4h2V7H9V5H7v2H5z',
  grid: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
  check: 'M12 3h2v3h-2v2h-2v2H8v2H6v-2H4V8H2V5h2v2h2v2h2V7h2V5h2z',
  empty: 'M3 2h10v2H5v8h6V8H7V6h6v2h2v6H3z',
  error: 'M4 1h8v2h2v10h-2v2H4v-2H2V3h2zM7 4v5h2V4zM7 11v2h2v-2z',
  clock: 'M4 1h8v2h2v10h-2v2H4v-2H2V3h2zM4 4v8h8V4zM7 5h2v3h2v2H7z',
  menu: 'M2 3h12v2H2zM2 7h12v2H2zM2 11h12v2H2z',
  jobs: 'M5 2h6v2h4v9H1V4h4zM7 4h2V3H7zM3 6v5h10V6zM6 7h4v2H6z',
  bookmark: 'M4 1h8v14l-4-3-4 3zM6 3v8l2-2 2 2V3z',
  profile: 'M6 2h4v4H6zM3 9h10v5H3zM5 11v1h6v-1z',
  folder: 'M1 3h5l2 2h7v9H1zM3 7v5h10V7z',
  chart: 'M2 10h2v4H2zM6 7h2v7H6zM10 3h2v11h-2zM14 1h1v13h-1z',
  spark: 'M7 1h2v4h4v2H9v4H7V7H3V5h4zM12 11h2v2h2v1h-2v2h-2v-2h-2v-1h2z',
  calendar: 'M3 1h2v2h6V1h2v2h2v12H1V3h2zM3 6v7h10V6zM5 8h2v2H5z',
} as const;

export type PixelIconName = keyof typeof icons;

// Integer coordinates keep the shared icons sharp at their 16/24px display sizes.
export function PixelIcon({ name }: { name: PixelIconName }) {
  return <svg className="pixel-icon" viewBox="0 0 16 16" fill="currentColor"
    shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <path d={icons[name]} fillRule="evenodd" />
  </svg>;
}

// Original, static chibi companion; no user data, remote assets or growth state.
export function PixelCharacter({ happy = false }: { happy?: boolean }) {
  return <svg className="pixel-character" viewBox="0 0 24 24" shapeRendering="crispEdges"
    aria-hidden="true" focusable="false">
    <path fill="var(--pixel-outline)" d="M7 2h10v1h2v2h1v9h-2v2h-1v2h2v4h-6v-2h-2v2H5v-4h2v-2H6v-2H4V5h1V3h2z" />
    <path fill="var(--pixel-hair)" d="M7 3h10v1h2v6h-2V7h-3V6H9v2H5V5h2z" />
    <path fill="var(--pixel-skin)" d="M9 7h5v1h3v2h2v3h-2v2H7v-2H5V9h4z" />
    <path fill="var(--pixel-outline)" d={happy
      ? 'M7 10h3v1H7zM14 10h3v1h-3zM10 12h4v2h-4z'
      : 'M8 9h1v2H8zM15 9h1v2h-1zM11 12h3v1h-3z'} />
    <path fill="var(--pixel-cheek)" d="M6 12h2v1H6zM16 12h2v1h-2z" />
    <path fill="var(--pixel-shirt)" d="M9 16h6v1h2v3h-3v-2h-4v2H7v-3h2z" />
    <path fill="var(--pixel-skin)" d="M6 17h1v2H6zM17 17h1v2h-1z" />
    <path fill="var(--pixel-outline)" d="M6 21h4v1H6zM14 21h4v1h-4z" />
    <path fill="var(--pixel-highlight)" d="M11 16h2v2h-2z" />
  </svg>;
}

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'error';

export function Badge({ children, tone = 'neutral', icon = 'grid' }: {
  children: ReactNode; tone?: BadgeTone; icon?: PixelIconName;
}) {
  return <span className={`badge badge--${tone}`}><PixelIcon name={icon} />{children}</span>;
}
