import type { ReactNode } from 'react';

// Icon paths adapted from Lucide Icons; see LUCIDE-LICENSE.txt for ISC/MIT notices.
const paths = {
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  trash: <><path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  fileText: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M8 13h8M8 17h8" /></>,
  calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  filter: <path d="M4 7h16l-6.5 7.5V20l-3-1.5v-4z" />,
  rotateCcw: <><path d="M3 11a9 9 0 1 1 2.5 7M3 5v6h6" /></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12h20M10 12v2h4v-2" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  monitor: <><rect x="2" y="3" width="20" height="15" rx="2" /><path d="M8 22h8M12 18v4" /></>,
  message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /><path d="M8 10h9M8 14h6" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h1M15 6h1M8 10h1M15 10h1M8 14h1M15 14h1" /></>,
  lightbulb: <><path d="M9 18h6M10 22h4M9 18a6 6 0 1 1 6 0l-1 2h-4z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  pencil: <><path d="m16 5 3 3M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11z" /></>,
  info: <><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7h.01" /></>,
} satisfies Record<string, ReactNode>;

export type LucideIconName = keyof typeof paths;
export function LucideIcon({ name, className = '' }: { name: LucideIconName; className?: string }) {
  return <svg className={`lucide-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {paths[name]}
  </svg>;
}
