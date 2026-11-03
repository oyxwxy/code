// ───────── 스킨 (테스트 중: config.js 의 SKINS_FOR_ALL = false 면 관리자·BETA_HANDLES 에게만 보여요) ─────────
// 페이지 스킨(theme.skin) · 프롬 모음(theme.shelf) · 프롬창(theme.pview) 세 가지를 따로 골라요.
// 기존 화면 구조는 그대로 두고, 스킨은 겉모양(클래스·장식)만 덧입혀요.
import { h, icon, fmtDate, copyText, txt, toast } from './util.js';
import { loadImage, safeUrl } from './images.js';
import { loadContent } from './store.js';
import { kindOf, kindLabel, KINDS } from './kinds.js';
import { PARAM_FIELDS } from './nai.js';
import { openLightbox } from './lightbox.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad = (n, w = 3) => String(n).padStart(w, '0');
const safeThumb = (t) => (typeof t === 'string' && (t.startsWith('data:image/') || safeUrl(t)) ? t : '');

// 픽셀 글꼴(갈무리, OFL)은 스킨을 쓸 때만 불러와요
let fontOn = false;
export function ensureSkinFont() {
  if (fontOn) return;
  fontOn = true;
  document.head.append(h('link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/galmuri.css' }));
}

// ── 색상 프리셋 ──
// 스킨마다 여러 벌. 고른 값은 theme.skinTone 에 저장돼요 (페이지 스킨이 없으면 프롬창의 프리셋으로 써요).
// 각 프리셋: name, sw(설정 화면 색 견본 3개), dark, vars(화면 변수)
const base = (o) => ({
  '--bg': o.bg, '--surface': o.surface, '--text': o.text, '--muted': o.muted, '--border': o.border,
  '--accent': o.accent, '--accent-soft': o.soft, '--on-accent': o.onAccent || '#ffffff',
});
const SERIF = "'Times New Roman', 'Noto Serif KR', Georgia, serif";
const MONO = "GalmuriMono11, Galmuri11, 'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Pretendard Variable', Pretendard, system-ui, -apple-system, 'Segoe UI', sans-serif";

const homeTone = (name, dark, c) => ({
  name, dark, sw: [c.bg, c.win, c.check],
  vars: {
    ...base(c), '--font': SERIF, '--radius': '2px',
    '--hp-grid': c.grid, '--hp-win': c.win, '--hp-bar1': c.bar1, '--hp-bar2': c.bar2, '--hp-frame': c.frame, '--hp-shade': c.shade,
    '--hp-check': c.check, '--hp-check-line': c.checkLine, '--hp-tab': c.tab, '--hp-tab-ink': c.tabInk,
    '--hp-title': c.title, '--hp-title-line': c.titleLine, '--hp-title-shadow': c.titleShadow, '--hp-link': c.link,
    '--hp-tagbg': c.tagBg, '--hp-tagline': c.tagLine,
    '--fl-bg': c.bg, '--fl-bg2': c.bg, '--fl-ink': c.text, '--fl-sub': c.muted, '--fl-mark': c.checkLine,
    '--fl-hl': c.hl, '--fl-hl-ink': c.text, '--fl-blend': 'normal', '--fl-filter': 'saturate(.9)', '--fl-frame': c.frame,
    '--fl-pattern': `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`, '--fl-pattern-size': '22px 22px',
    '--idc-paper': c.win, '--idc-paper2': c.surface, '--idc-ink': c.text, '--idc-acc': c.checkLine, '--idc-acc2': c.accent,
  },
});
const termTone = (name, c) => ({
  name, dark: true, sw: [c.bg, c.ink, c.hl],
  vars: {
    ...base({ bg: c.bg, surface: c.surface, text: c.ink, muted: c.sub, border: c.ink, accent: c.ink, soft: c.soft, onAccent: c.bg }),
    '--font': MONO, '--radius': '0px',
    '--tm-bg': c.bg, '--tm-glow': c.glow, '--tm-edge': c.edge, '--tm-ink': c.ink, '--tm-sub': c.sub, '--tm-ca': c.ca, '--tm-cb': c.cb,
    '--fl-bg': c.bg, '--fl-bg2': c.glow, '--fl-ink': c.ink, '--fl-sub': c.sub, '--fl-mark': c.sub,
    '--fl-hl': c.hl, '--fl-hl-ink': '#111111', '--fl-blend': 'luminosity', '--fl-filter': 'grayscale(1) contrast(1.15) brightness(1.1)', '--fl-frame': c.ink,
    '--fl-pattern': 'repeating-linear-gradient(0deg, rgb(0 0 0 / .14) 0 1px, transparent 1px 3px)', '--fl-pattern-size': 'auto',
    '--idc-paper': '#f2efe6', '--idc-paper2': '#ffffff', '--idc-ink': '#16182a', '--idc-acc': c.bg, '--idc-acc2': c.bg,
  },
});
const gameTone = (name, dark, c) => ({
  name, dark, sw: [c.bg, c.acc, c.acc2],
  vars: {
    ...base({ bg: c.bg, surface: c.bg, text: c.ink, muted: c.muted, border: c.ink, accent: c.acc, soft: c.soft, onAccent: c.onAcc }),
    '--font': SANS, '--radius': '0px',
    '--gm-bg': c.bg, '--gm-ink': c.ink, '--gm-acc': c.acc, '--gm-acc2': c.acc2, '--gm-line': c.line, '--gm-on': c.onAcc,
    '--fl-bg': c.bg, '--fl-bg2': c.bg, '--fl-ink': c.ink, '--fl-sub': c.muted, '--fl-mark': c.acc,
    '--fl-hl': c.acc, '--fl-hl-ink': c.onAcc, '--fl-blend': dark ? 'luminosity' : 'multiply', '--fl-filter': 'grayscale(1) contrast(1.1)', '--fl-frame': c.ink,
    '--fl-pattern': `radial-gradient(circle, ${c.line} 0 1.2px, transparent 1.6px)`, '--fl-pattern-size': '16px 16px',
    '--idc-paper': dark ? '#f3f0ff' : c.bg, '--idc-paper2': '#ffffff', '--idc-ink': dark ? '#151325' : c.ink, '--idc-acc': c.acc, '--idc-acc2': c.acc2,
  },
});
const floatTone = (name, dark, c) => ({
  name, dark, sw: [c.bg, c.hl, c.ink],
  vars: {
    '--fl-bg': c.bg, '--fl-bg2': c.bg2, '--fl-ink': c.ink, '--fl-sub': c.sub, '--fl-mark': c.sub, '--fl-hl': c.hl, '--fl-hl-ink': c.hlInk,
    '--fl-blend': c.blend, '--fl-filter': c.filter, '--fl-frame': c.ink, '--fl-pattern': 'none', '--fl-pattern-size': 'auto',
  },
});
const gridTone = (name, dark, c) => ({
  name, dark, sw: [c.bg, c.acc, c.ink],
  vars: {
    ...base({ bg: c.bg, surface: c.bg, text: c.ink, muted: c.muted, border: c.acc, accent: c.acc, soft: c.soft, onAccent: c.onAcc }),
    '--font': SANS, '--radius': '0px',
    '--gc-bg': c.bg, '--gc-ink': c.ink, '--gc-acc': c.acc, '--gc-on': c.onAcc,
    '--fl-bg': c.bg, '--fl-bg2': c.bg, '--fl-ink': c.ink, '--fl-sub': c.muted, '--fl-mark': c.acc,
    '--fl-hl': c.acc, '--fl-hl-ink': c.onAcc, '--fl-blend': dark ? 'luminosity' : 'multiply', '--fl-filter': 'grayscale(1) contrast(1.1)', '--fl-frame': c.acc,
    '--fl-pattern': `linear-gradient(${c.line} 1px, transparent 1px), linear-gradient(90deg, ${c.line} 1px, transparent 1px)`, '--fl-pattern-size': '28px 28px',
    '--idc-paper': dark ? '#f2f2ee' : c.bg, '--idc-paper2': '#ffffff', '--idc-ink': dark ? '#111111' : c.ink, '--idc-acc': c.acc, '--idc-acc2': dark ? '#333333' : c.ink,
  },
});
const idTone = (name, c) => ({
  name, dark: false, sw: [c.paper, c.o, c.t],
  vars: { '--idv-paper': c.paper, '--idv-ink': c.ink, '--idv-o': c.o, '--idv-t': c.t },
});
const cardTone = (name, c) => ({
  name, dark: false, sw: [c.paper, c.ink, c.acc],
  vars: { '--idc-paper': c.paper, '--idc-paper2': c.paper2, '--idc-ink': c.ink, '--idc-acc': c.acc, '--idc-acc2': c.acc2 },
});

export const TONES = {
  home: {
    blue: homeTone('모눈 블루', false, { bg: '#fdfdff', surface: '#ffffff', text: '#2b2a33', muted: '#6d7088', border: '#9aa3b8', accent: '#7486c2', soft: '#e8ecf8',
      grid: '#bfd1f1', win: '#f6f2e9', bar1: '#efeeea', bar2: '#d7d5cf', frame: '#858894', shade: '#dfe4f1', check: 'rgb(240 160 182 / .3)', checkLine: '#cf8fa1',
      tab: '#ffe7ee', tabInk: '#7b3c50', title: '#ffffff', titleLine: '#2b2a33', titleShadow: '#f2b4c4', link: '#2a3a90', tagBg: '#fff7d8', tagLine: '#c9b98a', hl: '#ffd9e3' }),
    berry: homeTone('딸기우유', false, { bg: '#fff8fa', surface: '#ffffff', text: '#4a2f37', muted: '#9a7480', border: '#e2b9c5', accent: '#e07f9c', soft: '#fbe3ea',
      grid: '#f6cad7', win: '#fffdfd', bar1: '#ffeef3', bar2: '#f3cbd7', frame: '#b98596', shade: '#f8dbe3', check: 'rgb(140 200 170 / .3)', checkLine: '#8fbfa6',
      tab: '#e6f6ed', tabInk: '#3f6e57', title: '#ffffff', titleLine: '#5a2f3c', titleShadow: '#a8dcc2', link: '#b0456a', tagBg: '#eaf8f0', tagLine: '#9cc9b1', hl: '#d8f2e4' }),
    matcha: homeTone('말차 노트', false, { bg: '#fbfbf4', surface: '#fffef8', text: '#2f3527', muted: '#737a64', border: '#b5bf9f', accent: '#7b9a55', soft: '#e7efd9',
      grid: '#d3e2c4', win: '#f4f1e1', bar1: '#eef0e2', bar2: '#d3d8bd', frame: '#7f8a6c', shade: '#e1e8d2', check: 'rgb(214 170 96 / .26)', checkLine: '#c4a265',
      tab: '#fbefd6', tabInk: '#6d5222', title: '#ffffff', titleLine: '#34402a', titleShadow: '#e3c27d', link: '#4f6b2e', tagBg: '#fff4d9', tagLine: '#cdb27a', hl: '#f6e3b4' }),
    night: homeTone('밤 모눈', true, { bg: '#151826', surface: '#23283d', text: '#e7e8f5', muted: '#9097b8', border: '#3d4466', accent: '#8f86ff', soft: '#2a2c4c',
      grid: '#252b46', win: '#1d2133', bar1: '#2b3150', bar2: '#20253c', frame: '#4a5276', shade: '#0d0f19', check: 'rgb(150 130 255 / .16)', checkLine: '#6a66b8',
      tab: '#2a2950', tabInk: '#cbc6ff', title: '#f6f3ff', titleLine: '#5c53c9', titleShadow: '#2e2a63', link: '#b3c0ff', tagBg: '#262a44', tagLine: '#4c5380', hl: '#3b3878' }),
  },
  term: {
    blue: termTone('VHS 블루', { bg: '#0b1fd6', glow: '#1735f2', edge: '#0614a8', ink: '#f4f6ff', sub: '#a8b4ff', surface: '#1430e6', soft: '#2843f0', ca: 'rgb(255 40 130 / .65)', cb: 'rgb(40 230 255 / .65)', hl: '#e8ff3a' }),
    green: termTone('그린 모니터', { bg: '#04140b', glow: '#0b2a17', edge: '#010805', ink: '#7dffa1', sub: '#3fae64', surface: '#082011', soft: '#0d3a1f', ca: 'rgb(0 255 120 / .35)', cb: 'rgb(170 255 210 / .25)', hl: '#7dffa1' }),
    amber: termTone('앰버', { bg: '#170c02', glow: '#2a1704', edge: '#0b0500', ink: '#ffbf5a', sub: '#b07a2a', surface: '#221303', soft: '#3a2308', ca: 'rgb(255 90 0 / .45)', cb: 'rgb(255 230 150 / .3)', hl: '#ffbf5a' }),
    pink: termTone('핑크 VHS', { bg: '#c4126f', glow: '#e0278a', edge: '#8a0a4c', ink: '#fff3fa', sub: '#ffb3d9', surface: '#d01d7b', soft: '#de3a8f', ca: 'rgb(0 220 255 / .6)', cb: 'rgb(255 255 0 / .45)', hl: '#fff35a' }),
  },
  game: {
    coral: gameTone('코랄 아케이드', false, { bg: '#fbf7ef', ink: '#1d1b22', muted: '#6c6772', acc: '#ff5b3a', acc2: '#2f6bff', line: 'rgb(29 27 34 / .16)', soft: '#ffe4dc', onAcc: '#1d1b22' }),
    lime: gameTone('라임', false, { bg: '#f5faf0', ink: '#10140f', muted: '#5c6559', acc: '#33cc55', acc2: '#ff3fa4', line: 'rgb(16 20 15 / .16)', soft: '#ddf6e2', onAcc: '#10140f' }),
    lavender: gameTone('라벤더', false, { bg: '#f7f4ff', ink: '#221a3a', muted: '#6e6789', acc: '#8a5cff', acc2: '#ffb21f', line: 'rgb(34 26 58 / .16)', soft: '#e9e0ff', onAcc: '#ffffff' }),
    night: gameTone('나이트', true, { bg: '#0f0d1c', ink: '#f3f0ff', muted: '#a29cbf', acc: '#ff4f9a', acc2: '#3fe0ff', line: 'rgb(243 240 255 / .16)', soft: '#2a1d3a', onAcc: '#0f0d1c' }),
  },
  grid: {
    green: gridTone('형광 그린', false, { bg: '#ffffff', ink: '#0b0b0b', muted: '#5d5d5d', acc: '#16c93a', soft: '#e2f9e6', onAcc: '#0b0b0b', line: 'rgb(22 201 58 / .35)' }),
    blue: gridTone('일렉트릭 블루', false, { bg: '#ffffff', ink: '#0b0b18', muted: '#5d5d6d', acc: '#2f5bff', soft: '#e3e9ff', onAcc: '#ffffff', line: 'rgb(47 91 255 / .3)' }),
    pink: gridTone('핫핑크', false, { bg: '#fffafd', ink: '#1a0b14', muted: '#6d5d66', acc: '#ff3d9a', soft: '#ffe3f1', onAcc: '#1a0b14', line: 'rgb(255 61 154 / .3)' }),
    dark: gridTone('블랙 그린', true, { bg: '#0b0d0b', ink: '#f2f5f2', muted: '#9aa39a', acc: '#2bff5c', soft: '#123018', onAcc: '#0b0d0b', line: 'rgb(43 255 92 / .25)' }),
  },
  float: {
    blue: floatTone('블루', true, { bg: '#1d2bff', bg2: '#2a38ff', ink: '#ffffff', sub: '#b6beff', hl: '#e8ff3a', hlInk: '#111111', blend: 'luminosity', filter: 'grayscale(1) contrast(1.15) brightness(1.12)' }),
    red: floatTone('레드', true, { bg: '#e3262b', bg2: '#ef3a3e', ink: '#ffffff', sub: '#ffc4c4', hl: '#ffffff', hlInk: '#111111', blend: 'luminosity', filter: 'grayscale(1) contrast(1.15) brightness(1.1)' }),
    ink: floatTone('먹색', true, { bg: '#0d0d10', bg2: '#17171c', ink: '#f2f2f2', sub: '#8d8d96', hl: '#e8ff3a', hlInk: '#111111', blend: 'normal', filter: 'grayscale(1) contrast(1.1)' }),
    paper: floatTone('종이', false, { bg: '#f1ede2', bg2: '#f6f3ea', ink: '#1d1d1d', sub: '#7a756a', hl: '#ff6a3d', hlInk: '#111111', blend: 'multiply', filter: 'grayscale(1) contrast(1.1)' }),
  },
  pass: {
    navy: cardTone('여권 네이비', { paper: '#f3efe4', paper2: '#fffdf7', ink: '#1e2433', acc: '#b8473a', acc2: '#2f4f7a' }),
    forest: cardTone('숲', { paper: '#ecefe4', paper2: '#fbfcf6', ink: '#1f3a2e', acc: '#c0562f', acc2: '#2e5a46' }),
    plum: cardTone('자두', { paper: '#f4eef2', paper2: '#fffafd', ink: '#3a1f35', acc: '#b03a6e', acc2: '#5a3a7a' }),
    mono: cardTone('모노', { paper: '#f2f2ef', paper2: '#ffffff', ink: '#111111', acc: '#111111', acc2: '#777777' }),
  },
  card: {
    cream: idTone('크림', { paper: '#f2ede1', ink: '#1b1b1b', o: '#e8692c', t: '#4fb5ac' }),
    mint: idTone('민트', { paper: '#e9f2ee', ink: '#14241e', o: '#1f9e7a', t: '#e5a33b' }),
    lilac: idTone('라일락', { paper: '#efeaf5', ink: '#211a2e', o: '#7a5cd6', t: '#e86a9a' }),
    char: idTone('차콜', { paper: '#e7e6e2', ink: '#151515', o: '#151515', t: '#9a9a9a' }),
  },
};
/** 고른 프리셋 (없거나 모르는 값이면 첫 번째) */
export const toneOf = (key, tone) => { const t = TONES[key]; return t ? (t[tone] || Object.values(t)[0]) : null; };

let applied = [];
function setVars(vars) {
  const s = document.documentElement.style;
  // 기본 색(--bg 등)은 다음 화면의 applyTheme 이 다시 정하니까, 스킨 전용 변수만 지워요
  applied.forEach((k) => s.removeProperty(k));
  applied = [];
  for (const [k, v] of Object.entries(vars || {})) { s.setProperty(k, v); if (/^--(hp|tm|gm|gc|fl|idc|idv)-/.test(k)) applied.push(k); }
}

/** 화면 전체 색(변수)을 스킨으로 바꿔요. 다른 화면으로 가면 app.js 가 data-skin 을 지우고, 다음 화면의 테마가 색을 다시 정해요 */
export function setPageSkin(skin, tone = '') {
  const el = document.documentElement;
  if (!skin) { delete el.dataset.skin; return; }
  ensureSkinFont();
  const t = toneOf(skin, tone);
  setVars(t?.vars);
  el.dataset.skin = skin;
  el.dataset.mode = t?.dark ? 'dark' : 'light';
}
/** 페이지 스킨 없이 프롬창만 쓸 때: 프롬창 색만 정해요 */
export function setViewTone(pview, tone = '') {
  ensureSkinFont();
  setVars(toneOf(pview, tone)?.vars);
}

// ═════════════════════ 페이지 스킨 ═════════════════════
/**
 * 블로그 화면에 스킨을 입혀요.
 * ctx: { root, head, body, side, main, pickBar, prof, theme, boards, selectBoard, posts }
 */
export function dressBlog(skin, ctx) {
  setPageSkin(skin, ctx.theme.skinTone);
  ctx.root.classList.add('skin', 'skin-' + skin);
  if (skin === 'home') dressHome(ctx);
  else if (skin === 'term') dressTerm(ctx);
  else if (skin === 'game') dressGame(ctx);
  else if (skin === 'grid') dressGrid(ctx);
}

// ── 1. 홈페이지: 모눈종이 바탕 위 옛날 브라우저 창 ──
function dressHome({ root, head, body, side, pickBar, prof }) {
  // 이웃 배너는 오른쪽 칸으로 (링크 모음처럼)
  const nb = side?.querySelector('.nb-zone');
  if (nb) {
    body.append(h('aside', { class: 'hp-right' }, nb));
    if (!side.children.length) side.remove();
    body.classList.add(side.isConnected ? 'hp-3' : 'hp-2r');
  }
  const search = () => { const i = root.querySelector('.search input'); i?.focus(); i?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); };
  const bar = h('div', { class: 'hp-bar' },
    h('button', { class: 'hp-nav', type: 'button', 'aria-label': '뒤로', onclick: () => history.back() }, '◀'),
    h('button', { class: 'hp-nav', type: 'button', 'aria-label': '앞으로', onclick: () => history.forward() }, '▶'),
    h('span', { class: 'hp-url' }, `https://drawer/@${prof.handle}/`),
    h('button', { class: 'hp-go', type: 'button', onclick: search }, 'search'));
  const year = prof.created ? new Date(prof.created).getFullYear() : new Date().getFullYear();
  const win = h('div', { class: 'hp-win' }, bar,
    h('div', { class: 'hp-in' }, head, body,
      h('p', { class: 'hp-foot' }, `@${prof.handle} · ${year}–forever · best viewed with your heart`)));
  root.replaceChildren(win, pickBar);
}

// ── 2. 터미널: VHS 파란 화면 + 창 ──
function dressTerm({ root, head, pickBar, prof }) {
  head.querySelector('.head-in')?.before(h('div', { class: 'tm-rule' }, h('span', null, txt(prof.display) || prof.handle)));
  const tc = h('span', { class: 'tm-tc' }, '0:00:00');
  const foot = h('div', { class: 'tm-foot', 'aria-hidden': 'true' },
    h('div', { class: 'tm-keys' },
      h('span', null, h('b', null, 'SELECT'), ' : ▲ ▼ KEY'),
      h('span', null, h('b', null, 'SET'), ' : ➤ ENTER'),
      h('span', null, h('b', null, 'END'), ' : ESC KEY')),
    h('div', { class: 'tm-play' }, h('span', null, 'PLAY', h('i', null, 'SP')), tc));
  root.append(h('div', { class: 'tm-scan', 'aria-hidden': 'true' }), foot);
  if (pickBar) root.append(pickBar);
  // 재생 시간처럼 흘러가는 시계
  const t0 = Date.now();
  const tick = setInterval(() => {
    if (!root.isConnected) { clearInterval(tick); document.removeEventListener('keydown', onKey); return; }
    const s = Math.floor((Date.now() - t0) / 1000);
    tc.textContent = `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}`;
  }, 1000);
  // ▲▼ 로 글 사이를 옮겨 다니고, Enter 로 열고, Esc 로 맨 위로
  const onKey = (e) => {
    if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') { window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); document.activeElement?.blur?.(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const cards = [...root.querySelectorAll('.blog-main a.card, .blog-main a.rec-item, .blog-main a.dw-cell, .blog-main .fd-tab')];
    if (!cards.length) return;
    e.preventDefault();
    const at = cards.indexOf(document.activeElement);
    const next = at < 0 ? 0 : Math.max(0, Math.min(cards.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
    cards[next].focus();
    cards[next].scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  };
  document.addEventListener('keydown', onKey);
}

// ── 3. 게임 타이틀: 픽셀 아케이드 타이틀 화면 (HUD · 원근 바닥 · 메뉴 · PRESS START) ──
function floorSvg() {
  const W = 1000, H = 300, cx = W / 2;
  const L = [];
  for (let i = -14; i <= 14; i++) L.push(`<line x1="${cx}" y1="0" x2="${cx + i * 120}" y2="${H}"/>`);
  for (let k = 1; k <= 12; k++) { const y = H * Math.pow(k / 12, 2.2); L.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}"/>`); }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke">${L.join('')}</g></svg>`;
}

function dressGame({ root, head, body, main, prof, theme, boards, selectBoard, posts }) {
  const name = txt(prof.display) || prof.handle;
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  // 게시판 = 메뉴 (최대 5개). 마우스·포커스가 가면 ▶ 커서가 따라가요
  // 메뉴에 보일 게시판: 꾸미기에서 고른 것(theme.gameBoards, 고른 순서대로) → 없으면 앞에서부터 4개
  const picked = (theme.gameBoards || []).map((id) => boards.find((b) => b.id === id)).filter(Boolean);
  const items = [{ id: 'all', name: '전체 보기' }, ...(picked.length ? picked : boards).slice(0, 4)];
  const menu = h('ul', { class: 'gm-menu' }, items.map((b, i) => h('li', null,
    h('button', { class: 'gm-item' + (i === 0 ? ' on' : ''), type: 'button',
      onmouseenter: (e) => mark(e.currentTarget), onfocus: (e) => mark(e.currentTarget),
      onclick: () => { selectBoard(b.id); go(); } }, h('i', { 'aria-hidden': 'true' }, '▶'), h('span', null, b.name)))));
  const mark = (el) => menu.querySelectorAll('.gm-item').forEach((x) => x.classList.toggle('on', x === el));
  const player = h('div', { class: 'gm-player' }, h('div', { class: 'gm-face' }), h('small', null, 'PLAYER 1'));
  if (theme.avatar) loadImage(theme.avatar).then((u) => { if (u) { player.firstChild.style.backgroundImage = `url("${u}")`; player.classList.add('on'); } });
  const year = new Date().getFullYear();
  const hero = h('section', { class: 'gm-hero' },
    h('div', { class: 'gm-sky', 'aria-hidden': 'true' }, h('i', { class: 'c1' }), h('i', { class: 'c2' }), h('i', { class: 'c3' })),
    h('div', { class: 'gm-floor', html: floorSvg() }),
    h('div', { class: 'gm-hud' },
      h('span', null, h('b', null, '1P'), '@' + prof.handle),
      h('span', null, h('b', null, 'HI-SCORE'), pad(posts.length, 6)),
      h('span', null, h('b', null, 'CREDIT'), '01')),
    h('div', { class: 'gm-center' },
      h('p', { class: 'gm-kicker' }, '— PROMPT ARCADE —'),
      h('h1', { class: 'gm-title' }, name),
      menu,
      h('button', { class: 'gm-press', type: 'button', onclick: go }, 'PRESS START')),
    player,
    h('div', { class: 'gm-copy' }, `© ${year} @${prof.handle}`));
  head.before(hero);
  body.classList.add('gm-body');
}

// ── 4. 그리드 타이틀 (처음 버전): 원근 그리드 복도 + 큰 픽셀 제목 + START ──
function corridorSvg() {
  const W = 1000, H = 560, cx = W / 2, cy = H / 2;
  const iw = 230, ih = 128;
  const lines = [];
  const L = (x1, y1, x2, y2) => lines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
  for (let k = 0; k <= 9; k++) {
    const t = 1 - Math.pow(0.72, k);
    const w = W - (W - iw) * t, hh = H - (H - ih) * t;
    lines.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - hh / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/>`);
  }
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    L(f * W, 0, cx - iw / 2 + f * iw, cy - ih / 2);
    L(f * W, H, cx - iw / 2 + f * iw, cy + ih / 2);
  }
  for (let i = 1; i < 6; i++) {
    const f = i / 6;
    L(0, f * H, cx - iw / 2, cy - ih / 2 + f * ih);
    L(W, f * H, cx + iw / 2, cy - ih / 2 + f * ih);
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke">${lines.join('')}</g></svg>`;
}

function dressGrid({ head, body, main, prof, theme, boards, selectBoard }) {
  const name = txt(prof.display) || prof.handle;
  const avatar = h('div', { class: 'gc-photo', 'aria-hidden': 'true' });
  if (theme.avatar) loadImage(theme.avatar).then((u) => { if (u) { avatar.style.backgroundImage = `url("${u}")`; avatar.classList.add('on'); } });
  const spots = ['l1', 'l2', 'r1', 'r2', 'l3', 'r3'];
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const menu = boards.slice(0, 6).map((b, i) =>
    h('button', { class: 'gc-tag ' + spots[i], type: 'button', onclick: () => { selectBoard(b.id); go(); } }, '• ' + b.name));
  const hero = h('section', { class: 'gc-hero' },
    h('div', { class: 'gc-grid', html: corridorSvg() }),
    h('div', { class: 'gc-dots', 'aria-hidden': 'true' }),
    avatar,
    h('div', { class: 'gc-id' }, '@' + prof.handle),
    h('h1', { class: 'gc-title' }, h('span', null, name)),
    ...menu,
    h('button', { class: 'gc-start', type: 'button', onclick: go },
      h('span', { class: 'gc-ring', 'aria-hidden': 'true' }), h('b', null, 'START'), h('span', { class: 'gc-cur', 'aria-hidden': 'true' }, '↖')));
  head.before(hero);
  body.classList.add('gc-body');
}

// ═════════════════════ 프롬 모음 ═════════════════════
/**
 * 글 목록을 다른 모양으로 보여줘요.
 * ctx: { isOwner, boardName(id), boardOf(p), handle, display }
 */
export function collectionView(shelf, rows, ctx) {
  if (shelf === 'records') return recordsView(rows, ctx);
  if (shelf === 'drawer') return drawerView(rows, ctx);
  if (shelf === 'folders') return foldersView(rows, ctx);
  return null;
}

const coverOf = (p, cls) => {
  const th = safeThumb(p.thumb);
  const hide = (p.spoiler && p.vis === 'public') || p.thumbSp;
  return th
    ? h('img', { class: cls + (hide ? ' sp' : ''), src: th, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' })
    : h('span', { class: cls + ' ph' }, icon(p.vis === 'locked' ? 'lock' : p.vis === 'private' ? 'eye-off' : 'image', 20), h('small', null, txt(p.title).slice(0, 14)));
};

// ── 프롬모음 1: 레코드 진열 (대각선으로 비스듬히 꽂힌 커버들) ──
function recordsView(rows, ctx) {
  const capDate = h('b'), capTitle = h('span'), capMeta = h('small');
  const setCap = (p) => {
    capDate.textContent = p ? fmtDate(p.created) : `${rows.length} records`;
    capTitle.textContent = p ? (txt(p.title) || '제목 없음') : 'every : prompt';
    capMeta.textContent = p ? [kindLabel(kindOf(p)), ctx.boardName(ctx.boardOf(p))].filter(Boolean).join(' · ') : '하나를 골라 보세요';
  };
  const row = h('div', { class: 'rec-row' }, rows.map((p, i) => {
    const a = h('a', { class: 'rec-item', href: '#/p/' + p.id, 'data-id': p.id, 'aria-label': txt(p.title) || '제목 없음' },
      h('span', { class: 'rec-cover' }, coverOf(p, 'rec-img'), h('span', { class: 'rec-plus', 'aria-hidden': 'true' }, '+')),
      i % 6 === 0 ? h('span', { class: 'rec-tick', 'aria-hidden': 'true' }, fmtDate(p.created)) : null);
    a.style.setProperty('--i', i);
    a.addEventListener('mouseenter', () => setCap(p));
    a.addEventListener('focus', () => setCap(p));
    return a;
  }));
  row.style.setProperty('--n', rows.length);
  row.style.setProperty('--dy', Math.min(9, 240 / Math.max(1, rows.length)).toFixed(2) + 'px');
  row.addEventListener('mouseleave', () => setCap(null));
  setCap(null);
  const stage = h('div', { class: 'rec-stage' }, row);
  // 마우스 휠을 가로 스크롤로
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && stage.scrollWidth > stage.clientWidth) {
      const max = stage.scrollWidth - stage.clientWidth;
      if ((e.deltaY > 0 && stage.scrollLeft < max) || (e.deltaY < 0 && stage.scrollLeft > 0)) { e.preventDefault(); stage.scrollLeft += e.deltaY; }
    }
  }, { passive: false });
  // 스크롤바 대신: 마우스로 끌어서 넘기고, 넘칠 때만 양 끝을 흐리게
  let drag = null, moved = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: stage.scrollLeft }; moved = false;
  });
  const onMove = (e) => {
    if (!stage.isConnected) { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); return; }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { moved = true; stage.classList.add('dragging'); }
    if (moved) stage.scrollLeft = drag.left - dx;
  };
  const onUp = () => { drag = null; stage.classList.remove('dragging'); };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  stage.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  stage.addEventListener('dragstart', (e) => e.preventDefault());
  // 넘기기 버튼 (휠·끌기가 안 되는 환경에서도 넘길 수 있게)
  const step = (d) => stage.scrollBy({ left: d * Math.max(200, stage.clientWidth * 0.6), behavior: reduced() ? 'auto' : 'smooth' });
  const prev = h('button', { class: 'rec-nav prev', type: 'button', 'aria-label': '앞으로 넘기기', onclick: () => step(-1) }, icon('chevl', 18));
  const next = h('button', { class: 'rec-nav next', type: 'button', 'aria-label': '뒤로 넘기기', onclick: () => step(1) }, icon('chevr', 18));
  const wrap = h('div', { class: 'rec-wrap' }, h('div', { class: 'rec-cap', 'aria-live': 'polite' }, capDate, capTitle, capMeta), stage, prev, next);
  const edges = () => {
    const max = stage.scrollWidth - stage.clientWidth;
    const l = stage.scrollLeft > 4, r = stage.scrollLeft < max - 4;
    stage.classList.toggle('fade-l', l);
    stage.classList.toggle('fade-r', r);
    prev.disabled = !l; next.disabled = !r;
    wrap.classList.toggle('no-scroll', max <= 4);
  };
  stage.addEventListener('scroll', edges, { passive: true });
  window.addEventListener('resize', () => { if (wrap.isConnected) edges(); });
  requestAnimationFrame(edges);
  return wrap;
}

// ── 프롬모음 2: 서랍 (칸칸이 나뉜 서랍 속 카드) ──
function drawerView(rows, ctx) {
  const PER = 20;
  const units = [];
  for (let s = 0; s < rows.length; s += PER) {
    const part = rows.slice(s, s + PER);
    const no = s / PER + 1;
    const cells = part.map((p) => h('a', { class: 'dw-cell', href: '#/p/' + p.id, 'data-id': p.id, title: txt(p.title) || '제목 없음' },
      h('span', { class: 'dw-card' }, coverOf(p, 'dw-img'))));
    const fill = Math.ceil(part.length / 5) * 5 - part.length;
    for (let k = 0; k < fill; k++) cells.push(h('span', { class: 'dw-cell empty', 'aria-hidden': 'true' }));
    const index = h('ol', { class: 'dw-index', start: s + 1 }, part.map((p) => h('li', { 'data-id': p.id },
      h('a', { href: '#/p/' + p.id }, txt(p.title) || '제목 없음'))));
    const unit = h('section', { class: 'dw-unit' },
      h('div', { class: 'dw-box' },
        h('div', { class: 'dw-tray' }, cells),
        h('div', { class: 'dw-front' }, h('span', { class: 'dw-handle', 'aria-hidden': 'true' }), h('span', { class: 'dw-label' }, `No. ${pad(no, 2)}`))),
      h('h4', { class: 'dw-cap' }, `서랍 ${no} / Drawer ${no}`), index);
    // 칸과 목록 이름을 서로 짚어 줘요
    const mark = (id, on) => unit.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.toggle('hl', on));
    unit.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-id]'); if (t) mark(t.dataset.id, true); });
    unit.addEventListener('mouseout', (e) => { const t = e.target.closest('[data-id]'); if (t) mark(t.dataset.id, false); });
    units.push(unit);
  }
  return h('div', { class: 'dw-wrap' }, units);
}

// ── 프롬모음 3: 폴더 인덱스 (탭 달린 폴더 → 안의 파일 → 프롬) ──
function foldersView(rows, ctx) {
  const groups = Object.keys(KINDS).map((k) => [k, rows.filter((p) => kindOf(p) === k)]).filter(([, g]) => g.length);
  const offs = ['a', 'b', 'c', 'b'];
  // 탭 모양: 아래로 갈수록 부드럽게 벌어지는 곡선. 끝선은 폴더 윗선 한가운데(34.75px)에 딱 맞춰 이어지고, 채움은 윗선을 덮도록 조금 더 내려가요
  const tabShape = () => h('span', { class: 'fd-shape', 'aria-hidden': 'true', html:
    '<svg viewBox="0 0 300 34" preserveAspectRatio="none">'
    + '<path class="f" d="M0 34.75 C10 34.75 13 30.75 15 23 L19 9 C21 3 24 1 31 1 L269 1 C276 1 279 3 281 9 L285 23 C287 30.75 290 34.75 300 34.75 L300 37 L0 37 Z"/>'
    + '<path class="s" d="M0 34.75 C10 34.75 13 30.75 15 23 L19 9 C21 3 24 1 31 1 L269 1 C276 1 279 3 281 9 L285 23 C287 30.75 290 34.75 300 34.75" vector-effect="non-scaling-stroke"/></svg>' });
  let n = 0, turn = 0;
  const cab = h('div', { class: 'fd-cab' });
  groups.forEach(([k, list], gi) => {
    cab.append(h('div', { class: 'fd-row divider ' + (gi % 2 ? 'c' : 'a') },
      h('span', { class: 'fd-tab dark', tabindex: '-1' }, tabShape(), h('b', null, kindLabel(k)), h('em', null, pad(list.length))), h('span', { class: 'fd-edge' })));
    list.forEach((p) => {
      n++;
      const row = h('div', { class: 'fd-row ' + offs[turn++ % offs.length] });
      const files = h('div', { class: 'fd-files' });
      const tab = h('button', { class: 'fd-tab', type: 'button', 'aria-expanded': 'false', onclick: () => toggle() },
        tabShape(), h('i', null, pad(n)), h('span', null, txt(p.title) || '제목 없음'));
      let loaded = false;
      const toggle = () => {
        const open = !row.classList.contains('open');
        cab.querySelectorAll('.fd-row.open').forEach((r) => { if (r !== row) { r.classList.remove('open'); r.querySelector('.fd-tab')?.setAttribute('aria-expanded', 'false'); } });
        row.classList.toggle('open', open);
        tab.setAttribute('aria-expanded', String(open));
        if (open && !loaded) { loaded = true; fillFiles(files, p); }
      };
      row.append(tab, h('span', { class: 'fd-edge' }), files);
      cab.append(row);
    });
  });
  return h('div', { class: 'fd-wrap' }, cab,
    h('div', { class: 'fd-front' }, h('span', { class: 'fd-name' }, `${ctx.display}'s secret files`)));
}

/** 프롬 종류별로 '파일' 목록을 만들어요 (기본 · 변형 · 캐릭터 · 네거티브 · 설정) */
export function promptFiles(content, kind) {
  const out = [];
  const L = { prompt: txt(content.labels?.prompt).trim(), negative: txt(content.labels?.negative).trim() };
  const add = (name, text, extra = {}) => { text = txt(text); if (text.trim()) out.push({ name, text, ...extra }); };
  add(L.prompt || (kind === 'style' ? '그림체 프롬프트' : kind === 'character' ? '캐릭터 프롬프트' : '프롬프트'), content.prompt);
  if (kind === 'character' || kind === 'scene') {
    (content.variants || []).forEach((v) => add(txt(v.name) || '변형', v.prompt, { spoiler: !!v.spoiler, base: txt(content.prompt) }));
  }
  (content.chars || []).forEach((c, i) => { add(`캐릭터 ${i + 1}`, c.prompt); add(`캐릭터 ${i + 1} · UC`, c.uc, { neg: true }); });
  add(L.negative || '네거티브 프롬프트', content.negative, { neg: true });
  const pr = content.params || {};
  const filled = PARAM_FIELDS.filter(([k]) => txt(pr[k]).trim() !== '');
  if (filled.length) out.push({ name: '생성 설정', text: filled.map(([k, label]) => `${label}: ${txt(pr[k])}`).join(', '), params: true });
  return out;
}

async function fillFiles(box, p) {
  box.replaceChildren(h('p', { class: 'fd-note' }, '여는 중…'));
  let r;
  try { r = await loadContent(p); } catch { box.replaceChildren(h('p', { class: 'fd-note' }, '파일을 열지 못했어요'), openLink(p)); return; }
  if (r.needPassword) { box.replaceChildren(h('p', { class: 'fd-note' }, '🔒 비밀번호가 걸린 폴더예요'), openLink(p)); return; }
  const files = promptFiles(r.content || {}, kindOf(p));
  const th = safeThumb(p.thumb);
  box.replaceChildren(
    h('div', { class: 'fd-sheet' },
      th ? h('img', { class: 'fd-thumb' + ((p.spoiler && p.vis === 'public') || p.thumbSp ? ' sp' : ''), src: th, alt: '', loading: 'lazy' }) : null,
      h('div', { class: 'fd-list' },
        files.length ? files.map((f) => h('button', { class: 'fd-file' + (f.neg ? ' neg' : ''), type: 'button', onclick: () => popPrompt(f, p) },
          icon('file', 15), h('span', null, f.name + (f.params ? '.cfg' : '.txt')), f.spoiler ? h('em', null, '스포') : null))
          : h('p', { class: 'fd-note' }, '빈 폴더예요'),
        openLink(p))));
}
const openLink = (p) => h('a', { class: 'fd-open', href: '#/p/' + p.id }, '글 전체 보기 →');

function popPrompt(f, p) {
  const close = () => { pop.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const pre = h('pre', { class: 'fd-pre' + (f.spoiler ? ' sp' : '') }, f.text);
  if (f.spoiler) pre.addEventListener('click', () => pre.classList.remove('sp'), { once: true });
  const pop = h('div', { class: 'fd-pop', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === pop) close(); } },
    h('div', { class: 'fd-paper' },
      h('div', { class: 'fd-paper-head' }, h('b', null, f.name), h('small', null, txt(p.title)),
        h('button', { class: 'fd-x', type: 'button', 'aria-label': '닫기', onclick: close }, icon('x', 16))),
      pre,
      h('div', { class: 'fd-paper-foot' },
        f.base ? h('button', { class: 'btn sm', type: 'button', onclick: () => copyText([f.base, f.text].filter((x) => x.trim()).join(', '), '기본 + 변형을 함께 복사했어요') }, '기본과 함께 복사') : null,
        h('button', { class: 'btn sm primary', type: 'button', onclick: () => copyText(f.text, `${f.name} 복사했어요`) }, icon('copy', 14), '복사'))));
  document.body.append(pop);
  document.addEventListener('keydown', onKey);
  pop.querySelector('.fd-x').focus();
}

// ═════════════════════ 프롬창 ═════════════════════
/**
 * 글 보기 본문을 스킨으로 그려요. 실패하면 null (기본 보기로)
 * ctx: { post, author, handle, boardName, onPlain }
 */
export function promptView(pview, content, ctx) {
  if (pview === 'float') return floatView(content, ctx);
  if (pview === 'pass') return cardView(content, ctx);
  if (pview === 'card') return idCardView(content, ctx);
  return null;
}

const imgSet = (content) => ({
  ids: content.images || [],
  spoilers: new Set((content.imgSp || []).filter((n) => Number.isInteger(n))),
  revealed: new Set(),
});

// ── 프롬창 1: 유영 (떠다니는 예시 이미지 + 가운데 프롬, 누르면 복사) ──
function floatView(content, ctx) {
  const { post } = ctx;
  const kind = kindOf(post);
  const files = promptFiles(content, kind);
  const I = imgSet(content);
  let cur = 0;

  const text = h('p', { class: 'fl-text', role: 'button', tabindex: '0', title: '눌러서 복사' });
  const flash = h('span', { class: 'fl-flash', 'aria-live': 'polite' });
  const paintText = () => {
    const f = files[cur];
    text.classList.toggle('sp', !!f?.spoiler && !f.shown);
    text.replaceChildren(h('mark', null, f ? f.text : '프롬프트가 없어요'));
    tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === cur));
  };
  const doCopy = () => {
    const f = files[cur];
    if (!f) return;
    if (f.spoiler && !f.shown) { f.shown = true; paintText(); return; }
    copyText(f.text, `${f.name} 복사했어요`);
    flash.textContent = 'COPIED';
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
  };
  text.addEventListener('click', doCopy);
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCopy(); } });
  const tabs = h('div', { class: 'fl-tabs' }, files.map((f, i) =>
    h('button', { type: 'button', onclick: () => { cur = i; paintText(); } }, `(${i + 1}) ${f.name}`)));

  const tags = (post.tags || []).map(txt).filter(Boolean);
  const corner = (cls, items) => h('div', { class: 'fl-corner ' + cls }, items.filter(Boolean).map(([n, a, b]) =>
    h('div', { class: 'fl-note' }, h('i', null, `{${n}}`), h('b', null, a), b ? h('span', null, b) : null)));
  const stage = h('section', { class: 'fl-stage' },
    h('div', { class: 'fl-sky' }),
    corner('tl', [[1, txt(post.title) || '제목 없음', kindLabel(kind)], ctx.boardName ? [2, 'Board', ctx.boardName] : null]),
    corner('tr', [[3, 'Written by', '@' + ctx.handle], [4, 'Date of issue', fmtDate(post.created)]]),
    corner('bl', [tags.length ? [5, 'Tags', tags.slice(0, 8).map((t) => '#' + t).join('  ')] : null]),
    corner('br', [[6, 'Files', `${files.length}개 · ${I.ids.length}장`], [7, 'How to', '글자를 누르면 바로 복사돼요']]),
    h('div', { class: 'fl-center' }, tabs, text, flash,
      files.some((f) => f.base) ? h('button', { class: 'fl-both', type: 'button', onclick: () => {
        const f = files[cur]; if (f?.base) copyText([f.base, f.text].filter((x) => x.trim()).join(', '), '기본 + 변형을 함께 복사했어요'); else toast('변형 프롬에서 쓸 수 있어요');
      } }, '+ 기본과 함께 복사') : null),
    h('button', { class: 'fl-plain', type: 'button', onclick: ctx.onPlain }, '기본 보기'));
  paintText();
  // 글이 길면 스크롤바 대신 아래를 흐리게
  const fade = () => text.classList.toggle('more', text.scrollHeight > text.clientHeight + 2 && text.scrollTop + text.clientHeight < text.scrollHeight - 2);
  text.addEventListener('scroll', fade, { passive: true });
  tabs.addEventListener('click', () => requestAnimationFrame(fade));
  requestAnimationFrame(fade);

  // 떠다니는 이미지
  const floaters = I.ids.slice(0, 12).map((ref, i) => {
    const hidden = I.spoilers.has(i);
    const el = h('button', { class: 'fl-img' + (hidden ? ' sp' : ''), type: 'button', 'aria-label': `이미지 ${i + 1} 크게 보기`,
      onclick: () => {
        if (el.classList.contains('sp')) { el.classList.remove('sp'); I.revealed.add(i); return; }
        openLightbox(I.ids, i, { spoilers: I.spoilers, revealed: I.revealed });
      } }, h('img', { alt: '', draggable: 'false' }));
    loadImage(ref).then((u) => { if (u) { el.firstChild.src = u; el.classList.add('ready'); } });
    stage.append(el);
    return { el, x: 0, y: 0, vx: 0, vy: 0, size: 0, hover: false };
  });
  floaters.forEach((f) => {
    f.el.addEventListener('mouseenter', () => { f.hover = true; });
    f.el.addEventListener('mouseleave', () => { f.hover = false; });
  });
  requestAnimationFrame(() => startFloat(stage, floaters));
  return stage;
}

function startFloat(stage, fl) {
  if (!fl.length) return;
  const W = () => stage.clientWidth, H = () => stage.clientHeight;
  fl.forEach((f, i) => {
    f.size = Math.max(70, Math.min(150, W() * (0.11 + (i % 3) * 0.025)));
    f.el.style.width = f.size + 'px';
    const a = (i / fl.length) * Math.PI * 2 + 0.4;
    f.x = W() / 2 + Math.cos(a) * W() * 0.36 - f.size / 2;
    f.y = H() / 2 + Math.sin(a) * H() * 0.36 - f.size / 2;
    const sp = 0.12 + ((i * 37) % 10) / 60;
    f.vx = Math.cos(a + 1.7) * sp; f.vy = Math.sin(a + 1.7) * sp;
  });
  const place = () => fl.forEach((f) => { f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px)`; });
  place();
  if (reduced()) return;
  let last = performance.now();
  const step = (now) => {
    if (!stage.isConnected) return;
    const dt = Math.min(48, now - last) / 16.7; last = now;
    const w = W(), hh = H();
    fl.forEach((f) => {
      if (f.hover) return;
      const fh = f.el.offsetHeight || f.size;
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < -f.size * 0.25 || f.x > w - f.size * 0.75) { f.vx *= -1; f.x = Math.max(-f.size * 0.25, Math.min(w - f.size * 0.75, f.x)); }
      if (f.y < -fh * 0.25 || f.y > hh - fh * 0.75) { f.vy *= -1; f.y = Math.max(-fh * 0.25, Math.min(hh - fh * 0.75, f.y)); }
    });
    place();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── 프롬창 2: 네임카드 (여권·우표 모양 + 표 모양 쪽지) ──
const KIND_CODE = { style: 'STY', character: 'CHR', scene: 'SCN' };
function mrz(post, handle, kind, n) {
  const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '<');
  const d = post.created ? new Date(post.created) : new Date();
  const ymd = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2);
  const fill = (s) => (s + '<'.repeat(44)).slice(0, 44);
  return [fill(`PD<DRW${clean(handle)}<<${KIND_CODE[kind] || 'PRM'}<<${clean(post.id).slice(0, 10)}`), fill(`${clean(post.id).slice(-9)}<${ymd}<${pad(n, 2)}<<${clean(handle).slice(0, 12)}`)];
}
const postmarkSvg = (top, mid, bottom) => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<svg viewBox="0 0 220 96" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6">
    <circle cx="48" cy="48" r="42"/><circle cx="48" cy="48" r="33"/>
    <path d="M96 30 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/><path d="M96 42 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/>
    <path d="M96 54 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/><path d="M96 66 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"/></g>
    <g fill="currentColor" text-anchor="middle" font-family="'JetBrains Mono', monospace">
    <text x="48" y="31" font-size="8" letter-spacing="1">${esc(top)}</text>
    <text x="48" y="52" font-size="11" font-weight="700">${esc(mid)}</text>
    <text x="48" y="70" font-size="8" letter-spacing="1">${esc(bottom)}</text></g></svg>`;
};

function cardView(content, ctx) {
  const { post, author } = ctx;
  const kind = kindOf(post);
  const files = promptFiles(content, kind);
  const I = imgSet(content);
  const blog = txt(author?.display) || ctx.handle;
  const d = post.created ? new Date(post.created) : null;
  const issue = d ? `${d.getFullYear()}.${pad(d.getMonth() + 1, 2)}.${pad(d.getDate(), 2)}` : '—';
  const serial = 'DRW-' + String(post.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();

  let at = 0;
  const photo = h('button', { class: 'idc-photo', type: 'button', 'aria-label': '사진 크게 보기',
    onclick: () => {
      if (photo.classList.contains('sp')) { photo.classList.remove('sp'); I.revealed.add(at); return; }
      if (I.ids.length) openLightbox(I.ids, at, { spoilers: I.spoilers, revealed: I.revealed });
    } }, h('img', { alt: '', draggable: 'false' }));
  const show = (i) => {
    at = i;
    photo.classList.toggle('sp', I.spoilers.has(i) && !I.revealed.has(i));
    photo.classList.toggle('none', !I.ids.length);
    if (I.ids[i]) loadImage(I.ids[i]).then((u) => { if (u && at === i) photo.firstChild.src = u; });
    strip.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const strip = h('div', { class: 'idc-strip' }, I.ids.length > 1 ? I.ids.slice(0, 8).map((_, i) =>
    h('button', { type: 'button', 'aria-label': `${i + 1}번째 사진`, onclick: () => show(i) }, pad(i + 1, 2))) : []);

  const row = (ko, en, value) => h('div', { class: 'idc-row' },
    h('span', { class: 'idc-k' }, ko, h('small', null, en)), h('span', { class: 'idc-dots', 'aria-hidden': 'true' }), h('span', { class: 'idc-v' }, value));
  const [m1, m2] = mrz(post, ctx.handle, kind, files.length);
  const card = h('article', { class: 'idc' },
    h('div', { class: 'idc-guil', 'aria-hidden': 'true' }),
    h('header', { class: 'idc-top' }, h('b', null, 'PROMPT PASS'), h('span', null, '프롬프트 여권'), h('em', null, serial)),
    h('div', { class: 'idc-main' },
      h('div', { class: 'idc-left' },
        h('div', { class: 'idc-stampbox' }, photo, h('span', { class: 'idc-denom' }, kindLabel(kind))),
        strip),
      h('div', { class: 'idc-right' },
        h('small', { class: 'idc-lbl' }, '이름 / NAME'),
        h('h2', { class: 'idc-name' }, txt(post.title) || '제목 없음'),
        row('종류', 'KIND', kindLabel(kind)),
        row('게시판', 'BOARD', ctx.boardName || '—'),
        row('발급일', 'ISSUED', issue),
        row('발급처', 'AUTHORITY', blog),
        row('수록', 'PAGES', `${files.length}매 · 사진 ${I.ids.length}장`),
        h('div', { class: 'idc-sig' }, h('span', null, blog), h('small', null, 'SIGNATURE OF BEARER')))),
    h('div', { class: 'idc-postmark', html: postmarkSvg('@' + ctx.handle.slice(0, 12).toUpperCase(), issue, 'DRAWER POST') }),
    h('div', { class: 'idc-mrz', 'aria-hidden': 'true' }, h('span', null, m1), h('span', null, m2)));
  show(0);

  // 표 모양 쪽지: 프롬마다 한 장, 누르면 복사
  const slips = files.map((f, i) => {
    const pre = h('pre', { class: 'idc-text' + (f.spoiler ? ' sp' : '') }, f.text);
    pre.addEventListener('click', () => {
      if (pre.classList.contains('sp')) { pre.classList.remove('sp'); return; }
      copyText(f.text, `${f.name} 복사했어요`);
    });
    return h('section', { class: 'idc-slip' + (f.neg ? ' neg' : '') },
      h('div', { class: 'idc-stub', 'aria-hidden': 'true' }, h('small', null, 'No.'), h('b', null, pad(i + 1, 2))),
      h('div', { class: 'idc-slip-body' },
        h('div', { class: 'idc-slip-head' },
          h('b', null, f.name),
          h('div', { class: 'idc-slip-tools' },
            f.base ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => copyText([f.base, f.text].filter((x) => x.trim()).join(', '), '기본 + 변형을 함께 복사했어요') }, '기본과 함께') : null,
            h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(f.text, `${f.name} 복사했어요`) }, icon('copy', 14), '복사'))),
        pre));
  });
  return h('div', { class: 'idc-wrap' }, card,
    h('div', { class: 'idc-slips' }, slips),
    h('button', { class: 'fl-plain idc-plain', type: 'button', onclick: ctx.onPlain }, '기본 보기'));
}

// ── 프롬창 3: 신분증 (처음 버전 네임카드) ──
function barcode(seed) {
  let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const bars = [];
  for (let i = 0; i < 46; i++) { x = (x * 1103515245 + 12345) >>> 0; bars.push(h('i', { style: { width: (1 + (x >>> 16) % 3) + 'px' } })); }
  return h('div', { class: 'idv-bar', 'aria-hidden': 'true' }, bars);
}

function idCardView(content, ctx) {
  const { post, author } = ctx;
  const kind = kindOf(post);
  const files = promptFiles(content, kind);
  const I = imgSet(content);
  const blog = txt(author?.display) || ctx.handle;
  const d = post.created ? new Date(post.created) : null;
  const issue = d ? `${pad(d.getMonth() + 1, 2)}/${pad(d.getDate(), 2)}/${d.getFullYear()}` : '—';
  const serial = 'DRW-' + String(post.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  let at = 0;
  const photo = h('button', { class: 'idv-photo', type: 'button', 'aria-label': '사진 크게 보기',
    onclick: () => {
      if (photo.classList.contains('sp')) { photo.classList.remove('sp'); I.revealed.add(at); return; }
      if (I.ids.length) openLightbox(I.ids, at, { spoilers: I.spoilers, revealed: I.revealed });
    } }, h('img', { alt: '', draggable: 'false' }));
  const show = (i) => {
    at = i;
    photo.classList.toggle('sp', I.spoilers.has(i) && !I.revealed.has(i));
    photo.classList.toggle('none', !I.ids.length);
    if (I.ids[i]) loadImage(I.ids[i]).then((u) => { if (u && at === i) photo.firstChild.src = u; });
    strip.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const strip = h('div', { class: 'idv-strip' }, I.ids.length > 1 ? I.ids.slice(0, 8).map((_, i) =>
    h('button', { type: 'button', 'aria-label': `${i + 1}번째 사진`, onclick: () => show(i) }, pad(i + 1, 2))) : []);
  const field = (label, value, cls = '') => h('div', { class: 'idv-field ' + cls }, h('small', null, label), h('div', { class: 'idv-val' }, value));
  const card = h('article', { class: 'idv' },
    h('span', { class: 'idv-hz tl', 'aria-hidden': 'true' }), h('span', { class: 'idv-hz tr', 'aria-hidden': 'true' }),
    h('div', { class: 'idv-left' },
      h('span', { class: 'idv-chip' }, ctx.handle.slice(0, 6).toUpperCase()),
      photo,
      h('div', { class: 'idv-plate' }, kindLabel(kind)),
      strip,
      h('div', { class: 'idv-codes' }, barcode(post.id || 'x'), h('span', { class: 'idv-ticks', 'aria-hidden': 'true' }))),
    h('div', { class: 'idv-right' },
      h('div', { class: 'idv-sign', 'aria-hidden': 'true' }, blog),
      h('h2', { class: 'idv-brand' }, blog),
      h('p', { class: 'idv-doc' }, 'PROMPT IDENTIFICATION DOCUMENT'),
      field('NAME', txt(post.title) || '제목 없음', 'boxed'),
      h('div', { class: 'idv-two' }, field('KIND', kindLabel(kind)), field('BOARD', ctx.boardName || '—')),
      field('DATE OF ISSUE', issue),
      h('div', { class: 'idv-bottom' },
        h('span', { class: 'idv-line', 'aria-hidden': 'true' }),
        h('span', { class: 'idv-stamp', 'aria-hidden': 'true' }, h('small', null, 'DRAWER'), h('b', null, kindLabel(kind)), h('small', null, '@' + ctx.handle)),
        h('span', { class: 'idv-holo', 'aria-hidden': 'true' }, blog.slice(0, 1).toUpperCase()),
        h('span', { class: 'idv-serial' }, serial))));
  show(0);
  const slips = files.map((f, i) => {
    const pre = h('pre', { class: 'idv-text' + (f.spoiler ? ' sp' : '') }, f.text);
    pre.addEventListener('click', () => { if (pre.classList.contains('sp')) { pre.classList.remove('sp'); return; } copyText(f.text, `${f.name} 복사했어요`); });
    return h('section', { class: 'idv-slip' + (f.neg ? ' neg' : '') },
      h('div', { class: 'idv-slip-head' },
        h('small', null, `ATTACHMENT ${pad(i + 1, 2)}`), h('b', null, f.name),
        h('div', { class: 'idv-slip-tools' },
          f.base ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => copyText([f.base, f.text].filter((x) => x.trim()).join(', '), '기본 + 변형을 함께 복사했어요') }, '기본과 함께') : null,
          h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(f.text, `${f.name} 복사했어요`) }, icon('copy', 14), '복사'))),
      pre);
  });
  return h('div', { class: 'idv-wrap' }, card, h('div', { class: 'idv-slips' }, slips),
    h('button', { class: 'fl-plain idc-plain', type: 'button', onclick: ctx.onPlain }, '기본 보기'));
}
