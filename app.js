import { initAuth, state, onAuth, signOutUser } from './store.js';
import { h, icon, $, emptyState, loader } from './util.js';
import { APP_NAME } from './config.js';
import { applyTheme, DEFAULT_THEME } from './theme.js';
import { home, login, join } from './view-home.js';
import { blog, avatarEl } from './view-blog.js';
import { post } from './view-post.js';
import { editor } from './view-editor.js';
import { settings } from './view-settings.js';

const routes = [
  [/^\/?$/, home],
  [/^\/login$/, login],
  [/^\/join(?:\/([^/]+))?$/, join],
  [/^\/u\/([^/]+)$/, blog],
  [/^\/p\/([^/]+)$/, post],
  [/^\/new$/, editor],
  [/^\/edit\/([^/]+)$/, editor],
  [/^\/settings$/, settings],
];

const headerEl = $('#header');
const viewEl = $('#view');
let navToken = 0;

function renderHeader() {
  const me = state.me;
  const brand = h('a', { class: 'brand', href: me ? '#/u/' + me.handle : '#/' },
    h('span', { class: 'brand-mark' }, icon('sparkle', 15)), h('span', { class: 'brand-name' }, APP_NAME));
  const nav = h('nav', { class: 'nav' });
  if (me) {
    nav.append(
      h('a', { class: 'btn primary sm', href: '#/new' }, icon('plus', 15), h('span', { class: 'hide-sm' }, '글쓰기')),
      h('a', { class: 'nav-avatar', href: '#/settings', title: '설정' }, avatarEl(me, 'sm')));
  } else {
    nav.append(
      h('a', { class: 'btn ghost sm', href: '#/login' }, '로그인'),
      h('a', { class: 'btn primary sm', href: '#/join' }, '가입'));
  }
  headerEl.replaceChildren(h('div', { class: 'topbar-in' }, brand, h('span', { class: 'spacer' }), nav));
}

async function route() {
  const raw = location.hash.slice(1) || '/';
  const qi = raw.indexOf('?');
  const path = qi >= 0 ? raw.slice(0, qi) : raw;
  const query = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  const token = ++navToken;
  const root = h('div', { class: 'view' });
  viewEl.replaceChildren(root);
  window.scrollTo(0, 0);

  let matched = null;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { matched = { fn, params: m.slice(1).filter((x) => x != null) }; break; }
  }
  if (!matched) { applyTheme(DEFAULT_THEME); root.append(emptyState('페이지를 찾을 수 없어요', '', h('a', { class: 'btn', href: '#/' }, '처음으로'))); return; }
  root.append(loader());
  try {
    root.replaceChildren();
    await matched.fn({ params: matched.params, query, root, isCurrent: () => token === navToken });
  } catch (e) {
    console.error(e);
    if (token !== navToken) return;
    root.replaceChildren(emptyState('문제가 생겼어요', (e && e.message && e.message !== 'null' ? e.message : '알 수 없는 오류가 났어요'), h('a', { class: 'btn', href: '#/' }, '처음으로')));
  }
}

window.addEventListener('hashchange', route);
await initAuth();
onAuth(renderHeader);
renderHeader();
await route();

// 첫 화면이 준비되면 로딩 화면을 걷어요
const boot = document.getElementById('boot');
if (boot) { boot.classList.add('done'); setTimeout(() => boot.remove(), 500); }
