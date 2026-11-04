// ───────── 배경음악 (유튜브 링크) ─────────
// 블로그 주인이 설정 → (알림 옆) 배경음악 버튼에서 유튜브 링크를 넣어 두면, 그 블로그와 글 화면에 작은 플레이어가 떠요.
// 같은 블로그 안에서 화면을 옮겨 다녀도 끊기지 않고, 다른 블로그나 다른 화면으로 가면 멈춰요.
// 유튜브 플레이어(API)는 처음 재생을 누를 때 불러와요. 자동 재생은 브라우저가 막을 수 있어요.
import { h, icon, toast } from './util.js';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** 유튜브 주소(또는 영상 ID)에서 영상 ID를 꺼내요. 못 찾으면 '' */
export function parseYouTube(input) {
  const s = String(input || '').trim();
  if (ID_RE.test(s)) return s;
  let u;
  try { u = new URL(s.startsWith('http') ? s : 'https://' + s); } catch { return ''; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || '';
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    if (!id && m) id = m[1];
  }
  return ID_RE.test(id) ? id : '';
}
export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** 영상 제목 (유튜브 oEmbed). 못 가져오면 '' */
export async function fetchYouTubeTitle(id) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id));
    if (!r.ok) return '';
    const j = await r.json();
    return typeof j.title === 'string' ? j.title.slice(0, 80) : '';
  } catch { return ''; }
}

// ── 유튜브 IFrame API ──
let apiP = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiP) apiP = new Promise((res, rej) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { prev?.(); } catch { /* */ } res(window.YT); };
    const sc = h('script', { src: 'https://www.youtube.com/iframe_api' });
    sc.onerror = () => { apiP = null; rej(new Error('유튜브 플레이어를 불러오지 못했어요')); };
    document.head.append(sc);
  });
  return apiP;
}

// ── 상태 ──
const S = {
  key: '', sig: '', tracks: [], order: [], at: 0,
  player: null, ready: false, playing: false, starting: false,
  vol: 60, muted: false, claimed: false, el: null, timer: 0, fails: 0,
};
const VOL_KEY = 'drawer.bgm.vol', OPEN_KEY = 'drawer.bgm.open';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 괜찮아요 */ } },
};

// ── 화면 ──
const ui = {};
function build() {
  if (S.el) return S.el;
  ui.art = h('span', { class: 'bgm-art', 'aria-hidden': 'true' });
  ui.ico = h('span', { class: 'bgm-ico', 'aria-hidden': 'true' }, icon('music', 15));
  ui.disc = h('button', { class: 'bgm-disc', type: 'button', title: '배경음악', 'aria-label': '배경음악 펼치기', 'aria-expanded': 'false', onclick: () => setOpen(!S.el.classList.contains('open')) },
    ui.art, ui.ico, h('span', { class: 'bgm-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  ui.title = h('span', { class: 'bgm-title-in' });
  ui.seek = h('input', { class: 'bgm-seek', type: 'range', min: '0', max: '1000', value: '0', step: '1', 'aria-label': '재생 위치',
    oninput: () => { ui.seek.style.setProperty('--p', ui.seek.value / 10 + '%'); },
    onchange: () => { if (S.player && S.ready) { const d = S.player.getDuration() || 0; S.player.seekTo(d * ui.seek.value / 1000, true); } } });
  ui.time = h('span', { class: 'bgm-time' }, '0:00');
  ui.play = h('button', { class: 'bgm-btn bgm-play', type: 'button', 'aria-label': '재생', onclick: toggle }, icon('play', 16));
  ui.next = h('button', { class: 'bgm-btn', type: 'button', 'aria-label': '다음 곡', onclick: () => step(1) }, icon('skip', 16));
  ui.volBtn = h('button', { class: 'bgm-btn', type: 'button', 'aria-label': '음소거', onclick: () => setMuted(!S.muted) }, icon('vol', 16));
  ui.vol = h('input', { class: 'bgm-vol', type: 'range', min: '0', max: '100', step: '1', 'aria-label': '볼륨',
    oninput: () => setVol(+ui.vol.value) });
  ui.fold = h('button', { class: 'bgm-btn bgm-fold', type: 'button', 'aria-label': '접기', onclick: () => setOpen(false) }, icon('chevd', 16));
  ui.yt = h('div', { class: 'bgm-yt', 'aria-hidden': 'true' }, h('div'));
  S.el = h('div', { class: 'bgm', role: 'region', 'aria-label': '배경음악' },
    ui.disc,
    h('div', { class: 'bgm-panel' },
      h('div', { class: 'bgm-title' }, ui.title),
      h('div', { class: 'bgm-row' }, ui.play, ui.next, h('div', { class: 'bgm-bar' }, ui.seek), ui.time,
        h('div', { class: 'bgm-volbox' }, ui.volBtn, ui.vol), ui.fold)),
    ui.yt);
  document.body.append(S.el);
  return S.el;
}
function setOpen(on) {
  S.el.classList.toggle('open', on);
  ui.disc.setAttribute('aria-expanded', String(on));
  ui.disc.setAttribute('aria-label', on ? '배경음악 접기' : '배경음악 펼치기');
  store.set(OPEN_KEY, on ? '1' : '0');
}
const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function paint() {
  if (!S.el) return;
  const t = S.tracks[S.order[S.at]];
  S.el.classList.toggle('playing', S.playing);
  ui.play.replaceChildren(icon(S.playing ? 'pause' : 'play', 16));
  ui.ico.replaceChildren(icon(S.playing ? 'pause' : 'music', 15));
  ui.play.setAttribute('aria-label', S.playing ? '일시정지' : '재생');
  ui.next.disabled = S.tracks.length < 2;
  ui.volBtn.replaceChildren(icon(S.muted || S.vol === 0 ? 'volx' : 'vol', 16));
  ui.vol.value = String(S.muted ? 0 : S.vol);
  ui.vol.style.setProperty('--p', (S.muted ? 0 : S.vol) + '%');
  if (t) {
    const name = t.t || (S.player && S.ready && S.player.getVideoData?.().video_id === t.id ? S.player.getVideoData().title : '') || '배경음악';
    if (ui.title.textContent !== name) { ui.title.textContent = name; marquee(); }
    ui.art.style.backgroundImage = `url("${ytThumb(t.id)}")`;
  }
}
// 제목이 길면 천천히 흘러가요
function marquee() {
  requestAnimationFrame(() => {
    const box = ui.title.parentElement;
    const over = ui.title.scrollWidth - box.clientWidth;
    ui.title.style.setProperty('--mq', over > 4 ? `-${over + 12}px` : '0px');
    ui.title.classList.toggle('mq', over > 4);
  });
}
function tick() {
  clearInterval(S.timer);
  S.timer = setInterval(() => {
    if (!S.player || !S.ready || !S.el?.isConnected) return;
    const d = S.player.getDuration?.() || 0, c = S.player.getCurrentTime?.() || 0;
    if (document.activeElement !== ui.seek) {
      const v = d ? Math.round(c / d * 1000) : 0;
      ui.seek.value = String(v);
      ui.seek.style.setProperty('--p', v / 10 + '%');
    }
    ui.time.textContent = fmt(c);
  }, 500);
}

// ── 재생 ──
function setVol(v) {
  S.vol = Math.max(0, Math.min(100, Math.round(v)));
  S.muted = S.vol === 0;
  store.set(VOL_KEY, String(S.vol));
  if (S.player && S.ready) { S.player.setVolume(S.vol); S.muted ? S.player.mute() : S.player.unMute(); }
  paint();
}
function setMuted(m) {
  S.muted = m;
  if (!m && S.vol === 0) S.vol = 40;
  if (S.player && S.ready) { m ? S.player.mute() : (S.player.unMute(), S.player.setVolume(S.vol)); }
  paint();
}
async function ensurePlayer() {
  if (S.player) return true;
  const t = S.tracks[S.order[S.at]];
  if (!t) return false;
  S.starting = true;
  let YT;
  try { YT = await loadApi(); } catch (e) { S.starting = false; toast(e.message); return false; }
  const host = ui.yt.firstChild;
  S.player = new YT.Player(host, {
    width: '200', height: '113', videoId: t.id,
    playerVars: { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, rel: 0, fs: 0, iv_load_policy: 3, modestbranding: 1 },
    events: {
      onReady: (e) => { S.ready = true; S.starting = false; e.target.setVolume(S.vol); if (S.muted) e.target.mute(); e.target.playVideo(); tick(); paint(); },
      onStateChange: (e) => {
        if (e.data === 1) { S.playing = true; S.fails = 0; }
        else if (e.data === 2 || e.data === -1 || e.data === 5) S.playing = false;
        else if (e.data === 0) { S.playing = false; step(1, true); }
        paint();
      },
      // 101·150: 퍼가기를 막아 둔 영상, 100: 없는 영상 → 다음 곡으로
      onError: () => {
        S.fails++;
        if (S.fails >= S.tracks.length) { S.playing = false; paint(); toast('재생할 수 있는 곡이 없어요 (퍼가기가 막힌 영상일 수 있어요)'); return; }
        toast('이 곡은 재생할 수 없어서 넘어가요');
        step(1, true);
      },
    },
  });
  return true;
}
async function toggle() {
  if (!S.tracks.length || S.starting) return;
  if (!S.player) { await ensurePlayer(); return; }
  if (!S.ready) return;
  if (S.playing) S.player.pauseVideo(); else S.player.playVideo();
}
function step(d, auto = false) {
  if (!S.tracks.length) return;
  if (S.tracks.length < 2 && !auto) return;
  S.at = (S.at + d + S.order.length) % S.order.length;
  const t = S.tracks[S.order[S.at]];
  if (S.player && S.ready) S.player.loadVideoById(t.id);
  ui.seek.value = '0'; ui.seek.style.setProperty('--p', '0%'); ui.time.textContent = '0:00';
  paint();
}
function stop() {
  clearInterval(S.timer);
  try { S.player?.destroy(); } catch { /* */ }
  S.player = null; S.ready = false; S.playing = false; S.starting = false;
  if (ui.yt) ui.yt.replaceChildren(h('div'));
}
const shuffled = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ── 화면과 연결 ──
/** 화면이 바뀔 때마다 처음에 불러요 (app.js) */
export function bgmRouteStart() { S.claimed = false; }
/** 화면을 다 그린 뒤 불러요. 이번 화면이 배경음악을 쓰지 않았으면 멈추고 숨겨요 */
export function bgmSettle() {
  if (S.claimed || !S.el) return;
  stop();
  S.key = ''; S.sig = '';
  S.el.hidden = true;
}
/**
 * 블로그·글 화면에서 그 블로그 주인의 배경음악을 띄워요.
 * key: 블로그 주인 uid, cfg: theme.bgm (sanitize 된 값)
 */
export function useBgm(key, cfg) {
  const tracks = cfg?.on !== false ? (cfg?.tracks || []) : [];
  if (!tracks.length) { S.claimed = false; return; }
  S.claimed = true;
  build();
  S.el.hidden = false;
  const sig = key + '|' + tracks.map((t) => t.id).join(',') + '|' + (cfg.shuffle ? 1 : 0);
  if (S.key === key && S.sig === sig) { paint(); return; }
  // 다른 블로그(또는 바뀐 목록): 새로 준비해요 (재생은 누를 때부터)
  stop();
  S.key = key; S.sig = sig;
  S.tracks = tracks;
  S.order = cfg.shuffle ? shuffled(tracks.length) : [...tracks.keys()];
  S.at = 0; S.fails = 0;
  const saved = store.get(VOL_KEY);
  S.vol = saved != null && Number.isFinite(+saved) ? +saved : (cfg.vol ?? 60);
  S.muted = S.vol === 0;
  setOpen(store.get(OPEN_KEY) !== '0');   // 처음엔 펼쳐서 보여주고, 접으면 다음부터 접힌 채로
  ui.seek.value = '0'; ui.seek.style.setProperty('--p', '0%'); ui.time.textContent = '0:00';
  paint();
  if (cfg.auto) ensurePlayer();   // 브라우저가 막으면 재생 버튼을 누를 때 시작돼요
}
