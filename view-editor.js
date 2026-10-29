import { h, icon, toast, modal, loader, emptyState, autosize, askText } from './util.js';
import { state, getPost, loadContent, unlockContent, savePost, friendly } from './store.js';
import { applyTheme } from './theme.js';
import { compressImage, loadImage, isUrl } from './images.js';
import { readImageMeta, parseGenText, PARAM_FIELDS } from './nai.js';
import { MAX_IMAGES } from './config.js';
import { KINDS, kindOf } from './kinds.js';

const MODELS = ['NovelAI Diffusion V5 Full', 'NovelAI Diffusion V5 Curated', 'NovelAI Diffusion V4.5 Full', 'NovelAI Diffusion V4.5 Curated', 'NovelAI Diffusion V4 Full', 'NovelAI Diffusion V4 Curated', 'NovelAI Diffusion Anime V3', 'NovelAI Diffusion Furry V3'];
const SAMPLERS = ['Euler', 'Euler Ancestral', 'DPM++ 2S Ancestral', 'DPM++ 2M', 'DPM++ 2M SDE', 'DPM++ SDE', 'DDIM'];
const PLACEHOLDERS = { model: 'NovelAI Diffusion V5 Full', sampler: 'Euler Ancestral', steps: '28', scale: '5', cfgRescale: '0', schedule: 'karras', seed: '', size: '832x1216', extra: 'SMEA, Variety+ 등' };
const normEffort = (x) => { const v = String(x || '').toLowerCase(); return v === 'medium' ? 'Medium' : v === 'high' ? 'High' : ''; };

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
  document.title = (editId ? '글 수정' : '새 글') + ' · 프롬프트 서랍';

  let kind = prev ? kindOf(prev) : (KINDS[query?.get('kind')] ? query.get('kind') : 'style');

  // ── 이미지 상태: { src(올라간 주소) | data(아직 안 올린 데이터) } ──
  const origImages = [...(content?.images || [])];
  let imgs = [];
  for (const ref of origImages) {
    if (isUrl(ref)) imgs.push({ src: ref });
    else { const d = await loadImage(ref); if (d) imgs.push({ data: d }); }   // 예전 방식 글은 저장할 때 ImgBB로 옮겨져요
  }

  // ── 입력 요소 ──
  let vis = prev?.vis || 'public';
  let tags = [...(prev?.tags || [])];
  const titleIn = h('input', { class: 'input title-input', maxlength: '120', value: prev?.title || '' });
  const mkTa = (value, rows, cls = 'mono') => {
    const t = h('textarea', { class: 'textarea ' + cls, rows: String(rows), spellcheck: 'false', value: value || '' });
    autosize(t);
    return t;
  };
  const promptIn = mkTa(content?.prompt, 6);
  const negIn = mkTa(content?.negative, 4);
  const notesIn = mkTa(content?.notes, 3, '');
  negIn.placeholder = '네거티브 프롬프트(UC)';
  notesIn.placeholder = '메모 (사용 팁, 마음에 든 점, 출처 등)';

  // 캐릭터 변형 (사복, 교복 …)
  const varBox = h('div', { class: 'chars' });
  const varRows = [];
  const addVariant = (v = {}) => {
    const name = h('input', { class: 'input', placeholder: '변형 이름 (예: 사복, 교복, 수영복)', maxlength: '40', value: v.name || '' });
    const p = mkTa(v.prompt, 3);
    p.placeholder = '이 변형에만 쓰는 프롬프트';
    const row = { name, p };
    const el = h('div', { class: 'char-row' },
      h('div', { class: 'char-head' }, name,
        h('button', { class: 'btn ghost sm icon', type: 'button', onclick: () => { varRows.splice(varRows.indexOf(row), 1); el.remove(); }, 'aria-label': '삭제' }, icon('x', 15))),
      p);
    row.el = el;
    varRows.push(row);
    varBox.append(el);
    return row;
  };
  (content?.variants || []).forEach(addVariant);

  // 생성 설정 (그림체 전용)
  const pf = {};
  const paramGrid = h('div', { class: 'param-grid' }, PARAM_FIELDS.map(([k, label]) => {
    if (k === 'effort') {
      pf[k] = h('select', { class: 'select' },
        h('option', { value: '' }, '선택 안 함'), h('option', { value: 'Medium' }, 'Medium'), h('option', { value: 'High' }, 'High'));
      pf[k].value = normEffort(content?.params?.effort);
    } else {
      const attrs = { class: 'input', placeholder: PLACEHOLDERS[k] || '', value: content?.params?.[k] ?? '' };
      if (k === 'model') attrs.list = 'dl-model';
      if (k === 'sampler') attrs.list = 'dl-sampler';
      pf[k] = h('input', attrs);
    }
    return h('label', { class: 'pf' + (k === 'extra' || k === 'model' ? ' wide' : '') }, h('span', null, label), pf[k]);
  }));
  const datalists = [
    h('datalist', { id: 'dl-model' }, MODELS.map((m) => h('option', { value: m }))),
    h('datalist', { id: 'dl-sampler' }, SAMPLERS.map((m) => h('option', { value: m }))),
  ];

  // 공개 설정
  const pwIn = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
  const unlistedCb = h('input', { type: 'checkbox', checked: !!prev?.unlisted });
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
    if (vis !== 'private') {
      kids.push(h('label', { class: 'check' }, unlistedCb, h('span', null, '내 블로그 목록에 숨기기 ', h('small', null, '(링크를 아는 사람만 접근)'))));
    }
    visExtra.replaceChildren(...kids);
  };
  paintVis();

  // 태그
  const tagInput = h('input', { class: 'tag-input', placeholder: '태그 입력 후 Enter' });
  const tagBox = h('div', { class: 'tag-box', onclick: () => tagInput.focus() });
  const paintTags = () => {
    tagBox.replaceChildren(...tags.map((t) =>
      h('span', { class: 'tag removable' }, '#' + t, h('button', { type: 'button', onclick: (e) => { e.stopPropagation(); tags = tags.filter((x) => x !== t); paintTags(); }, 'aria-label': '삭제' }, '×'))), tagInput);
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

  // ── 가져오기 ──
  const applyMeta = (m) => {
    promptIn.value = m.prompt || '';
    negIn.value = m.negative || '';
    for (const [k] of PARAM_FIELDS) {
      const v = m.params?.[k];
      if (v == null || v === '') continue;
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
  let dragIdx = -1;
  const paintImgs = () => {
    imgGrid.replaceChildren(...imgs.map((im, i) => {
      if (im.pending) return h('div', { class: 'img-item pending' }, h('span', { class: 'spin' }));
      const it = h('div', { class: 'img-item', draggable: 'true' },
        h('img', { src: im.data || im.src, alt: '', draggable: 'false' }),
        i === 0 ? h('span', { class: 'cover-tag' }, '대표') : null,
        h('div', { class: 'img-tools' },
          i !== 0 ? h('button', { type: 'button', title: '대표 이미지로', onclick: () => { imgs.unshift(imgs.splice(i, 1)[0]); paintImgs(); } }, icon('star', 14)) : null,
          h('button', { type: 'button', title: '삭제', onclick: () => { imgs.splice(i, 1); paintImgs(); } }, icon('x', 14))));
      it.addEventListener('dragstart', (e) => { dragIdx = i; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'img'); });
      it.addEventListener('dragover', (e) => { if (dragIdx >= 0) { e.preventDefault(); it.classList.add('over'); } });
      it.addEventListener('dragleave', () => it.classList.remove('over'));
      it.addEventListener('drop', (e) => {
        if (dragIdx < 0) return;
        e.preventDefault(); e.stopPropagation();
        const [m] = imgs.splice(dragIdx, 1);
        imgs.splice(i, 0, m);
        dragIdx = -1;
        paintImgs();
      });
      it.addEventListener('dragend', () => { dragIdx = -1; });
      return it;
    }));
  };
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
    h('small', null, 'NovelAI 이미지면 프롬프트·설정을 자동으로 읽어와요'));
  drop.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  paintImgs();

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
    const body = { prompt: promptIn.value.replace(/\s+$/, ''), notes: notesIn.value.trim() };
    if (kind === 'style') {
      body.negative = negIn.value.replace(/\s+$/, '');
      body.params = {};
      for (const [k] of PARAM_FIELDS) { const v = pf[k].value.trim(); if (v) body.params[k] = v; }
    }
    if (kind === 'character') {
      body.variants = varRows
        .map((r, i) => ({ name: r.name.value.trim() || `변형 ${i + 1}`, prompt: r.p.value.replace(/\s+$/, '') }))
        .filter((v) => v.prompt);
    }
    saveBtn.disabled = true;
    const label = saveBtn.lastChild;
    label.textContent = ' 저장 중…';
    try {
      const id = await savePost({
        id: editId, prev, kind, title: titleIn.value, vis, unlisted: unlistedCb.checked, tags, content: body,
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
  const promptTitle = h('h3', { class: 'panel-title' });
  const promptPanel = h('section', { class: 'panel' }, promptTitle, promptIn);
  const negPanel = panel('네거티브 프롬프트', negIn);
  const variantPanel = panel('변형 (사복 · 교복 등)', varBox,
    h('button', { class: 'btn sm', type: 'button', onclick: () => addVariant().name.focus() }, icon('plus', 14), '변형 추가'),
    h('small', { class: 'hint-line' }, '보기 화면에서 변형마다 따로 복사할 수 있고, 기본 프롬프트와 함께 복사하는 버튼도 있어요.'));
  const notesPanel = panel('메모', notesIn);
  const visPanel = panel('공개 설정', segBox, visExtra);
  const imgPanel = panel('이미지', drop, fileIn, imgGrid,
    h('small', { class: 'hint-line' }, `최대 ${MAX_IMAGES}장 · 첫 번째가 대표 이미지 · 끌어서 순서를 바꿔요`),
    h('small', { class: 'hint-line' }, '올릴 때 메타데이터(프롬프트 정보 등)는 모두 지워지고, 이미지는 ImgBB에 저장돼요.'));
  const tagPanel = panel('태그', tagBox);
  const paramPanel = panel('생성 설정', paramGrid, ...datalists,
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
        icon(v.icon, 18), h('strong', null, v.label), h('small', null, v.desc))));
    promptTitle.textContent = TITLES[kind];
    promptIn.placeholder = PHS[kind];
    titleIn.placeholder = TPH[kind];
    mainBox.replaceChildren(titleIn, promptPanel,
      ...(kind === 'style' ? [negPanel] : []),
      ...(kind === 'character' ? [variantPanel] : []),
      notesPanel);
    sideBox.replaceChildren(visPanel, imgPanel, tagPanel, ...(kind === 'style' ? [paramPanel] : []), importPanel);
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
