// 이미지: ImgBB에 올리고 주소만 저장해요. (예전 Firestore 저장 방식의 글도 읽을 수 있어요)
import { db, doc, getDoc, deleteDoc } from './fb.js';
import { isUrl, safeUrl } from './imgbb.js';

export { uploadImage, isUrl, safeUrl } from './imgbb.js';

const cache = new Map();

/** 주소(ImgBB) 또는 예전 이미지 ID → 화면에 쓸 수 있는 src */
export function loadImage(ref) {
  if (!ref) return Promise.resolve(null);
  if (isUrl(ref)) return Promise.resolve(safeUrl(ref));
  if (!cache.has(ref)) {
    const p = getDoc(doc(db, 'images', ref)).then((s) => (s.exists() ? s.data().d : null)).catch(() => null);
    cache.set(ref, p);
    p.then((v) => { if (v == null) cache.delete(ref); });
  }
  return cache.get(ref);
}

/** 예전 방식(Firestore) 이미지 문서만 지워요. ImgBB 이미지는 사이트에서 삭제할 수 없어요 */
export async function removeImages(refs) {
  const ids = refs.filter((r) => r && !isUrl(r));
  await Promise.all(ids.map((id) => deleteDoc(doc(db, 'images', id)).catch(() => {})));
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

/**
 * 이미지를 캔버스에서 새로 그려 다시 인코딩해요.
 * → PNG 텍스트(프롬프트 등), EXIF, NovelAI 알파채널 숨은 정보가 전부 사라져요.
 * (투명도는 흰 배경으로 합쳐지므로 알파채널 속 정보도 남지 않아요)
 */
export async function compressImage(file, { maxEdge = 3072, quality = 0.93 } = {}) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const hh = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, hh);
  ctx.drawImage(bmp, 0, 0, w, hh);
  bmp.close?.();
  return c.toDataURL(format(), quality);
}

/** 목록용 작은 썸네일 (역시 새로 그려서 메타데이터 없음) */
export async function makeThumb(src, edge = 480) {
  const img = new Image();
  if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
  img.src = src;
  await img.decode();
  const s = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const hh = Math.max(1, Math.round(img.naturalHeight * s));
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, hh);
  ctx.drawImage(img, 0, 0, w, hh);
  return c.toDataURL(format(), 0.72);
}
