import React from 'react';

const IconPaths: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/><path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></>,
  tag: <><path d="M20 12V6a2 2 0 0 0-2-2h-6L2 14l8 8 10-10Z"/><circle cx="8" cy="8" r="1.5"/></>,
  truck: <><path d="M1 6h14v10H1z"/><path d="M15 10h5l3 3v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
  box: <><path d="m3 8 9-5 9 5v8l-9 5-9-5V8Z"/><path d="M3 8 12 13 21 8"/><path d="M12 13v8"/></>,
  invoice: <><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M15 2v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  report: <><path d="M4 4h16v16H4z"/><path d="M8 16V10"/><path d="M12 16V7"/><path d="M16 16v-4"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  chevronDown: <path d="m6 9 6 6 6-6"/>,
  chevronRight: <path d="m9 6 6 6-6 6"/>,
  chevronLeft: <path d="m15 6-6 6 6 6"/>,
  chevronsLeft: <><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></>,
  chevronsRight: <><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></>,
  menu: <><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M9.9 4.24A10.5 10.5 0 0 1 12 4c6 0 10 7 10 7a14.4 14.4 0 0 1-2.42 3.33"/><path d="M6.61 6.61A14.5 14.5 0 0 0 2 11s4 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="M1 1l22 22"/></>,
  plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  filter: <path d="M3 4h18l-7 9v7l-4-2v-5L3 4Z"/>,
  download: <><path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M3 21h18"/></>,
  moreH: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  arrowUp: <><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>,
  check: <path d="m5 12 5 5L20 7"/>,
  x: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  anchor: <><circle cx="12" cy="5" r="3"/><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></>,
  ship: <><path d="M2 20a5 5 0 0 0 5 1 5 5 0 0 0 5-1 5 5 0 0 1 5 0 5 5 0 0 0 5 1 5 5 0 0 0 2-1"/><path d="M4 18 2 13h20l-2 5"/><path d="M12 10V3H8v3"/><path d="M12 6h6l2 4"/></>,
  layers: <><path d="m12 2 10 6-10 6L2 8l10-6Z"/><path d="m2 14 10 6 10-6"/><path d="m2 11 10 6 10-6"/></>,
  trending: <><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 11h18"/></>,
  logOut: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></>,
  edit: <><path d="M11 4H4v16h16v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></>,
  trash: <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m6 6 1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></>,
  print: <><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1"/><path d="M6 17h12v5H6z"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor"/>,
  lightning: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>,
  sparkline: <path d="M3 14 7 9l3 3 4-6 3 4 4-4"/>,
  activity: <path d="M3 12h4l3-9 4 18 3-9h4"/>,
  flame: <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-3 2-5 5-5 8a6 6 0 0 0 12 0c0-6-4-10-4-13Z"/>,
  thermometer: <><path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0Z"/></>,
  tool: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/></>,
  percent: <><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8" r=".5" fill="currentColor"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></>,
  alertCircle: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></>,
  upload: <><path d="M12 14V3"/><path d="m7 8 5-5 5 5"/><path d="M3 21h18"/></>,
  refreshCcw: <><path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M21 21v-5h-5"/></>,
  moreHorizontal: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  fileX: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m9.5 12.5 5 5"/><path d="m14.5 12.5-5 5"/></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></>,
  warning: <><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  shieldCheck: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  scale: <><path d="M12 3v18"/><path d="M6 21h12"/><path d="M4 8h16"/><path d="m4 8 3 8a3 3 0 1 1-6 0Z"/><path d="m20 8-3 8a3 3 0 1 0 6 0Z"/></>,
  arrowLeft: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></>,
  clipboardList: <><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></>,
  zap: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  chevronUp: <path d="m18 15-6-6-6 6"/>,
  packageOpen: <><path d="M20.9 18.6 12 22l-8.9-3.4A2 2 0 0 1 2 16.8V7.2a2 2 0 0 1 1.1-1.8L12 2l8.9 3.4A2 2 0 0 1 22 7.2v9.6a2 2 0 0 1-1.1 1.8Z"/><path d="M12 22V12"/><path d="m2 7 10 5 10-5"/></>,
  transferH: <><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></>,
  scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12" strokeWidth="2"/></>,
  printer: <><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
  mapPin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
};

export interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, size = 18, stroke = 1.5, className = '', style = {} }: IconProps) {
  const path = IconPaths[name];
  if (!path) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      {path}
    </svg>
  );
}
