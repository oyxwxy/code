// 글 속 이미지를 모든 글에서 똑같은 규칙으로 보여줘요.
//  · 세로로 긴 이미지: 2장씩 나란히 (마지막 한 장이 남거나 한 장뿐이면 그것만)
//  · 가로로 긴 이미지: 잘라내지 않고 전체를 한 화면에
//  · 화면이 둘 이상이면 좌우로 넘기는 버튼(스와이프·방향키도 가능)
import { h, icon } from './util.js';
import { loadImage } from './images.js';

const measure = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
  im.onerror = () => res(null);
  im.src = src;
});

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * refs: 이미지 주소(또는 예전 방식 이미지 ID) 배열
 * onOpen(index): 이미지를 눌렀을 때 (크게 보기)
 */
export function imageGallery(refs, { onOpen, spoilers = new Set(), revealed = new Set() } = {}) {
  const root = h('div', { class: 'gal' }, h('div', { class: 'gal-skel' }, h('span', { class: 'spin' })));

  (async () => {
    // 가로/세로를 알아야 묶을 수 있어서 먼저 크기를 재요 (브라우저 캐시에 남아 뒤에서 바로 뜹니다)
    const items = await Promise.all(refs.map(async (ref, index) => {
      const src = await loadImage(ref);
      const dim = src ? await measure(src) : null;
      return { index, src, portrait: !!dim && dim.h > dim.w * 1.05 };
    }));

    // 연속한 세로 이미지는 2장씩 묶어요
    const slides = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i], nx = items[i + 1];
      if (it.portrait && nx?.portrait) { slides.push({ kind: 'pair', items: [it, nx] }); i++; }
      else slides.push({ kind: it.portrait ? 'solo' : 'wide', items: [it] });
    }

    // 스포일러로 가린 이미지: 처음엔 흐리게 가리고, 한 번 누르면 풀려요 (그 다음부터는 크게 보기)
    const figs = new Map();
    const unhide = (i) => { revealed.add(i); const f = figs.get(i); if (f) { f.classList.remove('sp'); f.querySelector('.sp-cover')?.remove(); f.setAttribute('aria-label', `이미지 ${i + 1} 크게 보기`); } };
    root.reveal = unhide;
    const fig = (it) => {
      if (!it.src) return h('div', { class: 'gfig missing' }, '이미지를 불러올 수 없어요');
      const hidden = spoilers.has(it.index) && !revealed.has(it.index);
      const el = h('button', { class: 'gfig' + (hidden ? ' sp' : ''), type: 'button',
        onclick: () => { if (el.classList.contains('sp')) unhide(it.index); else onOpen?.(it.index); },
        'aria-label': hidden ? `이미지 ${it.index + 1} (스포일러, 눌러서 보기)` : `이미지 ${it.index + 1} 크게 보기` },
        h('img', { src: it.src, alt: '', draggable: 'false', decoding: 'async' }),
        hidden ? h('span', { class: 'sp-cover' }, icon('eye-off', 22), h('strong', null, '스포일러'), h('small', null, '눌러서 보기')) : null);
      figs.set(it.index, el);
      return el;
    };
    const only = items.length === 1;
    const slideEls = slides.map((s) => h('div', { class: `gslide ${s.kind}` + (only ? ' only' : '') }, s.items.map(fig)));

    if (slides.length <= 1) { root.replaceChildren(h('div', { class: 'gal-single' }, ...slideEls)); return; }

    let idx = 0;
    const track = h('div', { class: 'gal-track', tabindex: '0', role: 'group', 'aria-label': '이미지 넘겨보기' }, slideEls);
    const prev = h('button', { class: 'gal-nav prev', type: 'button', 'aria-label': '이전 이미지', onclick: () => go(idx - 1) }, icon('chevl', 22));
    const next = h('button', { class: 'gal-nav next', type: 'button', 'aria-label': '다음 이미지', onclick: () => go(idx + 1) }, icon('chevr', 22));
    const dots = h('div', { class: 'gal-dots' }, slides.map((_, i) =>
      h('button', { class: 'gal-dot', type: 'button', 'aria-label': `${i + 1}번째 화면`, onclick: () => go(i) })));
    const count = h('div', { class: 'gal-count' });

    const sync = () => {
      prev.disabled = idx <= 0;
      next.disabled = idx >= slides.length - 1;
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
      const nums = slides[idx].items.map((x) => x.index + 1);
      count.textContent = `${nums.length > 1 ? `${nums[0]}–${nums[nums.length - 1]}` : nums[0]} / ${items.length}`;
    };
    const go = (n) => {
      n = Math.max(0, Math.min(slides.length - 1, n));
      track.scrollTo({ left: n * track.clientWidth, behavior: reduced() ? 'auto' : 'smooth' });
      idx = n;
      sync();
    };
    track.addEventListener('scroll', () => {
      const n = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (n !== idx && n >= 0 && n < slides.length) { idx = n; sync(); }
    }, { passive: true });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    });

    root.replaceChildren(h('div', { class: 'gal-stage' }, track, prev, next, count), dots);
    sync();
  })();

  return root;
}
