import { mix, lum } from './util.js';
import { KINDS, MAX_KIND_NAME, setKindPrefs } from './kinds.js';

// 프리셋은 배경색 + 포인트색 두 가지만 정하면 나머지 색은 자동 계산돼요
export const PRESETS = [
  { id: 'cream',    name: '기본',     bg: '#f1f8f5', accent: '#678e85' },
  { id: 'mint',     name: '민트',     bg: '#f1f8f5', accent: '#2f9e84' },
  { id: 'lavender', name: '라벤더',   bg: '#f6f3fb', accent: '#7c5cd6' },
  { id: 'rose',     name: '로즈',     bg: '#fdf2f4', accent: '#d6456b' },
  { id: 'sky',      name: '하늘',     bg: '#f1f6fd', accent: '#3a7bd5' },
  { id: 'paper',    name: '페이퍼',   bg: '#ffffff', accent: '#26262b' },
  { id: 'midnight', name: '미드나잇', bg: '#14151c', accent: '#8b9cff' },
  { id: 'forest',   name: '포레스트', bg: '#121a17', accent: '#6fcf97' },
  { id: 'mocha',    name: '모카',     bg: '#1f1a17', accent: '#e0a46a' },
  { id: 'noir',     name: '누아르',   bg: '#0e0e10', accent: '#ff7a9c' },
];

export const FONTS = {
  sans:  { name: '깔끔한 고딕', stack: "'Pretendard Variable', Pretendard, system-ui, -apple-system, 'Segoe UI', sans-serif" },
  serif: { name: '단정한 명조', stack: "'Noto Serif KR', 'Nanum Myeongjo', Georgia, serif" },
  round: { name: '말랑한 둥근체', stack: "'Gowun Dodum', 'Pretendard Variable', system-ui, sans-serif" },
  mono:  { name: '코드 느낌', stack: "'JetBrains Mono', 'D2Coding', ui-monospace, 'Pretendard Variable', monospace" },
};

export const LAYOUTS = {
  list:    '리스트',
  grid:    '카드 그리드',
  masonry: '갤러리',
  journal: '저널',
};

export const RADII = { sharp: '4px', soft: '14px', round: '26px' };
export const HEADERS = { center: '가운데', left: '왼쪽', banner: '배너' };

/** 글 종류별 { show: 다른 사람에게 보이기, name: 바꾼 이름('' = 기본 이름) } */
export function sanitizeKinds(k) {
  const out = {};
  for (const key of Object.keys(KINDS)) {
    const x = k && typeof k === 'object' ? k[key] : null;
    out[key] = { show: x?.show !== false, name: typeof x?.name === 'string' ? x.name.trim().slice(0, MAX_KIND_NAME) : '' };
  }
  return out;
}

export const DEFAULT_THEME = {
  preset: 'cream', bg: '#f1f8f5', accent: '#678e85',
  font: 'sans', layout: 'list', radius: 'soft', header: 'center',
  avatar: '', banner: '', kinds: sanitizeKinds(null),
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 저장된(또는 남의) 테마를 안전한 값으로 정리 */
export function sanitizeTheme(t) {
  t = t || {};
  const d = DEFAULT_THEME;
  return {
    preset: typeof t.preset === 'string' ? t.preset : d.preset,
    // 예전 기본 배경(크림색)을 그대로 저장해 둔 계정도 새 기본 배경으로 바뀌어요
    bg: HEX.test(t.bg) ? (t.preset === 'cream' && t.bg.toLowerCase() === '#faf6f0' ? d.bg : t.bg) : d.bg,
    // 예전 기본 포인트색(주황)을 그대로 저장해 둔 계정도 새 기본색으로 바뀌어요
    accent: HEX.test(t.accent) ? (t.preset === 'cream' && t.accent.toLowerCase() === '#c2713c' ? d.accent : t.accent) : d.accent,
    font: FONTS[t.font] ? t.font : d.font,
    layout: LAYOUTS[t.layout] ? t.layout : d.layout,
    radius: RADII[t.radius] ? t.radius : d.radius,
    header: HEADERS[t.header] ? t.header : d.header,
    avatar: typeof t.avatar === 'string' ? t.avatar : '',
    banner: typeof t.banner === 'string' ? t.banner : '',
    kinds: sanitizeKinds(t.kinds),
  };
}

export function palette(bg, accent) {
  const dark = lum(bg) < 0.35;
  const text = dark ? mix(bg, '#ffffff', 0.9) : mix(bg, '#000000', 0.84);
  return {
    dark, bg, accent, text,
    surface: dark ? mix(bg, '#ffffff', 0.05) : mix(bg, '#ffffff', 0.65),
    border: dark ? mix(bg, '#ffffff', 0.12) : mix(bg, '#000000', 0.09),
    muted: mix(text, bg, dark ? 0.42 : 0.5),
    accentSoft: mix(bg, accent, dark ? 0.24 : 0.14),
    onAccent: lum(accent) > 0.5 ? '#14110f' : '#ffffff',
  };
}

export function applyTheme(raw) {
  const t = sanitizeTheme(raw);
  setKindPrefs(t.kinds);
  const p = palette(t.bg, t.accent);
  const s = document.documentElement.style;
  s.setProperty('--bg', p.bg);
  s.setProperty('--surface', p.surface);
  s.setProperty('--text', p.text);
  s.setProperty('--muted', p.muted);
  s.setProperty('--border', p.border);
  s.setProperty('--accent', p.accent);
  s.setProperty('--accent-soft', p.accentSoft);
  s.setProperty('--on-accent', p.onAccent);
  s.setProperty('--radius', RADII[t.radius]);
  s.setProperty('--font', FONTS[t.font].stack);
  document.documentElement.dataset.mode = p.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg);
  return t;
}
