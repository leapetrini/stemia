'use client';

const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5a2 2 0 0 1 4 0V21h3.5a1 1 0 0 0 1-1V9.5',
  calendar: 'M7 3v3M17 3v3M3.5 8.5h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5Z',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  chat: 'M20.5 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.8-5.4A7.5 7.5 0 1 1 20.5 11.5Z',
  box: 'M3.5 7.5 12 3l8.5 4.5M3.5 7.5 12 12m-8.5-4.5v9L12 21m0-9 8.5-4.5M12 12v9m8.5-13.5v9L12 21',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-2.5 9-2.5 9h17S18 15 18 8ZM10.5 21a1.8 1.8 0 0 0 3 0',
  chevL: 'M14.5 5 8 12l6.5 7',
  chevR: 'M9.5 5 16 12l-6.5 7',
  chevDown: 'M5 9.5 12 16l7-6.5',
  more: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
  moreH: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  filter: 'M4 6h16M7 12h10M10 18h4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2',
  phone: 'M6.5 4h-2A1.5 1.5 0 0 0 3 5.6 16 16 0 0 0 18.4 21a1.5 1.5 0 0 0 1.6-1.5v-2a1.2 1.2 0 0 0-1-1.2l-2.6-.5a1.2 1.2 0 0 0-1.2.5l-.7 1A12.5 12.5 0 0 1 8.2 11l1-.7a1.2 1.2 0 0 0 .5-1.2l-.5-2.6A1.2 1.2 0 0 0 8 5.5Z',
  pin: 'M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  mail: 'M3.5 6.5h17v11h-17zM4 7l8 6 8-6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z',
  camera: 'M4.5 8.5h2l1.3-2h8.4l1.3 2h2A1.5 1.5 0 0 1 21 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V10a1.5 1.5 0 0 1 1.5-1.5ZM12 17a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 12 17Z',
  file: 'M6 3h7l5 5v12.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-17A.5.5 0 0 1 6 3ZM13 3v5h5',
  check: 'M5 12.5 10 17 19 7',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12l2.5 2.5 4.5-5',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM14 6l4 4',
  syringe: 'M14 3l7 7M18 6l-9 9-3 .7L5 18l-1.5 1.5M8 13l5 5M11.5 9.5l3 3',
  droplet: 'M12 3.5s6 6.3 6 10.5a6 6 0 1 1-12 0c0-4.2 6-10.5 6-10.5Z',
  heart: 'M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6ZM9 12l2 2 4-4',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  star: 'M12 3.5l2.5 5.6 6 .6-4.5 4 1.3 6-5.3-3.2L6.7 19.7l1.3-6-4.5-4 6-.6Z',
  sliders: 'M4 8h9M17 8h3M4 16h3M11 16h9M14 5.5v5M9 13.5v5',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  logout: 'M15 4h3a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-3M10 8l-4 4 4 4M5.5 12H15',
  lock: 'M6.5 10.5V8a5.5 5.5 0 0 1 11 0v2.5M5.5 10.5h13a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1ZM12 15v2',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  send: 'M21 4 3 11l6.5 2.5M21 4l-7 17-2.5-7.5M21 4 9.5 13.5',
  alert: 'M12 3 2.5 20h19L12 3ZM12 10v4M12 17.5h.01',
  trend: 'M3 17l5-5 3 3 7-8M15 7h5v5',
  refresh: 'M20 8a8 8 0 1 0 1 6M20 4v4h-4',
  dots3: 'M5 12h.01M12 12h.01M19 12h.01',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 12a7.5 7.5 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2l-.4-2.6H8.5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h6.9l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  flask: 'M9 3h6M10 3v6L5.5 18a1.5 1.5 0 0 0 1.4 2.2h10.2A1.5 1.5 0 0 0 18.5 18L14 9V3M8 14h8',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  image: 'M4.5 4.5h15v15h-15zM4.5 16l4-4 3 3 4-5 4 5M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
};

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
  fill?: string;
  className?: string;
}

export function Icon({ name, size = 22, stroke = 1.7, color = 'currentColor', fill = 'none', className }: IconProps) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} className={className}
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Mark({ size = 40, color = '#0f4a3a', gold = '#b9974f' }: { size?: number; color?: string; gold?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="3" y="3" width="42" height="42" rx="11" stroke={gold} strokeWidth="1.3" opacity="0.9" />
      <path d="M30.5 17.5c-1.2-1.8-3.4-2.9-6-2.9-3.4 0-6 1.9-6 4.6 0 6 12.5 3.4 12.5 9.6 0 2.9-2.8 4.9-6.5 4.9-2.9 0-5.4-1.2-6.7-3.2"
        stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
