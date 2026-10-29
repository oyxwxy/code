// ImgBB 업로드 (Firebase에 의존하지 않는 순수 모듈)
import { IMGBB_KEY } from './config.js';

const API = 'https://api.imgbb.com/1/upload';
const SAFE = /^https:\/\/([a-z0-9-]+\.)?ibb\.co(\.com)?\//i;

export const isUrl = (s) => typeof s === 'string' && /^https?:\/\//i.test(s);
/** 화면에 그려도 되는 이미지 주소만 통과 (남의 글에 엉뚱한 주소가 들어있어도 안전하게) */
export const safeUrl = (u) => (typeof u === 'string' && SAFE.test(u) ? u : null);

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** data URL 또는 Blob을 ImgBB에 올리고 이미지 주소를 돌려줘요 */
export async function uploadImage(src, name = 'image') {
  const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const fd = new FormData();
      fd.append('image', blob, `${name}.${EXT[blob.type] || 'webp'}`);
      fd.append('name', name);
      const res = await fetch(`${API}?key=${encodeURIComponent(IMGBB_KEY)}`, { method: 'POST', body: fd });
      let json = null;
      try { json = await res.json(); } catch { /* JSON이 아닌 응답 */ }
      if (res.ok && json?.success && json.data) {
        const url = json.data.image?.url || json.data.url || json.data.display_url;
        if (!safeUrl(url)) throw Object.assign(new Error('ImgBB가 예상과 다른 이미지 주소를 돌려줬어요'), { fatal: true });
        return url;
      }
      const msg = json?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`이미지 업로드 실패: ${msg}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) { err.fatal = true; throw err; }
      lastErr = err;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = new Error('이미지 업로드에 실패했어요. 네트워크를 확인해 주세요');
    }
    await sleep(800 * (attempt + 1));
  }
  throw lastErr;
}
