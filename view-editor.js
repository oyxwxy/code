import { openImageCropper } from './crop.js';
import { h, icon, toast, modal, loader, emptyState, autosize, askText, sortable, rid, txt } from './util.js';
import { state, getPost, listPosts, loadContent, unlockContent, savePost, saveBoards, friendly } from './store.js';
import { applyTheme, sanitizeBoards, MAX_BOARDS, MAX_BOARD_NAME } from './theme.js';
import { datePicker, selectField, comboField } from './widgets.js';
import { compressImage, loadImage, isUrl } from './images.js';
import { readImageMeta, parseGenText, PARAM_FIELDS } from './nai.js';
import { MAX_IMAGES } from './config.js';
import { KINDS, kindOf, kindLabel } from './kinds.js';

const MODELS = ['NovelAI Diffusion V5 Full', 'NovelAI Diffusion V5 Curated', 'NovelAI Diffusion V4.5 Full', 'NovelAI Diffusion V4.5 Curated', 'NovelAI Diffusion V4 Full', 'NovelAI Diffusion V4 Curated', 'NovelAI Diffusion Anime V3', 'NovelAI Diffusion Furry V3'];
const SAMPLERS = ['Euler', 'Euler Ancestral', 'DPM++ 2S Ancestral', 'DPM++ 2M', 'DPM++ 2M SDE', 'DPM++ SDE', 'DDIM'];
const PLACEHOLDERS = { model: 'NovelAI Diffusion V5 Full', sampler: 'Euler Ancestral', steps: '28', scale: '5', cfgRescale: '0', schedule: 'karras', seed: '', size: '832x1216', extra: 'SMEA, Variety+ 등' };
const normEffort = (x) => { const v = String(x || '').toLowerCase(); return v === 'medium' ? 'Medium' : v === 'high' ? 'High' : ''; };

const ymd = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const panel = (title, ...kids) => h('section', { class: 'panel' }, title ? h('h3', { class: 'panel-title' }, title) : null, ...kids);

export async function editor({ params, query, root }) {
  if (!state.me) { location.replace('#/login?next=' + encodeURIComponent(location.hash.slice(1))); return; }
  applyTheme(state.me.theme);
  root.append(loader());

  const editId = params[0] || null;
  let prev = null, content = null, lock = null;
  if (editId) {
    prev = await getPost(editId);
    if (!prev || prev.owner !== state.user.uid) {
      root.replaceChildren(emptyState('수정할 수 없는 글이에요', '', h('a', { class: 'btn', href: '#/u/' + state.me.handle }, '돌아가기')));
      return;
    }
    let r = await loadContent(prev, { fresh: true });
    if (r.needPassword) {
      const pw = await askText({ title: '비밀번호 입력', label: '이 글을 수정하려면 비밀번호가 필요해요.', type: 'password' });
      if (pw == null) { location.hash = '#/p/' + editId; return; }
      try { r = await unlockContent(prev, r.enc, pw); }
      catch { toast('비밀번호가 올바르지 않아요'); location.hash = '#/p/' + editId; return; }
    }
    content = r.content;
    lock = r.lock || null;
  }
  document.title = (editId ? '글 수정' : '새 글') + ' · Drawer';

  let kind = prev ? kindOf(prev) : (KINDS[query?.get('kind')] ? query.get('kind') : 'style');

  // ── 이미지 상태: { src(올라간 주소) | data(아직 안 올린 데이터) } ──
  const origImages = [...(content?.images || [])];
  let imgs = [];
  for (const [idx, ref] of origImages.entries()) {
    const sp = (content?.imgSp || []).includes(idx);
    if (isUrl(ref)) imgs.push({ src: ref, spoiler: sp });
    else { const d = await loadImage(ref); if (d) imgs.push({ data: d, spoiler: sp }); }   // 예전 방식 글은 저장할 때 ImgBB로 옮겨져요
  }

  // ── 입력 요소 ──
  let vis = prev?.vis || 'public';
  let tags = [...(prev?.tags || [])];
  const titleIn = h('input', { class: 'input title-input', maxlength: '120', value: txt(prev?.title) });
  const mkTa = (value, rows, cls = 'mono') => {
    const t = h('textarea', { class: 'textarea ' + cls, rows: String(rows), spellcheck: 'false', value: txt(value) });
    autosize(t);
    return t;
  };
  const promptIn = mkTa(content?.prompt, 6);
  const negIn = mkTa(content?.negative, 4);
  negIn.placeholder = '네거티브 프롬프트(UC)';

  // 메모: 말풍선 목록 (상대 / 나 를 골라서 대화처럼 적어요). 예전 글의 메모 글자는 말풍선 하나로 열려요
  const MAX_BUBBLES = 40;
  const memoBox = h('div', { class: 'memo-edit' });
  const memoRows = [];
  const addBubble = (side = 'them', text = '') => {
    if (memoRows.length >= MAX_BUBBLES) { toast(`말풍선은 ${MAX_BUBBLES}개까지예요`); return null; }
    const row = { side: side === 'me' ? 'me' : 'them' };
    const ta = h('textarea', { class: 'textarea', rows: '2', maxlength: '2000', value: txt(text), placeholder: '메모 (사용 팁, 마음에 든 점, 출처 등)' });
    autosize(ta);
    const grip = h('span', { class: 'grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 16));
    const seg = h('div', { class: 'side-seg', role: 'group', 'aria-label': '말풍선 쪽' });
    const paint = () => {
      el.dataset.side = row.side;
      seg.replaceChildren(...[['them', '상대'], ['me', '나']].map(([k, label]) =>
        h('button', { type: 'button', class: 'side-opt' + (row.side === k ? ' on' : ''), onclick: () => { row.side = k; paint(); } }, label)));
    };
    const del = h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '말풍선 삭제', onclick: () => { memoRows.splice(memoRows.indexOf(row), 1); el.remove(); } }, icon('x', 15));
    const el = h('div', { class: 'memo-row' }, h('div', { class: 'memo-head' }, grip, seg, h('span', { class: 'sp' }), del), ta);
    Object.assign(row, { el, ta });
    memoRows.push(row);
    memoBox.append(el);
    paint();
    return row;
  };
  const initMemo = Array.isArray(content?.memo) && content.memo.length ? content.memo
    : txt(content?.notes).trim() ? [{ side: 'them', text: content.notes }] : [];
  initMemo.slice(0, MAX_BUBBLES).forEach((m) => addBubble(m?.side, m?.text));
  sortable(memoBox, {
    item: '.memo-row', handle: '.grip',
    onSort: (els) => { const next = els.map((el) => memoRows.find((r) => r.el === el)).filter(Boolean); memoRows.splice(0, memoRows.length, ...next); },
  });

  // 캐릭터 변형 (사복, 교복 …)
  const varBox = h('div', { class: 'chars' });
  const varRows = [];
  // 변형은 캐릭터(의상 등)와 배포 프롬(상황·꾸밈 등) 글에서 쓸 수 있어요
  const hasVariants = (k) => k === 'character' || k === 'scene';
  const VAR_PH = { character: '변형 이름 (예: 사복, 교복, 수영복)', scene: '변형 이름 (예: 낮, 밤, 비 오는 날)' };
  const addVariant = (v = {}) => {
    const name = h('input', { class: 'input', placeholder: VAR_PH[kind] || VAR_PH.character, maxlength: '40', value: txt(v.name) });
    const p = mkTa(v.prompt, 3);
    p.placeholder = '이 변형에만 쓰는 프롬프트';
    const sp = h('input', { type: 'checkbox', checked: !!v.spoiler });
    const row = { name, p, sp };
    const el = h('div', { class: 'char-row' },
      h('div', { class: 'char-head' },
        h('span', { class: 'grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 16)), name,
        h('button', { class: 'btn ghost sm icon', type: 'button', onclick: () => { varRows.splice(varRows.indexOf(row), 1); el.remove(); }, 'aria-label': '삭제' }, icon('x', 15))),
      p,
      h('label', { class: 'check' }, sp, h('span', null, '스포일러 가리기 ', h('small', null, '(이 프롬프트만 흐리게 가리고, 눌러야 보여요)'))));
    row.el = el;
    varRows.push(row);
    varBox.append(el);
    return row;
  };
  (content?.variants || []).forEach(addVariant);
  sortable(varBox, {
    item: '.char-row', handle: '.grip',
    onSort: (els) => { const next = els.map((el) => varRows.find((r) => r.el === el)).filter(Boolean); varRows.splice(0, varRows.length, ...next); },
  });

  // 생성 설정 (그림체 전용) — 드롭다운·추천 목록도 브라우저 기본 대신 직접 만든 위젯이에요
  const pf = {};
  const paramGrid = h('div', { class: 'param-grid' }, PARAM_FIELDS.map(([k, label]) => {
    const val = txt(content?.params?.[k]);
    let node, custom = true;
    if (k === 'effort') {
      pf[k] = selectField({ options: [['', '선택 안 함'], ['Medium', 'Medium'], ['High', 'High']], value: normEffort(val), label: 'Effort' });
      node = pf[k].el;
    } else if (k === 'model' || k === 'sampler') {
      pf[k] = comboField({ options: k === 'model' ? MODELS : SAMPLERS, value: val, placeholder: PLACEHOLDERS[k] || '', label: label });
      node = pf[k].el;
    } else {
      pf[k] = h('input', { class: 'input', placeholder: PLACEHOLDERS[k] || '', value: val });
      node = pf[k];
      custom = false;
    }
    return h(custom ? 'div' : 'label', { class: 'pf' + (k === 'extra' || k === 'model' ? ' wide' : '') }, h('span', null, label), node);
  }));

  // 작성일 (직접 지정)
  const dateIn = datePicker({ value: ymd(prev?.created || Date.now()), label: '작성일 선택' });

  // 게시판 (글 분류)
  let boards = sanitizeBoards(state.me.theme.boards);
  let board = boards.some((b) => b.id === prev?.board) ? prev.board : '';
  // 새 글: 게시판을 보다가 글쓰기를 눌렀으면(#/new?board=…) 그 게시판을 미리 골라 둬요
  if (!prev) { const qb = query?.get('board'); if (qb && boards.some((b) => b.id === qb)) board = qb; }
  const boardOpts = () => [['', '미분류'], ...boards.map((b) => [b.id, b.name])];
  const boardSel = selectField({ options: boardOpts(), value: board, label: '게시판', onChange: (v) => { board = v; } });
  async function addBoard() {
    if (boards.length >= MAX_BOARDS) { toast(`게시판은 최대 ${MAX_BOARDS}개까지 만들 수 있어요`); return; }
    const name = await askText({ title: '새 게시판', label: '게시판 이름을 입력해 주세요.', ok: '만들기', placeholder: '예: 완성작, 연구 중' });
    if (!name || !name.trim()) return;
    const nb = { id: rid(8), name: name.trim().slice(0, MAX_BOARD_NAME) };
    try {
      await saveBoards([...boards, nb]);
      boards = sanitizeBoards(state.me.theme.boards);
      board = nb.id;
      boardSel.setOptions(boardOpts());
      boardSel.value = nb.id;
      toast(`'${nb.name}' 게시판을 만들었어요`);
    } catch (e) { toast(friendly(e)); }
  }

  // 공개 설정
  const pwIn = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const unlistedCb = h('input', { type: 'checkbox', checked: !!prev?.unlisted });
  const spoilerCb = h('input', { type: 'checkbox', checked: !!prev?.spoiler });
  const fillCb = h('input', { type: 'checkbox', checked: !!prev?.thumbFill });
  const visOpts = [
    ['public', 'globe', '공개', '링크를 아는 누구나'],
    ['locked', 'lock', '비밀번호', '비밀번호를 아는 사람만'],
    ['private', 'eye-off', '비공개', '나만 볼 수 있어요'],
  ];
  const segBox = h('div', { class: 'seg' });
  const visExtra = h('div', { class: 'vis-extra' });
  const paintVis = () => {
    segBox.replaceChildren(...visOpts.map(([k, ic, label, desc]) =>
      h('button', { type: 'button', class: 'seg-opt' + (vis === k ? ' on' : ''), onclick: () => { vis = k; paintVis(); } },
        icon(ic, 18), h('strong', null, label), h('small', null, desc))));
    const kids = [];
    if (vis === 'locked') {
      const keep = !!lock;
      pwIn.placeholder = keep ? '비워두면 기존 비밀번호 유지' : '이 글의 비밀번호';
      kids.push(h('label', { class: 'field' }, h('span', { class: 'lbl' }, keep ? '새 비밀번호 (선택)' : '비밀번호'), pwIn,
        h('small', { class: 'hint-line' }, '비밀번호는 서버에 저장되지 않아요. 잊으면 복구할 수 없지만, 로그인한 내 계정에서는 비밀번호 없이 열 수 있어요.')));
    }
    if (vis === 'public') {
      kids.push(h('label', { class: 'check' }, spoilerCb, h('span', null, '스포일러 가리기 ', h('small', null, '(공개지만 썸네일과 내용을 흐리게 가리고, 눌러야 보여요)'))));
    }
    if (vis !== 'private') {
      kids.push(h('label', { class: 'check' }, unlistedCb, h('span', null, '내 블로그 목록에 숨기기 ', h('small', null, '(링크를 아는 사람만 접근)'))));
    }
    visExtra.replaceChildren(...kids);
  };
  paintVis();

  // 태그
  const tagInput = h('input', { class: 'tag-input', placeholder: '태그 입력 후 Enter' });
  const tagBox = h('div', { class: 'tag-box', onclick: () => tagInput.focus() });
  // 이전 글에서 쓴 태그: 눌러서 바로 추가 (많이 쓴 순서)
  const SUGGEST_SHOW = 16;
  const pastTags = [];
  let suggestAll = false;
  const suggestBox = h('div', { class: 'tag-suggest', hidden: true });
  const paintSuggest = () => {
    const avail = pastTags.filter((t) => !tags.includes(t));
    suggestBox.hidden = avail.length === 0;
    if (!avail.length) return;
    const list = suggestAll ? avail : avail.slice(0, SUGGEST_SHOW);
    suggestBox.replaceChildren(
      h('small', { class: 'hint-line' }, '이전 글에서 쓴 태그 — 눌러서 추가'),
      h('div', { class: 'tag-suggest-list' },
        list.map((t) => h('button', { type: 'button', class: 'pill sm', title: '이 태그 추가', onclick: () => { addTagsFrom(t); } }, '#' + t)),
        avail.length > SUGGEST_SHOW ? h('button', { type: 'button', class: 'pill sm more', onclick: () => { suggestAll = !suggestAll; paintSuggest(); } }, suggestAll ? '접기' : `+${avail.length - SUGGEST_SHOW}개 더`) : null));
  };
  listPosts(state.user.uid).then((posts) => {
    const cnt = new Map();
    posts.forEach((p) => (p.tags || []).map(txt).filter(Boolean).forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1)));
    pastTags.push(...[...cnt.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]));
    paintSuggest();
  }).catch(() => { /* 태그 추천을 못 불러와도 글쓰기는 그대로 해요 */ });

  const paintTags = () => {
    paintSuggest();
    tagBox.replaceChildren(...tags.map((t) =>
      h('span', { class: 'tag removable', 'data-tag': t }, h('span', { class: 'grip', title: '끌어서 순서 바꾸기' }, icon('grip', 12)), '#' + t, h('button', { type: 'button', onclick: (e) => { e.stopPropagation(); tags = tags.filter((x) => x !== t); paintTags(); }, 'aria-label': '삭제' }, '×'))), tagInput);
  };
  const addTagsFrom = (s) => {
    s.split(/[,\n]/).map((x) => x.trim().replace(/^#/, '')).filter(Boolean).forEach((t) => { if (!tags.includes(t) && tags.length < 20) tags.push(t.slice(0, 30)); });
    paintTags();
  };
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTagsFrom(tagInput.value); tagInput.value = ''; tagInput.focus(); }
    else if (e.key === 'Backspace' && !tagInput.value && tags.length) { tags.pop(); paintTags(); tagInput.focus(); }
  });
  tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) { addTagsFrom(tagInput.value); tagInput.value = ''; } });
  paintTags();
  sortable(tagBox, { item: '.tag.removable', handle: '.grip', onSort: (els) => { tags = els.map((e) => e.dataset.tag); } });

  // ── 가져오기 ──
  const applyMeta = (m) => {
    promptIn.value = m.prompt || '';
    negIn.value = m.negative || '';
    for (const [k] of PARAM_FIELDS) {
      const v = txt(m.params?.[k]);
      if (!v) continue;
      pf[k].value = k === 'effort' ? normEffort(v) : v;
    }
    if (kind === 'character' && m.chars?.length) {
      varRows.splice(0).forEach((r) => r.el.remove());
      m.chars.forEach((c, i) => addVariant({ name: `캐릭터 ${i + 1}`, prompt: c.prompt }));
    }
    [promptIn, negIn].forEach((t) => t.dispatchEvent(new Event('input')));
  };
  const hasText = () => promptIn.value.trim() || negIn.value.trim();

  // ── 이미지 ──
  const imgGrid = h('div', { class: 'img-grid' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const paintImgs = () => {
    imgGrid.replaceChildren(...imgs.map((im, i) => {
      if (im.pending) return h('div', { class: 'img-item pending', 'data-i': i }, h('span', { class: 'spin' }));
      return h('div', { class: 'img-item', 'data-i': i },
        h('img', { src: im.data || im.src, alt: '', draggable: 'false' }),
        h('span', { class: 'grip img-grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 14)),
        i === 0 ? h('span', { class: 'cover-tag' }, '대표') : null,
        im.spoiler ? h('span', { class: 'sp-tag' }, icon('eye-off', 11), '스포일러') : null,
        h('div', { class: 'img-tools' },
          h('button', { type: 'button', class: im.spoiler ? 'on' : '', title: im.spoiler ? '스포일러 가리기 끄기' : '스포일러로 가리기', onclick: () => { im.spoiler = !im.spoiler; paintImgs(); } }, icon('eye-off', 14)),
          h('button', { type: 'button', title: '자르기 (선택)', onclick: () => cropImg(im) }, icon('crop', 14)),
          i !== 0 ? h('button', { type: 'button', title: '대표 이미지로', onclick: () => { imgs.unshift(imgs.splice(i, 1)[0]); paintImgs(); } }, icon('star', 14)) : null,
          h('button', { type: 'button', title: '삭제', onclick: () => { imgs.splice(i, 1); paintImgs(); } }, icon('x', 14))));
    }));
  };
  sortable(imgGrid, { item: '.img-item', handle: '.img-grip', onSort: (els) => { imgs = els.map((el) => imgs[Number(el.dataset.i)]); paintImgs(); } });
  // 선택 기능: 이미 올린 이미지를 필요할 때만 잘라요 (자르면 새 이미지로 다시 올라가요)
  async function cropImg(im) {
    let blob;
    try { blob = await (await fetch(im.data || im.src)).blob(); }
    catch { toast('이 이미지는 브라우저에서 자를 수 없어요. 원본 파일을 다시 올려서 잘라 주세요'); return; }
    const canvas = await openImageCropper(blob);
    if (!canvas) return;
    try {
      const out = await new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('이미지를 만들지 못했어요'))), 'image/png'));
      im.data = await compressImage(out);
      delete im.src;
      paintImgs();
    } catch (err) { toast(friendly(err)); }
  }
  async function addFiles(files, { forceMeta = false } = {}) {
    files = [...files].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    let found = null;
    for (const f of files) {
      if (imgs.length >= MAX_IMAGES) { toast(`이미지는 최대 ${MAX_IMAGES}장까지 넣을 수 있어요`); break; }
      const ph = { pending: true };
      imgs.push(ph);
      paintImgs();
      try {
        // 프롬프트 정보는 원본에서 읽고, 올라가는 이미지는 새로 인코딩해서 메타데이터를 지워요
        const [data, meta] = await Promise.all([compressImage(f), readImageMeta(f)]);
        ph.data = data; ph.pending = false;
        if (meta && !found) found = meta;
      } catch (e) {
        imgs.splice(imgs.indexOf(ph), 1);
        toast(`${f.name}: ${friendly(e)}`);
      }
      paintImgs();
    }
    if (found) {
      if (forceMeta || !hasText()) { applyMeta(found); toast('이미지에서 프롬프트 정보를 가져왔어요'); }
      else toast('이미지에서 프롬프트 정보를 찾았어요', { action: '덮어쓰기', onAction: () => applyMeta(found), ms: 7000 });
    } else if (forceMeta) {
      toast('이 이미지에서는 프롬프트 정보를 찾지 못했어요');
    }
  }
  fileIn.addEventListener('change', () => { addFiles(fileIn.files); fileIn.value = ''; });
  const drop = h('div', { class: 'dropzone', tabindex: '0', onclick: () => fileIn.click() },
    icon('upload', 22), h('strong', null, '이미지를 끌어다 놓거나 눌러서 선택'),
    h('small', null, 'Ctrl+V (맥은 ⌘V)로 복사한 이미지를 붙여넣어도 돼요'),
    h('small', null, 'NovelAI 이미지면 프롬프트·설정을 자동으로 읽어와요'));
  drop.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  paintImgs();

  // 복사한 이미지(스크린샷, 웹에서 '이미지 복사', 탐색기에서 복사한 파일)를 글쓰기 화면 어디서든 Ctrl+V 로 넣어요.
  // 글자만 복사했을 땐 건드리지 않아서 평소처럼 붙여넣어져요.
  const onPaste = (e) => {
    if (!imgGrid.isConnected) { document.removeEventListener('paste', onPaste); return; }   // 다른 화면으로 가면 정리
    if (document.querySelector('.modal-back')) return;                                        // 팝업(자르기 등)이 열려 있으면 그쪽에 맡겨요
    const cd = e.clipboardData;
    if (!cd) return;
    let files = [...(cd.items || [])].filter((it) => it.kind === 'file' && it.type.startsWith('image/')).map((it) => it.getAsFile()).filter(Boolean);
    if (!files.length) files = [...(cd.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    if (imgs.length >= MAX_IMAGES) { toast(`이미지는 최대 ${MAX_IMAGES}장까지 넣을 수 있어요`); return; }
    toast(files.length > 1 ? `이미지 ${files.length}장을 붙여넣었어요` : '이미지를 붙여넣었어요');
    addFiles(files);
  };
  document.addEventListener('paste', onPaste);

  const metaFile = h('input', { type: 'file', accept: 'image/*', hidden: true });
  metaFile.addEventListener('change', () => { addFiles(metaFile.files, { forceMeta: true }); metaFile.value = ''; });
  const importText = () => {
    const ta = h('textarea', { class: 'textarea mono', rows: '10', placeholder: 'SD 웹UI 형식 / NovelAI 코멘트 JSON / 프롬프트 텍스트를 붙여넣으세요' });
    modal({
      title: '텍스트로 가져오기', body: ta, wide: true,
      actions: [{ label: '취소', kind: 'ghost' }, {
        label: '가져오기', kind: 'primary',
        onClick: () => {
          const m = parseGenText(ta.value);
          if (!m) { toast('내용을 해석하지 못했어요'); return false; }
          applyMeta(m);
          toast('가져왔어요');
        },
      }],
    });
    setTimeout(() => ta.focus(), 60);
  };

  // ── 저장 ──
  const saveBtn = h('button', { class: 'btn primary', type: 'button' }, icon('check', 16), editId ? '수정 저장' : '저장');
  async function save() {
    if (imgs.some((i) => i.pending)) { toast('이미지를 처리 중이에요. 잠시만요'); return; }
    if (vis === 'locked' && !pwIn.value && !lock) { toast('비밀번호를 입력해 주세요'); pwIn.focus(); return; }
    if (tagInput.value.trim()) { addTagsFrom(tagInput.value); tagInput.value = ''; }
    const memo = memoRows.map((r) => ({ side: r.side, text: r.ta.value.trim() })).filter((m) => m.text);
    // notes 는 말풍선 글을 이어 붙인 글자예요 (목록 발췌·백업·예전 화면 호환용)
    const body = { prompt: promptIn.value.replace(/\s+$/, ''), notes: memo.map((m) => m.text).join('\n'), memo };
    const labels = {};
    if (promptTitle.value) labels.prompt = promptTitle.value;
    if (notesTitle.value) labels.notes = notesTitle.value;
    if (kind === 'style' && negTitle.value) labels.negative = negTitle.value;
    if (Object.keys(labels).length) body.labels = labels;
    if (kind === 'style') {
      body.negative = negIn.value.replace(/\s+$/, '');
      body.params = {};
      for (const [k] of PARAM_FIELDS) { const v = txt(pf[k].value).trim(); if (v) body.params[k] = v; }
    }
    if (hasVariants(kind)) {
      body.variants = varRows
        .map((r, i) => ({ name: r.name.value.trim() || `변형 ${i + 1}`, prompt: r.p.value.replace(/\s+$/, ''), ...(r.sp.checked ? { spoiler: true } : {}) }))
        .filter((v) => v.prompt);
    }
    // 날짜를 바꾸지 않았으면 원래 시각을 그대로 두고, 바꿨으면 고른 날짜 + 지금 시각으로 저장해요
    let created;
    if (dateIn.value && dateIn.value !== ymd(prev?.created || Date.now())) {
      const [y, m, d] = dateIn.value.split('-').map(Number);
      const n = new Date();
      created = new Date(y, m - 1, d, n.getHours(), n.getMinutes(), n.getSeconds()).getTime();
    }
    saveBtn.disabled = true;
    const label = saveBtn.lastChild;
    label.textContent = ' 저장 중…';
    try {
      const id = await savePost({
        id: editId, prev, kind, board, title: titleIn.value, vis, unlisted: unlistedCb.checked, spoiler: spoilerCb.checked, thumbFill: fillCb.checked, tags, content: body, created,
        images: imgs.filter((i) => i.src || i.data), password: pwIn.value, lock, origImages,
        onProgress: (i, n) => { label.textContent = ` 이미지 올리는 중 (${i + 1}/${n})…`; },
      });
      toast('저장했어요');
      location.hash = '#/p/' + id;
    } catch (e) {
      console.error(e);
      toast(friendly(e), { ms: 6000 });
      saveBtn.disabled = false;
      label.textContent = editId ? '수정 저장' : '저장';
    }
  }
  saveBtn.addEventListener('click', save);

  // ── 종류별 화면 구성 ──
  const kindBox = h('div', { class: 'kind-seg' });
  const mainBox = h('div', { class: 'ed-main' });
  const sideBox = h('aside', { class: 'ed-side' });
  // 칸 이름은 글마다 바꿀 수 있어요 (비워 두면 기본 이름)
  const promptTitle = titleEditor('프롬프트', content?.labels?.prompt);
  const promptPanel = h('section', { class: 'panel' }, promptTitle.el, promptIn);
  const negTitle = titleEditor('네거티브 프롬프트', content?.labels?.negative);
  const negPanel = h('section', { class: 'panel' }, negTitle.el, negIn);
  const VAR_TITLE = { character: '변형 (사복 · 교복 등)', scene: '변형 (상황 · 꾸밈 등)' };
  const variantPanel = panel(VAR_TITLE.character, varBox,
    h('button', { class: 'btn sm', type: 'button', onclick: () => addVariant().name.focus() }, icon('plus', 14), '변형 추가'),
    h('small', { class: 'hint-line' }, '보기 화면에서 변형마다 따로 복사할 수 있고, 기본 프롬프트와 함께 복사하는 버튼도 있어요.'));
  const notesTitle = titleEditor('메모', content?.labels?.notes);
  const notesPanel = h('section', { class: 'panel' }, notesTitle.el, memoBox,
    h('div', { class: 'row tight' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => addBubble('them')?.ta.focus() }, icon('plus', 14), '상대 말풍선'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => addBubble('me')?.ta.focus() }, icon('plus', 14), '내 말풍선')),
    h('small', { class: 'hint-line' }, '메시지처럼 말풍선으로 보여요. 상대/나를 눌러 쪽을 바꾸고, ⋮⋮ 를 끌어 순서를 바꿔요.'));
  const visPanel = panel('공개 설정', segBox, visExtra);
  const boardPanel = panel('게시판', boardSel.el,
    h('div', { class: 'row tight' }, h('button', { class: 'btn sm', type: 'button', onclick: addBoard }, icon('plus', 14), '새 게시판')),
    h('small', { class: 'hint-line' }, '글을 분류하는 폴더예요. 블로그에서 게시판별로 모아 볼 수 있어요.'));
  const datePanel = panel('작성일', dateIn.el, h('small', { class: 'hint-line' }, '글에 표시되는 날짜예요. 원하는 날짜로 바꿀 수 있어요. 목록 순서는 블로그에서 카드를 끌어서 정해요.'));
  const imgPanel = panel('이미지', drop, fileIn, imgGrid,
    h('small', { class: 'hint-line' }, `최대 ${MAX_IMAGES}장 · 첫 번째가 대표 이미지 · 끌어서 순서를 바꿔요`),
    h('label', { class: 'check' }, fillCb, h('span', null, '목록 썸네일 꽉 채우기 ', h('small', null, '(가로로 긴 그림의 위아래 여백을 없애고 칸을 가득 채워요. 가장자리는 잘릴 수 있어요)'))));
  const tagPanel = panel('태그', tagBox, suggestBox);
  const paramPanel = panel('생성 설정', paramGrid,
    h('small', { class: 'hint-line' }, 'Effort는 V5 Full 전용이에요. Medium은 14 steps·Euler Ancestral로 고정돼요.'));
  const importPanel = panel('가져오기',
    h('div', { class: 'btn-col' },
      h('button', { class: 'btn', type: 'button', onclick: () => metaFile.click() }, icon('image', 15), '이미지에서 프롬프트 가져오기'),
      h('button', { class: 'btn', type: 'button', onclick: importText }, icon('file', 15), '텍스트 붙여넣어 가져오기'),
      metaFile));

  const TITLES = { style: '그림체 프롬프트', character: '캐릭터 프롬프트 (기본)', scene: '프롬프트' };
  const PHS = { style: '그림체를 만드는 프롬프트 (작가 태그, 퀄리티 태그 등)', character: '캐릭터의 기본 외형 프롬프트', scene: '상황·배경·꾸밈 프롬프트' };
  const TPH = { style: '그림체 이름', character: '캐릭터 이름', scene: '제목' };
  const paintKind = () => {
    kindBox.replaceChildren(...Object.entries(KINDS).map(([k, v]) =>
      h('button', { type: 'button', class: 'kind-opt' + (kind === k ? ' on' : ''), onclick: () => { kind = k; paintKind(); } },
        icon(v.icon, 18), h('strong', null, kindLabel(k)), h('small', null, v.desc))));
    promptTitle.setDefault(TITLES[kind]);
    if (hasVariants(kind)) {   // 변형 칸의 제목·예시를 글 종류에 맞춰요
      variantPanel.querySelector('.panel-title').textContent = VAR_TITLE[kind];
      varRows.forEach((r) => { r.name.placeholder = VAR_PH[kind]; });
    }
    promptIn.placeholder = PHS[kind];
    titleIn.placeholder = TPH[kind];
    mainBox.replaceChildren(titleIn, promptPanel,
      ...(kind === 'style' ? [negPanel] : []),
      ...(hasVariants(kind) ? [variantPanel] : []),
      notesPanel);
    sideBox.replaceChildren(boardPanel, visPanel, datePanel, imgPanel, tagPanel, ...(kind === 'style' ? [paramPanel] : []), importPanel);
  };
  paintKind();

  root.classList.add('wide');
  root.replaceChildren(
    h('div', { class: 'editor' },
      h('div', { class: 'ed-top' },
        h('a', { class: 'back', href: editId ? '#/p/' + editId : '#/u/' + state.me.handle }, icon('back', 16), '돌아가기'),
        h('h2', null, editId ? '글 수정' : '새 글')),
      kindBox,
      h('div', { class: 'ed-grid' }, mainBox, sideBox),
      h('div', { class: 'sticky-bar' },
        h('a', { class: 'btn ghost', href: editId ? '#/p/' + editId : '#/u/' + state.me.handle }, '취소'), saveBtn)));
  if (!editId) titleIn.focus();
}


/** 패널 제목 + 연필 버튼: 누르면 이 칸의 이름을 직접 입력해서 바꿀 수 있어요 (비우면 기본 이름) */
function titleEditor(defaultText, initial) {
  let def = defaultText, custom = txt(initial).trim();
  const text = h('span', { class: 'pt-text' });
  const input = h('input', { class: 'input pt-input', maxlength: '30', hidden: true, 'aria-label': '칸 이름' });
  const btn = h('button', { type: 'button', class: 'btn ghost sm icon pt-edit', 'aria-label': '이 칸의 이름 바꾸기', title: '이 칸의 이름 바꾸기' }, icon('edit', 13));
  const paint = () => { text.textContent = custom || def; text.hidden = false; input.hidden = true; btn.hidden = false; };
  const finish = (ok) => { if (ok) custom = input.value.trim() === def ? '' : input.value.trim(); paint(); };
  btn.addEventListener('click', () => {
    input.value = custom || def; input.placeholder = def;
    text.hidden = true; btn.hidden = true; input.hidden = false;
    input.focus(); input.select();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => { if (!input.hidden) finish(true); });
  paint();
  return {
    el: h('h3', { class: 'panel-title pt' }, text, input, btn),
    get value() { return custom; },
    setDefault(d) { def = d; if (input.hidden) paint(); },
  };
}
