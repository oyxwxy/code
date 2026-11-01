// 이미지 크게 보기 (직접 만든 뷰어)
//  · 화면 크기에 맞춰 항상 전체가 보여요 (넘치지 않음)
//  · 휠 · 두 손가락 · +/- 키 · 더블클릭으로 확대, 끌어서 이동
//  · 확대하지 않은 상태에서 좌우로 밀면 이전/다음 이미지
import { h, icon } from './util.js';
import { loadImage } from './images.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_ZOOM = 6;

export function openLightbox(refs, start = 0, { spoilers = new Set(), revealed = new Set(), onReveal } = {}) {
  let i = clamp(start, 0, refs.length - 1), token = 0;
  let nat = null;                       // 현재 이미지 원본 크기
  const view = { s: 1, x: 0, y: 0 };    // 확대 배율 / 이동량(px)
  const pts = new Map();                // 눌려 있는 포인터들
  let pinch = null, dragFrom = null, swipe = null, lastTap = 0;

  const img = h('img', { class: 'lb-img', alt: '', draggable: 'false' });
  const stage = h('div', { class: 'lb-stage' }, img);
  const count = h('div', { class: 'lb-count' });
  const zoomTxt = h('button', { class: 'lb-zoom-txt', type: 'button', 'aria-label': '원래 크기로', onclick: () => reset(true) }, '100%');
  const spin = h('div', { class: 'lb-spin' }, h('span', { class: 'spin' }));

  const multi = refs.length > 1;
  const prevBtn = multi ? h('button', { class: 'lb-btn lb-prev', type: 'button', 'aria-label': '이전 이미지', onclick: () => go(i - 1) }, icon('chevl', 26)) : null;
  const nextBtn = multi ? h('button', { class: 'lb-btn lb-next', type: 'button', 'aria-label': '다음 이미지', onclick: () => go(i + 1) }, icon('chevr', 26)) : null;
  const tools = h('div', { class: 'lb-tools' },
    h('button', { class: 'lb-btn sm', type: 'button', 'aria-label': '축소', onclick: () => zoomBy(1 / 1.4) }, icon('minus', 18)),
    zoomTxt,
    h('button', { class: 'lb-btn sm', type: 'button', 'aria-label': '확대', onclick: () => zoomBy(1.4) }, icon('plus', 18)));

  const spCover = h('button', { class: 'lb-sp', type: 'button', onclick: () => {
    revealed.add(i); onReveal?.(i); box.classList.remove('sp-hidden');
  } }, icon('eye-off', 26), h('strong', null, '스포일러'), h('small', null, '눌러서 보기'));
  const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': '이미지 크게 보기' },
    stage, spCover, spin,
    h('button', { class: 'lb-btn lb-close', type: 'button', 'aria-label': '닫기', onclick: () => close() }, icon('x', 22)),
    prevBtn, nextBtn, count, tools);

  // 화면에 딱 맞는 기본 크기(px)
  const fit = () => {
    if (!nat) return { w: 0, h: 0 };
    const W = stage.clientWidth - 24, H = stage.clientHeight - 24;
    const f = Math.min(W / nat.w, H / nat.h, 3);
    return { w: Math.max(1, nat.w * f), h: Math.max(1, nat.h * f) };
  };
  const limits = () => {
    const f = fit();
    return { mx: Math.max(0, (f.w * view.s - stage.clientWidth) / 2), my: Math.max(0, (f.h * view.s - stage.clientHeight) / 2) };
  };
  const apply = (smooth = false) => {
    const { mx, my } = limits();
    view.x = clamp(view.x, -mx, mx);
    view.y = clamp(view.y, -my, my);
    img.classList.toggle('smooth', smooth);
    img.style.transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.s})`;
    zoomTxt.textContent = `${Math.round(view.s * 100)}%`;
    box.classList.toggle('zoomed', view.s > 1.001);
  };
  const layout = () => { const f = fit(); img.style.width = f.w + 'px'; img.style.height = f.h + 'px'; apply(); };
  const reset = (smooth) => { view.s = 1; view.x = 0; view.y = 0; apply(smooth); };

  // (cx, cy) 화면 좌표를 기준으로 배율 바꾸기
  const zoomAt = (ns, cx, cy, smooth = false) => {
    ns = clamp(ns, 1, MAX_ZOOM);
    const r = stage.getBoundingClientRect();
    const px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
    const k = ns / view.s;
    view.x = px - (px - view.x) * k;
    view.y = py - (py - view.y) * k;
    view.s = ns;
    if (ns === 1) { view.x = 0; view.y = 0; }
    apply(smooth);
  };
  const zoomBy = (k) => { const r = stage.getBoundingClientRect(); zoomAt(view.s * k, r.left + r.width / 2, r.top + r.height / 2, true); };

  async function go(n) {
    if (!multi && img.src) return;
    i = (n + refs.length) % refs.length;
    box.classList.toggle('sp-hidden', spoilers.has(i) && !revealed.has(i));
    count.textContent = multi ? `${i + 1} / ${refs.length}` : '';
    const my = ++token;
    img.classList.add('loading');
    spin.classList.add('on');
    const u = await loadImage(refs[i]);
    if (my !== token) return;
    if (!u) { spin.classList.remove('on'); return; }
    const pre = new Image();
    pre.onload = () => {
      if (my !== token) return;
      nat = { w: pre.naturalWidth, h: pre.naturalHeight };
      img.src = u;
      view.s = 1; view.x = 0; view.y = 0;
      layout();
      img.classList.remove('loading');
      spin.classList.remove('on');
      // 앞뒤 이미지를 미리 받아 둬요
      [i - 1, i + 1].forEach((k) => { if (multi) loadImage(refs[(k + refs.length) % refs.length]).then((x) => { if (x) new Image().src = x; }); });
    };
    pre.onerror = () => { if (my === token) spin.classList.remove('on'); };
    pre.src = u;
  }

  // ── 입력 ──
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(view.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
  }, { passive: false });

  stage.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
      dragFrom = null; swipe = null;
    } else {
      dragFrom = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      swipe = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      zoomAt(pinch.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (dragFrom) {
      if (view.s > 1.001) {
        view.x = dragFrom.vx + (e.clientX - dragFrom.x);
        view.y = dragFrom.vy + (e.clientY - dragFrom.y);
        stage.classList.add('grabbing');
        apply();
      }
      if (swipe && Math.hypot(e.clientX - swipe.x, e.clientY - swipe.y) > 6) swipe.moved = true;
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    stage.classList.remove('grabbing');
    if (pinch && pts.size < 2) { pinch = null; if (view.s < 1.02) reset(true); }
    if (pts.size === 0 && swipe && e.type === 'pointerup') {
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (view.s <= 1.001 && swipe.moved && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && Date.now() - swipe.t < 700) go(i + (dx < 0 ? 1 : -1));
      else if (!swipe.moved) {
        const now = Date.now();
        const onImg = e.target === img;
        if (onImg && now - lastTap < 320) { lastTap = 0; view.s > 1.001 ? reset(true) : zoomAt(2.5, e.clientX, e.clientY, true); }
        else {
          lastTap = now;
          // 이미지 바깥(어두운 배경)을 누르면 닫혀요
          if (!onImg && view.s <= 1.001) setTimeout(() => { if (lastTap === now) close(); }, 0);
        }
      }
    }
    if (pts.size === 0) { dragFrom = null; swipe = null; }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { if (view.s > 1.001) { view.x += 80; apply(true); } else go(i - 1); }
    else if (e.key === 'ArrowRight') { if (view.s > 1.001) { view.x -= 80; apply(true); } else go(i + 1); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.4);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.4);
    else if (e.key === '0') reset(true);
  };
  const onResize = () => layout();

  const prevOverflow = document.body.style.overflow;
  let closing = false;
  function close() {
    if (closing) return;
    closing = true;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    document.body.style.overflow = prevOverflow;
    box.classList.add('out');
    setTimeout(() => box.remove(), 180);
  }

  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  document.body.style.overflow = 'hidden';   // 뒤 화면이 같이 스크롤되지 않게
  document.body.append(box);
  requestAnimationFrame(() => box.classList.add('in'));
  go(i);
  return { close };
}
