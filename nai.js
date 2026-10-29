// NovelAI / Stable Diffusion 이미지·텍스트에서 프롬프트 정보를 읽어와요.
// 지원: PNG tEXt/iTXt/zTXt 메타데이터, NovelAI 알파채널(stealth) 메타데이터, SD 웹UI 텍스트, NAI Comment JSON

export const PARAM_FIELDS = [
  ['model', '모델'], ['sampler', '샘플러'], ['steps', 'Steps'], ['scale', 'Guidance'],
  ['cfgRescale', 'Rescale'], ['schedule', 'Schedule'], ['seed', 'Seed'], ['size', '크기'], ['extra', '기타'],
];

const SAMPLERS = {
  k_euler: 'Euler', k_euler_ancestral: 'Euler Ancestral', k_dpmpp_2s_ancestral: 'DPM++ 2S Ancestral',
  k_dpmpp_2m: 'DPM++ 2M', k_dpmpp_2m_sde: 'DPM++ 2M SDE', k_dpmpp_sde: 'DPM++ SDE', ddim_v3: 'DDIM',
  k_dpm_2: 'DPM2', k_dpm_adaptive: 'DPM Adaptive', k_dpm_fast: 'DPM Fast',
};

function decodeBytes(u8) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch { return new TextDecoder('latin1').decode(u8); }
}

async function inflate(u8, format) {
  const ds = new DecompressionStream(format);
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** PNG 텍스트 청크를 {키: 값}으로 */
export async function readPngText(buf) {
  const u8 = new Uint8Array(buf);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (u8[i] !== sig[i]) return null;
  const dv = new DataView(buf);
  const latin = new TextDecoder('latin1');
  const out = {};
  let p = 8;
  while (p + 8 <= u8.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
    const s = p + 8, e = s + len;
    if (e > u8.length) break;
    try {
      if (type === 'tEXt') {
        const z = u8.indexOf(0, s);
        if (z > s && z < e) out[latin.decode(u8.subarray(s, z))] = decodeBytes(u8.subarray(z + 1, e));
      } else if (type === 'zTXt') {
        const z = u8.indexOf(0, s);
        if (z > s && z < e) out[latin.decode(u8.subarray(s, z))] = decodeBytes(await inflate(u8.subarray(z + 2, e), 'deflate'));
      } else if (type === 'iTXt') {
        const z = u8.indexOf(0, s);
        if (z > s && z < e) {
          const key = latin.decode(u8.subarray(s, z));
          const compressed = u8[z + 1] === 1;
          let q = u8.indexOf(0, z + 3);          // language tag 끝
          q = u8.indexOf(0, q + 1);              // translated keyword 끝
          const data = u8.subarray(q + 1, e);
          out[key] = decodeBytes(compressed ? await inflate(data, 'deflate') : data);
        }
      }
    } catch { /* 깨진 청크는 건너뛰기 */ }
    if (type === 'IEND') break;
    p = e + 4;
  }
  return out;
}

/** NovelAI 알파채널 숨은 메타데이터 */
async function readStealth(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { premultiplyAlpha: 'none' }); }
  catch { try { bmp = await createImageBitmap(file); } catch { return null; } }
  const w = bmp.width, hh = bmp.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const d = ctx.getImageData(0, 0, w, hh).data;
  const total = w * hh;
  let k = 0;
  const bit = () => {
    if (k >= total) return -1;
    const x = Math.floor(k / hh), y = k % hh;   // 세로 방향(열 우선)으로 읽어요
    k++;
    return d[(y * w + x) * 4 + 3] & 1;
  };
  const bytes = (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let j = 0; j < 8; j++) { const b = bit(); if (b < 0) return null; v = (v << 1) | b; }
      out[i] = v;
    }
    return out;
  };
  const head = bytes(15);
  if (!head) return null;
  const sigText = String.fromCharCode(...head);
  if (sigText !== 'stealth_pngcomp' && sigText !== 'stealth_pnginfo') return null;
  const lenB = bytes(4);
  if (!lenB) return null;
  const bits = new DataView(lenB.buffer).getUint32(0);
  const n = Math.floor(bits / 8);
  if (!n || n > 6_000_000) return null;
  let data = bytes(n);
  if (!data) return null;
  if (sigText === 'stealth_pngcomp') data = await inflate(data, 'gzip');
  return JSON.parse(new TextDecoder().decode(data));
}

const blank = () => ({ prompt: '', negative: '', chars: [], params: {} });

/** NAI 정보 객체(Comment/Description 등) → 앱 형식 */
export function normalizeNai(info) {
  if (!info || typeof info !== 'object') return null;
  let c = info.Comment;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { c = null; } }
  if (!c && (info.prompt != null || info.uc != null)) c = info;
  const r = blank();
  const v4 = c?.v4_prompt?.caption;
  const v4n = c?.v4_negative_prompt?.caption;
  r.prompt = String(v4?.base_caption ?? c?.prompt ?? info.Description ?? '');
  r.negative = String(v4n?.base_caption ?? c?.uc ?? c?.negative_prompt ?? '');
  const pos = v4?.char_captions || [];
  const neg = v4n?.char_captions || [];
  r.chars = pos.map((x, i) => ({ prompt: x?.char_caption || '', uc: neg[i]?.char_caption || '' }));
  if (c) {
    const p = r.params;
    if (c.steps != null) p.steps = String(c.steps);
    if (c.scale != null) p.scale = String(c.scale);
    if (c.cfg_rescale != null && Number(c.cfg_rescale) !== 0) p.cfgRescale = String(c.cfg_rescale);
    if (c.seed != null) p.seed = String(c.seed);
    if (c.width && c.height) p.size = `${c.width}x${c.height}`;
    if (c.sampler) p.sampler = SAMPLERS[c.sampler] || String(c.sampler);
    if (c.noise_schedule) p.schedule = String(c.noise_schedule);
    const ex = [];
    if (c.sm) ex.push('SMEA');
    if (c.sm_dyn) ex.push('SMEA DYN');
    if (c.dynamic_thresholding) ex.push('Decrisper');
    if (c.skip_cfg_above_sigma != null) ex.push('Variety+');
    if (ex.length) p.extra = ex.join(', ');
  }
  if (!r.prompt && !r.negative) return null;
  return r;
}

function splitParamLine(line) {
  return line.split(/,\s*(?=[A-Za-z][\w .\-]*:\s)/);
}

/** 붙여넣은 텍스트(SD 웹UI 형식 / NAI JSON / 그냥 프롬프트) 해석 */
export function parseGenText(text) {
  text = (text || '').trim();
  if (!text) return null;
  if (text[0] === '{') {
    try {
      const m = normalizeNai(JSON.parse(text));
      if (m) return m;
    } catch { /* 일반 텍스트로 진행 */ }
  }
  const lines = text.split(/\r?\n/);
  let pi = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^Steps:\s*\d+/.test(lines[i].trim())) { pi = i; break; }
  }
  const body = pi >= 0 ? lines.slice(0, pi).join('\n') : text;
  let prompt = body, negative = '';
  const m = body.match(/(^|\n)Negative prompt:\s*/i);
  if (m) { prompt = body.slice(0, m.index); negative = body.slice(m.index + m[0].length); }
  const r = blank();
  r.prompt = prompt.trim();
  r.negative = negative.trim();
  if (pi >= 0) {
    const extras = [];
    for (const part of splitParamLine(lines[pi].trim())) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      const k = part.slice(0, i).trim().toLowerCase();
      const v = part.slice(i + 1).trim();
      if (k === 'steps') r.params.steps = v;
      else if (k === 'sampler') r.params.sampler = v;
      else if (k === 'cfg scale' || k === 'guidance') r.params.scale = v;
      else if (k === 'seed') r.params.seed = v;
      else if (k === 'size') r.params.size = v;
      else if (k === 'model') r.params.model = v;
      else if (k === 'schedule type' || k === 'schedule') r.params.schedule = v;
      else extras.push(`${part.slice(0, i).trim()}: ${v}`);
    }
    if (extras.length) r.params.extra = extras.join(', ');
  }
  if (!r.prompt && !r.negative) return null;
  return r;
}

/** 이미지 파일에서 프롬프트 정보를 찾아요. 없으면 null */
export async function readImageMeta(file) {
  let res = null;
  try {
    if (file.type === 'image/png' || /\.png$/i.test(file.name || '')) {
      const t = await readPngText(await file.arrayBuffer());
      if (t) {
        if (t.Comment || (t.Description && /novelai/i.test(t.Software || ''))) res = normalizeNai(t);
        else if (t.parameters) res = parseGenText(t.parameters);
      }
    }
    if (!res || !res.prompt) {
      const s = await readStealth(file);
      if (s) {
        const n = normalizeNai(s);
        if (n) res = n;
      }
    }
  } catch (e) {
    console.warn('메타데이터 읽기 실패', e);
  }
  return res;
}
