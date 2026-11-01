// 이미지: ImgBB에 올리고 주소만 저장해요. (예전 Firestore 저장 방식의 글도 읽을 수 있어요)
import { db, doc, getDoc, setDoc, deleteDoc } from './fb.js';
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

/**
 * 파비콘용: 가운데를 정사각형으로 잘라 size 픽셀 PNG로 다시 그려요 (투명 배경 유지, 메타데이터 없음)
 */
export async function makeIcon(file, size = 128) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close?.();
  return c.toDataURL('image/png');
}

/**
 * 배너 이미지만 Firebase(Firestore)에 직접 저장해요. 나머지 이미지는 ImgBB예요.
 * 한 문서가 1MB를 넘을 수 없어서, 크기가 넘으면 화질·크기를 줄여 가며 다시 인코딩해요.
 * 반환값은 이미지 ID이고, loadImage()가 그대로 읽어 와요.
 */
export async function saveBannerImage(file, uid) {
  let edge = 1600, q = 0.85, data = '';
  for (let n = 0; n < 8; n++) {
    data = await compressImage(file, { maxEdge: edge, quality: q });
    if (data.length < 900000) break;
    q = Math.max(0.5, q - 0.1);
    edge = Math.round(edge * 0.85);
  }
  if (data.length >= 900000) throw new Error('배너 이미지가 너무 커요. 더 작은 이미지를 골라 주세요');
  const id = 'bn' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await setDoc(doc(db, 'images', id), { owner: uid, d: data, t: Date.now() });
  cache.set(id, Promise.resolve(data));
  return id;
}

/** 이웃 배너: 가운데를 4:1 로 잘라 400×100 으로 다시 그려요 (메타데이터 없음). 반환값은 loadImage() 가 읽는 ID */
export async function saveNeighborBanner(file, uid) {
  const W = 400, H = 100;
  const bmp = await createImageBitmap(file);
  const r = W / H;
  let sw = bmp.width, sh = bmp.width / r;
  if (sh > bmp.height) { sh = bmp.height; sw = bmp.height * r; }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
  bmp.close?.();
  const data = c.toDataURL(format(), 0.88);
  const id = 'nb' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await setDoc(doc(db, 'images', id), { owner: uid, d: data, t: Date.now() });
  cache.set(id, Promise.resolve(data));
  return id;
}
