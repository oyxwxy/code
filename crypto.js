// 비밀번호 글은 브라우저에서 AES-GCM으로 암호화해서 저장해요.
// (서버에는 암호문만 올라가고, 비밀번호는 어디에도 저장되지 않아요)
const te = new TextEncoder();
const td = new TextDecoder();

const toB64 = (buf) => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password, salt) {
  const km = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
const importRaw = (raw) => crypto.subtle.importKey('raw', fromB64(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);

async function seal(obj, key, saltB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
  return { v: 1, salt: saltB64, iv: toB64(iv), ct: toB64(ct) };
}
async function open(enc, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, key, fromB64(enc.ct));
  return JSON.parse(td.decode(pt));
}

/** 새 비밀번호로 잠그기 → { enc, keyRaw, salt } */
export async function lockWithPassword(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(password, salt);
  const saltB64 = toB64(salt);
  return { enc: await seal(obj, key, saltB64), keyRaw: toB64(await crypto.subtle.exportKey('raw', key)), salt: saltB64 };
}

/** 이미 알고 있는 키로 다시 잠그기 (글 수정 시 비밀번호 재입력 없이) */
export async function lockWithKey(obj, keyRaw, salt) {
  const key = await importRaw(keyRaw);
  return { enc: await seal(obj, key, salt), keyRaw, salt };
}

/** 비밀번호로 열기. 틀리면 예외 */
export async function unlock(enc, password) {
  const key = await derive(password, fromB64(enc.salt));
  const content = await open(enc, key);
  return { content, keyRaw: toB64(await crypto.subtle.exportKey('raw', key)), salt: enc.salt };
}
