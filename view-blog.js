import { h, icon, fmtDate, loader, emptyState, initial, sortable, toast, confirmDialog, txt } from './util.js';
import { state, getProfileByHandle, getProfile, listPosts, savePostOrder, movePosts, friendly, neighborsOn, ddayOn, bannerSlideOn, skinOn, isNeighbor, takeNeighbor, dropNeighbor } from './store.js';
import { dressBlog, collectionView } from './skins.js';
import { applyTheme, sanitizeTheme, DEFAULT_THEME, previewTheme } from './theme.js';
import { loadImage, safeUrl } from './images.js';
import { KINDS, kindOf, kindLabel, kindShown } from './kinds.js';
import { selectField } from './widgets.js';
import { ddayPill } from './dday.js';
import { APP_NAME } from './config.js';

export function avatarEl(prof, cls = '') {
  const t = prof?.theme || {};
  const el = h('div', { class: 'avatar ' + cls }, initial(txt(prof?.display) || txt(prof?.handle)));
  if (t.avatar) {
    loadImage(t.avatar).then((u) => {
      if (u) { el.style.backgroundImage = `url("${u}")`; el.textContent = ''; el.classList.add('has-img'); }
    });
  }
  return el;
}

export function visBadge(p, isOwner) {
  if (p.vis === 'locked') return h('span', { class: 'vis vis-locked' }, icon('lock', 13), '비밀번호');
  if (p.vis === 'private') return h('span', { class: 'vis vis-private' }, icon('eye-off', 13), '비공개');
  if (isOwner) return h('span', { class: 'vis vis-public' }, icon('globe', 13), p.unlisted ? '링크 전용' : '공개');
  return null;
}

export function kindBadge(p) {
  const k = kindOf(p);
  return h('span', { class: 'kind kind-' + k }, icon(KINDS[k].icon, 12), kindLabel(k));
}

const safeThumb = (t) => (typeof t === 'string' && (t.startsWith('data:image/') || safeUrl(t)) ? t : '');

/**
 * 썸네일 칸에 맞춰 그림을 놓아요.
 * 가로로 긴 그림이 세로형 칸에 들어가면 잘라내지 않고 전체를 보여주고, 빈 곳은 같은 그림을 흐리게 깔아요.
 */
function fitThumb(img, box, src) {
  const apply = () => {
    const iw = img.naturalWidth, ih = img.naturalHeight, bw = box.clientWidth, bh = box.clientHeight;
    if (!iw || !ih || !bw || !bh) return;
    const ir = iw / ih, br = bw / bh;
    const wide = ir > 1.12 && ir > br * 1.2;
    box.classList.toggle('contain', wide);
    if (wide) box.style.setProperty('--thumb', `url("${src}")`);
  };
  img.addEventListener('load', apply);
  if (img.complete) requestAnimationFrame(apply);
  if (typeof ResizeObserver === 'function') new ResizeObserver(apply).observe(box);
}

export function postCard(p, isOwner, canSort = false, boardLabel = null) {
  const bl = typeof boardLabel === 'string' ? (boardLabel ? { name: boardLabel, icon: 'folder' } : null) : boardLabel;
  const th = safeThumb(p.thumb);
  const img = th ? h('img', { src: th, alt: '', loading: 'lazy', decoding: 'async' }) : null;
  const thumb = img || h('div', { class: 'ph' }, icon(p.vis === 'locked' ? 'lock' : p.vis === 'private' ? 'eye-off' : 'image', 28));
  const badge = visBadge(p, isOwner);
  const hid = isOwner && !kindShown(kindOf(p));
  const sp = !!p.spoiler && p.vis === 'public';
  const box = h('div', { class: 'card-thumb' }, thumb, p.imgCount > 1 ? h('span', { class: 'count-chip', title: `이미지 ${p.imgCount}장` }, icon('stack', 13), p.imgCount) : null);
  if (img && !p.thumbFill) fitThumb(img, box, th);   // '썸네일 꽉 채우기'를 켠 글은 여백 없이 꽉 채워요
  const tags = (p.tags || []).map(txt).filter(Boolean);
  return h('a', { class: 'card' + (th ? '' : ' no-thumb') + (hid ? ' kind-hidden' : '') + (sp ? ' spoiler' : '') + (p.thumbSp ? ' thumb-sp' : ''), href: '#/p/' + p.id, draggable: 'false', 'data-id': p.id },
    canSort ? h('span', { class: 'grip card-grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 16)) : null,
    isOwner ? h('span', { class: 'card-check', 'aria-hidden': 'true' }, icon('check', 14)) : null,
    box,
    h('div', { class: 'card-body' },
      h('div', { class: 'card-meta' }, kindBadge(p),
        bl ? h('span', { class: 'kind board-badge' }, icon(bl.icon, 12), bl.name) : null,
        badge,
        sp ? h('span', { class: 'vis vis-spoiler' }, icon('eye-off', 13), '스포일러') : null,
        hid ? h('span', { class: 'vis vis-private', title: '이 종류는 다른 사람에게 숨겨져 있어요' }, icon('eye-off', 13), '숨김') : null,
        h('span', null, fmtDate(p.created))),
      h('h3', { class: 'card-title' }, txt(p.title) || '제목 없음'),
      sp ? h('p', { class: 'card-ex muted' }, '스포일러 방지 중이에요. 열어서 확인하세요')
        : (p.vis === 'locked' ? h('p', { class: 'card-ex muted' }, '비밀번호가 필요한 글이에요') : null),
      tags.length ? h('div', { class: 'tags' }, tags.slice(0, 4).map((t) => h('span', { class: 'tag' }, '#' + t))) : null));
}

/**
 * 대문 배너 슬라이드: 사진이 서서히 바뀌며 자동으로 넘어가요.
 * 마우스를 올리거나 탭이 가려지면 멈추고, '동작 줄이기' 설정이면 자동으로 넘기지 않아요 (점을 눌러서 볼 수 있어요).
 */
function bannerSlides(banner, refs, sec = 5) {
  const slides = refs.map(() => h('div', { class: 'banner-slide' }));
  const go = (i) => {
    idx = (i + refs.length) % refs.length;
    slides.forEach((el, k) => el.classList.toggle('on', k === idx));
    [...dots.children].forEach((d, k) => { d.classList.toggle('on', k === idx); d.setAttribute('aria-current', k === idx ? 'true' : 'false'); });
  };
  const dots = h('div', { class: 'banner-dots' }, refs.map((_, i) =>
    h('button', { class: 'banner-dot', type: 'button', 'aria-label': `${i + 1}번째 사진 보기`, onclick: () => { go(i); lastTick = Date.now(); } })));
  banner.classList.add('slides');
  banner.append(...slides, dots);
  let idx = 0, paused = false, lastTick = Date.now();
  go(0);
  refs.forEach((ref, i) => loadImage(ref).then((u) => {
    if (!u) return;
    slides[i].style.backgroundImage = `url("${u}")`;
    slides[i].classList.add('ready');
    if (i === 0) banner.classList.add('has-img');
  }));
  // 점이 나타나는 범위와 같게 (머리말 전체). 아직 화면에 붙기 전이라 한 박자 뒤에 찾아요
  requestAnimationFrame(() => {
    const zone = banner.closest('.blog-head') || banner;
    zone.addEventListener('mouseenter', () => { paused = true; });
    zone.addEventListener('mouseleave', () => { paused = false; lastTick = Date.now(); });
  });
  banner.addEventListener('focusin', () => { paused = true; });
  banner.addEventListener('focusout', () => { paused = false; lastTick = Date.now(); });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const timer = setInterval(() => {
    if (!banner.isConnected) { clearInterval(timer); return; }   // 다른 화면으로 가면 멈춰요
    if (paused || document.hidden) { lastTick = Date.now(); return; }
    if (Date.now() - lastTick >= sec * 1000 - 100) { lastTick = Date.now(); go(idx + 1); }
  }, 500);
}

const PAGE = 24;
const NONE = '_none';   // '미분류' 필터 값

export async function blog({ params, query, root }) {
  root.append(loader());
  const handle = decodeURIComponent(params[0]);
  const prof = await getProfileByHandle(handle);
  // 아이디를 바꾼 계정의 이전 주소로 들어왔으면 새 주소로 이어줘요
  if (prof && prof.handle && prof.handle !== handle.trim().toLowerCase().replace(/^@/, '')) {
    const q = location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?')) : '';
    location.replace('#/u/' + prof.handle + q);
    return;
  }
  if (!prof) {
    applyTheme(DEFAULT_THEME);
    root.replaceChildren(emptyState('블로그를 찾을 수 없어요', `@${handle} 아이디가 없어요.`, h('a', { class: 'btn', href: '#/' }, '처음으로')));
    return;
  }
  const theme = sanitizeTheme(previewTheme(prof.handle) || prof.theme);
  applyTheme(theme);
  // 스킨(테스트 중): 보는 사람이 관리자일 때만 입혀요. 다른 사람에게는 지금 모습 그대로
  const skin = skinOn() ? theme.skin : '', shelf = skinOn() ? theme.shelf : '';
  document.title = `${txt(prof.display) || prof.handle} · ${APP_NAME}`;
  const isOwner = state.user?.uid === prof.uid;
  const allPosts = await listPosts(prof.uid);
  // 글쓴이가 숨긴 종류는 다른 사람에게 보이지 않아요 (본인은 그대로 다 보여요)
  const posts = isOwner ? allPosts : allPosts.filter((p) => kindShown(kindOf(p)));
  const bioText = txt(prof.bio).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  // ── 게시판 ──
  const boards = theme.boards;
  const boardIds = new Set(boards.map((b) => b.id));
  const boardOf = (p) => (boardIds.has(p.board) ? p.board : '');   // 지워진 게시판의 글은 미분류
  const boardName = (id) => boards.find((b) => b.id === id)?.name || '';
  const newBtn = h('a', { class: 'btn primary sm', href: '#/new' }, icon('plus', 15), '새 글');
  const boardObj = (id) => boards.find((b) => b.id === id) || null;
  const showUncat = theme.uncat;   // 미분류 게시판을 사이드에 보일지 (설정 → 게시판)

  // ── 헤더 ──
  const banner = theme.header === 'banner'
    ? h('div', { class: 'banner' }) : null;
  // 대문 배너: 사진이 여러 장이면(관리자 테스트 기능) 자동으로 넘어가요. 아니면 지금처럼 한 장만
  const slideRefs = [theme.banner, ...(bannerSlideOn() ? theme.bannerMore : [])].filter(Boolean);
  if (banner && slideRefs.length > 1) bannerSlides(banner, slideRefs, theme.bannerSec);
  else if (banner && theme.banner) {
    loadImage(theme.banner).then((u) => { if (u) { banner.style.backgroundImage = `url("${u}")`; banner.classList.add('has-img'); } });
  }
  const counts = { public: 0, locked: 0, private: 0 };
  posts.forEach((p) => { counts[p.vis] = (counts[p.vis] || 0) + 1; });
  const head = h('header', { class: 'blog-head head-' + theme.header },
    banner,
    h('div', { class: 'head-in' },
      h('div', { class: 'head-side' }, avatarEl(prof, 'lg'), h('div', { class: 'blog-handle' }, '@' + prof.handle)),
      h('div', { class: 'head-text' },
        h('div', { class: 'name-row' },
          h('h1', { class: 'blog-name' }, txt(prof.display) || prof.handle),
          ddayOn() && theme.ddays.length ? ddayPill(theme.ddays) : null),
        bioText ? h('p', { class: 'blog-bio' }, bioText) : null,
        isOwner ? h('div', { class: 'head-actions' },
          newBtn,
          h('a', { class: 'btn sm', href: '#/settings' }, icon('settings', 15), '꾸미기·설정')) : null)));

  // ── 도구줄 ──
  const qBoard = query?.get('board');
  let q = '', tag = null, visFilter = 'all', shown = PAGE;
  let boardFilter = (qBoard === NONE && showUncat) || boardIds.has(qBoard) ? qBoard : 'all';
  let kindFilter = 'all';
  // 내 블로그에서 특정 게시판을 보고 있으면, 글쓰기를 눌렀을 때 그 게시판이 미리 골라져요
  const writeBoard = () => (isOwner && boardFilter !== 'all' && boardFilter !== NONE && boardIds.has(boardFilter) ? boardFilter : '');
  const writeHref = () => '#/new' + (writeBoard() ? '?board=' + encodeURIComponent(writeBoard()) : '');
  // 보고 있는 게시판을 주소에 남겨요 → 글을 보다가 뒤로 가면 그 게시판으로 돌아와요
  const blogHash = () => '#/u/' + handle + (boardFilter !== 'all' ? '?board=' + encodeURIComponent(boardFilter) : '');
  const rememberBoard = () => {
    state.lastBlog = { handle, hash: blogHash() };
    if (location.hash !== blogHash()) history.replaceState(history.state, '', blogHash());
  };
  state.lastBlog = { handle, hash: blogHash() };
  const selectBoard = (k) => { boardFilter = k; shown = PAGE; rememberBoard(); paintPills(); paint(); };
  const syncWrite = () => {
    state.writeBoard = writeBoard();
    newBtn.setAttribute('href', writeHref());
    if (writeBoard()) newBtn.setAttribute('title', `'${boardName(writeBoard())}' 게시판에 글쓰기`); else newBtn.removeAttribute('title');
  };
  const tagCount = new Map();
  posts.forEach((p) => (p.tags || []).map(txt).filter(Boolean).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  const TAG_LIMIT = 10;   // 사이드에 처음 보여줄 태그 수 (나머지는 '더보기')
  let tagsOpen = false;

  const list = h('div');
  const more = h('div', { class: 'more' });
  const tagBox = h('div', { class: 'side-tags' });
  const visBox = h('div', { class: 'pills' });
  const boardBox = h('div', { class: 'side-list' });
  const kindBox = h('div', { class: 'pills kind-pills' });

  // ── 게시판으로 옮기기 (고르기 모드) ──
  let picking = false, moveTo = '';
  const picked = new Set();
  const pickCount = h('strong', null, '0개 선택');
  const moveSel = selectField({
    options: [['', '미분류'], ...boards.map((b) => [b.id, b.name])], value: '', placeholder: '옮길 게시판', label: '옮길 게시판',
    onChange: (v) => { moveTo = v; },
  });
  const moveBtn = h('button', { class: 'btn primary sm', type: 'button', disabled: true, onclick: () => doMove() }, icon('move', 14), '옮기기');
  const pickBar = h('div', { class: 'pick-bar', hidden: true },
    pickCount, moveSel.el, moveBtn,
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => setPicking(false) }, '취소'));

  function paintPick() {
    pickCount.textContent = `${picked.size}개 선택`;
    moveBtn.disabled = picked.size === 0;
    list.querySelectorAll('.card').forEach((c) => c.classList.toggle('picked', picked.has(c.dataset.id)));
  }
  function setPicking(on) {
    if (on && !boards.length) {
      confirmDialog('아직 게시판이 없어요. 설정에서 먼저 만들까요?', { ok: '만들러 가기' }).then((ok) => { if (ok) location.hash = '#/settings?tab=boards'; });
      return;
    }
    picking = on;
    picked.clear();
    pickBar.hidden = !on;
    document.body.classList.toggle('picking', on);
    paintTools();
    paint();
  }
  async function doMove() {
    if (!picked.size) return;
    const ids = [...picked];
    moveBtn.disabled = true;
    try {
      await movePosts(ids, moveTo);
      const set = new Set(ids);
      posts.forEach((p) => { if (set.has(p.id)) p.board = moveTo; });
      toast(`${ids.length}개 글을 '${boardName(moveTo) || '미분류'}'(으)로 옮겼어요`);
      setPicking(false);
      paintPills();
    } catch (e) { toast(friendly(e)); moveBtn.disabled = false; }
  }

  function paintPills() {
    syncWrite();
    // 태그가 많으면 처음엔 몇 개만 보여주고 '더보기'로 펼쳐요 (골라 둔 태그는 접혀 있어도 계속 보여요)
    const foldable = topTags.length > TAG_LIMIT;
    let vis = topTags;
    if (foldable && !tagsOpen) {
      vis = topTags.slice(0, TAG_LIMIT);
      if (tag && !vis.includes(tag)) vis = [...vis, tag];
    }
    tagBox.replaceChildren(...vis.map((t) =>
      h('button', { class: 'pill' + (tag === t ? ' on' : ''), onclick: () => { tag = tag === t ? null : t; shown = PAGE; paintPills(); paint(); } }, '#' + t)),
      ...(foldable ? [h('button', { class: 'pill tag-more', type: 'button', 'aria-expanded': String(tagsOpen),
        onclick: () => { tagsOpen = !tagsOpen; paintPills(); } },
        tagsOpen ? '접기' : `더보기 +${topTags.length - Math.min(TAG_LIMIT, topTags.length)}`)] : []));
    if (isOwner) {
      const opts = [['all', '전체'], ['public', '공개'], ['locked', '비밀번호'], ['private', '비공개']];
      visBox.replaceChildren(...opts.map(([k, label]) =>
        h('button', { class: 'pill' + (visFilter === k ? ' on' : ''), onclick: () => { visFilter = k; shown = PAGE; paintPills(); paint(); } }, label)));
    }
    // 글 종류 (검색줄 오른쪽)
    const kinds = Object.keys(KINDS).filter((k) => isOwner || kindShown(k));
    kindBox.replaceChildren(...[['all', '전체', null], ...kinds.map((k) => [k, kindLabel(k), KINDS[k].icon])].map(([k, label, ic]) =>
      h('button', { class: 'pill' + (kindFilter === k ? ' on' : '') + (k !== 'all' && !kindShown(k) ? ' dim' : ''), title: k !== 'all' && !kindShown(k) ? '다른 사람에게는 숨겨진 종류예요' : null,
        onclick: () => { kindFilter = k; shown = PAGE; paintPills(); paint(); } }, ic ? icon(ic, 14) : null, label)));
    // 게시판: 다른 사람에게는 글이 있는 게시판만 보여요. '미분류'는 설정에서 켜고 끌 수 있어요
    const has = new Set(posts.map((p) => boardOf(p) || NONE));
    const entries = [['all', '전체', 'grid'], ...boards.filter((b) => isOwner || has.has(b.id)).map((b) => [b.id, b.name, b.icon]),
      ...(showUncat && (isOwner || has.has(NONE)) ? [[NONE, '미분류', 'file']] : [])];
    boardBox.replaceChildren(...entries.map(([k, label, ic]) =>
      h('button', { class: 'side-item' + (boardFilter === k ? ' on' : ''), onclick: () => selectBoard(k) },
        icon(ic, 15), h('span', null, label))));
  }

  // 화면에 보이는 글들끼리 자리를 바꾸고, 전체 순서에 반영해 저장해요
  function reorder(ids) {
    const set = new Set(ids);
    const byId = new Map(posts.map((p) => [p.id, p]));
    const slots = posts.map((p, i) => (set.has(p.id) ? i : -1)).filter((i) => i >= 0);
    slots.forEach((slot, k) => { posts[slot] = byId.get(ids[k]); });
    savePostOrder(posts).then(() => toast('순서를 저장했어요', { ms: 1600 })).catch((e) => toast(friendly(e)));
  }

  async function sortByDate() {
    if (!(await confirmDialog('직접 정한 순서가 사라지고, 작성일이 최신인 글이 위로 와요. 계속할까요?', { ok: '정리하기' }))) return;
    posts.sort((a, b) => (b.created || 0) - (a.created || 0));
    paint();
    savePostOrder(posts).then(() => toast('작성일 순으로 정리했어요', { ms: 1800 })).catch((e) => toast(friendly(e)));
  }

  function paint() {
    const ql = q.trim().toLowerCase();
    const rows = posts.filter((p) =>
      (visFilter === 'all' || p.vis === visFilter) &&
      (kindFilter === 'all' || kindOf(p) === kindFilter) &&
      (boardFilter === 'all' || (boardFilter === NONE ? !boardOf(p) : boardOf(p) === boardFilter)) &&
      (!tag || (p.tags || []).includes(tag)) &&
      (!ql || `${txt(p.title)} ${(p.tags || []).map(txt).join(' ')}`.toLowerCase().includes(ql)));
    list.replaceChildren();
    more.replaceChildren();
    if (!rows.length) {
      list.append(posts.length
        ? emptyState('조건에 맞는 글이 없어요', '검색어나 필터를 바꿔 보세요.')
        : emptyState(isOwner ? '아직 글이 없어요' : '아직 공개된 글이 없어요',
          isOwner ? '첫 프롬프트를 저장해 볼까요?' : '', isOwner ? h('a', { class: 'btn primary', href: writeHref() }, icon('plus', 15), '새 글 쓰기') : null));
      return;
    }
    // 프롬 모음 스킨: 고르기 모드가 아닐 때만 (순서 바꾸기·고르기는 기본 배치에서)
    if (shelf && !picking) {
      // 레코드 진열은 한 줄로 넘겨 보는 모양이라 '더 보기' 없이 전부 보여줘요
      const all = shelf === 'records';
      const v = collectionView(shelf, all ? rows : rows.slice(0, shown), { boardName, boardOf, display: txt(prof.display) || prof.handle });
      if (v) {
        list.append(v);
        if (!all && rows.length > shown) more.append(h('button', { class: 'btn', onclick: () => { shown += PAGE; paint(); } }, `더 보기 (${rows.length - shown})`));
        return;
      }
    }
    const box = h('div', { class: 'posts layout-' + theme.layout + (picking ? ' picking' : '') },
      rows.slice(0, shown).map((p) => postCard(p, isOwner, isOwner && !picking, boardObj(boardOf(p)))));
    if (isOwner) {
      sortable(box, { item: '.card', handle: '.grip', onSort: (els) => reorder(els.map((e) => e.dataset.id)) });
      // 고르기 모드에서는 카드를 누르면 열리지 않고 선택돼요
      box.addEventListener('click', (e) => {
        if (!picking) return;
        const c = e.target.closest('.card');
        if (!c) return;
        e.preventDefault();
        const id = c.dataset.id;
        if (picked.has(id)) picked.delete(id); else picked.add(id);
        paintPick();
      });
    }
    list.append(box);
    paintPick();
    if (rows.length > shown) more.append(h('button', { class: 'btn', onclick: () => { shown += PAGE; paint(); } }, `더 보기 (${rows.length - shown})`));
  }

  const search = h('div', { class: 'search' }, icon('search', 16),
    h('input', { placeholder: '제목·태그·내용 검색', oninput: (e) => { q = e.target.value; shown = PAGE; paint(); } }));

  const toolsHost = h('div');
  function paintTools() {
    const showSort = isOwner && posts.length > 1;
    toolsHost.replaceChildren(...(isOwner ? [h('div', { class: 'sort-bar' },
      visBox,
      showSort ? h('div', { class: 'sort-btns' },
        h('button', { class: 'btn ghost sm', onclick: () => setPicking(!picking), title: '여러 글을 골라 한 번에 게시판으로 옮겨요' }, icon('folder', 14), picking ? '고르기 끝내기' : '게시판으로 옮기기'),
        h('button', { class: 'btn ghost sm', onclick: sortByDate, title: '카드의 ⋮⋮ 손잡이를 끌어서 순서를 직접 바꿀 수도 있어요' }, '작성일 최신순으로 정리')) : null)] : []));
  }

  // ── 이웃 배너: 태그 아래에 이 블로그의 배너, 그 밑으로 이 블로그의 이웃들 ──
  const nbZone = neighborsOn() ? neighborZone(prof, theme, isOwner) : null;

  const hasSide = boards.length > 0 || topTags.length > 0 || !!nbZone;
  const side = hasSide ? h('aside', { class: 'blog-side' },
    boards.length ? h('div', { class: 'side-sec side-boards' }, h('h4', null, '게시판', h('em', { class: 'side-total', title: '전체 글 개수' }, posts.length)), boardBox) : null,
    topTags.length ? h('div', { class: 'side-sec side-tagsec' }, h('h4', null, '태그'), tagBox) : null,
    nbZone) : null;
  const main = h('div', { class: 'blog-main' },
    h('div', { class: 'toolbar' }, search, kindBox),
    toolsHost, list, more);
  const bodyEl = h('div', { class: 'blog-body' + (hasSide ? ' has-side' : '') }, side, main);
  root.replaceChildren(head, bodyEl, pickBar);
  if (skin) {
    const shownBoards = boards.filter((b) => isOwner || posts.some((p) => boardOf(p) === b.id));
    dressBlog(skin, { root, head, body: bodyEl, side, main, pickBar, prof, theme, boards: shownBoards, selectBoard, posts });
  }
  paintTools();
  paintPills();
  paint();
}

// ───────── 이웃 배너 ─────────
/** 배너 한 장. 이미지만 보이고, 마우스를 올리면 블로그 이름과 핸들이 나와요 */
export function bannerEl(p, { href = null, onclick = null, cls = '' } = {}) {
  const name = txt(p?.display) || txt(p?.handle);
  const ref = sanitizeTheme(p?.theme).nbBanner;
  const el = h(href ? 'a' : 'button', { class: 'nb-banner ' + cls + (ref ? '' : ' no-img'), ...(href ? { href } : { type: 'button' }), 'aria-label': `${name} @${txt(p?.handle)}`, onclick },
    ref ? null : h('span', { class: 'nb-fallback' }, name),
    h('span', { class: 'nb-hover' }, h('strong', null, name), h('small', null, '@' + txt(p?.handle))));
  if (ref) loadImage(ref).then((u) => { if (u) el.style.backgroundImage = `url("${u}")`; });
  return el;
}

function neighborZone(prof, theme, isOwner) {
  const nbs = h('div', { class: 'nb-list' });
  const zone = h('div', { class: 'side-sec nb-zone' }, h('h4', null, '배너'));
  const paintNeighbors = async () => {
    const mine = isOwner ? state.me.theme.neighbors : theme.neighbors;
    const profs = (await Promise.all(mine.map((u) => getProfile(u).catch(() => null)))).filter(Boolean);
    nbs.replaceChildren(...profs.map((p) => {
      const wrap = h('div', { class: 'nb-item' }, bannerEl(p, { href: '#/u/' + p.handle }));
      if (isOwner) wrap.append(h('button', { class: 'nb-x', type: 'button', title: '내 배너 목록에서 빼기', 'aria-label': '내 배너 목록에서 빼기', onclick: async () => {
        if (!(await confirmDialog(`${txt(p.display) || p.handle} 님의 배너를 내 배너 목록에서 뺄까요?`, { ok: '빼기', danger: true }))) return;
        try { await dropNeighbor(p.uid); toast('내 배너 목록에서 뺐어요'); paintNeighbors(); } catch (e) { toast(friendly(e)); }
      } }, icon('x', 12)));
      return wrap;
    }));
    markScroll(); requestAnimationFrame(markScroll);
  };
  // 넘치면 아래쪽을 흐리게 해서 '더 있다'는 걸 알려요 (스크롤바는 숨김)
  const markScroll = () => {
    const more = nbs.scrollHeight > nbs.clientHeight + 2;
    nbs.classList.toggle('more', more);
    nbs.classList.toggle('end', more && nbs.scrollTop + nbs.clientHeight >= nbs.scrollHeight - 2);
  };
  nbs.addEventListener('scroll', markScroll, { passive: true });

  let mineEl = null;
  {   // 이미지를 정하지 않아도 이름이 적힌 기본 배너가 걸려요
    if (isOwner) mineEl = bannerEl(prof, { cls: 'mine', onclick: null });
    else {
      const paintTaken = () => mineEl.classList.toggle('taken', !!state.me && isNeighbor(prof.uid));
      mineEl = bannerEl(prof, { cls: 'mine takeable', onclick: async () => {
        if (!state.me) { toast('로그인하면 배너를 가져갈 수 있어요'); return; }
        try {
          if (isNeighbor(prof.uid)) {
            if (!(await confirmDialog('이미 내 배너 목록에 가져온 배너예요. 목록에서 뺄까요?', { ok: '빼기', danger: true }))) return;
            await dropNeighbor(prof.uid); toast('내 배너 목록에서 뺐어요');
          } else { await takeNeighbor(prof); toast('배너를 내 배너 목록으로 가져갔어요'); }
          paintTaken();
        } catch (e) { toast(friendly(e)); }
      } });
      mineEl.title = '눌러서 내 배너 목록으로 가져가기';
      paintTaken();
    }
  }
  zone.append(h('div', { class: 'nb-mine' }, mineEl,
    isOwner && !theme.nbBanner ? h('a', { class: 'nb-empty', href: '#/settings?tab=design' }, '배너 이미지를 정해 보세요') : null), nbs);
  paintNeighbors();
  return zone;
}
