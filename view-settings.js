import { h, icon, toast, copyText, loader, confirmDialog, askText, modal, rid, sortable, txt } from './util.js';
import { state, updateProfile, saveBoards, createInvite, listInvites, listInvitedMembers, signOutUser, friendly, hasRealEmail, changeEmail, changePassword } from './store.js';
import { applyTheme, sanitizeTheme, sanitizeBoards, faviconHref, clampIconText, BOARD_ICONS, BUTTONS, BUTTON_ICONS, MAX_BUTTON_LABEL, PRESETS, FONTS, LAYOUTS, RADII, HEADERS, DEFAULT_THEME, MAX_BOARDS, MAX_BOARD_NAME } from './theme.js';
import { KINDS, MAX_KIND_NAME } from './kinds.js';
import { compressImage, uploadImage, removeImages, makeIcon, saveBannerImage } from './images.js';
import { colorField, stepper, iconField } from './widgets.js';
import { postCard, avatarEl } from './view-blog.js';
import { backupTab } from './backup.js';

const ALL_TABS = [['profile', 'user', '프로필'], ['boards', 'folder', '게시판'], ['design', 'palette', '꾸미기'], ['invite', 'gift', '초대'], ['backup', 'download', '백업·가져오기']];
// 초대 탭은 관리자에게만 보여요
const tabsFor = (me) => ALL_TABS.filter(([k]) => k !== 'invite' || me?.isAdmin);

export async function settings({ root, query }) {
  if (!state.me) { location.replace('#/login?next=' + encodeURIComponent('/settings')); return; }
  applyTheme(state.me.theme);
  document.title = '설정 · Drawer';
  root.classList.add('settings-wrap');
  const TABS = tabsFor(state.me);
  let tab = TABS.some((t) => t[0] === query.get('tab')) ? query.get('tab') : 'profile';
  const content = h('div');
  const tabBar = h('div', { class: 'tabs' });
  const paintTabs = () => tabBar.replaceChildren(...TABS.map(([k, ic, label]) =>
    h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { tab = k; paintTabs(); show(); } }, icon(ic, 16), h('span', null, label))));
  async function show() {
    content.replaceChildren(loader());
    if (tab !== 'design') applyTheme(state.me.theme);
    const node = tab === 'profile' ? profileTab() : tab === 'boards' ? boardsTab() : tab === 'design' ? designTab() : tab === 'invite' ? await inviteTab() : backupTab();
    content.replaceChildren(node);
  }
  root.append(
    h('div', { class: 'ed-top' }, h('a', { class: 'back', href: '#/u/' + state.me.handle }, icon('back', 16), '내 블로그'), h('h2', null, '설정')),
    tabBar, content);
  paintTabs();
  await show();
}

// ───────── 프로필 ─────────
function profileTab() {
  const me = state.me;
  const display = h('input', { class: 'input', value: me.display || '', maxlength: '30' });
  const bio = h('textarea', { class: 'textarea', rows: '3', maxlength: '300', placeholder: '짧은 소개를 적어 보세요', value: me.bio || '' });
  const avatarHost = h('div', { class: 'avatar-host' }, avatarEl(me, 'xl'));
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const url = await compressImage(f, { maxEdge: 512 });
      const id = await uploadImage(url, 'profile');
      const old = me.theme.avatar;
      await updateProfile({ theme: { ...sanitizeTheme(me.theme), avatar: id } });
      if (old) removeImages([old]);
      avatarHost.replaceChildren(avatarEl(state.me, 'xl'));
      toast('프로필 사진을 바꿨어요');
    } catch (e) { toast(friendly(e)); }
  });
  const removeAvatar = async () => {
    const old = me.theme.avatar;
    if (!old) return;
    try {
      await updateProfile({ theme: { ...sanitizeTheme(state.me.theme), avatar: '' } });
      removeImages([old]);
      avatarHost.replaceChildren(avatarEl(state.me, 'xl'));
    } catch (e) { toast(friendly(e)); }
  };
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    saveBtn.disabled = true;
    try { await updateProfile({ display: display.value.trim() || me.handle, bio: bio.value.trim() }); toast('저장했어요'); }
    catch (e) { toast(friendly(e)); }
    finally { saveBtn.disabled = false; }
  } }, icon('check', 16), '저장');

  const real = hasRealEmail();
  const onEmail = async () => {
    const em = await askText({ title: real ? '이메일 변경' : '이메일 등록', label: '새 이메일로 확인 메일을 보내드려요. 메일의 링크를 눌러야 적용돼요.', type: 'email', ok: '다음', placeholder: 'name@example.com' });
    if (!em) return;
    const pw = await askText({ title: '비밀번호 확인', label: '현재 비밀번호를 입력해 주세요.', type: 'password' });
    if (!pw) return;
    try { await changeEmail(em, pw); toast('확인 메일을 보냈어요. 링크를 누르면 완료돼요. 이후 로그인은 이메일로 하세요', { ms: 8000 }); }
    catch (e) { toast(friendly(e), { ms: 5000 }); }
  };
  const onPw = async () => {
    const oldPw = await askText({ title: '비밀번호 변경', label: '현재 비밀번호를 입력해 주세요.', type: 'password' });
    if (!oldPw) return;
    const newPw = await askText({ title: '새 비밀번호', label: '6자 이상으로 정해 주세요.', type: 'password' });
    if (!newPw) return;
    try { await changePassword(oldPw, newPw); toast('비밀번호를 바꿨어요'); }
    catch (e) { toast(friendly(e), { ms: 5000 }); }
  };

  return h('div', { class: 'tab-body' },
    h('section', { class: 'panel' },
      h('div', { class: 'profile-row' },
        avatarHost,
        h('div', { class: 'btn-col' },
          h('button', { class: 'btn sm', onclick: () => file.click() }, icon('image', 14), '사진 바꾸기'),
          h('button', { class: 'btn ghost sm', onclick: removeAvatar }, '사진 지우기'), file)),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '아이디'), h('input', { class: 'input', value: '@' + me.handle, disabled: true })),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '표시 이름'), display),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '소개'), bio),
      h('div', { class: 'row' }, saveBtn)),
    faviconPanel(),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '내 블로그 주소'),
      h('p', { class: 'desc' }, '이 링크를 공유하면 공개 글과 비밀번호 글 목록을 볼 수 있어요.'),
      h('div', { class: 'row' },
        h('input', { class: 'input mono', readonly: true, value: location.origin + location.pathname + '#/u/' + me.handle }),
        h('button', { class: 'btn', onclick: () => copyText(location.origin + location.pathname + '#/u/' + me.handle, '주소를 복사했어요') }, icon('copy', 15), '복사'))),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '로그인 · 복구'),
      h('p', { class: 'desc' }, real
        ? `복구용 이메일: ${state.user.email} (로그인도 이 이메일로 해요. 비밀번호를 잊으면 로그인 화면의 '비밀번호를 잊으셨나요?'로 재설정할 수 있어요.)`
        : '등록된 이메일이 없어요. 이메일을 등록하면 비밀번호를 잊었을 때 메일로 재설정할 수 있어요.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: onEmail }, icon('link', 15), real ? '이메일 변경' : '이메일 등록'),
        h('button', { class: 'btn', onclick: onPw }, icon('lock', 15), '비밀번호 변경'))),
    h('section', { class: 'panel' },
      h('button', { class: 'btn', onclick: async () => { await signOutUser(); location.hash = '#/'; } }, icon('logout', 16), '로그아웃')));
}

// ───────── 파비콘 (브라우저 탭 아이콘) ─────────
function faviconPanel() {
  const prev = h('div', { class: 'fav-prev' });
  const paint = () => {
    const href = faviconHref(sanitizeTheme(state.me.theme).favicon);
    prev.replaceChildren(
      h('img', { class: 'fav-big', src: href, alt: '파비콘 미리보기' }),
      h('div', { class: 'fav-tab' }, h('img', { src: href, alt: '' }), h('span', null, `${txt(state.me.display) || state.me.handle} · Drawer`)));
  };
  const save = async (favicon) => {
    await updateProfile({ theme: { ...sanitizeTheme(state.me.theme), favicon } });
    applyTheme(state.me.theme);
    paint();
  };

  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    try {
      const url = await uploadImage(await makeIcon(f), 'icon');
      await save({ type: 'image', src: url });
      toast('파비콘을 바꿨어요');
    } catch (e) { toast(friendly(e)); }
  });

  const openText = () => {
    const cur = sanitizeTheme(state.me.theme).favicon;
    let bg = cur?.type === 'text' ? cur.bg : sanitizeTheme(state.me.theme).accent;
    const input = h('input', { class: 'input', maxlength: '8', placeholder: '✨ 또는 A', value: cur?.type === 'text' ? cur.text : '✨', 'aria-label': '글자 또는 이모지', autocomplete: 'off' });
    const big = h('img', { class: 'fav-big', alt: '' });
    const draw = () => { big.src = faviconHref({ type: 'text', text: clampIconText(input.value) || '?', bg }); };
    const color = colorField({ value: bg, label: '아이콘 배경색', onInput: (v) => { bg = v; draw(); } });
    input.addEventListener('input', draw);
    draw();
    modal({
      title: '글자·이모지로 파비콘 만들기',
      body: h('div', { class: 'fav-maker' },
        big,
        h('div', { class: 'fav-fields' },
          h('div', { class: 'field' }, h('span', { class: 'lbl' }, '글자 또는 이모지 (최대 2글자)'), input),
          h('div', { class: 'field' }, h('span', { class: 'lbl' }, '배경색'), color.el))),
      actions: [{ label: '취소', kind: 'ghost' }, {
        label: '적용', kind: 'primary',
        onClick: async () => {
          const text = clampIconText(input.value);
          if (!text) { toast('글자나 이모지를 입력해 주세요'); return false; }
          try { await save({ type: 'text', text, bg }); toast('파비콘을 바꿨어요'); }
          catch (e) { toast(friendly(e)); return false; }
        },
      }],
    });
    setTimeout(() => input.focus(), 80);
  };

  const reset = async () => {
    try { await save(null); toast('기본 아이콘으로 되돌렸어요'); } catch (e) { toast(friendly(e)); }
  };
  paint();
  return h('section', { class: 'panel' },
    h('h3', { class: 'panel-title' }, '파비콘'),
    h('p', { class: 'desc' }, '브라우저 탭에 뜨는 작은 아이콘이에요. 내 블로그와 내 글을 보는 사람에게는 내가 정한 아이콘이 보여요. 이미지는 가운데를 정사각형으로 잘라 올려요.'),
    prev,
    h('div', { class: 'row' },
      h('button', { class: 'btn sm', onclick: () => file.click() }, icon('image', 14), '이미지 올리기'),
      h('button', { class: 'btn sm', onclick: openText }, icon('sparkle', 14), '글자·이모지로 만들기'),
      h('button', { class: 'btn ghost sm', onclick: reset }, '기본으로'), file));
}

// ───────── 게시판 ─────────
function boardsTab() {
  let boards = sanitizeBoards(state.me.theme.boards).map((b) => ({ ...b }));
  const listEl = h('div', { class: 'bset' });
  const empty = h('p', { class: 'desc' }, '아직 게시판이 없어요. 아래에서 첫 게시판을 만들어 보세요.');
  const newIn = h('input', { class: 'input', maxlength: String(MAX_BOARD_NAME), placeholder: '새 게시판 이름 (예: 완성작, 연구 중)', 'aria-label': '새 게시판 이름' });
  let dirty = false;
  let uncat = sanitizeTheme(state.me.theme).uncat;
  const uncatTxt = h('span', { class: 'sw-txt' }, uncat ? '보임' : '숨김');
  const uncatCb = h('input', { type: 'checkbox', checked: uncat, onchange: (e) => { uncat = e.target.checked; uncatTxt.textContent = uncat ? '보임' : '숨김'; touch(); } });
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    saveBtn.disabled = true;
    try {
      await saveBoards(boards, { uncat });
      boards = sanitizeBoards(state.me.theme.boards).map((b) => ({ ...b }));
      dirty = false;
      paint();
      toast('게시판을 저장했어요');
    } catch (e) { toast(friendly(e)); }
    finally { saveBtn.disabled = false; }
  } }, icon('check', 16), '저장');
  const note = h('small', { class: 'hint-line' });

  const touch = () => { dirty = true; note.textContent = '저장하지 않은 변경이 있어요'; };
  function paint() {
    note.textContent = dirty ? '저장하지 않은 변경이 있어요' : '';
    empty.hidden = boards.length > 0;
    listEl.replaceChildren(...boards.map((b) =>
      h('div', { class: 'bset-row', 'data-id': b.id },
        h('span', { class: 'grip', title: '끌어서 순서 바꾸기', 'aria-label': '끌어서 순서 바꾸기' }, icon('grip', 16)),
        iconField({ options: BOARD_ICONS, value: b.icon || 'folder', label: `${b.name} 아이콘`, onChange: (v) => { b.icon = v; touch(); } }).el,
        h('input', { class: 'input', maxlength: String(MAX_BOARD_NAME), value: b.name, 'aria-label': '게시판 이름', oninput: (e) => { b.name = e.target.value; touch(); } }),
        h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '게시판 삭제', onclick: async () => {
          if (!(await confirmDialog(`'${b.name}' 게시판을 지울까요? 이 게시판의 글은 지워지지 않고 '미분류'로 돌아가요.`, { ok: '삭제', danger: true }))) return;
          boards = boards.filter((x) => x.id !== b.id);
          touch();
          paint();
        } }, icon('trash', 15)))));
  }
  sortable(listEl, {
    item: '.bset-row', handle: '.grip',
    onSort: (els) => { const by = new Map(boards.map((b) => [b.id, b])); boards = els.map((e) => by.get(e.dataset.id)).filter(Boolean); touch(); },
  });
  const add = () => {
    const name = newIn.value.trim();
    if (!name) return;
    if (boards.length >= MAX_BOARDS) { toast(`게시판은 최대 ${MAX_BOARDS}개까지예요`); return; }
    boards.push({ id: rid(8), name: name.slice(0, MAX_BOARD_NAME), icon: 'folder' });
    newIn.value = '';
    touch();
    paint();
    newIn.focus();
  };
  newIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  paint();
  return h('div', { class: 'tab-body' },
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '게시판'),
      h('p', { class: 'desc' }, '글을 분류하는 폴더예요. 게시판마다 아이콘을 골라 꾸밀 수 있어요. 글쓰기에서 게시판을 고르고, 블로그 왼쪽 목록으로 게시판별로 모아 봐요. 이미 있는 글은 블로그에서 ‘게시판으로 옮기기’로 한꺼번에 옮길 수 있어요. 글이 없는 게시판은 다른 사람에게 보이지 않아요.'),
      empty, listEl,
      h('div', { class: 'row' }, newIn, h('button', { class: 'btn', onclick: add }, icon('plus', 15), '추가'))),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '미분류 게시판'),
      h('p', { class: 'desc' }, '게시판을 정하지 않은 글이 모이는 곳이에요. 끄면 블로그 왼쪽 목록에서 빠지고, 그 글들은 ‘전체’에서만 보여요.'),
      h('label', { class: 'switch' }, uncatCb, h('span', { class: 'trk' }), uncatTxt)),
    h('div', { class: 'row between' }, note, saveBtn));
}

// ───────── 꾸미기 ─────────
const SAMPLE = [
  { id: 's1', kind: 'style', title: '봄날의 교실', excerpt: 'masterpiece, 1girl, classroom, cherry blossoms, soft light', tags: ['풍경', '소녀'], vis: 'public', created: Date.now(), imgCount: 3 },
  { id: 's2', kind: 'scene', title: '네온 시티 야경', excerpt: 'cyberpunk city, rain, neon lights, reflection, night', tags: ['배경'], vis: 'locked', created: Date.now() - 86400000 * 3, imgCount: 1 },
  { id: 's3', kind: 'character', title: '고양이 귀 소녀 연구', excerpt: 'cat ears, white hair, blue eyes, smile, upper body', tags: ['캐릭터', '연구'], vis: 'public', created: Date.now() - 86400000 * 9, imgCount: 2 },
  { id: 's4', kind: 'style', title: '습작 메모', excerpt: '나중에 다듬을 프롬프트 초안', tags: ['메모'], vis: 'private', created: Date.now() - 86400000 * 20, imgCount: 1 },
];

const LAYOUT_ICON = {
  list: '<rect x="3" y="4" width="18" height="4" rx="1.5"/><rect x="3" y="10" width="18" height="4" rx="1.5"/><rect x="3" y="16" width="18" height="4" rx="1.5"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  masonry: '<rect x="3" y="3" width="8" height="11" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="3" y="16" width="8" height="5" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/>',
  journal: '<rect x="6" y="3" width="12" height="9" rx="1.5"/><rect x="6" y="14" width="12" height="3" rx="1.5"/><rect x="6" y="19" width="12" height="2" rx="1"/>',
};
const svg = (inner) => h('span', { class: 'opt-ic', html: `<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" opacity=".85">${inner}</svg>` });

function designTab() {
  let T = sanitizeTheme(state.me.theme);
  const host = h('div', { class: 'tab-body' });
  const preview = h('div', { class: 'preview' });
  let dirty = false;
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    saveBtn.disabled = true;
    try { T = sanitizeTheme(T); await updateProfile({ theme: T }); dirty = false; toast('꾸미기를 저장했어요'); }
    catch (e) { toast(friendly(e)); }
    finally { saveBtn.disabled = false; }
  } }, icon('check', 16), '꾸미기 저장');

  const paintPreview = () => {
    preview.replaceChildren(h('div', { class: 'posts layout-' + T.layout }, SAMPLE.map((p) => postCard(p, true))));
  };
  const set = (patch, rebuild = true) => {
    T = { ...T, ...patch };
    dirty = true;
    applyTheme(T);
    paintPreview();
    if (rebuild) build();
  };

  // 글 종류 이름·공개 (입력 중에는 다시 그리지 않아서 포커스가 유지돼요)
  const setKind = (k, patch) => {
    T = { ...T, kinds: { ...T.kinds, [k]: { ...T.kinds[k], ...patch } } };
    dirty = true;
    applyTheme(T);
    paintPreview();
  };
  const kindRow = (k, v) => {
    const cur = T.kinds[k];
    const state = h('span', { class: 'sw-txt' }, cur.show ? '다른 사람에게 보임' : '나만 봄');
    const cb = h('input', { type: 'checkbox', checked: cur.show, onchange: (e) => { state.textContent = e.target.checked ? '다른 사람에게 보임' : '나만 봄'; setKind(k, { show: e.target.checked }); } });
    const name = h('input', {
      class: 'input', maxlength: String(MAX_KIND_NAME), placeholder: v.label, value: cur.name, 'aria-label': `${v.label} 이름`,
      oninput: (e) => setKind(k, { name: e.target.value }),
    });
    return h('div', { class: 'kset-row' },
      h('span', { class: 'kset-ic' }, icon(v.icon, 18)),
      name,
      h('label', { class: 'switch' }, cb, h('span', { class: 'trk' }), state));
  };

  // 글 안의 버튼 이름·아이콘 (입력 중에는 다시 그리지 않아서 포커스가 유지돼요)
  const setBtn = (k, patch) => {
    T = { ...T, buttons: { ...T.buttons, [k]: { ...T.buttons[k], ...patch } } };
    dirty = true;
    applyTheme(T);
  };
  const btnRow = (k, d) => {
    const prev = h('span', { class: 'btn sm bt-prev' });
    const paintPrev = () => { const c = T.buttons[k]; prev.replaceChildren(c.icon ? icon(c.icon, 14) : null, c.label || d.name); };
    const ic = iconField({ options: BUTTON_ICONS, value: T.buttons[k].icon, label: `${d.name} 아이콘`, onChange: (v) => { setBtn(k, { icon: v }); paintPrev(); } });
    const name = h('input', { class: 'input', maxlength: String(MAX_BUTTON_LABEL), placeholder: d.name, value: T.buttons[k].label, 'aria-label': `${d.name} 이름`,
      oninput: (e) => { setBtn(k, { label: e.target.value }); paintPrev(); } });
    paintPrev();
    return h('div', { class: 'bt-row' }, h('div', { class: 'bt-info' }, h('strong', null, d.name), h('small', null, d.where)), ic.el, name, prev);
  };

  function build() {
    const sw = h('div', { class: 'swatches' }, PRESETS.map((p) =>
      h('button', {
        class: 'swatch' + (T.preset === p.id ? ' on' : ''), title: p.name,
        style: { background: p.bg, '--sw': p.accent },
        onclick: () => set({ preset: p.id, bg: p.bg, accent: p.accent }),
      }, h('i'), h('span', null, p.name))));
    // 브라우저 기본 색 선택기 대신 직접 만든 선택기 (고르는 동안 바로 적용돼요)
    // 화면을 다시 그리면 열려 있는 창 밖을 누르는 순간 버튼이 바뀌어 클릭이 씹히므로, 프리셋 표시만 제자리에서 풀어요
    const custom = (patch) => { set({ preset: 'custom', ...patch }, false); host.querySelectorAll('.swatch.on').forEach((e) => e.classList.remove('on')); };
    const bgIn = colorField({ value: T.bg, label: '배경색', onInput: (v) => custom({ bg: v }) });
    const acIn = colorField({ value: T.accent, label: '포인트색', onInput: (v) => custom({ accent: v }) });

    const bannerFile = h('input', { type: 'file', accept: 'image/*', hidden: true });
    bannerFile.addEventListener('change', async () => {
      const f = bannerFile.files[0];
      bannerFile.value = '';
      if (!f) return;
      try {
        // 배너만 Firebase에 직접 저장해요 (나머지 이미지는 ImgBB)
        const id = await saveBannerImage(f, state.user.uid);
        const old = state.me.theme.banner;
        T = { ...T, banner: id };
        await updateProfile({ theme: T });
        if (old && old !== id) removeImages([old]);
        dirty = false;
        toast('배너를 바꿨어요');
        build();
      } catch (e) { toast(friendly(e)); }
    });

    host.replaceChildren(
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '색상'),
        sw,
        h('div', { class: 'color-row' },
          h('div', { class: 'cf-item' }, h('span', null, '배경색'), bgIn.el),
          h('div', { class: 'cf-item' }, h('span', null, '포인트색'), acIn.el),
          h('small', { class: 'hint-line' }, '배경이 어두우면 자동으로 다크 모드가 돼요'))),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '글꼴'),
        h('div', { class: 'opt-grid cols-2' }, Object.entries(FONTS).map(([k, f]) =>
          h('button', { class: 'opt' + (T.font === k ? ' on' : ''), style: { fontFamily: f.stack }, onclick: () => set({ font: k }) },
            h('strong', null, '가나다 Abc'), h('small', null, f.name))))),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '글 목록 배치'),
        h('div', { class: 'opt-grid cols-4' }, Object.entries(LAYOUTS).map(([k, name]) =>
          h('button', { class: 'opt center' + (T.layout === k ? ' on' : ''), onclick: () => set({ layout: k }) }, svg(LAYOUT_ICON[k]), h('small', null, name))))),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '모서리'),
        h('div', { class: 'opt-grid cols-3' }, [['sharp', '각지게'], ['soft', '부드럽게'], ['round', '둥글게']].map(([k, name]) =>
          h('button', { class: 'opt center' + (T.radius === k ? ' on' : ''), onclick: () => set({ radius: k }) },
            h('span', { class: 'radius-demo', style: { borderRadius: RADII[k] } }), h('small', null, name))))),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '블로그 머리말'),
        h('div', { class: 'opt-grid cols-3' }, Object.entries(HEADERS).map(([k, name]) =>
          h('button', { class: 'opt center' + (T.header === k ? ' on' : ''), onclick: () => set({ header: k }) }, h('small', null, name)))),
        T.header === 'banner' ? h('div', { class: 'row' },
          h('button', { class: 'btn sm', onclick: () => bannerFile.click() }, icon('image', 14), T.banner ? '배너 바꾸기' : '배너 이미지 선택'),
          T.banner ? h('button', { class: 'btn ghost sm', onclick: async () => {
            const old = T.banner;
            T = { ...T, banner: '' };
            try { await updateProfile({ theme: T }); removeImages([old]); build(); } catch (e) { toast(friendly(e)); }
          } }, '배너 지우기') : null, bannerFile) : null),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '글 안의 버튼'),
        h('p', { class: 'desc' }, '복사 버튼 같은 글 속 버튼의 아이콘과 이름을 바꿀 수 있어요. 이름을 비우면 기본 이름으로 돌아가요. 내 글을 보는 사람에게도 이렇게 보여요.'),
        h('div', { class: 'bt-list' }, Object.entries(BUTTONS).map(([k, d]) => btnRow(k, d)))),
      h('section', { class: 'panel' },
        h('h3', { class: 'panel-title' }, '글 종류 이름 · 공개'),
        h('p', { class: 'desc' }, '이름을 바꾸고, 다른 사람에게 보여줄지 정해요. 숨긴 종류는 다른 사람의 블로그 목록과 필터에서 빠지고, 내 블로그에서는 그대로 보여요. 이름을 비우면 기본 이름으로 돌아가요.'),
        h('div', { class: 'kset' }, Object.entries(KINDS).map(([k, v]) => kindRow(k, v)))),
      h('div', { class: 'row between' },
        h('button', { class: 'btn ghost', onclick: async () => {
          if (await confirmDialog('꾸미기를 기본값으로 되돌릴까요? (저장하기 전까지는 적용되지 않아요)', { ok: '되돌리기' })) set({ ...DEFAULT_THEME, avatar: T.avatar, banner: T.banner, kinds: T.kinds, boards: T.boards, uncat: T.uncat, favicon: T.favicon });
        } }, '기본값으로'),
        saveBtn),
      h('h3', { class: 'preview-title' }, '미리보기'),
      preview);
  }
  paintPreview();
  build();
  return host;
}

// ───────── 초대 ─────────
async function inviteTab() {
  const me = state.me;
  const wrap = h('div', { class: 'tab-body' });
  if (!me.isAdmin) return wrap;
  let invites = [], members = [];
  try { [invites, members] = await Promise.all([listInvites(), listInvitedMembers()]); }
  catch (e) { toast(friendly(e)); }

  const link = (code) => location.origin + location.pathname + '#/join/' + code;
  const maxIn = stepper({ value: 1, min: 1, max: 1000 });

  const make = h('button', { class: 'btn primary', onclick: async () => {
    make.disabled = true;
    try {
      const code = await createInvite(maxIn.value);
      await copyText(link(code), '초대 링크를 만들어 복사했어요');
      wrap.replaceWith(await inviteTab());
    } catch (e) { toast(friendly(e)); make.disabled = false; }
  } }, icon('plus', 16), '초대코드 만들기');

  wrap.append(
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '관리자 초대코드'),
      h('p', { class: 'desc' }, '초대는 관리자만 할 수 있어요. 코드 하나로 여러 명이 가입할 수 있게 사용 횟수를 정할 수 있어요.'),
      h('div', { class: 'row' }, h('div', { class: 'inline' }, h('span', null, '사용 가능 횟수'), maxIn.el), make)),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '내가 만든 초대코드'),
      invites.length ? h('div', { class: 'list' }, invites.map((i) =>
        h('div', { class: 'list-row' },
          h('code', { class: 'code' }, i.code),
          h('span', { class: 'muted' }, `${i.uses} / ${i.max} 사용`),
          h('span', { class: 'sp' }),
          h('button', { class: 'btn sm', disabled: i.uses >= i.max, onclick: () => copyText(link(i.code), '초대 링크를 복사했어요') }, icon('link', 14), '링크 복사'),
          h('button', { class: 'btn ghost sm', onclick: () => copyText(i.code, '코드를 복사했어요') }, icon('copy', 14))))) : h('p', { class: 'desc' }, '아직 만든 초대코드가 없어요.')),
    members.length ? h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, `내가 초대한 사람 ${members.length}명`),
      h('div', { class: 'list' }, members.map((m) =>
        h('a', { class: 'list-row', href: '#/u/' + m.handle }, avatarEl(m, 'xs'), h('strong', null, m.display || m.handle), h('span', { class: 'muted' }, '@' + m.handle))))) : null);
  return wrap;
}
