// 브라우저 기본 위젯 대신 쓰는 직접 만든 선택기들: 색상 · 달력 · 드롭다운 · 숫자
import { h, icon, hex2rgb, rgb2hex } from './util.js';

// ───────── 팝오버 (데스크톱은 버튼 아래, 모바일은 아래에서 올라오는 시트) ─────────
let current = null;

export function popover(anchor, build, { onClose } = {}) {
  if (current && current.anchor === anchor) { current.close(); return null; }
  current?.close();
  const back = h('div', { class: 'pop-back' });
  const pop = h('div', { class: 'pop', role: 'dialog' });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', onScroll, true);
    back.remove(); pop.remove();
    if (current && current.pop === pop) current = null;
    anchor.setAttribute('aria-expanded', 'false');
    onClose?.();
  };
  const onDown = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus?.(); } };
  const onScroll = (e) => { if (!pop.contains(e.target) && innerWidth > 640) place(); };
  function place() {
    if (innerWidth <= 640) { pop.style.left = pop.style.top = ''; pop.classList.add('sheet'); back.classList.add('on'); return; }
    pop.classList.remove('sheet'); back.classList.remove('on');
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, ph = pop.offsetHeight;
    let left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let top = r.bottom + 6;
    if (top + ph > innerHeight - 8 && r.top - 6 - ph > 8) top = r.top - 6 - ph;
    pop.style.left = left + 'px';
    pop.style.top = Math.max(8, top) + 'px';
  }
  document.body.append(back, pop);
  build(pop, close, place);
  place();
  anchor.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', onScroll, true);
  back.addEventListener('click', close);
  current = { anchor, pop, close };
  return { close, place };
}

// 읽고 쓸 수 있는 .value 를 가진 요소 (기존 input 처럼 쓰려고)
function withValue(el, get, set) {
  Object.defineProperty(el, 'value', { get, set, configurable: true });
  return el;
}

// ───────── 색상 ─────────
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const isHex = (s) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || '').trim());
export const normHex = (s) => {
  let t = String(s).trim().replace('#', '').toLowerCase();
  if (t.length === 3) t = t.split('').map((c) => c + c).join('');
  return '#' + t;
};
function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hh = 0;
  if (d) hh = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(hh * 60 + 360) % 360, mx ? d / mx : 0, mx];
}
function hsv2rgb(hh, s, v) {
  const f = (n) => { const k = (n + hh / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

function dragArea(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const go = (ev) => { const r = el.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); };
    go(e);
    const mv = (ev) => go(ev);
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}

/** 색상 입력: 누르면 색상판이 열려요. onInput은 고르는 동안, onDone은 닫힐 때(바뀌었으면) */
export function colorField({ value = '#888888', label = '색상', swatches = [], onInput, onDone } = {}) {
  let hex = normHex(value);
  const dot = h('i', { class: 'cf-dot' });
  const txt = h('span', { class: 'cf-hex' });
  const btn = h('button', { type: 'button', class: 'cf', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, dot, txt);
  const paint = () => { dot.style.background = hex; txt.textContent = hex.toUpperCase(); };
  paint();
  let startHex = hex;
  const setHex = (x, emit = true) => { hex = normHex(x); paint(); if (emit) onInput?.(hex); };

  btn.addEventListener('click', () => {
    startHex = hex;
    popover(btn, (pop) => {
      let [hh, s, v] = rgb2hsv(hex2rgb(hex));
      pop.classList.add('pop-color');
      const area = h('div', { class: 'cp-area' }, h('i', { class: 'cp-thumb' }));
      const hue = h('div', { class: 'cp-hue' }, h('i', { class: 'cp-thumb' }));
      const hexIn = h('input', { class: 'input cp-in', maxlength: '7', spellcheck: 'false', 'aria-label': '색상 코드', value: hex.toUpperCase() });
      const preview = h('i', { class: 'cp-prev' });
      const draw = (fromInput = false) => {
        const cur = rgb2hex(hsv2rgb(hh, s, v));
        area.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hh} 100% 50%))`;
        area.firstChild.style.left = s * 100 + '%'; area.firstChild.style.top = (1 - v) * 100 + '%';
        area.firstChild.style.background = cur;
        hue.firstChild.style.left = (hh / 360) * 100 + '%';
        hue.firstChild.style.background = `hsl(${hh} 100% 50%)`;
        preview.style.background = cur;
        if (!fromInput) hexIn.value = cur.toUpperCase();
        return cur;
      };
      const emit = () => setHex(draw());
      dragArea(area, (x, y) => { s = x; v = 1 - y; emit(); });
      dragArea(hue, (x) => { hh = x * 360 >= 360 ? 359.99 : x * 360; emit(); });
      hexIn.addEventListener('input', () => {
        if (!isHex(hexIn.value)) return;
        [hh, s, v] = rgb2hsv(hex2rgb(normHex(hexIn.value)));
        draw(true);
        setHex(normHex(hexIn.value));
      });
      hexIn.addEventListener('blur', () => { hexIn.value = hex.toUpperCase(); });
      const sw = swatches.length ? h('div', { class: 'cp-sw' }, swatches.map((c) =>
        h('button', { type: 'button', class: 'cp-sw-b', style: { background: c }, 'aria-label': c, title: c,
          onclick: () => { [hh, s, v] = rgb2hsv(hex2rgb(c)); setHex(c); draw(); } }))) : null;
      pop.append(area, h('div', { class: 'cp-row' }, preview, hue), h('div', { class: 'cp-row' }, hexIn), sw);
      draw();
    }, { onClose: () => { if (hex !== startHex) onDone?.(hex); } });
  });

  return withValue(btn, () => hex, (x) => { if (isHex(x)) { hex = normHex(x); paint(); } });
}

// ───────── 달력 ─────────
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const toYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parseYmd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : null; };

/** 날짜 입력: 누르면 달력이 열려요. value는 'YYYY-MM-DD' */
export function dateField({ value, label = '날짜', onChange } = {}) {
  let val = parseYmd(value) ? value : toYmd(...(() => { const n = new Date(); return [n.getFullYear(), n.getMonth(), n.getDate()]; })());
  const txt = h('span', { class: 'df-txt' });
  const btn = h('button', { type: 'button', class: 'input df', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('calendar', 16), txt, icon('chevd', 14));
  const paint = () => {
    const [y, m, d] = parseYmd(val);
    txt.textContent = `${y}년 ${m + 1}월 ${d}일 (${DOW[new Date(y, m, d).getDay()]})`;
  };
  paint();
  const set = (v, emit = true) => { val = v; paint(); if (emit) { onChange?.(val); btn.dispatchEvent(new Event('change')); } };

  btn.addEventListener('click', () => {
    popover(btn, (pop, close, place) => {
      pop.classList.add('pop-cal');
      let [vy, vm] = parseYmd(val);
      const title = h('button', { type: 'button', class: 'cal-title', title: '연도 선택' });
      const grid = h('div', { class: 'cal-grid', role: 'grid' });
      const body = h('div');
      let mode = 'days';
      const nav = (dm) => { if (mode === 'years') { vy += dm * 12; } else { vm += dm; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } } draw(); };
      const draw = () => {
        const today = new Date();
        const ty = today.getFullYear(), tm = today.getMonth(), td = today.getDate();
        const sel = parseYmd(val);
        if (mode === 'years') {
          const base = vy - (((vy % 12) + 12) % 12);
          title.textContent = `${base} – ${base + 11}`;
          body.replaceChildren(h('div', { class: 'cal-years' }, Array.from({ length: 12 }, (_, i) => base + i).map((y) =>
            h('button', { type: 'button', class: 'cal-y' + (y === sel[0] ? ' on' : '') + (y === ty ? ' today' : ''), onclick: () => { vy = y; mode = 'days'; draw(); } }, `${y}`))));
          place();
          return;
        }
        title.textContent = `${vy}년 ${vm + 1}월`;
        const first = new Date(vy, vm, 1).getDay();
        const dim = new Date(vy, vm + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < first; i++) cells.push(h('span', { class: 'cal-e' }));
        for (let d = 1; d <= dim; d++) {
          const on = sel[0] === vy && sel[1] === vm && sel[2] === d;
          const isToday = ty === vy && tm === vm && td === d;
          const dow = (first + d - 1) % 7;
          cells.push(h('button', { type: 'button', class: 'cal-d' + (on ? ' on' : '') + (isToday ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''),
            'aria-label': `${vy}년 ${vm + 1}월 ${d}일`, 'aria-pressed': on ? 'true' : 'false',
            onclick: () => { set(toYmd(vy, vm, d)); close(); } }, `${d}`));
        }
        grid.replaceChildren(...DOW.map((w, i) => h('span', { class: 'cal-w' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') }, w)), ...cells);
        body.replaceChildren(grid);
        place();
      };
      title.addEventListener('click', () => { mode = mode === 'days' ? 'years' : 'days'; draw(); });
      pop.append(
        h('div', { class: 'cal-head' },
          h('button', { type: 'button', class: 'cal-nav', 'aria-label': '이전', onclick: () => nav(-1) }, icon('chevl', 16)),
          title,
          h('button', { type: 'button', class: 'cal-nav', 'aria-label': '다음', onclick: () => nav(1) }, icon('chevr', 16))),
        body,
        h('div', { class: 'cal-foot' },
          h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { const n = new Date(); set(toYmd(n.getFullYear(), n.getMonth(), n.getDate())); close(); } }, '오늘')));
      draw();
    });
  });

  return withValue(btn, () => val, (v) => { if (parseYmd(v)) { val = v; paint(); } });
}

// ───────── 드롭다운 / 콤보 ─────────
/** options: [[value, label], ...]  — 값이 정해진 목록에서 고르는 드롭다운 */
export function selectField({ options, value = '', label = '선택', onChange, block = false } = {}) {
  let val = value;
  const txt = h('span', { class: 'sf-txt' });
  const btn = h('button', { type: 'button', class: 'input sf' + (block ? ' block' : ''), 'aria-label': label, 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, txt, icon('chevd', 14));
  const paint = () => { txt.textContent = (options.find(([v]) => v === val) || options[0])?.[1] ?? ''; };
  paint();
  const set = (v) => { val = v; paint(); onChange?.(v); btn.dispatchEvent(new Event('change')); };
  btn.addEventListener('click', () => {
    popover(btn, (pop) => {
      pop.classList.add('pop-list');
      pop.style.minWidth = btn.offsetWidth + 'px';
      const items = options.map(([v, l]) => h('button', { type: 'button', role: 'option', class: 'opt-i' + (v === val ? ' on' : ''), 'aria-selected': v === val ? 'true' : 'false',
        onclick: () => { set(v); current?.close(); } }, h('span', null, l), v === val ? icon('check', 15) : null));
      pop.append(h('div', { class: 'pop-opts', role: 'listbox' }, items));
      pop.addEventListener('keydown', (e) => {
        const i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, i - 1)]?.focus(); }
      });
      setTimeout(() => (items.find((x) => x.classList.contains('on')) || items[0])?.focus(), 0);
    });
  });
  return withValue(btn, () => val, (v) => { val = v; paint(); });
}

/** 직접 입력도 되고 추천 목록에서 고를 수도 있는 입력칸 (datalist 대신) */
export function comboField({ options = [], value = '', placeholder = '', onChange } = {}) {
  const input = h('input', { class: 'input', placeholder, value, autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'false' });
  const list = h('div', { class: 'combo-list', role: 'listbox', hidden: true });
  const wrap = h('div', { class: 'combo' }, input, h('button', { type: 'button', class: 'combo-btn', tabindex: '-1', 'aria-label': '목록 열기',
    onmousedown: (e) => { e.preventDefault(); if (list.hidden) { input.focus(); show(true); } else hide(); } }, icon('chevd', 14)), list);
  let idx = -1;
  const hide = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); idx = -1; };
  const show = (all = false) => {
    const q = all ? '' : input.value.trim().toLowerCase();
    const rows = options.filter((o) => !q || o.toLowerCase().includes(q));
    if (!rows.length) { hide(); return; }
    list.replaceChildren(...rows.map((o) => h('button', { type: 'button', role: 'option', class: 'opt-i' + (o === input.value ? ' on' : ''),
      onmousedown: (e) => { e.preventDefault(); input.value = o; hide(); onChange?.(o); } }, h('span', null, o), o === input.value ? icon('check', 15) : null)));
    list.hidden = false; input.setAttribute('aria-expanded', 'true'); idx = -1;
  };
  input.addEventListener('focus', () => show(true));
  input.addEventListener('input', () => { show(); onChange?.(input.value); });
  input.addEventListener('blur', hide);
  input.addEventListener('keydown', (e) => {
    const els = [...list.children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) show(true);
      const n = [...list.children];
      idx = clamp(idx + (e.key === 'ArrowDown' ? 1 : -1), 0, n.length - 1);
      n.forEach((x, i) => x.classList.toggle('hl', i === idx));
      n[idx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && !list.hidden && idx >= 0) { e.preventDefault(); els[idx].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); }
    else if (e.key === 'Escape') hide();
  });
  return withValue(wrap, () => input.value, (v) => { input.value = v ?? ''; });
}

// ───────── 숫자 ─────────
export function numberField({ value = 1, min = 1, max = 1000, label = '개수', width = 132 } = {}) {
  const input = h('input', { class: 'input num-in', inputmode: 'numeric', 'aria-label': label, value: String(value) });
  const get = () => clamp(parseInt(input.value, 10) || min, min, max);
  const set = (n) => { input.value = String(clamp(n, min, max)); };
  input.addEventListener('input', () => { input.value = input.value.replace(/[^\d]/g, '').slice(0, 5); });
  input.addEventListener('blur', () => set(get()));
  input.addEventListener('keydown', (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); set(get() + 1); } if (e.key === 'ArrowDown') { e.preventDefault(); set(get() - 1); } });
  const wrap = h('div', { class: 'stepper', style: { width: width + 'px' } },
    h('button', { type: 'button', class: 'step-b', 'aria-label': '줄이기', onclick: () => set(get() - 1) }, icon('minus', 14)),
    input,
    h('button', { type: 'button', class: 'step-b', 'aria-label': '늘리기', onclick: () => set(get() + 1) }, icon('plus', 14)));
  return withValue(wrap, () => String(get()), (v) => set(Number(v)));
}
