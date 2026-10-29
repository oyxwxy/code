import { h, icon, fmtDate, loader, emptyState, initial, sortable, toast, confirmDialog } from './util.js';
import { state, getProfileByHandle, listPosts, savePostOrder, friendly } from './store.js';
import { applyTheme, sanitizeTheme, DEFAULT_THEME } from './theme.js';
import { loadImage, safeUrl } from './images.js';
import { KINDS, kindOf, kindLabel, kindShown } from './kinds.js';
import { APP_NAME } from './config.js';

export function avatarEl(prof, cls = '') {
  const t = prof?.theme || {};
  const el = h('div', { class: 'avatar ' + cls }, initial(prof?.display || prof?.handle));
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

export function postCard(p, isOwner, canSort = false) {
  const th = safeThumb(p.thumb);
  const thumb = th
    ? h('img', { src: th, alt: '', loading: 'lazy', decoding: 'async' })
    : h('div', { class: 'ph' }, icon(p.vis === 'locked' ? 'lock' : p.vis === 'private' ? 'eye-off' : 'image', 28));
  const badge = visBadge(p, isOwner);
  const hid = isOwner && !kindShown(kindOf(p));
  const sp = !!p.spoiler && p.vis === 'public';
  return h('a', { class: 'card' + (th ? '' : ' no-thumb') + (hid ? ' kind-hidden' : '') + (sp ? ' spoiler' : ''), href: '#/p/' + p.id, draggable: 'false', 'data-id': p.id },
    canSort ? h('span', { class: 'grip card-grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 16)) : null,
    h('div', { class: 'card-thumb' }, thumb, p.imgCount > 1 ? h('span', { class: 'count-chip' }, icon('image', 12), p.imgCount) : null),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-meta' }, kindBadge(p), badge,
        sp ? h('span', { class: 'vis vis-spoiler' }, icon('eye-off', 13), '스포일러') : null,
        hid ? h('span', { class: 'vis vis-private', title: '이 종류는 다른 사람에게 숨겨져 있어요' }, icon('eye-off', 13), '숨김') : null,
        h('span', null, fmtDate(p.created))),
      h('h3', { class: 'card-title' }, p.title),
      sp ? h('p', { class: 'card-ex muted' }, '스포일러 방지 중이에요. 열어서 확인하세요')
        : p.excerpt ? h('p', { class: 'card-ex' }, p.excerpt)
        : (p.vis === 'locked' ? h('p', { class: 'card-ex muted' }, '비밀번호가 필요한 글이에요') : null),
      p.tags?.length ? h('div', { class: 'tags' }, p.tags.slice(0, 4).map((t) => h('span', { class: 'tag' }, '#' + t))) : null));
}

const PAGE = 24;

export async function blog({ params, root }) {
  root.append(loader());
  const handle = decodeURIComponent(params[0]);
  const prof = await getProfileByHandle(handle);
  if (!prof) {
    applyTheme(DEFAULT_THEME);
    root.replaceChildren(emptyState('블로그를 찾을 수 없어요', `@${handle} 아이디가 없어요.`, h('a', { class: 'btn', href: '#/' }, '처음으로')));
    return;
  }
  const theme = sanitizeTheme(prof.theme);
  applyTheme(theme);
  document.title = `${prof.display || prof.handle} · ${APP_NAME}`;
  const isOwner = state.user?.uid === prof.uid;
  const allPosts = await listPosts(prof.uid);
  // 글쓴이가 숨긴 종류는 다른 사람에게 보이지 않아요 (본인은 그대로 다 보여요)
  const posts = isOwner ? allPosts : allPosts.filter((p) => kindShown(kindOf(p)));
  const bioText = (prof.bio || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

  // ── 헤더 ──
  const banner = theme.header === 'banner'
    ? h('div', { class: 'banner' }) : null;
  if (banner && theme.banner) {
    loadImage(theme.banner).then((u) => { if (u) { banner.style.backgroundImage = `url("${u}")`; banner.classList.add('has-img'); } });
  }
  const counts = { public: 0, locked: 0, private: 0 };
  posts.forEach((p) => { counts[p.vis] = (counts[p.vis] || 0) + 1; });
  const head = h('header', { class: 'blog-head head-' + theme.header },
    banner,
    h('div', { class: 'head-in' },
      h('div', { class: 'head-side' }, avatarEl(prof, 'lg'), h('div', { class: 'blog-handle' }, '@' + prof.handle)),
      h('div', { class: 'head-text' },
        h('h1', { class: 'blog-name' }, prof.display || prof.handle),
        bioText ? h('p', { class: 'blog-bio' }, bioText) : null,
        h('div', { class: 'blog-stats' }, `글 ${posts.length}개`),
        isOwner ? h('div', { class: 'head-actions' },
          h('a', { class: 'btn primary sm', href: '#/new' }, icon('plus', 15), '새 글'),
          h('a', { class: 'btn sm', href: '#/settings' }, icon('settings', 15), '꾸미기·설정')) : null)));

  // ── 도구줄 ──
  let q = '', tag = null, visFilter = 'all', kindFilter = 'all', shown = PAGE;
  const tagCount = new Map();
  posts.forEach((p) => (p.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map((x) => x[0]);

  const list = h('div');
  const more = h('div', { class: 'more' });
  const tagBox = h('div', { class: 'pills' });
  const visBox = h('div', { class: 'pills' });
  const kindBox = h('div', { class: 'pills' });

  function paintPills() {
    const kc = { all: posts.length };
    posts.forEach((p) => { const k = kindOf(p); kc[k] = (kc[k] || 0) + 1; });
    const kinds = Object.keys(KINDS).filter((k) => isOwner || kindShown(k));
    kindBox.replaceChildren(...[['all', '전체', null], ...kinds.map((k) => [k, kindLabel(k), KINDS[k].icon])].map(([k, label, ic]) =>
      h('button', { class: 'pill' + (kindFilter === k ? ' on' : '') + (k !== 'all' && !kindShown(k) ? ' dim' : ''), title: k !== 'all' && !kindShown(k) ? '다른 사람에게는 숨겨진 종류예요' : null,
        onclick: () => { kindFilter = k; shown = PAGE; paintPills(); paint(); } }, ic ? icon(ic, 14) : null, `${label} ${kc[k] || 0}`)));
    tagBox.replaceChildren(...(topTags.length ? [
      h('button', { class: 'pill' + (tag ? '' : ' on'), onclick: () => { tag = null; shown = PAGE; paintPills(); paint(); } }, '전체'),
      ...topTags.map((t) => h('button', { class: 'pill' + (tag === t ? ' on' : ''), onclick: () => { tag = tag === t ? null : t; shown = PAGE; paintPills(); paint(); } }, '#' + t)),
    ] : []));
    if (isOwner) {
      const opts = [['all', '전체', posts.length], ['public', '공개', counts.public], ['locked', '비밀번호', counts.locked], ['private', '비공개', counts.private]];
      visBox.replaceChildren(...opts.map(([k, label, n]) =>
        h('button', { class: 'pill' + (visFilter === k ? ' on' : ''), onclick: () => { visFilter = k; shown = PAGE; paintPills(); paint(); } }, `${label} ${n}`)));
    }
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
      (!tag || (p.tags || []).includes(tag)) &&
      (!ql || `${p.title} ${p.excerpt || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(ql)));
    list.replaceChildren();
    more.replaceChildren();
    if (!rows.length) {
      list.append(posts.length
        ? emptyState('조건에 맞는 글이 없어요', '검색어나 필터를 바꿔 보세요.')
        : emptyState(isOwner ? '아직 글이 없어요' : '아직 공개된 글이 없어요',
          isOwner ? '첫 프롬프트를 저장해 볼까요?' : '', isOwner ? h('a', { class: 'btn primary', href: '#/new' }, icon('plus', 15), '새 글 쓰기') : null));
      return;
    }
    const box = h('div', { class: 'posts layout-' + theme.layout }, rows.slice(0, shown).map((p) => postCard(p, isOwner, isOwner)));
    if (isOwner) sortable(box, { item: '.card', handle: '.grip', onSort: (els) => reorder(els.map((e) => e.dataset.id)) });
    list.append(box);
    if (rows.length > shown) more.append(h('button', { class: 'btn', onclick: () => { shown += PAGE; paint(); } }, `더 보기 (${rows.length - shown})`));
  }

  const search = h('div', { class: 'search' }, icon('search', 16),
    h('input', { placeholder: '제목·태그·내용 검색', oninput: (e) => { q = e.target.value; shown = PAGE; paint(); } }));

  root.replaceChildren(head,
    h('div', { class: 'toolbar' }, search, isOwner ? visBox : null),
    posts.length ? h('div', { class: 'kind-filter' }, kindBox) : null,
    topTags.length ? tagBox : null,
    isOwner && posts.length > 1 ? h('div', { class: 'sort-bar' },
      h('small', { class: 'hint-line' }, '카드의 ⋮⋮ 손잡이를 끌어서 순서를 바꿀 수 있어요'),
      h('button', { class: 'btn ghost sm', onclick: sortByDate }, '작성일 최신순으로 정리')) : null,
    list, more);
  paintPills();
  paint();
}
