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

/** 화면 전체 색(변수)만 스킨으로 바꿔요. 다른 화면으로 가면 app.js 가 지워요 */
export function setPageSkin(skin) {
  if (!skin) { delete document.documentElement.dataset.skin; return; }
  ensureSkinFont();
  document.documentElement.dataset.skin = skin;
  document.documentElement.dataset.mode = skin === 'term' ? 'dark' : 'light';
}

// ═════════════════════ 페이지 스킨 ═════════════════════
/**
 * 블로그 화면에 스킨을 입혀요.
 * ctx: { root, head, body, side, main, pickBar, prof, theme, boards, selectBoard, posts }
 */
export function dressBlog(skin, ctx) {
  setPageSkin(skin);
  ctx.root.classList.add('skin', 'skin-' + skin);
  if (skin === 'home') dressHome(ctx);
  else if (skin === 'term') dressTerm(ctx);
  else if (skin === 'game') dressGame(ctx);
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

// ── 3. 게임 타이틀: 초록 그리드 복도 + 큰 픽셀 제목 + START ──
function corridorSvg() {
  const W = 1000, H = 560, cx = W / 2, cy = H / 2;
  const iw = 230, ih = 128;   // 소실점 쪽 안쪽 사각형
  const lines = [];
  const L = (x1, y1, x2, y2) => lines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
  // 깊이(안쪽으로 갈수록 촘촘하게)
  for (let k = 0; k <= 9; k++) {
    const t = 1 - Math.pow(0.72, k);
    const w = W - (W - iw) * t, hh = H - (H - ih) * t;
    lines.push(`<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - hh / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/>`);
  }
  // 바깥 테두리 → 안쪽 사각형으로 모이는 선
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

function dressGame({ root, head, body, main, prof, theme, boards, selectBoard }) {
  const name = txt(prof.display) || prof.handle;
  const avatar = h('div', { class: 'gm-photo', 'aria-hidden': 'true' });
  if (theme.avatar) loadImage(theme.avatar).then((u) => { if (u) { avatar.style.backgroundImage = `url("${u}")`; avatar.classList.add('on'); } });
  // 게시판은 화면 가장자리의 작은 메뉴 상자로 (최대 6개)
  const spots = ['l1', 'l2', 'r1', 'r2', 'l3', 'r3'];
  const menu = boards.slice(0, 6).map((b, i) =>
    h('button', { class: 'gm-tag ' + spots[i], type: 'button', onclick: () => { selectBoard(b.id); go(); } }, '• ' + b.name));
  const go = () => main.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const hero = h('section', { class: 'gm-hero' },
    h('div', { class: 'gm-grid', html: corridorSvg() }),
    h('div', { class: 'gm-dots l', 'aria-hidden': 'true' }),
    avatar,
    h('div', { class: 'gm-id' }, '@' + prof.handle),
    h('h1', { class: 'gm-title' }, h('span', null, name)),
    ...menu,
    h('button', { class: 'gm-start', type: 'button', onclick: go },
      h('span', { class: 'gm-ring', 'aria-hidden': 'true' }), h('b', null, 'START'), h('span', { class: 'gm-cur', 'aria-hidden': 'true' }, '↖')));
  head.before(hero);
  body.classList.add('gm-body');
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
  return h('div', { class: 'rec-wrap' }, h('div', { class: 'rec-cap', 'aria-live': 'polite' }, capDate, capTitle, capMeta), stage);
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
  let n = 0, turn = 0;
  const cab = h('div', { class: 'fd-cab' });
  groups.forEach(([k, list], gi) => {
    cab.append(h('div', { class: 'fd-row divider ' + (gi % 2 ? 'c' : 'a') },
      h('span', { class: 'fd-tab dark', tabindex: '-1' }, h('b', null, kindLabel(k)), h('em', null, pad(list.length))), h('span', { class: 'fd-edge' })));
    list.forEach((p) => {
      n++;
      const row = h('div', { class: 'fd-row ' + offs[turn++ % offs.length] });
      const files = h('div', { class: 'fd-files' });
      const tab = h('button', { class: 'fd-tab', type: 'button', 'aria-expanded': 'false', onclick: () => toggle() },
        h('i', null, pad(n)), h('span', null, txt(p.title) || '제목 없음'));
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
  if (pview === 'card') return cardView(content, ctx);
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

// ── 프롬창 2: 네임카드 (신분증 모양 + 붙임 쪽지) ──
function barcode(seed) {
  let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const bars = [];
  for (let i = 0; i < 46; i++) { x = (x * 1103515245 + 12345) >>> 0; bars.push(h('i', { style: { width: (1 + (x >>> 16) % 3) + 'px' } })); }
  return h('div', { class: 'idc-bar', 'aria-hidden': 'true' }, bars);
}

function cardView(content, ctx) {
  const { post, author } = ctx;
  const kind = kindOf(post);
  const files = promptFiles(content, kind);
  const I = imgSet(content);
  const blog = txt(author?.display) || ctx.handle;
  const d = post.created ? new Date(post.created) : null;
  const issue = d ? `${pad(d.getMonth() + 1, 2)}/${pad(d.getDate(), 2)}/${d.getFullYear()}` : '—';
  const serial = 'DRW-' + String(post.id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();

  // 사진: 여러 장이면 아래 작은 칸으로 넘겨요
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

  const field = (label, value, cls = '') => h('div', { class: 'idc-field ' + cls }, h('small', null, label), h('div', { class: 'idc-val' }, value));
  const card = h('article', { class: 'idc' },
    h('span', { class: 'idc-hz tl', 'aria-hidden': 'true' }), h('span', { class: 'idc-hz tr', 'aria-hidden': 'true' }),
    h('div', { class: 'idc-left' },
      h('span', { class: 'idc-chip' }, ctx.handle.slice(0, 6).toUpperCase()),
      photo,
      h('div', { class: 'idc-plate' }, kindLabel(kind)),
      strip,
      h('div', { class: 'idc-codes' }, barcode(post.id || 'x'), h('span', { class: 'idc-ticks', 'aria-hidden': 'true' }))),
    h('div', { class: 'idc-right' },
      h('div', { class: 'idc-sign', 'aria-hidden': 'true' }, blog),
      h('h2', { class: 'idc-brand' }, blog),
      h('p', { class: 'idc-doc' }, 'PROMPT IDENTIFICATION DOCUMENT'),
      field('NAME', txt(post.title) || '제목 없음', 'boxed'),
      h('div', { class: 'idc-two' },
        field('KIND', kindLabel(kind)),
        field('BOARD', ctx.boardName || '—')),
      field('DATE OF ISSUE', issue),
      h('div', { class: 'idc-bottom' },
        h('span', { class: 'idc-line', 'aria-hidden': 'true' }),
        h('span', { class: 'idc-stamp', 'aria-hidden': 'true' }, h('small', null, 'DRAWER'), h('b', null, kindLabel(kind)), h('small', null, '@' + ctx.handle)),
        h('span', { class: 'idc-holo', 'aria-hidden': 'true' }, blog.slice(0, 1).toUpperCase()),
        h('span', { class: 'idc-serial' }, serial))));
  show(0);

  // 붙임 쪽지: 프롬마다 한 장, 누르면 복사
  const slips = files.map((f, i) => {
    const pre = h('pre', { class: 'idc-text' + (f.spoiler ? ' sp' : '') }, f.text);
    const slip = h('section', { class: 'idc-slip' + (f.neg ? ' neg' : '') },
      h('div', { class: 'idc-slip-head' },
        h('small', null, `ATTACHMENT ${pad(i + 1, 2)}`), h('b', null, f.name),
        h('div', { class: 'idc-slip-tools' },
          f.base ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => copyText([f.base, f.text].filter((x) => x.trim()).join(', '), '기본 + 변형을 함께 복사했어요') }, '기본과 함께') : null,
          h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(f.text, `${f.name} 복사했어요`) }, icon('copy', 14), '복사'))),
      pre);
    pre.addEventListener('click', () => {
      if (pre.classList.contains('sp')) { pre.classList.remove('sp'); return; }
      copyText(f.text, `${f.name} 복사했어요`);
    });
    return slip;
  });
  return h('div', { class: 'idc-wrap' }, card,
    h('div', { class: 'idc-slips' }, slips),
    h('button', { class: 'fl-plain idc-plain', type: 'button', onclick: ctx.onPlain }, '기본 보기'));
}
