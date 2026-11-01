// 이미지 자르기 편집기 (직접 만든 것): 끌어서 위치, 슬라이더·휠·두 손가락으로 확대/축소, 정해진 비율로 잘라 캔버스를 돌려줘요.
// 캔버스에서 새로 그리므로 메타데이터는 남지 않고, 투명한 부분은 흰색이 돼요.
import { h, icon, modal } from './util.js';

/**
 * @param {File|Blob} file
 * @param {{ratio:number, outW:number, title?:string, hint?:string}} o  ratio = 가로/세로
 * @returns {Promise<HTMLCanvasElement|null>} 취소하면 null
 */
export function openCropper(file, { ratio, outW, title = '이미지 자르기', hint = '' } = {}) {
  return new Promise(async (resolve) => {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { resolve(null); return; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; bmp.close?.(); resolve(v); } };

    const stage = h('div', { class: 'crop-stage', style: { aspectRatio: String(ratio) } });
    const cv = h('canvas', { class: 'crop-cv' });
    const grid = h('div', { class: 'crop-grid', 'aria-hidden': 'true' });
    stage.append(cv, grid);
    const zoom = h('input', { type: 'range', class: 'crop-zoom', min: '0', max: '100', value: '0', step: '0.1', 'aria-label': '확대·축소' });

    let W = 0, H = 0, minS = 1, maxS = 1, s = 1, x = 0, y = 0;   // s: 화면 픽셀 / 원본 픽셀, (x,y): 이미지 왼쪽 위 위치
    const clamp = () => {
      s = Math.min(maxS, Math.max(minS, s));
      x = Math.min(0, Math.max(W - bmp.width * s, x));
      y = Math.min(0, Math.max(H - bmp.height * s, y));
    };
    const draw = () => {
      const ctx = cv.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bmp, x, y, bmp.width * s, bmp.height * s);
      zoom.value = String(maxS > minS ? ((s - minS) / (maxS - minS)) * 100 : 0);
    };
    const zoomAt = (ns, cx, cy) => {      // (cx,cy) 화면 좌표를 고정한 채 확대
      const ix = (cx - x) / s, iy = (cy - y) / s;
      s = ns; x = cx - ix * s; y = cy - iy * s;
      clamp(); draw();
    };
    const layout = () => {
      if (!stage.clientWidth) return;
      const first = !W;
      const ox = W ? (x / W) : 0;
      W = stage.clientWidth; H = stage.clientHeight;
      minS = Math.max(W / bmp.width, H / bmp.height);     // 빈틈 없이 덮는 최소 배율
      maxS = minS * 6;
      if (first) { s = minS; x = (W - bmp.width * s) / 2; y = (H - bmp.height * s) / 2; } else { x = ox * W; }
      clamp(); draw();
    };

    // 끌기 · 두 손가락 확대 · 휠
    const ptrs = new Map();
    let pinch = 0;
    stage.addEventListener('pointerdown', (e) => {
      stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      stage.classList.add('grabbing');
    });
    stage.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      if (ptrs.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = stage.getBoundingClientRect();
        if (pinch) zoomAt(s * (d / pinch), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = d;
      } else {
        x += e.clientX - p.x; y += e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        clamp(); draw();
      }
    });
    const up = (e) => { ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size) stage.classList.remove('grabbing'); };
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(s * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    zoom.addEventListener('input', () => zoomAt(minS + (maxS - minS) * (Number(zoom.value) / 100), W / 2, H / 2));
    stage.tabIndex = 0;
    stage.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [20, 0], ArrowRight: [-20, 0], ArrowUp: [0, 20], ArrowDown: [0, -20] }[e.key];
      if (!k) return;
      e.preventDefault(); x += k[0]; y += k[1]; clamp(); draw();
    });

    const reset = () => { s = minS; x = (W - bmp.width * s) / 2; y = (H - bmp.height * s) / 2; clamp(); draw(); };
    const body = h('div', { class: 'crop-wrap' },
      stage,
      h('div', { class: 'crop-bar' },
        icon('image', 14), zoom,
        h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, '맞추기')),
      h('p', { class: 'hint-line' }, hint || '이미지를 끌어서 위치를, 슬라이더나 마우스 휠로 크기를 맞춰요. 밝은 선 안쪽이 그대로 저장돼요.'));

    const out = () => {
      const outH = Math.round(outW / ratio);
      const f = outW / W;
      const c = document.createElement('canvas');
      c.width = outW; c.height = outH;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(bmp, x * f, y * f, bmp.width * s * f, bmp.height * s * f);
      return c;
    };

    modal({
      title, body, wide: true,
      actions: [
        { label: '취소', kind: 'ghost', onClick: () => { finish(null); } },
        { label: '적용', kind: 'primary', onClick: () => { finish(out()); } },
      ],
      onClose: () => finish(null),
    });
    requestAnimationFrame(() => requestAnimationFrame(layout));
    window.addEventListener('resize', layout);
    const stop = setInterval(() => { if (done) { clearInterval(stop); window.removeEventListener('resize', layout); } }, 500);
  });
}

// ───────── 글 이미지용 자르기: 이미지 전체를 보면서 자를 영역을 끌어 정해요 (선택 기능) ─────────
export const RATIO_PRESETS = [['free', '자유'], ['orig', '원본'], ['1:1', '1 : 1'], ['4:3', '4 : 3'], ['3:4', '3 : 4'], ['3:2', '3 : 2'], ['2:3', '2 : 3'], ['16:9', '16 : 9'], ['9:16', '9 : 16'], ['4:5', '4 : 5']];

/**
 * @param {File|Blob} file
 * @returns {Promise<HTMLCanvasElement|null>} 자른 결과(원본 해상도). 취소하면 null
 */
export function openImageCropper(file, { title = '이미지 자르기' } = {}) {
  return new Promise(async (resolve) => {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { resolve(null); return; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; bmp.close?.(); resolve(v); } };

    const stage = h('div', { class: 'rc-stage' });
    const cv = h('canvas', { class: 'rc-cv' });
    const box = h('div', { class: 'rc-box', tabIndex: 0 }, h('i', { class: 'rc-grid' }));
    const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    HANDLES.forEach((k) => box.append(h('span', { class: 'rc-h rc-' + k, 'data-h': k })));
    stage.append(cv, box);
    const info = h('small', { class: 'hint-line rc-info' });
    const presetBar = h('div', { class: 'rc-presets', role: 'group', 'aria-label': '비율' });

    let d = 1, IW = 0, IH = 0;                 // d: 화면 픽셀 / 원본 픽셀
    let r = { x: 0, y: 0, w: 0, h: 0 };        // 자를 영역(화면 좌표)
    let preset = 'free', ratio = 0;            // ratio = 가로/세로, 0 이면 자유
    const MIN = 28;

    const paint = () => {
      box.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
      box.classList.toggle('locked', !!ratio);
      info.textContent = `자르는 크기 ${Math.round(r.w / d)} × ${Math.round(r.h / d)} px`;
    };
    const setPreset = (k) => {
      preset = k;
      ratio = k === 'free' ? 0 : k === 'orig' ? bmp.width / bmp.height : (() => { const [a, b] = k.split(':').map(Number); return a / b; })();
      if (ratio) {                                   // 지금 영역의 중심을 유지하며, 이미지 안에서 가장 크게
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        const w = Math.min(IW, IH * ratio), h2 = w / ratio;
        r = { x: Math.min(IW - w, Math.max(0, cx - w / 2)), y: Math.min(IH - h2, Math.max(0, cy - h2 / 2)), w, h: h2 };
      }
      paintPresets(); paint();
    };
    const paintPresets = () => presetBar.replaceChildren(...RATIO_PRESETS.map(([k, label]) =>
      h('button', { type: 'button', class: 'side-opt' + (preset === k ? ' on' : ''), onclick: () => setPreset(k) }, label)));

    const layout = () => {
      const maxW = Math.min(stage.parentElement?.clientWidth || 560, 560), maxH = Math.max(160, window.innerHeight * 0.5);
      d = Math.min(maxW / bmp.width, maxH / bmp.height, 1);
      const first = !IW;
      const od = IW ? IW / bmp.width : d;
      IW = Math.round(bmp.width * d); IH = Math.round(bmp.height * d);
      stage.style.width = IW + 'px'; stage.style.height = IH + 'px';
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(IW * dpr); cv.height = Math.round(IH * dpr);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
      if (first) r = { x: 0, y: 0, w: IW, h: IH };
      else { const f = d / od; r = { x: r.x * f, y: r.y * f, w: r.w * f, h: r.h * f }; }
      paint();
    };

    // 영역 끌기 / 크기 조절
    let drag = null;
    const pt = (e) => { const b = stage.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const clampR = () => {
      r.w = Math.max(MIN, Math.min(IW, r.w)); r.h = Math.max(MIN, Math.min(IH, r.h));
      r.x = Math.max(0, Math.min(IW - r.w, r.x)); r.y = Math.max(0, Math.min(IH - r.h, r.y));
    };
    box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      box.setPointerCapture(e.pointerId);
      const hd = e.target.dataset?.h || '';
      drag = { hd, start: pt(e), r0: { ...r } };
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = pt(e), { hd, start, r0 } = drag;
      if (!hd) { r.x = r0.x + p.x - start.x; r.y = r0.y + p.y - start.y; clampR(); paint(); return; }
      const px = Math.max(0, Math.min(IW, p.x)), py = Math.max(0, Math.min(IH, p.y));
      const west = hd.includes('w'), east = hd.includes('e'), north = hd.includes('n'), south = hd.includes('s');
      const corner = hd.length === 2;
      if (ratio && !corner) return;                            // 비율 고정일 땐 모서리만
      // 고정되는 반대편 기준점
      const ax = west ? r0.x + r0.w : r0.x, ay = north ? r0.y + r0.h : r0.y;
      let x1 = ax, x2 = ax, y1 = ay, y2 = ay;
      if (corner) {
        let w = Math.abs(px - ax), h2 = Math.abs(py - ay);
        const sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1;
        if (ratio) {
          const maxW = Math.min(sx > 0 ? IW - ax : ax, (sy > 0 ? IH - ay : ay) * ratio);
          w = Math.min(Math.max(w, h2 * ratio), maxW); h2 = w / ratio;
          if (w < MIN) { w = MIN; h2 = w / ratio; }
        } else { w = Math.max(w, MIN); h2 = Math.max(h2, MIN); }
        x1 = ax; x2 = ax + sx * w; y1 = ay; y2 = ay + sy * h2;
      } else if (west || east) {
        x1 = ax; x2 = Math.max(0, Math.min(IW, px)); y1 = r0.y; y2 = r0.y + r0.h;
        if (Math.abs(x2 - x1) < MIN) x2 = x1 + (x2 >= x1 ? MIN : -MIN);
      } else {
        y1 = ay; y2 = Math.max(0, Math.min(IH, py)); x1 = r0.x; x2 = r0.x + r0.w;
        if (Math.abs(y2 - y1) < MIN) y2 = y1 + (y2 >= y1 ? MIN : -MIN);
      }
      r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      clampR(); paint();
    });
    const end = () => { drag = null; };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
      if (!k) return;
      e.preventDefault(); r.x += k[0]; r.y += k[1]; clampR(); paint();
    });

    const body = h('div', { class: 'rc-wrap' },
      presetBar,
      h('div', { class: 'rc-center' }, stage),
      info,
      h('p', { class: 'hint-line' }, '비율을 고르고 네모를 끌어 옮기거나 모서리를 끌어 크기를 맞춰요. 자르지 않아도 되니 필요할 때만 쓰세요.'));
    paintPresets();

    const out = () => {
      const f = 1 / d;
      const sx = Math.round(r.x * f), sy = Math.round(r.y * f);
      const sw = Math.min(bmp.width - sx, Math.max(1, Math.round(r.w * f))), sh = Math.min(bmp.height - sy, Math.max(1, Math.round(r.h * f)));
      const c = document.createElement('canvas');
      c.width = sw; c.height = sh;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
      return c;
    };

    modal({
      title, body, wide: true,
      actions: [
        { label: '취소', kind: 'ghost', onClick: () => { finish(null); } },
        { label: '자르기', kind: 'primary', onClick: () => { finish(out()); } },
      ],
      onClose: () => finish(null),
    });
    requestAnimationFrame(() => requestAnimationFrame(layout));
    window.addEventListener('resize', layout);
    const stop = setInterval(() => { if (done) { clearInterval(stop); window.removeEventListener('resize', layout); } }, 500);
  });
}
