import { h, icon, fmtDate, loader, emptyState, initial } from './util.js';
import { state, getProfileByHandle, listPosts } from './store.js';
import { applyTheme, sanitizeTheme, DEFAULT_THEME } from './theme.js';
import { loadImage } from './images.js';
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

export function postCard(p, isOwner) {
  const thumb = p.thumb
    ? h('img', { src: p.thumb, alt: '', loading: 'lazy', decoding: 'async' })
    : h('div', { class: 'ph' }, icon(p.vis === 'locked' ? 'lock' : p.vis === 'private' ? 'eye-off' : 'image', 28));
  const badge = visBadge(p, isOwner);
  return h('a', { class: 'card' + (p.thumb ? '' : ' no-thumb'), href: '#/p/' + p.id },
    h('div', { class: 'card-thumb' }, thumb, p.imgCount > 1 ? h('span', { class: 'count-chip' }, icon('image', 12), p.imgCount) : null),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-meta' }, badge, h('span', null, fmtDate(p.created))),
      h('h3', { class: 'card-title' }, p.title),
      p.excerpt ? h('p', { class: 'card-ex' }, p.excerpt)
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
  const posts = await listPosts(prof.uid);

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
      avatarEl(prof, 'lg'),
      h('div', { class: 'head-text' },
        h('h1', { class: 'blog-name' }, prof.display || prof.handle),
        h('div', { class: 'blog-handle' }, '@' + prof.handle),
        prof.bio ? h('p', { class: 'blog-bio' }, prof.bio) : null,
        h('div', { class: 'blog-stats' }, `글 ${posts.length}개`),
        isOwner ? h('div', { class: 'head-actions' },
          h('a', { class: 'btn primary sm', href: '#/new' }, icon('plus', 15), '새 글'),
          h('a', { class: 'btn sm', href: '#/settings' }, icon('settings', 15), '꾸미기·설정')) : null)));

  // ── 도구줄 ──
  let q = '', tag = null, visFilter = 'all', shown = PAGE;
  const tagCount = new Map();
  posts.forEach((p) => (p.tags || []).forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map((x) => x[0]);

  const list = h('div');
  const more = h('div', { class: 'more' });
  const tagBox = h('div', { class: 'pills' });
  const visBox = h('div', { class: 'pills' });

  function paintPills() {
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

  function paint() {
    const ql = q.trim().toLowerCase();
    const rows = posts.filter((p) =>
      (visFilter === 'all' || p.vis === visFilter) &&
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
    list.append(h('div', { class: 'posts layout-' + theme.layout }, rows.slice(0, shown).map((p) => postCard(p, isOwner))));
    if (rows.length > shown) more.append(h('button', { class: 'btn', onclick: () => { shown += PAGE; paint(); } }, `더 보기 (${rows.length - shown})`));
  }

  const search = h('div', { class: 'search' }, icon('search', 16),
    h('input', { placeholder: '제목·태그·내용 검색', oninput: (e) => { q = e.target.value; shown = PAGE; paint(); } }));

  root.replaceChildren(head,
    h('div', { class: 'toolbar' }, search, isOwner ? visBox : null),
    topTags.length ? tagBox : null,
    list, more);
  paintPills();
  paint();
}
