import { mix, lum } from './util.js';
import { KINDS, MAX_KIND_NAME, setKindPrefs } from './kinds.js';
import { safeUrl } from './imgbb.js';

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

// 스킨 글꼴: 스킨마다 제목 · 꾸밈(메뉴·라벨) · 본문 글꼴을 따로 골라요 ('' = 스킨 기본)
export const SKIN_FONTS = {
  '':        { name: '스킨 기본', stack: '' },
  pixel:     { name: '갈무리 픽셀', stack: "Galmuri11, 'Pretendard Variable', sans-serif" },
  pixelbig:  { name: '갈무리 큰 픽셀', stack: 'Galmuri14, Galmuri11, sans-serif' },
  pixelmono: { name: '갈무리 모노', stack: 'GalmuriMono11, Galmuri11, monospace' },
  sans:      { name: FONTS.sans.name, stack: FONTS.sans.stack },
  serif:     { name: FONTS.serif.name, stack: FONTS.serif.stack },
  round:     { name: FONTS.round.name, stack: FONTS.round.stack },
  mono:      { name: FONTS.mono.name, stack: FONTS.mono.stack },
};
export const SKIN_FONT_SLOTS = ['title', 'ui', 'body'];

// 배경음악 (유튜브): 곡 목록 + 섞기 + 자동 재생 시도 + 기본 볼륨
export const MAX_BGM = 20;
export function sanitizeBgm(b) {
  const x = b && typeof b === 'object' ? b : {};
  const seen = new Set();
  const tracks = (Array.isArray(x.tracks) ? x.tracks : [])
    .filter((t) => t && typeof t.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(t.id) && !seen.has(t.id) && seen.add(t.id))
    .slice(0, MAX_BGM)
    .map((t) => ({ id: t.id, t: typeof t.t === 'string' ? t.t.trim().slice(0, 80) : '' }));
  const vol = Number(x.vol);
  return { on: x.on !== false, tracks, shuffle: !!x.shuffle, auto: !!x.auto, vol: Number.isFinite(vol) ? Math.max(0, Math.min(100, Math.round(vol))) : 60 };
}
function sanitizeSkinFonts(f) {
  const out = {};
  if (!f || typeof f !== 'object') return out;
  for (const sk of Object.keys(SKINS)) {
    if (!sk || !f[sk] || typeof f[sk] !== 'object') continue;
    const one = {};
    for (const slot of SKIN_FONT_SLOTS) if (typeof f[sk][slot] === 'string' && f[sk][slot] && SKIN_FONTS[f[sk][slot]]) one[slot] = f[sk][slot];
    if (Object.keys(one).length) out[sk] = one;
  }
  return out;
}

export const LAYOUTS = {
  list:    '리스트',
  grid:    '카드 그리드',
  masonry: '갤러리',
  journal: '저널',
};

// 스킨: 페이지 스킨 / 프롬 모음(글 목록) / 프롬창(글 보기)
export const SKINS = { '': '없음', home: '홈페이지', term: '터미널', game: '픽셀 아케이드', grid: '그리드 타이틀', chart: '천문 지도', probe: '관측 기록', space: '우주 유영' };
export const SHELVES = { '': '위 배치 그대로', records: '레코드 진열', drawer: '서랍', folders: '폴더 인덱스', stars: '별자리', planets: '행성', log: '관측 로그' };
export const PVIEWS = { '': '기본', float: '유영', card: '신분증', pass: '여권', signal: '교신' };
const pick = (map, v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(map, v) ? v : '');

export const RADII = { sharp: '4px', soft: '14px', round: '26px' };
export const HEADERS = { center: '가운데', left: '왼쪽', banner: '대문 배너' };
export const MAX_NEIGHBORS = 30;
export const MAX_DDAYS = 12;
export const MAX_BANNER_MORE = 5;   // 대문 배너 슬라이드: 대표 1장 + 추가 최대 5장
export const BANNER_SECS = [3, 5, 8, 12];

/** 글 종류별 { show: 다른 사람에게 보이기, name: 바꾼 이름('' = 기본 이름) } */
export function sanitizeKinds(k) {
  const out = {};
  for (const key of Object.keys(KINDS)) {
    const x = k && typeof k === 'object' ? k[key] : null;
    out[key] = { show: x?.show !== false, name: typeof x?.name === 'string' ? x.name.trim().slice(0, MAX_KIND_NAME) : '' };
  }
  return out;
}

// ───────── 게시판 (글 분류) ─────────
export const MAX_BOARDS = 20;
/** 게시판에 붙일 수 있는 아이콘 (util.js의 아이콘 이름) */
export const BOARD_ICONS = ['folder', 'star', 'heart', 'sparkle', 'palette', 'image', 'user', 'book', 'bookmark', 'tag', 'hash', 'pin',
  'zap', 'smile', 'moon', 'sun', 'music', 'camera', 'coffee', 'gift', 'crown', 'leaf', 'flame', 'box', 'file', 'globe', 'lock', 'grid'];
export const MAX_BOARD_NAME = 20;
export const BOARD_ID_RE = /^[a-z0-9]{4,16}$/;

/** 게시판 목록 [{ id, name, icon }] 을 안전한 값으로 정리 (순서는 그대로 유지) */
export function sanitizeBoards(b) {
  const out = [], seen = new Set();
  if (Array.isArray(b)) {
    for (const x of b) {
      const id = typeof x?.id === 'string' && BOARD_ID_RE.test(x.id) ? x.id : '';
      const name = typeof x?.name === 'string' ? x.name.trim().slice(0, MAX_BOARD_NAME) : '';
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name, icon: BOARD_ICONS.includes(x.icon) ? x.icon : 'folder' });
      if (out.length >= MAX_BOARDS) break;
    }
  }
  return out;
}

// ───────── 글 안의 버튼 (이름 · 아이콘 바꾸기) ─────────
/** 글 속 버튼마다 기본 이름·아이콘. 아이콘 ''은 '아이콘 없음' */
export const BUTTONS = {
  link:     { name: '링크 복사',   icon: 'link',  where: '글 위쪽, 돌아가기 줄 오른쪽' },
  copy:     { name: '복사',        icon: 'copy',  where: '프롬프트 · 설정 블록의 복사 버튼' },
  tags:     { name: '태그로 보기', icon: '',      where: '프롬프트를 태그 조각으로 보기' },
  raw:      { name: '원문 보기',   icon: '',      where: '태그 보기에서 원문으로 돌아가기' },
  withBase: { name: '기본과 함께', icon: 'copy',  where: '캐릭터 변형을 기본 프롬프트와 함께 복사' },
};
export const BUTTON_ICONS = ['', 'copy', 'clipboard', 'link', 'share', 'download', 'star', 'heart', 'sparkle', 'zap', 'check', 'bookmark', 'tag', 'hash', 'smile', 'flame', 'gift', 'file'];
export const MAX_BUTTON_LABEL = 12;

export function sanitizeButtons(b) {
  const out = {};
  for (const [k, d] of Object.entries(BUTTONS)) {
    const x = b && typeof b === 'object' ? b[k] : null;
    const label = typeof x?.label === 'string' ? x.label.trim().slice(0, MAX_BUTTON_LABEL) : '';
    out[k] = { label, icon: BUTTON_ICONS.includes(x?.icon) ? x.icon : d.icon };
  }
  return out;
}

let btnPrefs = sanitizeButtons(null);
/** 글 화면에서 쓸 버튼 이름·아이콘 (이름을 비워 두면 기본 이름) */
export function getButton(key) {
  const p = btnPrefs[key] || { label: '', icon: BUTTONS[key].icon };
  return { label: p.label || BUTTONS[key].name, icon: p.icon };
}

// ───────── 파비콘 (사람마다 따로) ─────────
export const DEFAULT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%23678e85'/%3E%3Cpath d='M16 6l2.6 7.4L26 16l-7.4 2.6L16 26l-2.6-7.4L6 16l7.4-2.6z' fill='white'/%3E%3C/svg%3E";

/** 글자·이모지 아이콘에 들어갈 글자: 최대 2글자(이모지는 한 글자로 셈) */
export function clampIconText(s) {
  s = String(s ?? '').trim();
  const parts = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment)
    : Array.from(s);
  return parts.slice(0, 2).join('');
}

/** { type:'image', src } | { type:'text', text, bg } | null */
export function sanitizeFavicon(f) {
  if (!f || typeof f !== 'object') return null;
  if (f.type === 'image') { const src = safeUrl(f.src); return src ? { type: 'image', src } : null; }
  if (f.type === 'text') {
    const text = clampIconText(f.text);
    return text && HEX.test(f.bg) ? { type: 'text', text, bg: f.bg.toLowerCase() } : null;
  }
  return null;
}

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 파비콘 설정 → <link rel=icon>에 넣을 주소 */
export function faviconHref(f) {
  f = sanitizeFavicon(f);
  if (!f) return DEFAULT_ICON;
  if (f.type === 'image') return f.src;
  const fg = lum(f.bg) > 0.5 ? '#14110f' : '#ffffff';
  const n = Array.from(f.text).length;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='9' fill='${f.bg}'/>`
    + `<text x='16' y='17' text-anchor='middle' dominant-baseline='central' font-size='${n > 1 ? 15 : 19}' font-weight='700' font-family='system-ui,sans-serif' fill='${fg}'>${xmlEsc(f.text)}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

let iconNow = '';
export function setFavicon(f) {
  const href = faviconHref(f);
  if (href === iconNow) return;
  iconNow = href;
  // 같은 요소의 href만 바꾸면 브라우저가 무시하는 경우가 있어서, 요소를 새로 만들어 갈아 끼워요
  document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  document.head.append(link);
}

export const DEFAULT_THEME = {
  preset: 'cream', bg: '#f1f8f5', accent: '#678e85',
  font: 'sans', layout: 'list', radius: 'soft', header: 'center',
  avatar: '', banner: '', bannerMore: [], bannerSec: 5, nbBanner: '', neighbors: [], ddays: [], kinds: sanitizeKinds(null), boards: [], uncat: true, favicon: null, buttons: sanitizeButtons(null),
  skin: '', shelf: '', pview: '', skinTone: '', gameBoards: [], skinFonts: {}, showAll: true, bgm: sanitizeBgm(null),
  spaceFloat: { posts: [], boards: [], sat: true },
  spacePhoto: { x: 50, y: 50, z: 100, more: [] },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** 디데이 목록 정리: { id, name, date:'YYYY-MM-DD', kind:'couple'|'dday', emoji, color:''|'#rrggbb' } */
export function sanitizeDdays(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const [y, m, d] = e.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) continue;
    const name = String(e.name ?? '').trim().slice(0, 20);
    if (!name) continue;
    out.push({
      id: typeof e.id === 'string' && e.id ? e.id.slice(0, 20) : Math.random().toString(36).slice(2, 10),
      name, date: e.date, kind: e.kind === 'dday' ? 'dday' : 'couple', emoji: clampIconText(e.emoji) || '💗',
      color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color.toLowerCase() : '',
    });
    if (out.length >= MAX_DDAYS) break;
  }
  return out;
}

/** 저장된(또는 남의) 테마를 안전한 값으로 정리 */
/** 설정의 '내 블로그 미리보기' 창(iframe) 안에서는 저장 전 꾸미기를 써요 */
export function previewTheme(handle) {
  try {
    if (window.parent === window) return null;
    const p = window.parent.__drawerPreview;
    return p && p.handle === handle ? p.theme : null;
  } catch { return null; }
}

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
    bannerMore: Array.isArray(t.bannerMore) ? [...new Set(t.bannerMore.filter((x) => typeof x === 'string' && x))].slice(0, MAX_BANNER_MORE) : [],
    bannerSec: BANNER_SECS.includes(t.bannerSec) ? t.bannerSec : d.bannerSec,
    nbBanner: typeof t.nbBanner === 'string' ? t.nbBanner : '',
    neighbors: Array.isArray(t.neighbors) ? [...new Set(t.neighbors.filter((x) => typeof x === 'string' && x))].slice(0, MAX_NEIGHBORS) : [],
    ddays: sanitizeDdays(t.ddays),
    kinds: sanitizeKinds(t.kinds),
    boards: sanitizeBoards(t.boards),
    uncat: t.uncat !== false,
    showAll: t.showAll !== false,
    bgm: sanitizeBgm(t.bgm),
    favicon: sanitizeFavicon(t.favicon),
    buttons: sanitizeButtons(t.buttons),
    skin: pick(SKINS, t.skin),
    shelf: pick(SHELVES, t.shelf),
    pview: pick(PVIEWS, t.pview),
    skinFonts: sanitizeSkinFonts(t.skinFonts),
    // 우주 유영: 떠다닐 글(최대 6) · 게시판(최대 4) · 인공위성 장식
    spaceFloat: {
      posts: Array.isArray(t.spaceFloat?.posts) ? [...new Set(t.spaceFloat.posts.filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(id)))].slice(0, 6) : [],
      boards: Array.isArray(t.spaceFloat?.boards) ? [...new Set(t.spaceFloat.boards.filter((id) => typeof id === 'string' && BOARD_ID_RE.test(id)))].slice(0, 4) : [],
      sat: t.spaceFloat?.sat !== false,
    },
    // 우주 유영: 무대에 깔리는 대문 배너 사진의 위치(x·y %) · 크기(z %, 100 = 무대 높이에 맞춤)
    spacePhoto: (() => {
      const p = t.spacePhoto || {}, n = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : d);
      const one = (q) => ({ x: n(q?.x, 0, 100, 50), y: n(q?.y, 0, 100, 50), z: n(q?.z, 40, 300, 100) });
      // more[i] = 슬라이드 추가 사진 i 번째의 위치·크기
      return { ...one(p), more: Array.from({ length: MAX_BANNER_MORE }, (_, i) => one(Array.isArray(p.more) ? p.more[i] : null)) };
    })(),
    gameBoards: Array.isArray(t.gameBoards) ? [...new Set(t.gameBoards.filter((id) => typeof id === 'string' && BOARD_ID_RE.test(id)))].slice(0, 4) : [],
    skinTone: typeof t.skinTone === 'string' && /^[a-z0-9]{1,16}$/.test(t.skinTone) ? t.skinTone : '',
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
  setFavicon(t.favicon);   // 글쓴이마다 자기 파비콘으로
  btnPrefs = t.buttons;    // 글쓴이가 정한 버튼 이름·아이콘
  return t;
}
