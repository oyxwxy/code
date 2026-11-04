// ───────── 작은 도우미들 ─────────
export const $ = (sel, root = document) => root.querySelector(sel);

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
}

// 브라우저 기본 append/prepend/replaceChildren는 null을 글자 "null"로 바꿔 붙여요.
// (예: 비어 있는 프롬프트 블록이 null을 돌려주면 화면에 null이 찍힘) 그래서 null · undefined · false는 건너뛰게 바꿔 둬요.
for (const m of ['append', 'prepend', 'replaceChildren']) {
  for (const proto of [Element.prototype, DocumentFragment.prototype]) {
    const orig = proto[m];
    if (!orig || orig.__safe) continue;
    const safe = function (...nodes) { return orig.apply(this, nodes.filter((n) => n != null && n !== false)); };
    safe.__safe = true;
    proto[m] = safe;
  }
}

/** h('div', {class:'x', onclick(){}}, child, child...) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}

// ───────── 아이콘 ─────────
const ICONS = {
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  stack: '<rect x="3" y="7" width="14" height="14" rx="2.5" ry="2.5"/><path d="M7 3h10a4 4 0 0 1 4 4v10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sparkle: '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
  back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".6"/><circle cx="17.5" cy="10.5" r=".6"/><circle cx="8.5" cy="7.5" r=".6"/><circle cx="6.5" cy="12.5" r=".6"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>',
  chevl: '<polyline points="15 18 9 12 15 6"/>',
  chevr: '<polyline points="9 18 15 12 9 6"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  crown: '<path d="M2 18l2-11 6 5 2-8 2 8 6-5 2 11z"/><line x1="2" y1="21" x2="22" y2="21"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  chevd: '<polyline points="6 9 12 15 18 9"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
};

export function icon(name, size = 18) {
  return h('span', {
    class: 'icon',
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`,
  });
}

// ───────── 알림 / 대화상자 ─────────
export function toast(msg, opts = {}) {
  const wrap = $('#toasts');
  const t = h('div', { class: 'toast' },
    h('span', null, msg),
    opts.action ? h('button', { class: 'toast-act', onclick: () => { opts.onAction?.(); t.remove(); } }, opts.action) : null);
  wrap.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, opts.ms ?? 3400);
}

export function modal({ title, body, actions = [], wide = false, onClose } = {}) {
  const back = h('div', { class: 'modal-back' });
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    if (closed) return;
    closed = true;
    back.classList.remove('in');
    setTimeout(() => back.remove(), 180);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
    title ? h('h3', { class: 'modal-title' }, title) : null,
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions.map(a =>
      h('button', {
        class: 'btn ' + (a.kind || ''), type: 'button',
        onclick: async (e) => { const r = a.onClick ? await a.onClick(e) : undefined; if (r !== false) close(); },
      }, a.label))) : null);
  back.append(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('in'));
  return { close, el: box };
}

export function confirmDialog(message, { ok = '확인', cancel = '취소', danger = false, title } = {}) {
  return new Promise((res) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; res(v); } };
    modal({
      title, body: h('p', { class: 'modal-text' }, message), onClose: () => fin(false),
      actions: [
        { label: cancel, kind: 'ghost', onClick: () => fin(false) },
        { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => fin(true) },
      ],
    });
  });
}

export function askText({ title, label, type = 'text', ok = '확인', placeholder = '' }) {
  return new Promise((res) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; res(v); } };
    const input = h('input', { class: 'input', type, placeholder, autocomplete: 'off' });
    const submit = () => { fin(input.value); modalRef.close(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    const modalRef = modal({
      title,
      body: h('div', null, label ? h('p', { class: 'modal-text' }, label) : null, input),
      onClose: () => fin(null),
      actions: [
        { label: '취소', kind: 'ghost', onClick: () => fin(null) },
        { label: ok, kind: 'primary', onClick: () => { fin(input.value); } },
      ],
    });
    setTimeout(() => input.focus(), 60);
  });
}

// ───────── 화면 조각 ─────────
export function loader() { return h('div', { class: 'loader' }, h('span')); }

export function emptyState(title, desc, action) {
  return h('div', { class: 'empty' }, h('h3', null, title), desc ? h('p', null, desc) : null, action || null);
}

/** 화면에 찍을 글: null · undefined · 'null' 같은 값은 빈 글자로 (화면에 'null'이 보이지 않게) */
export const txt = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /^\s*(null|undefined|NaN)\s*$/i.test(s) ? '' : s;
};

export const initial = (s) => (s || '?').trim().slice(0, 1).toUpperCase();

// ───────── 값 도우미 ─────────
const ALPH = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function rid(n = 20) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => ALPH[x % ALPH.length]).join('');
}
const CODE_ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteCode(n = 10) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => CODE_ALPH[x % CODE_ALPH.length]).join('');
}

export function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function copyText(text, okMsg = '복사했어요') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
  if (okMsg) toast(okMsg);
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function autosize(ta) {
  const f = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 640) + 'px'; };
  ta.addEventListener('input', f);
  requestAnimationFrame(f);
  return f;
}

export function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ───────── 색 계산 ─────────
export function hex2rgb(hex) {
  let s = hex.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(rgb) {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const x = hex2rgb(a), y = hex2rgb(b);
  return rgb2hex(x.map((v, i) => v * (1 - t) + y[i] * t));
}
export function lum(hex) {
  const [r, g, b] = hex2rgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ───────── 끌어서 순서 바꾸기 (마우스·터치 모두) ─────────
/**
 * container 안의 item 들을 handle(손잡이)을 끌어서 재정렬해요. 이벤트는 위임이라 항목이 다시 그려져도 한 번만 걸면 돼요.
 * 끝났을 때 순서가 바뀌었으면 onSort(새 순서의 요소 배열)을 불러요.
 */
export function sortable(container, { item, handle, onSort } = {}) {
  let st = null;
  const items = () => [...container.children].filter((c) => c.matches(item));

  container.addEventListener('dragstart', (e) => { if (e.target.closest?.(handle)) e.preventDefault(); });
  container.addEventListener('click', (e) => {
    if (e.target.closest?.(handle)) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  const tick = () => {
    if (!st) return;
    const el = st.el;
    const vh = window.innerHeight;
    if (st.y < 70) window.scrollBy(0, -Math.ceil((70 - st.y) / 5));
    else if (st.y > vh - 70) window.scrollBy(0, Math.ceil((st.y - (vh - 70)) / 5));
    el.style.transform = '';
    const own = el.getBoundingClientRect();
    const inOwn = st.x >= own.left && st.x <= own.right && st.y >= own.top && st.y <= own.bottom;
    if (!inOwn) {
      const all = items();
      const hit = all.find((n) => {
        if (n === el) return false;
        const r = n.getBoundingClientRect();
        return st.x >= r.left && st.x <= r.right && st.y >= r.top && st.y <= r.bottom;
      });
      if (hit) {
        // 끌고 있는 요소는 DOM에서 움직이지 않고, 부딪힌 쪽을 옮겨요 (터치 이벤트가 끊기지 않게)
        if (all.indexOf(hit) > all.indexOf(el)) el.before(hit); else el.after(hit);
      }
    }
    const b = el.getBoundingClientRect();
    el.style.transform = `translate(${st.x - st.gx - b.left}px, ${st.y - st.gy - b.top}px)`;
    st.raf = requestAnimationFrame(tick);
  };
  const move = (e) => {
    if (!st || e.pointerId !== st.id) return;
    st.x = e.clientX; st.y = e.clientY;
    e.preventDefault();
  };
  const end = (e) => {
    if (!st || e.pointerId !== st.id) return;
    cancelAnimationFrame(st.raf);
    const { el, before } = st;
    st = null;
    el.style.transform = '';
    el.classList.remove('sort-drag');
    document.body.classList.remove('sorting');
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
    const after = items();
    if (after.some((n, i) => n !== before[i])) onSort?.(after);
  };
  container.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || st) return;
    const g = e.target.closest?.(handle);
    if (!g || !container.contains(g)) return;
    const el = g.closest(item);
    if (!el || el.parentElement !== container) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    st = { el, id: e.pointerId, gx: e.clientX - r.left, gy: e.clientY - r.top, x: e.clientX, y: e.clientY, before: items(), raf: 0 };
    el.classList.add('sort-drag');
    document.body.classList.add('sorting');
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    tick();
  });
}
