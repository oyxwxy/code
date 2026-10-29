// 백업(내보내기) / 복원(가져오기) / NovelAI 이미지 일괄 가져오기
import { h, icon, toast, copyText, downloadBlob, confirmDialog } from './util.js';
import { state, listPosts, loadContent, savePost, friendly } from './store.js';
import { loadImage, compressImage, isUrl } from './images.js';
import { readImageMeta } from './nai.js';
import { KINDS, kindOf, kindLabel } from './kinds.js';

const FORMAT = 'promptbox-backup';

function progressBar() {
  const bar = h('div', { class: 'bar' }, h('i'));
  const label = h('div', { class: 'bar-label' });
  const el = h('div', { class: 'progress', hidden: true }, bar, label);
  return {
    el,
    set(done, total, text) {
      el.hidden = false;
      bar.firstChild.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
      label.textContent = text || `${done} / ${total}`;
    },
    hide() { el.hidden = true; },
  };
}

async function exportAll({ onProgress }) {
  const posts = await listPosts(state.user.uid);
  const items = [];
  let skipped = 0;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    onProgress(i, posts.length, `${p.title}`);
    let r;
    try { r = await loadContent(p, { fresh: true }); } catch { skipped++; continue; }
    if (r.needPassword) { skipped++; continue; }   // 사본이 없는 잠금 글은 건너뜀
    const it = {
      id: p.id, kind: kindOf(p), title: p.title, vis: p.vis, unlisted: !!p.unlisted, spoiler: !!p.spoiler, tags: p.tags || [],
      created: p.created, updated: p.updated, content: r.content,
    };
    if (r.lock) it.lock = r.lock;
    // 이미지는 ImgBB 주소로 들어 있어요. 예전 방식(Firestore) 이미지만 데이터를 같이 담아요
    for (const ref of r.content.images || []) {
      if (isUrl(ref)) continue;
      const u = await loadImage(ref);
      if (u) (it.images ||= {})[ref] = u;
    }
    items.push(it);
  }
  onProgress(posts.length, posts.length, '완료');
  const data = {
    format: FORMAT, version: 2, exported: Date.now(),
    profile: { handle: state.me.handle, display: state.me.display, bio: state.me.bio },
    posts: items,
  };
  return { blob: new Blob([JSON.stringify(data)], { type: 'application/json' }), count: items.length, skipped };
}

async function importBackup(data, { onProgress }) {
  if (data?.format !== FORMAT || !Array.isArray(data.posts)) throw new Error('이 사이트의 백업 파일이 아니에요');
  const mine = new Set((await listPosts(state.user.uid)).map((p) => p.id));
  let ok = 0, skip = 0, fail = 0;
  for (let i = 0; i < data.posts.length; i++) {
    const it = data.posts[i];
    onProgress(i, data.posts.length, it.title || '');
    if (mine.has(it.id)) { skip++; continue; }       // 같은 ID는 중복 방지로 건너뛰기
    try {
      const images = (it.content?.images || [])
        .map((ref) => (isUrl(ref) ? { src: ref } : it.images?.[ref] ? { data: it.images[ref] } : null))
        .filter(Boolean);
      await savePost({
        id: it.id, kind: it.kind || 'style', title: it.title, vis: it.vis || 'private', unlisted: !!it.unlisted, spoiler: !!it.spoiler, tags: it.tags || [],
        content: { ...it.content, images: [] }, images, lock: it.lock || null, created: it.created,
        password: '',
      });
      ok++;
    } catch (e) {
      console.error(e);
      fail++;
    }
  }
  onProgress(data.posts.length, data.posts.length, '완료');
  return { ok, skip, fail };
}

/** 이미지 메타데이터 → 글 종류에 맞는 본문 */
function contentFromMeta(kind, meta) {
  const c = { prompt: meta?.prompt || '', notes: '' };
  if (kind === 'style') { c.negative = meta?.negative || ''; c.params = meta?.params || {}; }
  if (kind === 'character') c.variants = (meta?.chars || []).map((x, i) => ({ name: `캐릭터 ${i + 1}`, prompt: x.prompt })).filter((v) => v.prompt);
  return c;
}

export function backupTab() {
  const wrap = h('div', { class: 'tab-body' });

  // ── 내보내기 ──
  const exProg = progressBar();
  const exBtn = h('button', { class: 'btn primary', onclick: async () => {
    exBtn.disabled = true;
    try {
      const { blob, count, skipped } = await exportAll({ onProgress: exProg.set });
      const d = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `promptbox-${state.me.handle}-${d}.json`);
      toast(`${count}개 글을 내보냈어요` + (skipped ? ` (열 수 없는 ${skipped}개 제외)` : ''));
    } catch (e) { toast(friendly(e)); }
    finally { exBtn.disabled = false; setTimeout(() => exProg.hide(), 1500); }
  } }, icon('download', 16), '백업 파일 만들기');

  // ── 복원 ──
  const imProg = progressBar();
  const jsonIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  jsonIn.addEventListener('change', async () => {
    const f = jsonIn.files[0];
    jsonIn.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!(await confirmDialog(`${data.posts?.length ?? 0}개 글을 가져올까요? 이미 있는 글(같은 ID)은 건너뛰어요.`, { title: '백업 가져오기', ok: '가져오기' }))) return;
      const r = await importBackup(data, { onProgress: imProg.set });
      toast(`가져오기 완료 · ${r.ok}개 추가${r.skip ? ` · ${r.skip}개 중복` : ''}${r.fail ? ` · ${r.fail}개 실패` : ''}`, { ms: 5000 });
    } catch (e) { toast(friendly(e)); }
    finally { setTimeout(() => imProg.hide(), 1500); }
  });

  // ── 이미지 일괄 가져오기 ──
  const bulkIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  const bulkKind = h('select', { class: 'select' }, Object.keys(KINDS).map((k) => h('option', { value: k }, kindLabel(k))));
  const bulkVis = h('select', { class: 'select' },
    h('option', { value: 'private' }, '비공개'), h('option', { value: 'public' }, '공개'), h('option', { value: 'locked' }, '비밀번호'));
  const bulkPw = h('input', { class: 'input', type: 'password', placeholder: '비밀번호 (잠금일 때)', autocomplete: 'new-password' });
  const bulkTags = h('input', { class: 'input', placeholder: '태그 (쉼표로 구분, 선택)' });
  const bulkProg = progressBar();
  bulkIn.addEventListener('change', async () => {
    const files = [...bulkIn.files].filter((f) => f.type.startsWith('image/'));
    bulkIn.value = '';
    if (!files.length) return;
    const vis = bulkVis.value, kind = bulkKind.value;
    if (vis === 'locked' && !bulkPw.value) { toast('비밀번호를 먼저 입력해 주세요'); return; }
    const tags = bulkTags.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
    let ok = 0, noMeta = 0, fail = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      bulkProg.set(i, files.length, f.name);
      try {
        const [data, meta] = await Promise.all([compressImage(f), readImageMeta(f)]);
        if (!meta) noMeta++;
        await savePost({
          kind, title: f.name.replace(/\.[^.]+$/, ''), vis, tags,
          content: contentFromMeta(kind, meta),
          images: [{ data }], password: vis === 'locked' ? bulkPw.value : '',
        });
        ok++;
      } catch (e) { console.error(e); fail++; }
    }
    bulkProg.set(files.length, files.length, '완료');
    toast(`${ok}개 글을 만들었어요${noMeta ? ` (프롬프트 정보 없음 ${noMeta})` : ''}${fail ? ` · 실패 ${fail}` : ''}`, { ms: 5000 });
    setTimeout(() => bulkProg.hide(), 1500);
  });
  const showPw = () => { bulkPw.style.display = bulkVis.value === 'locked' ? '' : 'none'; };
  bulkVis.addEventListener('change', showPw);
  showPw();

  wrap.append(
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '백업하기'),
      h('p', { class: 'desc' }, '내 모든 글(공개·비밀번호·비공개)을 JSON 파일 하나로 내려받아요. 이미지는 ImgBB 주소로 들어가요. 잠금 글 내용은 파일 안에서 암호화되지 않으니 보관에 주의하세요.'),
      h('div', { class: 'row' }, exBtn), exProg.el),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, '백업 파일에서 복원'),
      h('p', { class: 'desc' }, '이 사이트에서 만든 백업 파일을 불러와요. 다른 계정으로도 옮길 수 있어요.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => jsonIn.click() }, icon('upload', 16), '백업 파일 선택'), jsonIn), imProg.el),
    h('section', { class: 'panel' },
      h('h3', { class: 'panel-title' }, 'NovelAI 이미지로 한 번에 만들기'),
      h('p', { class: 'desc' }, '이미지를 여러 장 고르면, 이미지마다 프롬프트를 읽어 글을 하나씩 만들어요. 올릴 때 메타데이터는 지워져요. (그림체는 부정·생성 설정까지, 캐릭터는 V4 캐릭터 프롬이 변형으로 들어가요)'),
      h('div', { class: 'grid-2' },
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, '글 종류'), bulkKind),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, '공개 범위'), bulkVis, bulkPw)),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, '공통 태그'), bulkTags),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => bulkIn.click() }, icon('image', 16), '이미지 선택하고 만들기'), bulkIn), bulkProg.el));
  return wrap;
}

export { copyText };
