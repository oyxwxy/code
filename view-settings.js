import { h, icon, fmtDate, toast, copyText, loader, confirmDialog, askText, modal, rid, sortable, txt } from './util.js';
import { state, neighborsOn, ddayOn, bannerSlideOn, skinOn, listNotifs, markNotifsRead, deleteNotif, updateProfile, saveBoards, createInvite, listInvites, listInvitedMembers, signOutUser, friendly, hasRealEmail, changeEmail, changePassword, changeHandle, handleAvailable, normalizeHandle, HANDLE_RE } from './store.js';
import { applyTheme, sanitizeTheme, sanitizeBoards, faviconHref, clampIconText, BOARD_ICONS, BUTTONS, BUTTON_ICONS, MAX_BUTTON_LABEL, PRESETS, FONTS, LAYOUTS, RADII, HEADERS, DEFAULT_THEME, MAX_BOARDS, MAX_BOARD_NAME, MAX_DDAYS, sanitizeDdays, MAX_BANNER_MORE, BANNER_SECS, SKINS, SHELVES, PVIEWS, SKIN_FONTS, palette, sanitizeBgm, MAX_BGM } from './theme.js';
import { KINDS, MAX_KIND_NAME } from './kinds.js';
import { compressImage, uploadImage, removeImages, makeIcon, saveCroppedCanvas, loadImage } from './images.js';
import { colorField, stepper, iconField, datePicker, selectField } from './widgets.js';
import { TINTS as DD_TINTS } from './dday.js';
import { postCard, avatarEl, bannerEl } from './view-blog.js';
import { backupTab } from './backup.js';
import { openCropper } from './crop.js';
import { TONES, ensureSkinFont } from './skins.js';
import { parseYouTube, fetchYouTubeTitle, ytThumb } from './bgm.js';

const ALL_TABS = [['profile', 'user', '프로필'], ['boards', 'folder', '게시판'], ['design', 'palette', '꾸미기'], ['skin', 'sparkle', '스킨'], ['invite', 'gift', '초대'], ['backup', 'download', '백업·가져오기']];
// 초대 탭은 관리자에게만 보여요
// 스킨 탭: config.js 의 SKINS_FOR_ALL 이 true 면 모두에게, false 면 관리자(BETA_HANDLES 포함)에게만 보여요
const tabsFor = (me) => ALL_TABS.filter(([k]) => (k !== 'invite' || me?.isAdmin) && (k !== 'skin' || skinOn()));

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
    const node = tab === 'profile' ? profileTab() : tab === 'boards' ? boardsTab() : tab === 'design' ? designTab() : tab === 'skin' ? skinTab() : tab === 'invite' ? await inviteTab() : backupTab();
    content.replaceChildren(node);
  }
  root.append(
    h('div', { class: 'ed-top' }, h('a', { class: 'back', href: '#/u/' + state.me.handle }, icon('back', 16), '내 블로그'), h('h2', null, '설정'),
      h('div', { class: 'tabs-side' }, bgmButton(), neighborsOn() ? bellButton() : null)),
    h('div', { class: 'tabs-row' }, tabBar), content);
  paintTabs();
  await show();
}

// ───────── 내 블로그 미리보기 (꾸미기·스킨 탭 공용) ─────────
// 저장하지 않은 꾸미기 그대로 내 블로그를 창 안에 띄워요 (창 안의 화면이 부모 창의 __drawerPreview 를 읽어요)
const pickSkin = (t) => ({ skin: t.skin, shelf: t.shelf, pview: t.pview, skinTone: t.skinTone, gameBoards: t.gameBoards, skinFonts: t.skinFonts });
function openSitePreview(theme) {
  const handle = state.me?.handle;
  if (!handle) return;
  window.__drawerPreview = { handle, theme: sanitizeTheme(theme) };
  let mobile = false;
  const src = () => location.pathname + location.search + '#/u/' + encodeURIComponent(handle);
  const frame = h('iframe', { class: 'pv-frame', title: '내 블로그 미리보기', src: src() });
  const win = h('div', { class: 'pv-win' });
  const devBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => {
    mobile = !mobile; win.classList.toggle('mobile', mobile); devBtn.textContent = mobile ? 'PC 크기' : '모바일 크기';
  } }, '모바일 크기');
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); delete window.__drawerPreview; document.body.style.overflow = ''; };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  win.append(
    h('div', { class: 'pv-head' },
      h('b', null, '미리보기'), h('small', null, '저장하기 전 모습이에요 · 안에서 글을 눌러 프롬창도 볼 수 있어요'),
      h('div', { class: 'pv-tools' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { frame.src = src(); } }, '처음으로'),
        devBtn,
        h('button', { class: 'btn sm', type: 'button', 'aria-label': '닫기', onclick: close }, icon('x', 16)))),
    h('div', { class: 'pv-body' }, frame));
  const back = h('div', { class: 'pv-back', onclick: (e) => { if (e.target === back) close(); } }, win);
  document.body.append(back);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey);
}

// ───────── 스킨 탭 ─────────
// 꾸미기 탭과 따로 저장해요. 저장할 때는 지금 저장된 꾸미기에 스킨 값만 덮어써요
function skinTab() {
  ensureSkinFont();
  let T = sanitizeTheme(state.me.theme);
  const host = h('div');
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    saveBtn.disabled = true;
    try {
      const next = sanitizeTheme({ ...sanitizeTheme(state.me.theme), ...pickSkin(T) });
      await updateProfile({ theme: next });
      T = { ...sanitizeTheme(state.me.theme), ...pickSkin(next) };
      toast('스킨을 저장했어요');
    } catch (e) { toast(friendly(e)); }
    finally { saveBtn.disabled = false; }
  } }, icon('check', 16), '스킨 저장');
  const set = (patch) => { T = { ...T, ...patch }; build(); };

  const skinRow = (label, map, key, note = {}) => h('div', { class: 'skin-set' },
    h('span', { class: 'lbl' }, label),
    h('div', { class: 'opt-grid cols-4' }, Object.entries(map).map(([k, name]) =>
      h('button', { class: 'opt center' + (T[key] === k ? ' on' : ''), onclick: () => set({ [key]: k }) },
        h('small', null, name), note[k] ? h('em', { class: 'skin-note' }, note[k]) : null))));
  // 픽셀 아케이드: 타이틀 화면 메뉴에 보일 게시판 (최대 4개, 고른 순서대로)
  const gameBoardRow = () => {
    if (T.skin !== 'game' || !T.boards.length) return null;
    const sel = (T.gameBoards || []).filter((id) => T.boards.some((b) => b.id === id));
    return h('div', { class: 'skin-set' },
      h('span', { class: 'lbl' }, `타이틀 메뉴에 보일 게시판 · ${sel.length}/4`),
      h('div', { class: 'opt-grid cols-4' }, T.boards.map((b) => {
        const at = sel.indexOf(b.id);
        return h('button', { class: 'opt center' + (at >= 0 ? ' on' : ''), type: 'button', onclick: () => {
          if (at >= 0) set({ gameBoards: sel.filter((x) => x !== b.id) });
          else if (sel.length >= 4) toast('최대 4개까지 고를 수 있어요');
          else set({ gameBoards: [...sel, b.id] });
        } }, at >= 0 ? h('em', { class: 'skin-note' }, `${at + 1}번째`) : null, h('small', null, b.name));
      })),
      h('p', { class: 'desc' }, (T.showAll ? "'전체'는 늘 맨 위에 있어요. " : "('전체'를 숨겨 둬서 '전체'는 빠져요) ")
        + '고른 게시판이 고른 순서대로 타이틀 메뉴에 보여요. 하나도 안 고르면 앞에서부터 4개가 보여요. 왼쪽 게시판 목록은 그대로예요. 다른 사람에게는 글이 있는 게시판만 보여요.'));
  };
  // 색상 프리셋: 페이지 스킨이 있으면 그 스킨의 색, 없으면 프롬창의 색 (프롬창은 페이지 스킨 색을 따라가요)
  const toneRow = () => {
    const key = T.skin || T.pview;
    const set_ = TONES[key];
    if (!set_) return null;
    const cur = set_[T.skinTone] ? T.skinTone : Object.keys(set_)[0];
    const label = T.skin ? `색상 프리셋 · ${SKINS[T.skin]}` : `색상 프리셋 · ${PVIEWS[T.pview]}`;
    return h('div', { class: 'skin-set' },
      h('span', { class: 'lbl' }, label),
      h('div', { class: 'opt-grid cols-4' }, Object.entries(set_).map(([k, t]) =>
        h('button', { class: 'opt center' + (cur === k ? ' on' : ''), onclick: () => set({ skinTone: k }) },
          h('span', { class: 'tone-sw', 'aria-hidden': 'true' }, t.sw.map((c) => h('i', { style: { background: c } }))),
          h('small', null, t.name)))),
      T.skin && T.pview ? h('p', { class: 'desc' }, '프롬창도 이 색을 따라가요.') : null);
  };
  // 글꼴: 스킨마다 따로 기억해요 (제목 · 꾸밈 · 본문)
  const fontRow = () => {
    if (!T.skin) return h('p', { class: 'desc' }, '페이지 스킨을 고르면 글꼴을 바꿀 수 있어요.');
    const cur = T.skinFonts?.[T.skin] || {};
    const slot = (key, label, note) => h('div', { class: 'skin-font' },
      h('span', { class: 'lbl' }, label, h('small', null, note)),
      h('div', { class: 'font-pick' }, Object.entries(SKIN_FONTS).map(([k, f]) =>
        h('button', { class: 'fp' + ((cur[key] || '') === k ? ' on' : ''), type: 'button', style: f.stack ? { fontFamily: f.stack } : {},
          onclick: () => set({ skinFonts: { ...T.skinFonts, [T.skin]: { ...cur, [key]: k } } }) },
          h('b', null, '가나다 Abc'), h('small', null, f.name)))));
    return h('div', { class: 'skin-set' },
      h('span', { class: 'lbl' }, `글꼴 · ${SKINS[T.skin]}`),
      slot('title', '제목', '블로그 이름 · 타이틀 · 디데이 숫자'),
      slot('ui', '꾸밈', '메뉴 · 버튼 · 라벨'),
      slot('body', '본문', '소개 · 글 목록 · 설명'));
  };

  const build = () => host.replaceChildren(
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '스킨'),
      h('div', { class: 'row between skin-pv-row' },
        h('p', { class: 'desc' }, '블로그 전체 모양 · 글 목록 · 글 보기 화면을 따로 골라 꾸며요. 저장하지 않아도 미리보기로 확인할 수 있어요.'),
        h('button', { class: 'btn', type: 'button', onclick: () => openSitePreview({ ...sanitizeTheme(state.me.theme), ...pickSkin(T) }) }, icon('eye', 16), '내 블로그 미리보기')),
      skinRow('페이지 스킨', SKINS, 'skin', { home: '모눈종이 개인 홈', term: 'VHS 파란 화면', game: 'HUD · 메뉴 · PRESS START', grid: '원근 그리드 복도 · START' }),
      skinRow('프롬 모음 (글 목록)', SHELVES, 'shelf', { records: '비스듬히 꽂힌 커버', drawer: '칸칸이 서랍', folders: '탭 → 파일 → 프롬' }),
      skinRow('프롬창 (글 보기)', PVIEWS, 'pview', { float: '떠다니는 예시 이미지', card: '네임카드 · 바코드', pass: '네임카드 · 우표와 소인' }),
      toneRow(),
      gameBoardRow()),
    h('section', { class: 'panel' }, h('h3', { class: 'panel-title' }, '스킨 글꼴'), fontRow()),
    h('div', { class: 'row between' },
      h('button', { class: 'btn', type: 'button', onclick: () => openSitePreview({ ...sanitizeTheme(state.me.theme), ...pickSkin(T) }) }, icon('eye', 16), '미리보기'),
      saveBtn));
  build();
  return host;
}

// ───────── 배경음악 (설정 맨 위, 알림 옆 버튼) ─────────
function bgmButton() {
  const btn = h('button', { class: 'bell-btn bgm-set-btn', type: 'button', title: '배경음악', 'aria-label': '배경음악 설정' }, icon('music', 18));
  btn.addEventListener('click', () => openBgmSettings());
  return btn;
}
function openBgmSettings() {
  let B = sanitizeTheme(state.me.theme).bgm;
  B = { ...B, tracks: B.tracks.map((t) => ({ ...t })) };
  const list = h('div', { class: 'bgm-list' });
  const urlIn = h('input', { class: 'input', placeholder: '유튜브 링크를 붙여 넣어요 (youtu.be/… 또는 youtube.com/watch?v=…)', 'aria-label': '유튜브 링크' });
  const addBtn = h('button', { class: 'btn', type: 'button' }, icon('plus', 15), '추가');
  const add = async () => {
    const id = parseYouTube(urlIn.value);
    if (!id) { toast('유튜브 영상 링크를 확인해 주세요'); return; }
    if (B.tracks.some((t) => t.id === id)) { toast('이미 있는 곡이에요'); return; }
    if (B.tracks.length >= MAX_BGM) { toast(`곡은 ${MAX_BGM}개까지예요`); return; }
    const row = { id, t: '' };
    B.tracks.push(row);
    urlIn.value = '';
    paint();
    row.t = await fetchYouTubeTitle(id);   // 제목은 알아서 채우고, 나중에 고칠 수 있어요
    paint();
  };
  addBtn.addEventListener('click', add);
  urlIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= B.tracks.length) return; [B.tracks[i], B.tracks[j]] = [B.tracks[j], B.tracks[i]]; paint(); };
  function paint() {
    list.replaceChildren(...(B.tracks.length ? B.tracks.map((t, i) => h('div', { class: 'bgm-li' },
      h('span', { class: 'bgm-li-art', style: { backgroundImage: `url("${ytThumb(t.id)}")` } }),
      h('input', { class: 'input', value: t.t, maxlength: '80', placeholder: '곡 이름 (비우면 유튜브 제목)', 'aria-label': `${i + 1}번째 곡 이름`, oninput: (e) => { t.t = e.target.value; } }),
      h('div', { class: 'bgm-li-tools' },
        h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '위로', disabled: i === 0, onclick: () => move(i, -1) }, icon('chevl', 14)),
        h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '아래로', disabled: i === B.tracks.length - 1, onclick: () => move(i, 1) }, icon('chevr', 14)),
        h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '빼기', onclick: () => { B.tracks.splice(i, 1); paint(); } }, icon('x', 14)))))
      : [h('p', { class: 'desc' }, '아직 곡이 없어요. 유튜브 링크를 붙여 넣어 보세요.')]));
  }
  paint();
  const sw = (label, key) => {
    const txtEl = h('span', { class: 'sw-txt' }, label);
    return h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!B[key], onchange: (e) => { B[key] = e.target.checked; } }), h('span', { class: 'trk' }), txtEl);
  };
  const volOut = h('b', null, B.vol + '%');
  const vol = h('input', { class: 'bgm-set-vol', type: 'range', min: '0', max: '100', value: String(B.vol), 'aria-label': '처음 볼륨',
    oninput: (e) => { B.vol = +e.target.value; volOut.textContent = B.vol + '%'; } });
  const body = h('div', { class: 'bgm-set' },
    h('p', { class: 'desc' }, '내 블로그와 글 화면 구석에 작은 플레이어가 떠요. 보는 사람이 재생 버튼을 눌러야 소리가 나요(브라우저 정책). 퍼가기를 막아 둔 영상은 자동으로 건너뛰어요.'),
    h('div', { class: 'row' }, urlIn, addBtn),
    list,
    h('div', { class: 'bgm-set-opts' },
      sw('배경음악 켜기', 'on'),
      sw('섞어서 듣기', 'shuffle'),
      sw('들어오면 바로 재생 시도', 'auto'),
      h('label', { class: 'bgm-set-volrow' }, h('span', null, '처음 볼륨'), vol, volOut)));
  modal({
    title: '배경음악', body, wide: true,
    actions: [
      { label: '닫기', kind: 'ghost' },
      { label: '저장', kind: 'primary', onClick: async () => {
        try {
          const cur = sanitizeTheme(state.me.theme);
          await updateProfile({ theme: sanitizeTheme({ ...cur, bgm: sanitizeBgm(B) }) });
          toast('배경음악을 저장했어요');
        } catch (e) { toast(friendly(e)); return false; }
      } },
    ],
  });
}

// ───────── 디데이 ─────────
function ddayPanel() {
  const rows = [];
  const box = h('div', { class: 'dd-edit' });
  const add = (e = {}) => {
    if (rows.length >= MAX_DDAYS) { toast(`디데이는 ${MAX_DDAYS}개까지예요`); return null; }
    const r = { id: e.id || rid(), kind: e.kind === 'dday' ? 'dday' : 'couple', color: e.color || '' };
    const emoji = h('input', { class: 'input dd-emoji', maxlength: '4', value: txt(e.emoji) || '💗', 'aria-label': '아이콘(이모지)' });
    const name = h('input', { class: 'input', maxlength: '20', placeholder: '이름 (예: 우리 기념일)', value: txt(e.name) });
    const date = datePicker({ value: txt(e.date), label: '날짜 선택' });
    const seg = h('div', { class: 'side-seg', role: 'group', 'aria-label': '종류' });
    const paintSeg = () => seg.replaceChildren(...[['couple', '커플'], ['dday', '디데이']].map(([k, label]) =>
      h('button', { type: 'button', class: 'side-opt' + (r.kind === k ? ' on' : ''), onclick: () => { r.kind = k; paintSeg(); } }, label)));
    paintSeg();
    // 카드 색: 자동(순서대로 파스텔) · 기본 색 7가지 · 직접 고르기
    const swBox = h('div', { class: 'dd-colors', role: 'group', 'aria-label': '카드 색' });
    const custom = colorField({ value: r.color || DD_TINTS[0][1], label: '카드 색 직접 고르기', onInput: (hex) => { r.color = hex; paintSw(); } });
    const paintSw = () => {
      const on = (r.color || '').toLowerCase();
      swBox.replaceChildren(
        h('button', { type: 'button', class: 'dd-sw auto' + (on ? '' : ' on'), title: '자동', 'aria-label': '자동 (순서대로 색이 정해져요)', 'aria-pressed': String(!on), onclick: () => { r.color = ''; paintSw(); } }, '자동'),
        ...DD_TINTS.map(([bg, edge]) => h('button', { type: 'button', class: 'dd-sw' + (on === edge.toLowerCase() ? ' on' : ''), title: edge, 'aria-label': `색 ${edge}`, 'aria-pressed': String(on === edge.toLowerCase()),
          style: { background: `linear-gradient(135deg, ${bg}, ${edge})` }, onclick: () => { r.color = edge; paintSw(); } })),
        h('span', { class: 'dd-sw-custom' }, custom.el));
    };
    paintSw();
    const el = h('div', { class: 'dd-row' },
      h('div', { class: 'dd-row-top' }, emoji, name,
        h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '삭제', onclick: () => { rows.splice(rows.indexOf(r), 1); el.remove(); } }, icon('x', 15))),
      h('div', { class: 'dd-row-bot' }, seg, date.el),
      swBox);
    Object.assign(r, { el, emoji, name, date });
    rows.push(r);
    box.append(el);
    return r;
  };
  sanitizeDdays(state.me.theme.ddays).forEach(add);
  const save = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
    const list = sanitizeDdays(rows.map((r) => ({ id: r.id, name: r.name.value, date: r.date.value, kind: r.kind, emoji: r.emoji.value, color: r.color })));
    if (list.length < rows.filter((r) => r.name.value.trim() || r.date.value).length) { toast('이름과 날짜를 모두 채워 주세요'); return; }
    save.disabled = true;
    try { await updateProfile({ theme: { ...sanitizeTheme(state.me.theme), ddays: list } }); toast('디데이를 저장했어요'); }
    catch (e) { toast(friendly(e)); }
    finally { save.disabled = false; }
  } }, icon('check', 16), '디데이 저장');
  return h('section', { class: 'panel' },
    h('h3', { class: 'panel-title' }, '디데이'),
    h('p', { class: 'desc' }, '블로그 이름 오른쪽에 가장 가까운 기념일이 나오고, 누르면 전체 목록이 열려요. "커플"은 만난 날을 1일로 해서 D+일수를 세고 100일·주년을 기념일로 계산해요. "디데이"는 정한 날까지 D-일수를 세요.'),
    box,
    h('div', { class: 'row' }, h('button', { class: 'btn sm', type: 'button', onclick: () => add({})?.name.focus() }, icon('plus', 14), '디데이 추가'), save));
}

// ───────── 알림 (누가 내 배너를 가져갔는지) ─────────
function bellButton() {
  const badge = h('span', { class: 'bell-badge', hidden: true });
  const btn = h('button', { class: 'bell-btn', type: 'button', title: '알림', 'aria-label': '알림' }, icon('bell', 18), badge);
  let rows = [];
  const refresh = async () => {
    try {
      rows = await listNotifs();
      const n = rows.filter((r) => !r.read).length;
      badge.textContent = n > 9 ? '9+' : String(n);
      badge.hidden = n === 0;
    } catch { /* 알림을 못 읽어도 설정은 그대로 써요 */ }
  };
  btn.addEventListener('click', async () => {
    await refresh();
    const body = h('div', { class: 'notif-list' });
    const unreadIds = new Set(rows.filter((r) => !r.read).map((r) => r.from));
    const paint = () => {
      body.replaceChildren(...(rows.length ? rows.map((r) => {
        const p = r.prof;
        const name = txt(p?.display) || txt(p?.handle) || '알 수 없는 사용자';
        return h('div', { class: 'notif-row' + (unreadIds.has(r.from) ? ' new' : '') },
          p ? avatarEl(p, 'sm') : h('div', { class: 'avatar sm' }, '?'),
          h('div', { class: 'notif-text' },
            p ? h('a', { href: '#/u/' + p.handle, onclick: () => document.querySelector('.modal-back')?.remove() }, h('strong', null, name), ' ', h('span', { class: 'muted' }, '@' + p.handle))
              : h('strong', null, name),
            h('span', null, ' 님이 내 배너를 가져갔어요'),
            h('small', { class: 'muted' }, fmtDate(r.at))),
          h('button', { class: 'btn ghost sm icon', type: 'button', 'aria-label': '알림 지우기', onclick: async () => {
            try { await deleteNotif(r.from); rows = rows.filter((x) => x.from !== r.from); paint(); } catch (e) { toast(friendly(e)); }
          } }, icon('x', 14)));
      }) : [h('p', { class: 'desc' }, '아직 내 배너를 가져간 사람이 없어요.')]));
    };
    paint();
    modal({ title: '알림', body, onClose: refresh });
    markNotifsRead(rows).then(() => { badge.hidden = true; }).catch(() => {});
  });
  refresh();
  return btn;
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

  // 아이디 바꾸기 (계정당 1번)
  const idInput = h('input', { class: 'input', value: '@' + me.handle, disabled: true });
  const urlInput = h('input', { class: 'input mono', readonly: true, value: location.origin + location.pathname + '#/u/' + me.handle });
  const idHost = h('div', { class: 'row id-row' });
  const paintId = () => {
    idInput.value = '@' + state.me.handle;
    urlInput.value = location.origin + location.pathname + '#/u/' + state.me.handle;
    idHost.replaceChildren(state.me.handleChanged
      ? h('small', { class: 'hint-line' }, '아이디는 한 번 바꿨어요 (계정당 1번만 바꿀 수 있어요)')
      : h('button', { class: 'btn sm', type: 'button', onclick: onHandle }, icon('edit', 14), '아이디 바꾸기 (1번만 가능)'));
  };
  const onHandle = async () => {
    const v = await askText({ title: '아이디 바꾸기', ok: '다음', placeholder: '새 아이디 (영문 소문자·숫자·_ 3~20자)',
      label: '계정당 딱 1번만 바꿀 수 있어요. 블로그 주소가 새 아이디로 바뀌고, 이전 주소로 들어와도 새 주소로 이어져요. 이전 아이디는 다른 사람이 쓸 수 없게 남아요.' });
    if (!v) return;
    const nh = normalizeHandle(v);
    if (!HANDLE_RE.test(nh)) { toast('아이디는 영문 소문자·숫자·밑줄(_) 3~20자예요'); return; }
    if (nh === state.me.handle) { toast('지금 아이디와 같아요'); return; }
    try { if (!(await handleAvailable(nh))) { toast('이미 사용 중인 아이디예요'); return; } } catch (e) { toast(friendly(e)); return; }
    if (!(await confirmDialog(`'@${nh}'(으)로 바꿀까요? 한 번 바꾸면 다시 바꿀 수 없어요.`, { ok: '바꾸기' }))) return;
    try {
      await changeHandle(nh);
      paintId();
      toast(hasRealEmail() ? `아이디를 @${nh}(으)로 바꿨어요` : `아이디를 @${nh}(으)로 바꿨어요. 다음 로그인부터 새 아이디로 해 주세요`, { ms: 6000 });
    } catch (e) { toast(friendly(e), { ms: 5000 }); }
  };
  paintId();

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
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, '아이디'), idInput, idHost),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '표시 이름'), display),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '소개'), bio),
      h('div', { class: 'row' }, saveBtn)),
    faviconPanel(),
    ddayOn() ? ddayPanel() : null,
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '내 블로그 주소'),
      h('p', { class: 'desc' }, '이 링크를 공유하면 공개 글과 비밀번호 글 목록을 볼 수 있어요.'),
      h('div', { class: 'row' },
        urlInput,
        h('button', { class: 'btn', onclick: () => copyText(urlInput.value, '주소를 복사했어요') }, icon('copy', 15), '복사'))),
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
  let showAll = sanitizeTheme(state.me.theme).showAll;
  const allTxt = h('span', { class: 'sw-txt' }, showAll ? '보임' : '숨김');
  const allCb = h('input', { type: 'checkbox', checked: showAll, onchange: (e) => { showAll = e.target.checked; allTxt.textContent = showAll ? '보임' : '숨김'; touch(); } });
  const uncatCb = h('input', { type: 'checkbox', checked: uncat, onchange: (e) => { uncat = e.target.checked; uncatTxt.textContent = uncat ? '보임' : '숨김'; touch(); } });
  const saveBtn = h('button', { class: 'btn primary', onclick: async () => {
    saveBtn.disabled = true;
    try {
      await saveBoards(boards, { uncat, showAll });
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
      h('h3', { class: 'panel-title' }, '전체 게시판'),
      h('p', { class: 'desc' }, '모든 글을 한꺼번에 보여주는 ‘전체’예요. 끄면 블로그 왼쪽 목록에서 빠지고, 블로그에 들어오면 첫 번째 게시판이 먼저 열려요.'),
      h('label', { class: 'switch' }, allCb, h('span', { class: 'trk' }), allTxt)),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '미분류 게시판'),
      h('p', { class: 'desc' }, '게시판을 정하지 않은 글이 모이는 곳이에요. 끄면 블로그 왼쪽 목록에서 빠지고, 그 글들은 ‘전체’에서만 보여요. (전체도 꺼 두면 다른 사람에게는 안 보여요)'),
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
    // 배경음악·스킨은 각자 따로 저장해요 → 지금 저장된 값을 그대로 이어 붙여요
    try { const cur = sanitizeTheme(state.me.theme); T = sanitizeTheme({ ...T, bgm: cur.bgm, ...pickSkin(cur) }); await updateProfile({ theme: T }); dirty = false; toast('꾸미기를 저장했어요'); }
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
        style: { background: p.bg, '--sw': p.accent, '--sw-ink': palette(p.bg, p.accent).text },
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
        const canvas = await openCropper(f, { ratio: 6, outW: 1800, title: '대문 배너 자르기', hint: '블로그 맨 위에 걸리는 큰 이미지예요. 끌어서 위치를, 슬라이더·마우스 휠로 크기를 맞춰요. 휴대폰에서도 자른 모양 그대로(6 : 1) 보여요.' });
        if (!canvas) return;
        const id = await saveCroppedCanvas(canvas, state.user.uid, 'bn');
        const old = state.me.theme.banner;
        T = { ...T, banner: id };
        await updateProfile({ theme: T });
        if (old && old !== id) removeImages([old]);
        dirty = false;
        toast('대문 배너를 바꿨어요');
        build();
      } catch (e) { toast(friendly(e)); }
    });

    // 대문 배너 슬라이드: 추가 사진 (관리자 테스트 기능) — 대표 대문 배너 뒤로 이어져요
    const slideFile = h('input', { type: 'file', accept: 'image/*', hidden: true });
    slideFile.addEventListener('change', async () => {
      const f = slideFile.files[0];
      slideFile.value = '';
      if (!f) return;
      if (T.bannerMore.length >= MAX_BANNER_MORE) { toast(`슬라이드 사진은 대표 사진 외에 ${MAX_BANNER_MORE}장까지예요`); return; }
      try {
        const canvas = await openCropper(f, { ratio: 6, outW: 1800, title: '슬라이드 사진 자르기', hint: '대문 배너와 같은 비율(6 : 1)이에요. 끌어서 위치를, 슬라이더·마우스 휠로 크기를 맞춰요.' });
        if (!canvas) return;
        const id = await saveCroppedCanvas(canvas, state.user.uid, 'bn');
        T = { ...T, bannerMore: [...T.bannerMore, id] };
        await updateProfile({ theme: T });
        dirty = false;
        toast('슬라이드 사진을 추가했어요');
        build();
      } catch (e) { toast(friendly(e)); }
    });
    const slideThumb = (id, i) => {
      const el = h('div', { class: 'bn-thumb' },
        h('span', { class: 'bn-no' }, String(i + 2)),
        h('button', { class: 'bn-x', type: 'button', title: '이 사진 빼기', 'aria-label': '이 사진 빼기', onclick: async () => {
          if (!(await confirmDialog('이 슬라이드 사진을 뺄까요?', { ok: '빼기', danger: true }))) return;
          T = { ...T, bannerMore: T.bannerMore.filter((x) => x !== id) };
          try { await updateProfile({ theme: T }); removeImages([id]); dirty = false; build(); } catch (e) { toast(friendly(e)); }
        } }, icon('x', 12)));
      loadImage(id).then((u) => { if (u) el.style.backgroundImage = `url("${u}")`; });
      return el;
    };
    const slidePanel = () => {
      const secSel = selectField({ options: BANNER_SECS.map((n) => [String(n), `${n}초`]), value: String(T.bannerSec), label: '넘어가는 간격', onChange: (v) => set({ bannerSec: +v }, false) });
      return h('div', { class: 'bn-slide' },
        h('h4', null, '슬라이드 (자동으로 넘어가요)'),
        h('p', { class: 'desc' }, '대문 배너 사진이 1번이고, 여기에 추가한 사진이 이어서 자동으로 넘어가요. 마우스를 올리면 멈춰요. (지금은 관리자에게만 보이는 테스트 기능이에요)'),
        T.bannerMore.length ? h('div', { class: 'bn-thumbs' }, T.bannerMore.map(slideThumb)) : null,
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', type: 'button', disabled: T.bannerMore.length >= MAX_BANNER_MORE, onclick: () => slideFile.click() }, icon('plus', 14), `슬라이드 사진 추가 (${T.bannerMore.length}/${MAX_BANNER_MORE})`),
          h('div', { class: 'bn-sec' }, h('span', null, '간격'), secSel.el), slideFile));
    };

    // 배너: 블로그 태그 아래에 걸리는 작은 이미지 (4:1)
    const nbFile = h('input', { type: 'file', accept: 'image/*', hidden: true });
    nbFile.addEventListener('change', async () => {
      const f = nbFile.files[0];
      nbFile.value = '';
      if (!f) return;
      try {
        const canvas = await openCropper(f, { ratio: 4, outW: 400, title: '배너 자르기', hint: '블로그 태그 아래에 걸리는 작은 배너(가로 4 : 세로 1)예요. 끌어서 위치를, 슬라이더·마우스 휠로 크기를 맞춰요.' });
        if (!canvas) return;
        const id = await saveCroppedCanvas(canvas, state.user.uid, 'nb');
        const old = state.me.theme.nbBanner;
        T = { ...T, nbBanner: id };
        await updateProfile({ theme: T });
        if (old && old !== id) removeImages([old]);
        dirty = false;
        toast('배너를 바꿨어요');
        build();
      } catch (e) { toast(friendly(e)); }
    });
    const nbPanel = () => h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '배너'),
      h('p', { class: 'desc' }, '블로그 태그 아래에 걸리는 작은 이미지예요 (가로 4 : 세로 1, 가운데를 잘라 맞춰요). 이 배너를 누르면 상대가 바로 자기 배너 목록으로 가져갈 수 있고, 마우스를 올리면 블로그 이름과 핸들이 보여요. 이미지를 정하지 않아도 블로그 이름이 적힌 기본 배너가 걸려요.'),
      h('div', { class: 'nb-preview' }, bannerEl({ ...state.me, theme: T }, { cls: 'mine' })),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', onclick: () => nbFile.click() }, icon('image', 14), T.nbBanner ? '배너 바꾸기' : '배너 이미지 선택'),
        T.nbBanner ? h('button', { class: 'btn ghost sm', onclick: async () => {
          const old = T.nbBanner;
          T = { ...T, nbBanner: '' };
          try { await updateProfile({ theme: T }); removeImages([old]); build(); } catch (e) { toast(friendly(e)); }
        } }, '배너 지우기') : null, nbFile));

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
          h('button', { class: 'btn sm', onclick: () => bannerFile.click() }, icon('image', 14), T.banner ? '대문 배너 바꾸기' : '대문 배너 이미지 선택'),
          T.banner ? h('button', { class: 'btn ghost sm', onclick: async () => {
            const old = T.banner;
            T = { ...T, banner: '' };
            try { await updateProfile({ theme: T }); removeImages([old]); build(); } catch (e) { toast(friendly(e)); }
          } }, '대문 배너 지우기') : null, bannerFile) : null,
        T.header === 'banner' ? h('p', { class: 'desc' }, '대문 배너는 블로그 맨 위에 걸리는 큰 이미지예요. 태그 아래에 걸리는 작은 "배너"와는 달라요.') : null,
        T.header === 'banner' && bannerSlideOn() ? slidePanel() : null),
      neighborsOn() ? nbPanel() : null,
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
          if (await confirmDialog('꾸미기를 기본값으로 되돌릴까요? (저장하기 전까지는 적용되지 않아요)', { ok: '되돌리기' })) set({ ...DEFAULT_THEME, avatar: T.avatar, banner: T.banner, bannerMore: T.bannerMore, nbBanner: T.nbBanner, neighbors: T.neighbors, kinds: T.kinds, boards: T.boards, uncat: T.uncat, favicon: T.favicon, showAll: T.showAll, bgm: T.bgm, ...pickSkin(T) });
        } }, '기본값으로'),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => openSitePreview(T) }, icon('eye', 16), '미리보기'), saveBtn)),
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
