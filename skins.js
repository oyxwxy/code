// ───────── 스킨 (config.js 의 SKINS_FOR_ALL: true 면 전체 공개, false 면 관리자·BETA_HANDLES 에게만) ─────────
// 페이지 스킨(theme.skin) · 프롬 모음(theme.shelf) · 프롬창(theme.pview) 세 가지를 따로 골라요.
// 기존 화면 구조는 그대로 두고, 스킨은 겉모양(클래스·장식)만 덧입혀요.
import { h, icon, fmtDate, copyText, txt, toast } from './util.js';
import { loadImage, safeUrl } from './images.js';
import { loadContent } from './store.js';
import { kindOf, kindLabel, KINDS } from './kinds.js';
import { PARAM_FIELDS } from './nai.js';
import { SKIN_FONTS } from './theme.js';
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
// ── 새 스킨(테스트 중) 색상 ──
const SERIF2 = "Georgia, 'Times New Roman', 'Noto Serif KR', serif";
const flFrom = (c, dark) => ({
  '--fl-bg': c.flBg || c.bg, '--fl-bg2': c.flBg2 || c.flBg || c.bg, '--fl-ink': c.flInk || c.text, '--fl-sub': c.muted, '--fl-mark': c.accent,
  '--fl-hl': c.hl || c.accent, '--fl-hl-ink': c.hlInk || (dark ? '#111111' : '#ffffff'), '--fl-blend': dark ? 'luminosity' : 'multiply',
  '--fl-filter': 'grayscale(1) contrast(1.1)', '--fl-frame': c.flInk || c.text, '--fl-pattern': c.flPattern || 'none', '--fl-pattern-size': c.flPatternSize || 'auto',
  '--idc-paper': c.idcPaper || (dark ? '#efece4' : c.bg), '--idc-paper2': '#ffffff', '--idc-ink': c.idcInk || (dark ? '#14161f' : c.text), '--idc-acc': c.accent, '--idc-acc2': c.idcAcc2 || c.text,
});
// 천문 지도: 글자는 판(파란 바탕) 위에 놓이니까 기본 글자색 = 판 위 선 색
const chartTone = (name, c) => ({
  name, dark: true, sw: [c.paper, c.plate, c.acc],
  vars: {
    ...base({ bg: c.paper, surface: c.plate2, text: c.line, muted: `color-mix(in srgb, ${c.line} 68%, ${c.plate})`, border: `color-mix(in srgb, ${c.line} 45%, ${c.plate})`, accent: c.acc, soft: c.plate2, onAccent: c.plate }),
    '--font': SERIF2, '--radius': '0px',
    '--ch-paper': c.paper, '--ch-plate': c.plate, '--ch-plate2': c.plate2, '--ch-line': c.line, '--ch-ink': c.ink, '--ch-acc': c.acc,
    ...flFrom({ bg: c.plate, text: c.line, muted: c.line, accent: c.acc, hl: c.acc, hlInk: c.plate, flInk: c.line, idcPaper: c.paper, idcInk: c.ink, idcAcc2: c.plate,
      flPattern: `radial-gradient(circle, ${c.line} 0 .8px, transparent 1.2px)`, flPatternSize: '23px 19px' }, true),
  },
});
const probeTone = (name, dark, c) => ({
  name, dark, sw: [c.bg, c.ink, c.acc],
  vars: {
    ...base({ bg: c.bg, surface: c.surface, text: c.ink, muted: c.muted, border: c.ink, accent: c.ink, soft: c.soft, onAccent: c.bg }),
    '--font': "'Pretendard Variable', Pretendard, system-ui, sans-serif", '--radius': '0px',
    '--pb-bg': c.bg, '--pb-ink': c.ink, '--pb-acc': c.acc, '--pb-grain': c.grain, '--pb-grid': c.grid || 'transparent',
    ...flFrom({ bg: c.bg, text: c.ink, muted: c.muted, accent: c.acc, hl: c.acc, hlInk: dark ? c.bg : c.ink }, dark),
  },
});
const spaceTone = (name, c) => ({
  name, dark: true, sw: [c.bg, c.n1, c.acc],
  vars: {
    ...base({ bg: c.bg, surface: c.surface, text: c.ink, muted: c.muted, border: 'rgb(255 255 255 / .16)', accent: c.acc, soft: c.soft, onAccent: c.bg }),
    '--font': "'Pretendard Variable', Pretendard, system-ui, sans-serif", '--radius': '14px',
    '--sp-bg': c.bg, '--sp-ink': c.ink, '--sp-acc': c.acc, '--sp-n1': c.n1, '--sp-n2': c.n2, '--sp-n3': c.n3,
    ...flFrom({ bg: c.bg, flBg2: c.n1, text: c.ink, muted: c.muted, accent: c.acc, hl: c.acc, hlInk: c.bg }, true),
  },
});
// 시즌 모자이크: 계절·기념일마다 색과 그림이 바뀌어요. pal 은 모자이크 칸 색(글자 하나 = 색 하나)
const mosaicTone = (name, c) => ({
  name, dark: false, sw: [c.bg, c.pal.a, c.pal.b || c.accent], art: c.art, pal: c.pal,
  vars: {
    ...base({ bg: c.bg, surface: c.surface, text: c.text, muted: c.muted, border: c.border, accent: c.accent, soft: c.soft, onAccent: '#ffffff' }),
    '--font': "'Pretendard Variable', Pretendard, system-ui, sans-serif", '--radius': '0px',
    '--ms-bg': c.bg, '--ms-ink': c.text, '--ms-acc': c.accent,
    ...flFrom({ bg: c.bg, text: c.text, muted: c.muted, accent: c.accent, hl: c.soft, hlInk: c.text }, false),
  },
});
const TONES2 = {
  chart: {
    plate: chartTone('청판 성도', { paper: '#ece5d3', plate: '#1c3a8c', plate2: '#21429a', line: '#f3efe3', ink: '#1b2a55', acc: '#f3efe3' }),
    ink: chartTone('먹판 성도', { paper: '#e9e4d8', plate: '#131313', plate2: '#1c1c1c', line: '#efebe1', ink: '#151515', acc: '#efebe1' }),
    cobalt: chartTone('코발트 · 노랑', { paper: '#eceef2', plate: '#1d36c2', plate2: '#2340cc', line: '#e9edf7', ink: '#14205e', acc: '#f4e64a' }),
    night: chartTone('밤하늘 · 금박', { paper: '#e6dfcd', plate: '#0e1530', plate2: '#141d3d', line: '#e9e3cf', ink: '#0e1530', acc: '#e3c26a' }),
  },
  probe: {
    uranus: probeTone('천왕성', false, { bg: '#d9d9d5', surface: '#e3e3df', ink: '#141414', muted: '#55555a', acc: '#9cc6d3', soft: '#c9cfcf', grain: 'rgb(0 0 0 / .09)' }),
    blueprint: probeTone('청사진', true, { bg: '#1e4fd6', surface: '#2357e0', ink: '#f2f5ff', muted: '#b7c6ff', acc: '#ffffff', soft: '#2f62e6', grain: 'rgb(255 255 255 / .05)', grid: 'rgb(255 255 255 / .16)' }),
    nasa: probeTone('관측 필름', true, { bg: '#111111', surface: '#191919', ink: '#ededed', muted: '#9a9a9a', acc: '#ff4a2b', soft: '#262626', grain: 'rgb(255 255 255 / .06)' }),
    mars: probeTone('화성', false, { bg: '#e7dccd', surface: '#efe6da', ink: '#2a1912', muted: '#7a6457', acc: '#d4552e', soft: '#dccdbd', grain: 'rgb(60 20 0 / .08)' }),
  },
  space: {
    deep: spaceTone('깊은 우주', { bg: '#04060f', surface: '#0b1022', ink: '#e8ecff', muted: '#97a2c8', acc: '#9cc0ff', soft: '#16213f', n1: '#1b2a6b', n2: '#3a1d5c', n3: '#0f4a6b' }),
    nebula: spaceTone('성운', { bg: '#07040e', surface: '#130a22', ink: '#f6ecff', muted: '#b8a3cc', acc: '#ff9bd6', soft: '#2a143c', n1: '#5c1d5e', n2: '#7a2a3a', n3: '#2a1d6b' }),
    aurora: spaceTone('오로라', { bg: '#020c0c', surface: '#081a1a', ink: '#e6fff8', muted: '#8fc2b3', acc: '#6effd2', soft: '#0f2e2a', n1: '#0d5a4a', n2: '#1d3a6b', n3: '#3a6b1d' }),
    dawn: spaceTone('새벽 행성', { bg: '#08060c', surface: '#140f18', ink: '#fff2e6', muted: '#c9ab96', acc: '#ffb36b', soft: '#2e1d16', n1: '#6b3a1d', n2: '#3a1d4a', n3: '#1d2a5a' }),
  },
  mosaic: {
    auto: { name: '자동 (계절·기념일)', dark: false, sw: ['#f6f4ee', '#4c9a52', '#ff8fb1'], vars: {} },
    xmas: mosaicTone('크리스마스', { bg: '#f6f4ee', surface: '#ffffff', text: '#1d1d1b', muted: '#6d6b63', border: '#d9d6cc', accent: '#c4302b', soft: '#e7f0e3',
      art: 'xmas', pal: { a: '#4c9a52', b: '#2f7a3b', c: '#7cc06a', d: '#a7d39a', r: '#d63a33', y: '#f3c443', w: '#ffffff', t: '#7a5233' } }),
    buddha: mosaicTone('부처님 오신 날', { bg: '#fbf6ee', surface: '#ffffff', text: '#2b1d16', muted: '#7d6a5d', border: '#e6d9c8', accent: '#d9486b', soft: '#fde3e8',
      art: 'lotus', pal: { a: '#f28aa5', b: '#e2557a', c: '#ffc2d0', d: '#ffe1e8', g: '#5aa16b', y: '#f6c64b', r: '#c9303d', k: '#6b4a33' } }),
    spring: mosaicTone('봄', { bg: '#fbf7f6', surface: '#ffffff', text: '#2c2224', muted: '#7c6c70', border: '#eadfe0', accent: '#e36f92', soft: '#fbe5ec',
      art: 'blossom', pal: { a: '#f7b6c8', b: '#f093ad', c: '#fbd3de', d: '#fde9ef', t: '#7b5a48', g: '#9fcf8f' } }),
    summer: mosaicTone('여름', { bg: '#f3f8fa', surface: '#ffffff', text: '#122a33', muted: '#5f7680', border: '#d3e3ea', accent: '#1f8fbf', soft: '#dcf0f8',
      art: 'sea', pal: { a: '#3fa7d6', b: '#1f7fb3', c: '#8fd1ec', d: '#cdeef8', y: '#ffcf4a', s: '#f2e2b8', w: '#ffffff' } }),
    autumn: mosaicTone('가을', { bg: '#faf5ee', surface: '#ffffff', text: '#2d1d12', muted: '#7d6655', border: '#eadccb', accent: '#d2602a', soft: '#fbe5d3',
      art: 'maple', pal: { a: '#e4762f', b: '#c9472b', c: '#f2a64a', d: '#f6c779', t: '#6b4a33', r: '#a8321f' } }),
    winter: mosaicTone('겨울', { bg: '#f4f6f9', surface: '#ffffff', text: '#18212e', muted: '#677385', border: '#d9e0ea', accent: '#3d6fb6', soft: '#e3ebf6',
      art: 'snow', pal: { a: '#c9d8ea', b: '#9fb8d6', c: '#e8eff8', d: '#ffffff', m: '#6f87a6', k: '#3d4d63' } }),
  },
};
// 부처님 오신 날 (음력 4월 8일, 양력 날짜)
const BUDDHA_DAYS = { 2025: '05-05', 2026: '05-24', 2027: '05-13', 2028: '05-02', 2029: '05-20', 2030: '05-09', 2031: '05-28', 2032: '05-16' };
/** 오늘 날짜에 맞는 모자이크 시즌 */
export function seasonOf(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth() + 1;
  if (m === 12) return 'xmas';
  const bd = BUDDHA_DAYS[y];
  if (bd) {
    const day = new Date(`${y}-${bd}T00:00:00`);
    const diff = (day - new Date(y, d.getMonth(), d.getDate())) / 86400000;
    if (diff >= -1 && diff <= 14) return 'buddha';   // 2주 전부터 다음 날까지
  }
  return m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}
Object.assign(TONES, TONES2);
/** 고른 프리셋 (없거나 모르는 값이면 첫 번째). 시즌 모자이크의 '자동'은 오늘 날짜로 골라요 */
export const toneOf = (key, tone) => {
  const t = TONES[key];
  if (!t) return null;
  if (key === 'mosaic' && (!tone || tone === 'auto' || !t[tone])) return t[seasonOf()];
  return t[tone] || Object.values(t)[0];
};

let applied = [];
function setVars(vars) {
  const s = document.documentElement.style;
  // 기본 색(--bg 등)은 다음 화면의 applyTheme 이 다시 정하니까, 스킨 전용 변수만 지워요
  applied.forEach((k) => s.removeProperty(k));
  applied = [];
  for (const [k, v] of Object.entries(vars || {})) { s.setProperty(k, v); if (/^--(hp|tm|gm|gc|fl|idc|idv|sk|ch|pb|sp|ms)-/.test(k)) applied.push(k); }
}

/** 화면 전체 색(변수)을 스킨으로 바꿔요. 다른 화면으로 가면 app.js 가 data-skin 을 지우고, 다음 화면의 테마가 색을 다시 정해요 */
export function setPageSkin(skin, tone = '', fonts = null) {
  const el = document.documentElement;
  if (!skin) { delete el.dataset.skin; return; }
  ensureSkinFont();
  const t = toneOf(skin, tone);
  // 고른 글꼴: 제목(--sk-title) · 꾸밈(--sk-ui) · 본문(--font). 안 고른 칸은 스킨 기본
  const f = {};
  const stack = (k) => (k && SKIN_FONTS[k]?.stack) || '';
  if (stack(fonts?.title)) f['--sk-title'] = stack(fonts.title);
  if (stack(fonts?.ui)) f['--sk-ui'] = stack(fonts.ui);
  if (stack(fonts?.body)) f['--font'] = stack(fonts.body);
  setVars({ ...(t?.vars || {}), ...f });
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
  setPageSkin(skin, ctx.theme.skinTone, ctx.theme.skinFonts?.[skin]);
  ctx.root.classList.add('skin', 'skin-' + skin);
  if (skin === 'home') dressHome(ctx);
  else if (skin === 'term') dressTerm(ctx);
  else if (skin === 'game') dressGame(ctx);
  else if (skin === 'grid') dressGrid(ctx);
  else if (skin === 'chart') dressChart(ctx);
  else if (skin === 'probe') dressProbe(ctx);
  else if (skin === 'space') dressSpace(ctx);
  else if (skin === 'mosaic') dressMosaic(ctx);
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
  const items = [...(theme.showAll ? [{ id: 'all', name: '전체 보기' }] : []), ...(picked.length ? picked : boards).slice(0, 4)];
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

// ═════════════════════ 테스트 중인 페이지 스킨 (관리자만) ═════════════════════
// 같은 블로그는 늘 같은 별자리·모자이크가 나오게, 아이디로 정해지는 난수를 써요
function seeded(str) {
  let x = 2166136261;
  for (const c of String(str)) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return () => { x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n) => { let s = ''; n = Math.max(1, Math.min(3999, n | 0)); for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
const GREEK = 'αβγδεζηθικλμνξοπρστυφχψω';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yearOf = (prof) => (prof.created ? new Date(prof.created).getFullYear() : new Date().getFullYear());

// ── 5. 천문 지도: 화면 전체가 한 장의 성도(星圖) 판 ──
// 종이 여백 위에 파란 판을 찍고, 그 판 위에 경위선 · 은하수 점묘 · 별 · 주석 글씨를 판 크기에 맞춰 그려요.
// 블로그 이름은 별자리 이름처럼, 게시판은 별자리 목록처럼, 도구줄은 범례 상자처럼 보여요.
function starPath(cx, cy, r, n = 6) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI / n) * i - Math.PI / 2; const rr = i % 2 ? r * 0.3 : r; p.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`); }
  return `<polygon points="${p.join(' ')}"/>`;
}
function drawSky(el, seed, notes) {
  const W = Math.round(el.clientWidth), H = Math.round(el.clientHeight);
  if (W < 50 || H < 50) return;
  const R = seeded(seed);
  const o = [];
  // 적위선: 판 밖 아래쪽에 중심을 둔 큰 원호들
  const cx = W * (0.35 + R() * 0.3), cy = H + W * 0.9;
  o.push('<g class="g-arc" fill="none">');
  for (let i = 0; i < Math.ceil(H / 520) + 2; i++) o.push(`<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(W * 0.9 + 120 + i * 520).toFixed(0)}"/>`);
  o.push('</g>');
  // 시간선(적경선): 비스듬히 판을 가로질러요
  o.push('<g class="g-hr">');
  const hrs = [];
  for (let i = 0; i < 4; i++) {
    const x1 = W * (0.12 + i * 0.27) + (R() - 0.5) * 40, x2 = x1 + (R() - 0.5) * W * 0.35;
    hrs.push([x1, x2]);
    o.push(`<line x1="${x1.toFixed(0)}" y1="0" x2="${x2.toFixed(0)}" y2="${H}"/>`);
  }
  o.push('</g>');
  // 은하수: 판 대각선을 따라 띠 모양으로 찍은 점
  o.push('<g class="g-milky">');
  const dots = Math.min(6000, Math.round(W * H / 260));
  const ax = W * 0.15, ay = H, bx = W * 0.9, by = 0;
  for (let i = 0; i < dots; i++) {
    const t = R(), spread = (R() + R() + R() - 1.5) * Math.min(W, 520) * 0.32;
    const x = ax + (bx - ax) * t + spread * 0.85, y = ay + (by - ay) * t + spread * 0.5;
    if (x < 0 || x > W || y < 0 || y > H) continue;
    o.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.5 + R() * 1.05).toFixed(2)}"/>`);
  }
  o.push('</g>');
  // 별 + 그리스 문자
  o.push('<g class="g-star">');
  const n = Math.round(W * H / 26000);
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, big = R() < 0.18, r = big ? 7 + R() * 6 : 2.5 + R() * 4;
    o.push(starPath(x, y, r, big ? 6 : R() < 0.5 ? 6 : 4));
    if (big || R() < 0.25) o.push(`<text x="${(x + r + 4).toFixed(0)}" y="${(y + 5).toFixed(0)}">${GREEK[Math.floor(R() * GREEK.length)]}</text>`);
  }
  o.push('</g>');
  // 주석 글씨 (원래 성도의 '10 hours', '30° South Declination' 자리)
  o.push('<g class="g-note">');
  hrs.forEach(([x1], i) => o.push(`<text x="${(x1 + 8).toFixed(0)}" y="22">${notes.hours[i % notes.hours.length]}</text>`));
  let y = 260;
  notes.decl.forEach((t) => { if (y < H - 60) o.push(`<text x="${(18 + R() * 30).toFixed(0)}" y="${y}" transform="rotate(-11 40 ${y})">${esc(t)}</text>`); y += 340 + R() * 200; });
  o.push('</g>');
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${o.join('')}</svg>`;
}
function dressChart({ root, head, body, pickBar, prof, boards, posts }) {
  const year = yearOf(prof);
  const sky = h('div', { class: 'ch-sky', 'aria-hidden': 'true' });
  const sheet = h('div', { class: 'ch-sheet' }, sky, head, body);
  const top = h('div', { class: 'ch-top' }, h('span', null, '@' + prof.handle), h('b', null, `Map Nº ${roman(posts.length || 1)}.`), h('span', null, `Anno ${year}`));
  const bottom = h('div', { class: 'ch-bottom' }, h('span', null, `${posts.length || 0} hours Right Ascension`), h('b', null, 'SOUTH POLE'), h('span', null, `${boards.length} hours Rt Ascension`));
  root.replaceChildren(top, sheet, bottom, pickBar);
  // 블로그 이름: 별자리 이름처럼 (판 위에 비스듬히), 프로필 사진은 행성처럼
  head.querySelector('.blog-name')?.classList.add('ch-name');
  const notes = {
    hours: ['10 hours', '9 hours', `${posts.length} stars`, `${boards.length} constellations`],
    decl: [`30° South Declination`, `120° Nor Pol Distance`, `@${prof.handle}`, `140° North Polar Distance`, `since ${year}`, `160° North Polar Distance`],
  };
  const seed = prof.handle + 'atlas';
  let t = 0, lastW = 0, lastH = 0;
  const redraw = () => { clearTimeout(t); t = setTimeout(() => { const w = sky.clientWidth, hh = sky.clientHeight; if (Math.abs(w - lastW) < 2 && Math.abs(hh - lastH) < 40) return; lastW = w; lastH = hh; drawSky(sky, seed, notes); }, 120); };
  const ro = new ResizeObserver(() => { if (!sheet.isConnected) { ro.disconnect(); return; } redraw(); });
  ro.observe(sheet);
  requestAnimationFrame(() => drawSky(sky, seed, notes));
}

// ── 프롬 모음 4: 별자리 (글 = 별, 게시판 = 별자리) ──
// 게시판마다 별자리 하나. 글은 별, 같은 게시판 글은 선으로 이어지고, 별에 마우스를 올리면 작은 설명 카드가 떠요.
// 별 자리: 칸을 고르게 나눈 뒤 위아래로 지그재그 + 살짝 흔들어서, 이름표끼리 겹치지 않게
function constellationLayout(n, R, perRow) {
  const rows = Math.ceil(n / perRow);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow), col = row % 2 ? perRow - 1 - (i % perRow) : i % perRow;   // 줄마다 방향을 바꿔 선이 이어지게
    const span = perRow > 1 ? 0.8 / (perRow - 1) : 0;
    const x = 0.07 + col * span + (R() - 0.5) * span * 0.35;
    const band = 1 / rows, base = 0.16 + row * band * 0.84;
    const y = base + band * 0.84 * (0.25 + (col % 2 ? 0.45 : 0.1) + (R() - 0.5) * 0.25);
    pts.push([Math.max(0.04, Math.min(0.9, x)), Math.max(0.14, Math.min(0.92, y))]);
  }
  return pts;
}
function starsView(rows, ctx) {
  const groups = new Map();
  rows.forEach((p) => { const k = ctx.boardOf(p) || '_'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
  const wrap = h('div', { class: 'st-wrap' });
  const tip = h('div', { class: 'st-tip', role: 'tooltip', hidden: true });
  let gi = 0;
  for (const [k, list] of groups) {
    const R = seeded((k || '_') + 'cons');
    const name = k === '_' ? 'Incognita' : (ctx.boardName(k) || 'Incognita');
    const perRow = innerWidth < 640 ? 2 : innerWidth < 1000 ? 4 : 6;
    const H = 150 + Math.ceil(list.length / perRow) * 96;
    const box = h('section', { class: 'st-con', style: { height: H + 'px' } });
    const pts = constellationLayout(list.length, R, perRow);
    // 선
    const lines = pts.slice(1).map(([x, y], i) => `<line x1="${(pts[i][0] * 100).toFixed(2)}%" y1="${(pts[i][1] * 100).toFixed(2)}%" x2="${(x * 100).toFixed(2)}%" y2="${(y * 100).toFixed(2)}%"/>`).join('');
    box.append(h('div', { class: 'st-lines', html: `<svg width="100%" height="100%" aria-hidden="true">${lines}</svg>` }));
    box.append(h('h4', { class: 'st-name' }, h('i', null, ROMAN_SMALL(gi + 1)), name, h('small', null, `${list.length} stars`)));
    list.forEach((p, i) => {
      const [x, y] = pts[i];
      const big = i === 0 || R() < 0.25;
      const s = h('a', { class: 'st-star' + (big ? ' big' : '') + (p.vis === 'locked' ? ' locked' : '') + (x > 0.66 ? ' flip' : ''), href: '#/p/' + p.id, style: { left: (x * 100).toFixed(2) + '%', top: (y * 100).toFixed(2) + '%' }, 'aria-label': txt(p.title) || '제목 없음' },
        h('span', { class: 'st-glyph', 'aria-hidden': 'true', html: `<svg viewBox="-12 -12 24 24">${starPath(0, 0, 11, big ? 6 : 4)}</svg>` }),
        h('span', { class: 'st-lbl' }, h('i', null, GREEK[i % GREEK.length]), txt(p.title) || '제목 없음'));
      const show = () => {
        const th = safeThumb(p.thumb);
        tip.replaceChildren(
          th ? h('img', { src: th, alt: '', class: (p.spoiler && p.vis === 'public') || p.thumbSp ? 'sp' : '' }) : null,
          h('b', null, txt(p.title) || '제목 없음'),
          h('small', null, [kindLabel(kindOf(p)), fmtDate(p.created)].join(' · ')));
        tip.hidden = false;
        const r = s.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        const left = Math.min(wr.width - 210, Math.max(0, r.left - wr.left + 18));
        tip.style.left = left + 'px'; tip.style.top = (r.top - wr.top + 22) + 'px';
      };
      s.addEventListener('mouseenter', show); s.addEventListener('focus', show);
      s.addEventListener('mouseleave', () => { tip.hidden = true; }); s.addEventListener('blur', () => { tip.hidden = true; });
      box.append(s);
    });
    wrap.append(box);
    gi++;
  }
  wrap.append(tip);
  return wrap;
}
const ROMAN_SMALL = (n) => roman(n).toLowerCase() + '.';

// ── 6. 관측 기록: 거친 종이에 인쇄한 관측 포스터 + 디지털 데이터 표 ──
function orbitSvg(boards) {
  const W = 420, H = 150, cx = 210, cy = 78;
  const out = ['<g fill="none" class="pb-orb">'];
  const n = Math.max(3, Math.min(7, boards.length + 2));
  for (let i = 1; i <= n; i++) out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${24 + i * 26}" ry="${8 + i * 9}"/>`);
  out.push('</g><circle class="pb-sun" cx="210" cy="78" r="13"/>');
  boards.slice(0, n - 1).forEach((b, i) => {
    const a = 0.6 + i * 1.7, rx = 24 + (i + 2) * 26, ry = 8 + (i + 2) * 9;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    out.push(`<circle class="pb-planet" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${4 + (i % 3) * 2}"/>`);
    if (i === 0) out.push(`<text class="pb-orb-lbl" x="${(x - 18).toFixed(1)}" y="${(y - 12).toFixed(1)}">${esc(b.name.toUpperCase().slice(0, 14))}</text>`);
  });
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${out.join('')}</svg>`;
}
function dressProbe({ head, body, main, prof, boards, selectBoard, posts }) {
  // 이름을 단어별로 끊어 쌓은 큰 블록 글자 (한 단어면 3~4글자씩). 가장 긴 줄이 칸에 꼭 맞게 글자 크기를 정해요
  const full = (txt(prof.display) || prof.handle).trim();
  let lines = full.split(/\s+/).filter(Boolean);
  if (lines.length === 1 && lines[0].length > 6) { const w = lines[0], per = /[가-힣]/.test(w) ? 2 : Math.ceil(w.length / Math.ceil(w.length / 4)); lines = []; for (let i = 0; i < w.length; i += per) lines.push(w.slice(i, i + per)); }
  lines = lines.slice(0, 4);
  const units = (l) => [...l].reduce((n, c) => n + (/[가-힣ㄱ-ㅎ]/.test(c) ? 1 : /[MW]/i.test(c) ? 0.78 : 0.6), 0);
  const wUnits = Math.max(2.4, ...lines.map(units));
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const last = posts.reduce((m, p) => Math.max(m, p.created || 0), 0);
  const month = new Date().getMonth();
  const row = (a, b) => h('div', { class: 'pb-row' }, h('span', null, a), h('span', null, b));
  const bars = [];
  const R = seeded(prof.handle + 'bar');
  for (let i = 0; i < 40; i++) bars.push(h('i', { style: { width: (1 + Math.floor(R() * 3)) + 'px' } }));
  const hero = h('section', { class: 'pb-hero' },
    h('div', { class: 'pb-block', style: { '--w': wUnits.toFixed(2) }, 'aria-label': full }, lines.map((l) => h('span', null, l))),
    h('div', { class: 'pb-side' },
      h('div', { class: 'pb-top' }, h('span', null, `“DRAWER” OBSERVATION LOG\nBY @${prof.handle}`), h('span', null, `© ${yearOf(prof)} ${prof.handle.toUpperCase()}`)),
      h('div', { class: 'pb-table' },
        h('div', { class: 'pb-row head' }, h('span', null, `THE ${(txt(prof.display) || prof.handle).toUpperCase()}`)),
        row('ENTRIES', String(posts.length)), row('BOARDS', String(boards.length)),
        h('div', { class: 'pb-gap' }),
        row('SINCE', String(yearOf(prof))), row('LAST SIGNAL', last ? fmtDate(last) : '—')),
      h('div', { class: 'pb-dots' }, Array.from({ length: 12 }, (_, i) => h('i', { class: i === month ? 'on' : '' })), h('b', { 'aria-hidden': 'true' }), h('span', { class: 'pb-bar' }, bars)),
      txt(prof.bio) ? h('p', { class: 'pb-bio' }, txt(prof.bio)) : null,
      h('div', { class: 'pb-orbit', html: orbitSvg(boards) }),
      h('div', { class: 'pb-menu' }, boards.slice(0, 5).map((b) => h('button', { type: 'button', onclick: () => { selectBoard(b.id); go(); } }, '+ ' + b.name)),
        h('button', { class: 'pb-go', type: 'button', onclick: go }, 'CHANGE; REVOLT →'))),
    ...[[6, 18], [38, 62], [55, 8], [92, 40], [70, 88]].map(([x, y]) => h('i', { class: 'pb-plus', style: { left: x + '%', top: y + '%' }, 'aria-hidden': 'true' }, '+')));
  head.before(hero);
  body.classList.add('pb-body');
}

// ── 7. 우주 유영: 움직이는 별밭 + 성운 + 떠다니는 카드 ──
function spaceSky(root) {
  const cv = h('canvas', { class: 'sp-sky', 'aria-hidden': 'true' });
  const neb = h('div', { class: 'sp-neb', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
  root.prepend(neb, cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, stars = [], shoot = null, mx = 0, my = 0, raf = 0;
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round(W * H / 2600);
    stars = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), tw: Math.random() * 6.28, s: 0.002 + Math.random() * 0.01 }));
  };
  const color = getComputedStyle(document.documentElement).getPropertyValue('--sp-ink').trim() || '#e8ecff';
  const draw = (t) => {
    if (!cv.isConnected) { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('pointermove', onMove); return; }
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const depth = 0.3 + s.z * 0.7;
      const x = (s.x + mx * depth * 18 + t * 0.004 * depth) % W, y = (s.y + my * depth * 18 + t * 0.0015 * depth) % H;
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.tw + t * s.s)) * depth;
      ctx.globalAlpha = a; ctx.fillStyle = color;
      const r = 0.4 + depth * 1.3;
      ctx.beginPath(); ctx.arc(x < 0 ? x + W : x, y < 0 ? y + H : y, r, 0, 6.283); ctx.fill();
      if (depth > 0.93) { ctx.globalAlpha = a * 0.5; ctx.fillRect(x - r * 4, y - 0.4, r * 8, 0.8); ctx.fillRect(x - 0.4, y - r * 4, 0.8, r * 8); }
    }
    // 가끔 별똥별
    if (!shoot && Math.random() < 0.003) shoot = { x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, l: 0 };
    if (shoot) {
      shoot.l += 14;
      const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x + shoot.l, shoot.y + shoot.l * 0.45);
      g.addColorStop(0, 'transparent'); g.addColorStop(1, color);
      ctx.globalAlpha = Math.max(0, 1 - shoot.l / 420); ctx.strokeStyle = g; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x + shoot.l, shoot.y + shoot.l * 0.45); ctx.stroke();
      if (shoot.l > 420) shoot = null;
    }
    ctx.globalAlpha = 1;
    if (!reduced()) raf = requestAnimationFrame(draw);
  };
  const onMove = (e) => { mx = (e.clientX / W - 0.5) * -1; my = (e.clientY / H - 0.5) * -1; };
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', onMove, { passive: true });
  raf = requestAnimationFrame(draw);
}
function dressSpace({ root, head, body, main, prof, boards, selectBoard }) {
  spaceSky(root);
  const name = txt(prof.display) || prof.handle;
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const R = seeded(prof.handle + 'sp');
  const spark = Array.from({ length: 7 }, (_, i) => h('i', { class: 'sp-spark', 'aria-hidden': 'true', style: { left: (6 + R() * 88) + '%', top: (8 + R() * 80) + '%', '--s': (0.5 + R() * 1.1).toFixed(2), '--d': (R() * 4).toFixed(2) + 's' } }));
  const hero = h('section', { class: 'sp-hero' },
    ...spark,
    h('div', { class: 'sp-pin' }, h('span', null, 'you are here'), h('i', { 'aria-hidden': 'true' })),
    h('h1', { class: 'sp-name' }, name),
    h('p', { class: 'sp-sub' }, `@${prof.handle} · drifting since ${yearOf(prof)}`),
    h('div', { class: 'sp-orbits' }, boards.slice(0, 5).map((b, i) => h('button', { type: 'button', style: { '--i': i }, onclick: () => { selectBoard(b.id); go(); } }, h('i', { 'aria-hidden': 'true' }), b.name))),
    h('button', { class: 'sp-dive', type: 'button', onclick: go, 'aria-label': '글 목록으로' }, h('span', null, 'dive in'), h('i', { 'aria-hidden': 'true' }, '↓')));
  head.before(hero);
  body.classList.add('sp-body');
}

// ── 8. 시즌 모자이크: 계절·기념일마다 바뀌는 흐릿한 픽셀 그림 ──
// 그림은 칸 지도로 만들어요: 그림마다 '어느 칸에 어떤 색 글자'를 계산 → 색은 tone.pal
function artMap(kind, R) {
  const W = 21, H = 18;
  const g = Array.from({ length: H }, () => Array(W).fill(''));
  const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const pick = (s) => s[Math.floor(R() * s.length)];
  const blob = (cx, cy, rx, ry, cols, rough = 0.18) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1 - rough + R() * rough * 2) put(x, y, pick(cols));
    }
  };
  if (kind === 'xmas') {
    put(10, 0, 'y'); put(9, 1, 'y'); put(10, 1, 'y'); put(11, 1, 'y');
    for (let r = 0; r < 14; r++) {
      const half = Math.floor(r * 0.72) + (r % 3 === 0 ? 0 : 1) - (r > 0 && r % 4 === 0 ? 1 : 0);
      for (let x = 10 - half; x <= 10 + half; x++) put(x, 2 + r, R() < 0.09 ? pick('ry') : pick('aabbccd'));
    }
    for (let y = 16; y < 18; y++) for (let x = 9; x <= 11; x++) put(x, y, 't');
  } else if (kind === 'lotus') {
    const lan = [[4, 4], [10, 6], [16, 4]];
    lan.forEach(([cx, cy]) => {
      for (let y = 0; y < cy - 2; y++) put(cx, y, 'k');
      for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d <= 5) put(x, y, d <= 1 ? 'd' : d <= 2 ? 'c' : R() < 0.5 ? 'a' : 'b');
      }
      put(cx, cy + 3, 'y'); put(cx, cy + 4, 'y');
    });
    // 아래쪽 연꽃
    const fl = [[10, 13, 3], [7, 15, 2], [13, 15, 2], [10, 16, 2]];
    fl.forEach(([cx, cy, r]) => { for (let y = cy - r; y <= cy; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.abs(x - cx) <= r - (cy - y) * 0.6) put(x, y, pick('aabc')); });
    for (let x = 3; x <= 17; x++) put(x, 17, R() < 0.8 ? 'g' : '');
  } else if (kind === 'blossom' || kind === 'maple') {
    const cols = kind === 'blossom' ? 'aabbccd' : 'aabbccdr';
    blob(10, 6, 8.5, 5.2, cols);
    for (let y = 10; y < 17; y++) put(10, y, 't');
    put(11, 12, 't'); put(9, 14, 't'); put(12, 11, 't'); put(8, 13, 't');
    for (let i = 0; i < 12; i++) put(Math.floor(R() * W), 12 + Math.floor(R() * 6), pick(cols));
    if (kind === 'blossom') for (let x = 4; x <= 16; x++) if (R() < 0.7) put(x, 17, 'g');
  } else if (kind === 'sea') {
    blob(15, 3.2, 2.6, 2.6, 'y', 0.05);
    for (let y = 8; y < 16; y++) for (let x = 0; x < W; x++) {
      const wave = Math.sin((x + y * 1.7) * 0.9) > 0.2;
      put(x, y, y < 10 ? (wave ? 'd' : 'c') : y < 13 ? (wave ? 'c' : 'a') : (wave ? 'a' : 'b'));
    }
    for (let y = 16; y < 18; y++) for (let x = 0; x < W; x++) put(x, y, R() < 0.12 ? 'w' : 's');
  } else {   // snow: 눈 덮인 산 + 내리는 눈
    const peak = (cx, top, w) => { for (let y = top; y < 15; y++) { const half = Math.floor((y - top) * w); for (let x = cx - half; x <= cx + half; x++) put(x, y, y - top < 2 + (x % 2) ? 'd' : pick('mmk')); } };
    peak(7, 4, 0.9); peak(14, 6, 1.0);
    for (let y = 15; y < 18; y++) for (let x = 0; x < W; x++) put(x, y, pick('abcd'));
    for (let i = 0; i < 16; i++) { const x = Math.floor(R() * W), y = Math.floor(R() * 12); if (!g[y][x]) put(x, y, 'w'); }
  }
  return { W, H, g };
}
function mosaicArt(tone, seed) {
  const R = seeded(seed + tone.art);
  const { W, H, g } = artMap(tone.art, R);
  const pal = { w: '#ffffff', ...tone.pal };
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = g[y][x];
    if (ch && pal[ch]) {
      // 밝게(--l) 또는 어둡게(--k) 살짝 흔들어요 (color-mix 는 음수 % 를 못 써서 둘로 나눠요)
      const v = R() - 0.5, l = v > 0 ? Math.round(v * 44) : 0, k = v < 0 ? Math.round(-v * 30) : 0;
      cells.push(h('i', { class: 'on', style: { '--c': pal[ch], '--l': l + '%', '--k': k + '%', '--o': (0.8 + R() * 0.2).toFixed(2) } }));
      continue;
    }
    // 그림 가장자리에 흐릿한 칸을 조금 (손으로 붙인 모자이크 느낌)
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([dx, dy]) => g[y + dy]?.[x + dx]).find((c) => c && pal[c] && c !== 'w');
    cells.push(near && R() < 0.45 ? h('i', { class: 'halo', style: { '--c': pal[near], '--o': (0.12 + R() * 0.2).toFixed(2) } }) : h('i'));
  }
  return h('div', { class: 'ms-grid', style: { '--cols': W } }, cells);
}
const SEASON_COPY = {
  xmas: ['rockin\' around', '반짝이는 연말 프롬프트를 모았어요'], lotus: ['lotus lanterns', '연등처럼 환하게 밝혀 둔 서랍'], blossom: ['in full bloom', '봄바람 따라 꺼내 보는 서랍'],
  sea: ['summer tide', '파도처럼 밀려온 프롬프트'], maple: ['falling leaves', '천천히 물드는 가을 서랍'], snow: ['first snow', '눈 내리는 날의 조용한 서랍'],
};
function dressMosaic({ head, body, main, prof, theme }) {
  const tone = toneOf('mosaic', theme.skinTone);
  const name = txt(prof.display) || prof.handle;
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const [sub, line] = SEASON_COPY[tone.art] || SEASON_COPY.xmas;
  // 기념일 장식: 크리스마스엔 산타 모자, 부처님 오신 날엔 연등 줄
  const hat = tone.art === 'xmas' ? h('span', { class: 'ms-hat', 'aria-hidden': 'true', html:
    '<svg viewBox="0 0 64 48"><path d="M6 40 C14 14 30 4 48 10 C56 13 58 22 60 30 L52 28 C46 22 36 20 30 26 C22 32 18 38 18 42 Z" fill="#d63a33"/><rect x="2" y="36" width="34" height="10" rx="5" fill="#fff"/><circle cx="60" cy="31" r="5" fill="#fff"/></svg>' }) : null;
  const lanterns = tone.art === 'lotus' ? h('div', { class: 'ms-lanterns', 'aria-hidden': 'true' }, ...['#f28aa5', '#f6c64b', '#e2557a', '#ffc2d0', '#f28aa5'].map((c, i) => h('i', { style: { '--c': c, '--i': i } }))) : null;
  const hero = h('section', { class: 'ms-hero ms-' + tone.art },
    h('p', { class: 'ms-brand' }, (txt(prof.display) || prof.handle).toUpperCase()),
    lanterns,
    mosaicArt(tone, prof.handle),
    h('h1', { class: 'ms-title' }, hat, h('span', null, sub)),
    h('p', { class: 'ms-line' }, `${name} — ${line}`),
    h('button', { class: 'ms-go', type: 'button', onclick: go }, 'OPEN DRAWER'));
  head.before(hero);
  body.classList.add('ms-body');
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
  if (shelf === 'stars') return starsView(rows, ctx);
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
