// 브라우저 기본 위젯(색 선택기 · 달력 · 드롭다운 · 숫자 입력)을 쓰지 않고 직접 만든 것들이에요.
// 전부 테마 색을 따라가고, 마우스 · 터치 · 키보드로 쓸 수 있어요.
import { h, icon, hex2rgb, rgb2hex } from './util.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ───────── 팝오버 (공통 바탕) ─────────
let cur = null;
export function closePopover() { if (cur) cur.close(); }

/**
 * anchor 아래(자리가 없으면 위)에 content를 띄워요. 바깥을 누르거나 Esc를 누르면 닫혀요.
 * 반환값의 place()는 내용 크기가 바뀐 뒤 위치를 다시 잡을 때, cleanups는 닫힐 때 실행할 함수를 넣을 때 써요.
 */
export function openPopover(anchor, content, { onClose, matchWidth = false, align = 'start', label = '' } = {}) {
  closePopover();
  const el = h('div', { class: 'pop' + (matchWidth ? ' match' : ''), role: 'dialog', 'aria-label': label || null }, content);
  el.style.visibility = 'hidden';
  document.body.append(el);
  if (matchWidth) el.style.width = anchor.getBoundingClientRect().width + 'px';
  anchor.setAttribute('aria-expanded', 'true');
  let closed = false;

  const place = () => {
    if (closed) return;
    if (!anchor.isConnected) { close(); return; }
    const a = anchor.getBoundingClientRect();
    const pw = el.offsetWidth, ph = el.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let left = align === 'end' ? a.right - pw : a.left;
    left = clamp(left, 8, Math.max(8, vw - pw - 8));
    let top = a.bottom + 6;
    if (top + ph > vh - 8) top = a.top - ph - 6 >= 8 ? a.top - ph - 6 : Math.max(8, vh - ph - 8);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  };
  const onDown = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();   // 뒤에 열려 있는 대화상자까지 같이 닫히지 않게
    close();
    anchor.focus?.();
  };
  const api = {
    el, anchor, place, cleanups: [],
    close() { close(); },
  };
  function close() {
    if (closed) return;
    closed = true;
    if (cur === api) cur = null;
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    anchor.setAttribute('aria-expanded', 'false');
    api.cleanups.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    el.classList.remove('in');
    setTimeout(() => el.remove(), 140);
    onClose?.();
  }
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  cur = api;
  place();
  el.style.visibility = '';
  requestAnimationFrame(() => el.classList.add('in'));
  return api;
}

/** 같은 버튼을 다시 누르면 닫고, 아니면 build(p)가 만든 내용을 띄워요 */
export function togglePopover(anchor, build, opts = {}) {
  if (cur && cur.anchor === anchor) { cur.close(); return null; }
  const p = openPopover(anchor, null, opts);
  p.el.replaceChildren(build(p));
  p.place();
  return p;
}

// ───────── 색 선택기 ─────────
export function parseHex(s) {
  s = String(s || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  else if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return '#' + s.toLowerCase();
}
function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let hh = 0;
  if (d) {
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
    if (hh < 0) hh += 360;
  }
  return [hh, max ? d / max : 0, max];
}
function hsv2rgb(hh, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 영역 안에서 누르고 끄는 동안 (0~1, 0~1) 좌표를 알려줘요 (마우스 · 터치 공통) */
function dragArea(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    el.focus();
    try { el.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const run = (ev) => {
      const r = el.getBoundingClientRect();
      fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1));
    };
    const up = () => {
      el.removeEventListener('pointermove', run);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    run(e);
    el.addEventListener('pointermove', run);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}

const BASE_SWATCHES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#ffffff', '#f1f8f5', '#e5e7eb', '#9ca3af', '#4b5563', '#1f2937', '#14151c', '#000000'];

/**
 * 색 선택 버튼. 누르면 색 영역 · 색상 막대 · 16진수 입력 · 팔레트가 열려요.
 * onInput(hex): 색이 바뀔 때마다, onClose(hex): 창이 닫힐 때
 */
export function colorField({ value = '#888888', onInput, onClose, swatches = BASE_SWATCHES, label = '색 선택' } = {}) {
  let hex = parseHex(value) || '#888888';
  let [H, S, V] = rgb2hsv(hex2rgb(hex));
  let ui = null;

  const sw = h('i', { class: 'cf-sw' });
  const code = h('span', { class: 'cf-code' });
  const btn = h('button', { type: 'button', class: 'cf', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, sw, code);
  const paintBtn = () => { sw.style.background = hex; code.textContent = hex.toUpperCase(); };
  paintBtn();

  const fromHsv = () => { hex = rgb2hex(hsv2rgb(H, S, V)); paintBtn(); ui?.sync(); onInput?.(hex); };
  const fromHex = (nh, keepInput) => { hex = nh; [H, S, V] = rgb2hsv(hex2rgb(nh)); paintBtn(); ui?.sync(keepInput); onInput?.(hex); };

  const panel = () => {
    const sv = h('div', { class: 'cp-sv', tabindex: '0', role: 'slider', 'aria-label': '채도와 밝기 (방향키로 조절)' }, h('i', { class: 'cp-knob' }));
    const hue = h('div', { class: 'cp-hue', tabindex: '0', role: 'slider', 'aria-label': '색상 (방향키로 조절)', 'aria-valuemin': '0', 'aria-valuemax': '360' }, h('i', { class: 'cp-knob' }));
    const prev = h('i', { class: 'cp-prev' });
    const hexIn = h('input', { class: 'input mono cp-hex', maxlength: '7', spellcheck: 'false', autocomplete: 'off', 'aria-label': '16진수 색 코드' });
    const sws = h('div', { class: 'cp-sws' });

    const sync = (keepInput) => {
      sv.style.backgroundColor = rgb2hex(hsv2rgb(H, 1, 1));
      sv.firstChild.style.left = `${S * 100}%`;
      sv.firstChild.style.top = `${(1 - V) * 100}%`;
      hue.firstChild.style.left = `${(H / 360) * 100}%`;
      hue.firstChild.style.background = rgb2hex(hsv2rgb(H, 1, 1));
      hue.setAttribute('aria-valuenow', String(Math.round(H)));
      prev.style.background = hex;
      if (!keepInput) hexIn.value = hex.toUpperCase();
      [...sws.children].forEach((b) => b.classList.toggle('on', b.dataset.c === hex));
    };
    ui = { sync };

    dragArea(sv, (x, y) => { S = x; V = 1 - y; fromHsv(); });
    dragArea(hue, (x) => { H = x * 359.999; fromHsv(); });
    sv.addEventListener('keydown', (e) => {
      const st = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowLeft') S = clamp(S - st, 0, 1);
      else if (e.key === 'ArrowRight') S = clamp(S + st, 0, 1);
      else if (e.key === 'ArrowUp') V = clamp(V + st, 0, 1);
      else if (e.key === 'ArrowDown') V = clamp(V - st, 0, 1);
      else return;
      e.preventDefault();
      fromHsv();
    });
    hue.addEventListener('keydown', (e) => {
      const st = e.shiftKey ? 15 : 3;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') H = clamp(H - st, 0, 359.999);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') H = clamp(H + st, 0, 359.999);
      else return;
      e.preventDefault();
      fromHsv();
    });
    hexIn.addEventListener('input', () => { const v = parseHex(hexIn.value); if (v) fromHex(v, true); });
    hexIn.addEventListener('blur', () => { hexIn.value = hex.toUpperCase(); });

    const list = [...new Set([...swatches.map((c) => parseHex(c)).filter(Boolean)])];
    sws.append(...list.map((c) => h('button', { type: 'button', class: 'cp-sw', 'data-c': c, style: { background: c }, title: c.toUpperCase(), 'aria-label': c, onclick: () => fromHex(c) })));

    const root = h('div', { class: 'cp' }, sv, hue, h('div', { class: 'cp-row' }, prev, hexIn), sws);
    sync();
    return root;
  };

  btn.addEventListener('click', () => togglePopover(btn, panel, { label, onClose: () => { ui = null; onClose?.(hex); } }));
  return {
    el: btn,
    get value() { return hex; },
    set value(v) { const n = parseHex(v); if (n) { hex = n; [H, S, V] = rgb2hsv(hex2rgb(n)); paintBtn(); ui?.sync(); } },
  };
}

// ───────── 달력 ─────────
const pad = (n) => String(n).padStart(2, '0');
export const toYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;   // m은 0부터
export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  const dt = new Date(y, mo, d);
  return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d ? { y, m: mo, d } : null;
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const today = () => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; };
const dateLabel = (s) => {
  const p = parseYmd(s);
  return p ? `${p.y}년 ${p.m + 1}월 ${p.d}일 (${WEEK[new Date(p.y, p.m, p.d).getDay()]})` : '날짜 선택';
};

/** 날짜 선택 버튼. value는 'YYYY-MM-DD' 문자열이에요 */
export function datePicker({ value = '', onChange, label = '날짜 선택' } = {}) {
  let val = parseYmd(value) ? value : '';
  const txt = h('span', { class: 'dp-txt' });
  const btn = h('button', { type: 'button', class: 'dp', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('calendar', 17), txt, icon('chevd', 16));
  const paint = () => { txt.textContent = dateLabel(val); };
  paint();

  const panel = (p) => {
    const start = parseYmd(val) || today();
    const t = today();
    let view = 'days', vy = start.y, vm = start.m, yBase = Math.floor(vy / 12) * 12;
    const root = h('div', { class: 'cal' });
    const pick = (y, m, d) => { val = toYmd(y, m, d); paint(); onChange?.(val); p.close(); btn.focus(); };

    const step = (dir) => {
      if (view === 'days') { vm += dir; if (vm < 0) { vm = 11; vy--; } else if (vm > 11) { vm = 0; vy++; } }
      else if (view === 'months') vy += dir;
      else yBase += dir * 12;
      draw();
    };
    const head = () => h('div', { class: 'cal-head' },
      h('button', { type: 'button', class: 'cal-nav', 'aria-label': '이전', onclick: () => step(-1) }, icon('chevl', 16)),
      h('button', {
        type: 'button', class: 'cal-title',
        onclick: () => { view = view === 'days' ? 'months' : view === 'months' ? 'years' : 'days'; if (view === 'years') yBase = Math.floor(vy / 12) * 12; draw(); },
      }, view === 'days' ? `${vy}년 ${vm + 1}월` : view === 'months' ? `${vy}년` : `${yBase} – ${yBase + 11}`),
      h('button', { type: 'button', class: 'cal-nav', 'aria-label': '다음', onclick: () => step(1) }, icon('chevr', 16)));

    const body = () => {
      if (view === 'months') {
        return h('div', { class: 'cal-cells' }, Array.from({ length: 12 }, (_, i) =>
          h('button', { type: 'button', class: 'cal-cell' + (vy === start.y && i === start.m ? ' sel' : '') + (vy === t.y && i === t.m ? ' today' : ''), onclick: () => { vm = i; view = 'days'; draw(); } }, `${i + 1}월`)));
      }
      if (view === 'years') {
        return h('div', { class: 'cal-cells' }, Array.from({ length: 12 }, (_, i) => {
          const y = yBase + i;
          return h('button', { type: 'button', class: 'cal-cell' + (y === start.y ? ' sel' : '') + (y === t.y ? ' today' : ''), onclick: () => { vy = y; view = 'months'; draw(); } }, String(y));
        }));
      }
      const first = new Date(vy, vm, 1).getDay();
      const cells = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(vy, vm, 1 - first + i);
        const y = d.getFullYear(), m = d.getMonth(), dd = d.getDate();
        const cls = 'cal-day' + (m !== vm ? ' out' : '') + (y === t.y && m === t.m && dd === t.d ? ' today' : '') + (y === start.y && m === start.m && dd === start.d && parseYmd(val) ? ' sel' : '');
        return h('button', { type: 'button', class: cls, onclick: () => pick(y, m, dd), 'aria-label': `${y}년 ${m + 1}월 ${dd}일` }, String(dd));
      });
      return h('div', { class: 'cal-grid' }, WEEK.map((w) => h('span', { class: 'cal-wd' }, w)), cells);
    };
    const foot = () => h('div', { class: 'cal-foot' },
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => pick(t.y, t.m, t.d) }, '오늘'));

    function draw() { root.replaceChildren(head(), body(), foot()); p.place(); }
    draw();
    return root;
  };

  btn.addEventListener('click', () => togglePopover(btn, panel, { label }));
  return {
    el: btn,
    get value() { return val; },
    set value(v) { val = parseYmd(v) ? v : ''; paint(); },
  };
}

// ───────── 드롭다운 선택 ─────────
const normOpt = (o) => (Array.isArray(o) ? { value: String(o[0]), label: String(o[1]) } : { value: String(o.value), label: String(o.label), desc: o.desc });

/** options: [[값, 이름], …]. 값은 문자열이에요 */
export function selectField({ options = [], value = '', onChange, placeholder = '선택', label = '선택' } = {}) {
  let opts = options.map(normOpt);
  let val = String(value ?? '');
  const txt = h('span', { class: 'sel-txt' });
  const btn = h('button', { type: 'button', class: 'sel', 'aria-label': label, 'aria-haspopup': 'listbox', 'aria-expanded': 'false' }, txt, icon('chevd', 16));
  const paint = () => {
    const o = opts.find((x) => x.value === val);
    txt.textContent = o ? o.label : placeholder;
    txt.classList.toggle('ph', !o);
  };
  paint();

  const menu = (p) => {
    let act = Math.max(0, opts.findIndex((o) => o.value === val));
    const rows = [];
    const list = h('div', { class: 'sel-list', role: 'listbox' });
    const mark = () => rows.forEach((r, i) => r.classList.toggle('act', i === act));
    const choose = (o) => { val = o.value; paint(); p.close(); btn.focus(); onChange?.(val); };
    opts.forEach((o, i) => {
      const r = h('button', {
        type: 'button', class: 'sel-opt' + (o.value === val ? ' on' : ''), role: 'option', 'aria-selected': String(o.value === val),
        onclick: () => choose(o), onmousemove: () => { act = i; mark(); },
      }, h('span', null, o.label, o.desc ? h('small', null, o.desc) : null), o.value === val ? icon('check', 15) : null);
      rows.push(r);
      list.append(r);
    });
    const onKey = (e) => {
      if (e.key === 'ArrowDown') act = Math.min(opts.length - 1, act + 1);
      else if (e.key === 'ArrowUp') act = Math.max(0, act - 1);
      else if (e.key === 'Home') act = 0;
      else if (e.key === 'End') act = opts.length - 1;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts[act]) choose(opts[act]); return; }
      else return;
      e.preventDefault();
      mark();
      rows[act]?.scrollIntoView({ block: 'nearest' });
    };
    btn.addEventListener('keydown', onKey);
    p.cleanups.push(() => btn.removeEventListener('keydown', onKey));
    mark();
    requestAnimationFrame(() => rows[act]?.scrollIntoView({ block: 'nearest' }));
    return list;
  };
  btn.addEventListener('click', () => togglePopover(btn, menu, { matchWidth: true, label }));
  btn.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && btn.getAttribute('aria-expanded') !== 'true') { e.preventDefault(); btn.click(); }
  });
  return {
    el: btn,
    get value() { return val; },
    set value(v) { val = String(v ?? ''); paint(); },
    setOptions(next) { opts = next.map(normOpt); paint(); },
  };
}

// ───────── 입력 + 추천 목록 (datalist 대신) ─────────
/** 직접 입력도 되고, 화살표를 눌러 목록에서 고를 수도 있어요 */
export function comboField({ options = [], value = '', placeholder = '', onInput, label = '' } = {}) {
  const input = h('input', { class: 'input', placeholder, autocomplete: 'off', spellcheck: 'false', 'aria-label': label || placeholder || null, value });
  const arrow = h('button', { type: 'button', class: 'combo-btn', tabindex: '-1', 'aria-label': '목록 열기', 'aria-expanded': 'false' }, icon('chevd', 16));
  const wrap = h('div', { class: 'combo' }, input, arrow);
  let pop = null, act = -1, shown = [];

  const list = h('div', { class: 'sel-list', role: 'listbox' });
  const paintList = (filter) => {
    const f = (filter || '').trim().toLowerCase();
    shown = options.filter((o) => !f || String(o).toLowerCase().includes(f));
    act = shown.findIndex((o) => o === input.value);
    list.replaceChildren(...shown.map((o, i) =>
      h('button', {
        type: 'button', class: 'sel-opt' + (o === input.value ? ' on' : '') + (i === act ? ' act' : ''), role: 'option', 'aria-selected': String(o === input.value),
        // mousedown으로 받아야 입력창이 포커스를 잃기 전에 값이 들어가요
        onmousedown: (e) => { e.preventDefault(); pick(o); },
      }, h('span', null, o), o === input.value ? icon('check', 15) : null)));
    if (!shown.length) list.append(h('div', { class: 'sel-empty' }, '일치하는 항목이 없어요'));
    pop?.place();
  };
  const pick = (o) => { input.value = o; onInput?.(o); close(); input.focus(); };
  const open = (filter) => {
    if (pop) { paintList(filter); return; }
    paintList(filter);
    pop = openPopover(wrap, list, { matchWidth: true, label: label || '추천 목록', onClose: () => { pop = null; } });
  };
  const close = () => { if (pop) pop.close(); };

  input.addEventListener('input', () => { onInput?.(input.value); open(input.value); });
  input.addEventListener('focus', () => { /* 포커스만으로는 열지 않아요 (화면 가림 방지) */ });
  arrow.addEventListener('mousedown', (e) => e.preventDefault());
  arrow.addEventListener('click', () => { if (pop) close(); else { open(''); input.focus(); } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!pop) open(''); else { act = Math.min(shown.length - 1, act + 1); mark(); } }
    else if (e.key === 'ArrowUp' && pop) { e.preventDefault(); act = Math.max(0, act - 1); mark(); }
    else if (e.key === 'Enter' && pop && act >= 0 && shown[act]) { e.preventDefault(); pick(shown[act]); }
  });
  function mark() {
    [...list.querySelectorAll('.sel-opt')].forEach((r, i) => r.classList.toggle('act', i === act));
    list.querySelectorAll('.sel-opt')[act]?.scrollIntoView({ block: 'nearest' });
  }
  return {
    el: wrap,
    get value() { return input.value; },
    set value(v) { input.value = v ?? ''; },
  };
}

// ───────── 숫자 입력 (− 값 +) ─────────
export function stepper({ value = 1, min = 1, max = 99, step = 1, onChange } = {}) {
  let val = clamp(Number(value) || min, min, max);
  const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': '숫자', value: String(val) });
  const set = (n, fire = true) => {
    val = clamp(Math.round(Number.isFinite(n) ? n : val), min, max);
    input.value = String(val);
    if (fire) onChange?.(val);
  };
  input.addEventListener('input', () => { input.value = input.value.replace(/[^\d]/g, ''); });
  input.addEventListener('change', () => set(parseInt(input.value, 10)));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); set(val + step); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); set(val - step); }
  });
  const dec = h('button', { type: 'button', 'aria-label': '줄이기', onclick: () => set(val - step) }, icon('minus', 15));
  const inc = h('button', { type: 'button', 'aria-label': '늘리기', onclick: () => set(val + step) }, icon('plus', 15));
  return {
    el: h('div', { class: 'stp' }, dec, input, inc),
    get value() { return clamp(parseInt(input.value, 10) || min, min, max); },
    set value(v) { set(Number(v), false); },
  };
}

// ───────── 아이콘 고르기 ─────────
/**
 * 아이콘 목록에서 하나 고르는 버튼. options에 ''가 있으면 '없음' 칸이 생겨요.
 */
export function iconField({ options = [], value = '', onChange, label = '아이콘 고르기' } = {}) {
  let val = value;
  const face = h('span', { class: 'icf-face' });
  const btn = h('button', { type: 'button', class: 'icf', 'aria-label': label, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, face, icon('chevd', 14));
  const paint = () => {
    face.replaceChildren(val ? icon(val, 18) : h('span', { class: 'icf-none' }, '없음'));
    face.classList.toggle('none', !val);
  };
  paint();
  const panel = (p) => {
    const cells = options.map((name) => h('button', {
      type: 'button', class: 'icg-cell' + (name === val ? ' on' : '') + (name ? '' : ' none'), title: name ? name : '아이콘 없음', 'aria-label': name || '아이콘 없음',
      onclick: () => { val = name; paint(); onChange?.(val); p.close(); btn.focus(); },
    }, name ? icon(name, 20) : '없음'));
    return h('div', { class: 'icg' }, cells);
  };
  btn.addEventListener('click', () => togglePopover(btn, panel, { label }));
  return {
    el: btn,
    get value() { return val; },
    set value(v) { val = v; paint(); },
  };
}
