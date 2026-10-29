import { h, icon, fmtDate, loader, emptyState, copyText, toast, confirmDialog } from './util.js';
import { state, getPost, getProfile, loadContent, unlockContent, deletePost, friendly } from './store.js';
import { applyTheme, DEFAULT_THEME } from './theme.js';
import { loadImage } from './images.js';
import { PARAM_FIELDS } from './nai.js';
import { avatarEl, visBadge } from './view-blog.js';
import { APP_NAME } from './config.js';

/** 쉼표로 나누되 (), [], {} 안의 쉼표는 무시 */
export function splitTokens(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function promptBlock(label, text, { variant = '' } = {}) {
  if (!text || !text.trim()) return null;
  let chips = false;
  const body = h('div', { class: 'block-body' });
  const paint = () => {
    body.replaceChildren();
    if (chips) body.append(h('div', { class: 'toks' }, splitTokens(text).map((t) => h('span', { class: 'tok' }, t))));
    else body.append(h('pre', { class: 'plain' }, text));
  };
  const toggle = h('button', { class: 'btn ghost sm', onclick: () => { chips = !chips; toggle.textContent = chips ? '원문 보기' : '태그로 보기'; paint(); } }, '태그로 보기');
  paint();
  return h('section', { class: 'block ' + variant },
    h('div', { class: 'block-head' }, h('h3', null, label),
      h('div', { class: 'block-tools' }, toggle,
        h('button', { class: 'btn sm', onclick: () => copyText(text, `${label} 복사했어요`) }, icon('copy', 14), '복사'))),
    body);
}

function openLightbox(ids, start) {
  let i = start, token = 0;
  const img = h('img', { class: 'lb-img', alt: '' });
  const cnt = h('div', { class: 'lb-count' });
  const show = async (n) => {
    i = (n + ids.length) % ids.length;
    cnt.textContent = ids.length > 1 ? `${i + 1} / ${ids.length}` : '';
    const my = ++token;
    img.style.opacity = '.35';
    const u = await loadImage(ids[i]);
    if (my === token && u) { img.src = u; img.style.opacity = '1'; }
  };
  const close = () => { document.removeEventListener('keydown', onKey); box.remove(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(i - 1);
    else if (e.key === 'ArrowRight') show(i + 1);
  };
  const box = h('div', { class: 'lightbox', onclick: (e) => { if (e.target === box || e.target.classList.contains('lb-stage')) close(); } },
    h('div', { class: 'lb-stage' }, img),
    h('button', { class: 'lb-btn lb-close', onclick: close, 'aria-label': '닫기' }, icon('x', 22)),
    ids.length > 1 ? h('button', { class: 'lb-btn lb-prev', onclick: () => show(i - 1), 'aria-label': '이전' }, icon('chevl', 26)) : null,
    ids.length > 1 ? h('button', { class: 'lb-btn lb-next', onclick: () => show(i + 1), 'aria-label': '다음' }, icon('chevr', 26)) : null,
    cnt);
  document.addEventListener('keydown', onKey);
  document.body.append(box);
  show(start);
}

function renderBody(content) {
  const wrap = h('div', { class: 'post-body' });
  const ids = content.images || [];
  if (ids.length) {
    wrap.append(h('div', { class: 'gallery g' + Math.min(ids.length, 4) }, ids.map((id, idx) => {
      const im = h('img', { alt: '', class: 'fade' });
      const fig = h('button', { class: 'fig', onclick: () => openLightbox(ids, idx), 'aria-label': '이미지 크게 보기' }, im);
      loadImage(id).then((u) => { if (u) { im.src = u; im.classList.add('in'); } else fig.classList.add('missing'); });
      return fig;
    })));
  }
  wrap.append(promptBlock('프롬프트', content.prompt));
  (content.chars || []).forEach((c, i) => {
    wrap.append(promptBlock(`캐릭터 ${i + 1}`, c.prompt, { variant: 'char' }));
    wrap.append(promptBlock(`캐릭터 ${i + 1} · UC`, c.uc, { variant: 'neg' }));
  });
  wrap.append(promptBlock('네거티브 프롬프트', content.negative, { variant: 'neg' }));

  const pr = content.params || {};
  const filled = PARAM_FIELDS.filter(([k]) => pr[k] != null && String(pr[k]).trim() !== '');
  if (filled.length) {
    const asText = filled.map(([k, label]) => `${label}: ${pr[k]}`).join(', ');
    wrap.append(h('section', { class: 'block' },
      h('div', { class: 'block-head' }, h('h3', null, '생성 설정'),
        h('div', { class: 'block-tools' }, h('button', { class: 'btn sm', onclick: () => copyText(asText, '설정을 복사했어요') }, icon('copy', 14), '복사'))),
      h('div', { class: 'params' }, filled.map(([k, label]) =>
        h('div', { class: 'param' }, h('span', { class: 'pl' }, label), h('span', { class: 'pv' }, String(pr[k])))))));
  }
  if (content.notes?.trim()) {
    wrap.append(h('section', { class: 'block' }, h('div', { class: 'block-head' }, h('h3', null, '메모')),
      h('div', { class: 'block-body' }, h('div', { class: 'notes' }, content.notes))));
  }
  return wrap;
}

export async function post({ params, root }) {
  root.classList.add('narrow');
  root.append(loader());
  const id = params[0];
  const p = await getPost(id);
  if (!p) {
    applyTheme(state.me?.theme || DEFAULT_THEME);
    root.replaceChildren(emptyState('볼 수 없는 글이에요', '없는 글이거나 비공개로 바뀌었을 수 있어요.', h('a', { class: 'btn', href: state.me ? '#/u/' + state.me.handle : '#/' }, '돌아가기')));
    return;
  }
  const author = await getProfile(p.owner);
  applyTheme(author?.theme);
  document.title = `${p.title} · ${APP_NAME}`;
  const isOwner = state.user?.uid === p.owner;

  const share = () => {
    const url = location.origin + location.pathname + '#/p/' + p.id;
    copyText(url, p.vis === 'locked' ? '링크를 복사했어요. 비밀번호도 함께 알려주세요' : p.vis === 'private' ? '링크를 복사했어요 (비공개라 나만 열 수 있어요)' : '링크를 복사했어요');
  };

  const head = h('header', { class: 'post-head' },
    h('a', { class: 'back', href: '#/u/' + (author?.handle || p.handle) }, icon('back', 16), author?.display || p.handle),
    h('div', { class: 'post-vis' }, visBadge(p, true)),
    h('h1', { class: 'post-title' }, p.title),
    h('div', { class: 'post-meta' },
      author ? h('a', { class: 'by', href: '#/u/' + author.handle }, avatarEl(author, 'xs'), h('span', null, author.display || author.handle)) : null,
      h('span', null, fmtDate(p.created)),
      p.updated && p.updated - p.created > 60000 ? h('span', { class: 'muted' }, `· 수정 ${fmtDate(p.updated)}`) : null),
    p.tags?.length ? h('div', { class: 'tags' }, p.tags.map((t) => h('a', { class: 'tag', href: '#/u/' + (author?.handle || p.handle) }, '#' + t))) : null,
    h('div', { class: 'post-actions' },
      h('button', { class: 'btn sm', onclick: share }, icon('link', 15), '링크 복사'),
      isOwner ? h('a', { class: 'btn sm', href: '#/edit/' + p.id }, icon('edit', 15), '수정') : null,
      isOwner ? h('button', {
        class: 'btn sm danger-ghost',
        onclick: async () => {
          if (!(await confirmDialog('이 글과 첨부 이미지가 영구 삭제돼요. 계속할까요?', { title: '글 삭제', ok: '삭제', danger: true }))) return;
          try { await deletePost(p); toast('삭제했어요'); location.hash = '#/u/' + state.me.handle; }
          catch (e) { toast(friendly(e)); }
        },
      }, icon('trash', 15), '삭제') : null));

  const bodyBox = h('div', null, loader());
  root.replaceChildren(head, bodyBox);

  let r;
  try { r = await loadContent(p); }
  catch (e) { bodyBox.replaceChildren(emptyState('본문을 불러오지 못했어요', friendly(e))); return; }

  if (r.needPassword) {
    const pw = h('input', { class: 'input', type: 'password', placeholder: '비밀번호', autocomplete: 'off' });
    const err = h('div', { class: 'form-err' });
    const btn = h('button', { class: 'btn primary', type: 'submit' }, '열기');
    bodyBox.replaceChildren(h('form', {
      class: 'lock-card',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        btn.textContent = '여는 중…';
        try {
          const u = await unlockContent(p, r.enc, pw.value);
          bodyBox.replaceChildren(renderBody(u.content));
        } catch (ex) {
          err.textContent = ex?.name === 'OperationError' || ex instanceof DOMException ? '비밀번호가 올바르지 않아요' : friendly(ex);
          btn.disabled = false;
          btn.textContent = '열기';
        }
      },
    },
    h('div', { class: 'lock-ic' }, icon('lock', 26)),
    h('h3', null, '비밀번호가 필요한 글이에요'),
    h('p', null, '글쓴이에게 받은 비밀번호를 입력해 주세요.'),
    h('div', { class: 'lock-row' }, pw, btn), err));
    pw.focus();
    return;
  }
  bodyBox.replaceChildren(renderBody(r.content));
}
