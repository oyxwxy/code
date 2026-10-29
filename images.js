// 이미지는 Firestore 문서(images 컬렉션)에 data URL로 저장해요. (규칙상 한 장 950KB 미만)
import { db, doc, getDoc, setDoc, deleteDoc } from './fb.js';
import { rid } from './util.js';

const cache = new Map();

export function loadImage(id) {
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) {
    const p = getDoc(doc(db, 'images', id)).then((s) => (s.exists() ? s.data().d : null)).catch(() => null);
    cache.set(id, p);
    p.then((v) => { if (v == null) cache.delete(id); });
  }
  return cache.get(id);
}

export async function uploadImage(url, owner) {
  const id = rid();
  await setDoc(doc(db, 'images', id), { owner, d: url, created: Date.now() });
  cache.set(id, Promise.resolve(url));
  return id;
}

export async function removeImages(ids) {
  await Promise.all(ids.filter(Boolean).map((id) => deleteDoc(doc(db, 'images', id)).catch(() => {})));
  ids.forEach((id) => cache.delete(id));
}

let FMT = null;
function format() {
  if (FMT) return FMT;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  FMT = c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  return FMT;
}

/** 이미지 파일을 용량 제한 안으로 줄여 data URL로 만들어요 */
export async function compressImage(file, { maxEdge = 2048, maxChars = 880000 } = {}) {
  const bmp = await createImageBitmap(file);
  const f = format();
  let scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  for (let attempt = 0; attempt < 9; attempt++) {
    const w = Math.max(1, Math.round(bmp.width * scale));
    const hh = Math.max(1, Math.round(bmp.height * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = hh;
    const ctx = c.getContext('2d');
    if (f === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
    ctx.drawImage(bmp, 0, 0, w, hh);
    for (const q of [0.92, 0.85, 0.78, 0.7, 0.6]) {
      const url = c.toDataURL(f, q);
      if (url.length <= maxChars) { bmp.close?.(); return url; }
    }
    scale *= 0.85;
  }
  bmp.close?.();
  throw new Error('이미지를 저장 가능한 크기까지 줄이지 못했어요');
}

/** 목록용 작은 썸네일 */
export async function makeThumb(dataUrl, edge = 480) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const hh = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  const f = format();
  if (f === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
  ctx.drawImage(img, 0, 0, w, hh);
  return c.toDataURL(f, 0.72);
}
