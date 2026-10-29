// 인증 + Firestore 데이터 계층 (firestore.rules 와 맞물려 있어요)
import {
  auth, db, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut,
  sendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail, updatePassword,
  doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, writeBatch,
} from './fb.js';
import { AUTH_DOMAIN, MEMBER_INVITE_LIMIT } from './config.js';
import { rid, inviteCode } from './util.js';
import { DEFAULT_THEME, sanitizeTheme } from './theme.js';
import { lockWithPassword, lockWithKey, unlock } from './crypto.js';
import { makeThumb, uploadImage, removeImages, safeUrl, isUrl } from './images.js';

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const state = { user: null, me: null, ready: false };

const clean = (o) => JSON.parse(JSON.stringify(o));
const toEmail = (handle) => `${handle}@${AUTH_DOMAIN}`;
export const normalizeHandle = (s) => (s || '').trim().toLowerCase().replace(/^@/, '');

export function friendly(e) {
  const c = e?.code || '';
  const map = {
    'auth/invalid-credential': '아이디 또는 비밀번호가 올바르지 않아요',
    'auth/wrong-password': '아이디 또는 비밀번호가 올바르지 않아요',
    'auth/user-not-found': '아이디 또는 비밀번호가 올바르지 않아요',
    'auth/invalid-email': '아이디 형식이 올바르지 않아요',
    'auth/email-already-in-use': '이미 가입된 이메일(또는 아이디)이에요',
    'auth/invalid-new-email': '새 이메일 형식이 올바르지 않아요',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요',
    'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해주세요',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요',
    'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인을 켜 주세요',
    'permission-denied': '권한이 없어요 (로그인 상태나 Firestore 규칙을 확인해 주세요)',
    unavailable: '서버에 연결할 수 없어요',
    'resource-exhausted': 'Firebase 무료 사용량을 넘었어요',
  };
  return map[c] || e?.message || '알 수 없는 오류가 났어요';
}

// ───────── 인증 ─────────
const listeners = new Set();
export const onAuth = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

let seq = 0;
async function loadMe(uid) {
  const s = await getDoc(doc(db, 'profiles', uid));
  return s.exists() ? { uid, ...s.data(), theme: sanitizeTheme(s.data().theme) } : null;
}
export async function refreshMe() {
  const my = ++seq;
  const me = state.user ? await loadMe(state.user.uid).catch(() => null) : null;
  if (my !== seq) return;
  state.me = me;
  profileCache.clear();
  notify();
}

export function initAuth() {
  return new Promise((resolve) => {
    let first = true;
    onAuthStateChanged(auth, async (u) => {
      const my = ++seq;
      state.user = u;
      const me = u ? await loadMe(u.uid).catch(() => null) : null;
      if (my === seq) { state.me = me; state.ready = true; notify(); }
      if (first) { first = false; resolve(); }
    });
  });
}

export async function checkAdminExists() {
  return (await getDoc(doc(db, 'meta', 'admin'))).exists();
}
export async function handleAvailable(handle) {
  return !(await getDoc(doc(db, 'handles', normalizeHandle(handle)))).exists();
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUp({ handle, password, display, email, inviteCode: code }) {
  handle = normalizeHandle(handle);
  email = (email || '').trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) throw new Error('이메일 형식이 올바르지 않아요');
  if (!HANDLE_RE.test(handle)) throw new Error('아이디는 영문 소문자·숫자·밑줄(_) 3~20자예요');
  if ((password || '').length < 6) throw new Error('비밀번호는 6자 이상이어야 해요');
  const adminExists = await checkAdminExists();
  let invite = null;
  if (adminExists) {
    code = (code || '').trim().toUpperCase();
    if (!code) throw new Error('초대코드를 입력해 주세요');
    const s = await getDoc(doc(db, 'invites', code));
    if (!s.exists()) throw new Error('초대코드가 올바르지 않아요');
    invite = s.data();
    if (invite.uses >= invite.max) throw new Error('이미 모두 사용된 초대코드예요');
  }
  if (!(await handleAvailable(handle))) throw new Error('이미 사용 중인 아이디예요');

  const cred = await createUserWithEmailAndPassword(auth, email || toEmail(handle), password);
  const uid = cred.user.uid;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'handles', handle), { uid });
    const profile = {
      handle, display: (display || '').trim() || handle, bio: '',
      theme: clean(DEFAULT_THEME), inviteCount: 0, isAdmin: !adminExists, created: Date.now(),
    };
    if (adminExists) {
      profile.inviteCode = code;
      profile.invitedBy = invite.owner;
      batch.update(doc(db, 'invites', code), { uses: invite.uses + 1 });
    } else {
      batch.set(doc(db, 'meta', 'admin'), { uid });
    }
    batch.set(doc(db, 'profiles', uid), profile);
    await batch.commit();
  } catch (e) {
    await cred.user.delete().catch(() => {});
    throw e;
  }
  await refreshMe();
}

export async function signIn(idOrEmail, password) {
  const id = (idOrEmail || '').trim();
  if (!id || !password) throw new Error('아이디(또는 이메일)와 비밀번호를 입력해 주세요');
  // 이메일로 가입한 계정은 이메일로, 이메일 없이 가입한 계정은 아이디로 로그인해요
  const email = id.includes('@') && !id.startsWith('@') ? id.toLowerCase() : toEmail(normalizeHandle(id));
  await signInWithEmailAndPassword(auth, email, password);
  await refreshMe();
  if (!state.me) {
    await fbSignOut(auth);
    throw new Error('가입이 완전히 끝나지 않은 계정이에요. 초대코드로 다시 가입해 주세요');
  }
}

export async function signOutUser() {
  await fbSignOut(auth);
  state.me = null;
  contentCache.clear();
  notify();
}

// ───────── 프로필 ─────────
const profileCache = new Map();

export async function getProfile(uid) {
  if (state.me?.uid === uid) return state.me;
  if (!profileCache.has(uid)) {
    profileCache.set(uid, getDoc(doc(db, 'profiles', uid)).then((s) => (s.exists() ? { uid, ...s.data() } : null)));
  }
  return profileCache.get(uid);
}

export async function getProfileByHandle(handle) {
  const s = await getDoc(doc(db, 'handles', normalizeHandle(handle)));
  if (!s.exists()) return null;
  return getProfile(s.data().uid);
}

/** display / bio / theme 만 수정할 수 있어요 (규칙) */
export async function updateProfile(patch) {
  await updateDoc(doc(db, 'profiles', state.user.uid), clean(patch));
  await refreshMe();
}

// ───────── 글 ─────────
const contentCache = new Map();

export async function listPosts(ownerUid) {
  const isOwner = state.user?.uid === ownerUid;
  const col = collection(db, 'posts');
  let docs;
  if (isOwner) {
    docs = (await getDocs(query(col, where('owner', '==', ownerUid)))).docs;
  } else {
    try {
      const r = await Promise.all(['public', 'locked'].map((v) =>
        getDocs(query(col, where('owner', '==', ownerUid), where('vis', '==', v)))));
      docs = r.flatMap((s) => s.docs);
    } catch (e) {
      if (e.code !== 'permission-denied') throw e;
      // 대체 경로 (이 쿼리는 Firestore 콘솔에서 복합 색인을 만들어야 할 수 있어요)
      docs = (await getDocs(query(col, where('owner', '==', ownerUid), where('vis', '!=', 'private')))).docs;
    }
  }
  let posts = docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!isOwner) posts = posts.filter((p) => !p.unlisted);
  posts.sort((a, b) => (b.created || 0) - (a.created || 0));
  return posts;
}

export async function getPost(id) {
  try {
    const s = await getDoc(doc(db, 'posts', id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
  } catch (e) {
    if (e.code === 'permission-denied') return null;   // 없는 글이거나 비공개
    throw e;
  }
}

/**
 * 글 본문을 불러와요.
 * - 공개/비공개: { content }
 * - 잠금 글: 내 글이면 내 비공개 사본에서 바로, 아니면 { needPassword:true, enc }
 */
export async function loadContent(post, { fresh = false } = {}) {
  const isOwner = state.user?.uid === post.owner;
  if (!fresh && contentCache.has(post.id)) return contentCache.get(post.id);
  const bs = await getDoc(doc(db, 'bodies', post.id));
  if (!bs.exists()) throw new Error('본문을 찾을 수 없어요');
  const body = bs.data();
  let result;
  if (body.enc) {
    result = { needPassword: true, enc: body.enc };
    if (isOwner) {
      const ps = await getDoc(doc(db, 'users', state.user.uid, 'private', post.id));
      if (ps.exists()) {
        const p = ps.data();
        result = { content: p.content, lock: { keyRaw: p.keyRaw, salt: p.salt } };
      }
    }
  } else {
    result = { content: body.content };
  }
  if (!result.needPassword) contentCache.set(post.id, result);
  return result;
}

/** 비밀번호로 열기 (틀리면 예외). 내 글이면 사본도 복구해 둬요 */
export async function unlockContent(post, enc, password) {
  const r = await unlock(enc, password);
  const out = { content: r.content, lock: { keyRaw: r.keyRaw, salt: r.salt } };
  if (state.user?.uid === post.owner) {
    await setDoc(doc(db, 'users', state.user.uid, 'private', post.id),
      clean({ content: r.content, keyRaw: r.keyRaw, salt: r.salt, updated: Date.now() })).catch(() => {});
  }
  contentCache.set(post.id, out);
  return out;
}

function makeExcerpt(content) {
  const src = (content.notes || '').trim() || (content.prompt || '').trim();
  return src.replace(/\s+/g, ' ').slice(0, 140);
}

/**
 * 글 저장 (새 글/수정 공용)
 * images: [{ src?, data? }] — src(이미 올라간 주소)가 없는 것만 ImgBB에 올려요
 * lock: 수정 시 기존 잠금 키 { keyRaw, salt } — password 비우면 이 키로 다시 암호화
 */
export async function savePost({
  id, prev = null, kind = 'style', title, vis, unlisted = false, tags = [], content, images = [],
  password = '', lock = null, origImages = [], created, onProgress,
}) {
  const uid = state.user.uid;
  const now = Date.now();
  id = id || rid();
  if (vis === 'locked' && !password && !lock) throw new Error('비밀번호를 입력해 주세요');

  const urls = [];
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    if (!im.src) {
      onProgress?.(i, images.length);
      im.src = await uploadImage(im.data, rid(10));   // 실패해도 이미 올라간 것은 다시 안 올려요
    }
    urls.push(im.src);
  }
  content = { ...content, images: urls };

  let thumb = '';
  const first = images[0];
  if (vis !== 'locked' && first) {
    try {
      if (first.data) thumb = await makeThumb(first.data);
      else if (prev?.thumb && origImages[0] === first.src) thumb = prev.thumb;
      else thumb = await makeThumb(first.src);
    } catch { thumb = ''; }
    if (!thumb) thumb = safeUrl(first.src) || '';
  }

  const post = {
    owner: uid, handle: state.me.handle, kind, title: (title || '').trim() || '제목 없음', vis,
    unlisted: !!unlisted && vis !== 'private', tags,
    excerpt: vis === 'locked' ? '' : makeExcerpt(content),
    thumb, imgCount: urls.length, created: created || prev?.created || now, updated: now,
  };
  const body = { owner: uid, vis, updated: now };
  let priv = null;
  if (vis === 'locked') {
    let r;
    if (password) r = await lockWithPassword(content, password);
    else r = await lockWithKey(content, lock.keyRaw, lock.salt);
    body.enc = r.enc;
    priv = { content, keyRaw: r.keyRaw, salt: r.salt, updated: now };
  } else {
    body.content = content;
  }

  const batch = writeBatch(db);
  batch.set(doc(db, 'posts', id), clean(post));
  batch.set(doc(db, 'bodies', id), clean(body));
  const pref = doc(db, 'users', uid, 'private', id);
  if (priv) batch.set(pref, clean(priv));
  else if (prev?.vis === 'locked') batch.delete(pref);
  await batch.commit();

  const gone = origImages.filter((x) => !urls.includes(x));
  if (gone.length) removeImages(gone);
  contentCache.delete(id);
  return id;
}

export async function deletePost(post) {
  const uid = state.user.uid;
  let refs = [];
  try { refs = (await loadContent(post, { fresh: true })).content?.images || []; } catch { /* 본문 없이도 삭제 */ }
  const b = writeBatch(db);
  b.delete(doc(db, 'posts', post.id));
  b.delete(doc(db, 'bodies', post.id));
  b.delete(doc(db, 'users', uid, 'private', post.id));
  refs.filter((r) => !isUrl(r)).forEach((i) => b.delete(doc(db, 'images', i)));   // 예전 방식 이미지만
  await b.commit();
  contentCache.delete(post.id);
}

// ───────── 초대 ─────────
export async function createInvite(max = 1) {
  const uid = state.user.uid;
  const fresh = await loadMe(uid);
  const isAdmin = !!fresh?.isAdmin;
  const code = inviteCode();
  const batch = writeBatch(db);
  batch.set(doc(db, 'invites', code), { owner: uid, max: isAdmin ? Math.max(1, Math.min(1000, max | 0)) : 1, uses: 0, created: Date.now() });
  if (!isAdmin) {
    if ((fresh.inviteCount || 0) >= MEMBER_INVITE_LIMIT) throw new Error(`초대코드는 최대 ${MEMBER_INVITE_LIMIT}개까지 만들 수 있어요`);
    batch.update(doc(db, 'profiles', uid), { inviteCount: (fresh.inviteCount || 0) + 1 });
  }
  await batch.commit();
  await refreshMe();
  return code;
}

export async function listInvites() {
  const s = await getDocs(query(collection(db, 'invites'), where('owner', '==', state.user.uid)));
  return s.docs.map((d) => ({ code: d.id, ...d.data() })).sort((a, b) => (b.created || 0) - (a.created || 0));
}

export async function listInvitedMembers() {
  const s = await getDocs(query(collection(db, 'profiles'), where('invitedBy', '==', state.user.uid)));
  return s.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ───────── 비밀번호 찾기 · 계정 보안 ─────────
/** 복구용 실제 이메일이 등록된 계정인지 */
export const hasRealEmail = () => !!state.user?.email && !state.user.email.endsWith('@' + AUTH_DOMAIN);

/** 비밀번호 재설정 메일 보내기. 없는 이메일이어도 같은 결과를 보여줘요(가입 여부 노출 방지) */
export async function resetPassword(email) {
  email = (email || '').trim();
  if (!EMAIL_RE.test(email)) throw new Error('이메일 형식이 올바르지 않아요');
  try { await sendPasswordResetEmail(auth, email); }
  catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
}

async function reauth(password) {
  const u = auth.currentUser;
  if (!u?.email) throw new Error('로그인이 필요해요');
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
  return u;
}

/** 복구용 이메일 등록/변경: 새 이메일로 확인 메일을 보내고, 링크를 누르면 바뀌어요 */
export async function changeEmail(newEmail, password) {
  newEmail = (newEmail || '').trim().toLowerCase();
  if (!EMAIL_RE.test(newEmail)) throw new Error('이메일 형식이 올바르지 않아요');
  const u = await reauth(password);
  await verifyBeforeUpdateEmail(u, newEmail);
}

export async function changePassword(oldPassword, newPassword) {
  if ((newPassword || '').length < 6) throw new Error('새 비밀번호는 6자 이상이어야 해요');
  const u = await reauth(oldPassword);
  await updatePassword(u, newPassword);
}
