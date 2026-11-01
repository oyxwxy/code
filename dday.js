// 디데이: 커플 계산(D+N, 100일·주년 기념일) + 일반 디데이. 날짜는 모두 '내 기기의 오늘' 기준이에요.
import { h, icon, modal, txt } from './util.js';

const DAY = 86400000;
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD' → 그날 0시(로컬). 없는 날짜면 null */
export function parseDay(s) {
  if (!YMD_RE.test(s || '')) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}
export const todayStart = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
const diffDays = (a, b) => Math.round((a - b) / DAY);   // a - b (일)
const ymdDots = (s) => s.replaceAll('-', '.');

/** 카드에 크게 보여줄 글자: 커플은 D+N(만난 지 N일), 일반은 D-N / D-DAY / D+N */
export function ddayText(e, today = todayStart()) {
  const d = parseDay(e.date);
  if (!d) return '';
  const n = diffDays(today, d);
  if (e.kind === 'couple') return n >= 0 ? `D+${n}` : `D${n}`;
  return n === 0 ? 'D-DAY' : n < 0 ? `D${n}` : `D+${n}`;   // n<0 → 'D-12'
}

/** 앞으로 다가올(오늘 포함) 가장 가까운 기념일들 */
function upcoming(e, today) {
  const d = parseDay(e.date);
  if (!d) return [];
  if (e.kind !== 'couple') return diffDays(d, today) >= 0 ? [{ diff: diffDays(d, today), label: '' }] : [];
  const out = [];
  const n = diffDays(today, d);
  const k = Math.max(1, Math.ceil(n / 100));              // 다음 100일 단위
  out.push({ diff: k * 100 - n, label: `${k * 100}일` });
  for (let y = 1; y <= 100; y++) {                         // n주년 (같은 월·일)
    const a = new Date(d.getFullYear() + y, d.getMonth(), d.getDate());
    if (a.getMonth() !== d.getMonth()) continue;           // 2/29 → 없는 해는 건너뜀
    const df = diffDays(a, today);
    if (df >= 0) { out.push({ diff: df, label: `${y}주년` }); break; }
  }
  return out;
}

/** 가장 가까운 기념일 하나. 예정이 없으면 첫 항목의 현재 D값 */
export function nearest(list, today = todayStart()) {
  let best = null;
  for (const e of list) {
    for (const u of upcoming(e, today)) {
      if (!best || u.diff < best.diff) best = { diff: u.diff, name: e.name, label: u.label };
    }
  }
  if (best) return { text: best.diff === 0 ? 'D-DAY' : `D-${best.diff}`, name: best.name, label: best.label };
  const e = list[0];
  return e ? { text: ddayText(e, today), name: e.name, label: '' } : null;
}

// [카드 배경, 테두리·강조, 글자색(숫자)]
const TINTS = [
  ['#ece8fb', '#b9aef0', '#5b4bc0'], ['#fde3df', '#f4a9a0', '#c2463a'], ['#f6e3f7', '#d9a8e0', '#9a3aab'],
  ['#fde4ec', '#f3a9c1', '#c23a72'], ['#e4f5df', '#a6d79a', '#3f8a31'], ['#e1f0fb', '#9bc7ea', '#2f74b3'], ['#fdf1d9', '#ecc979', '#a87a10'],
];

/** 이름 줄 오른쪽에 붙는 알약: 가장 가까운 기념일. 누르면 전체 목록 */
export function ddayPill(list) {
  const n = nearest(list);
  if (!n) return null;
  const txtLine = `${n.text} · ${txt(n.name)}${n.label ? ' ' + n.label : ''}`;
  return h('button', { class: 'dd-pill', type: 'button', title: '디데이 보기', 'aria-label': '디데이 보기: ' + txtLine, onclick: () => openDdays(list) },
    icon('heart', 14), h('span', { class: 'dd-pill-txt' }, txtLine));
}

/** 'D+1200' → ['D+', '1200'] (D-DAY 는 그대로) */
const splitD = (t) => { const m = /^(D[+-])(\d+)$/.exec(t || ''); return m ? [m[1], m[2]] : ['', t || '']; };

function openDdays(list) {
  const today = todayStart();
  const rows = [...list].sort((a, b) => (a.date < b.date ? -1 : 1));
  const body = h('div', { class: 'dd-wrap' },
    h('div', { class: 'dd-head' }, icon('heart', 16), h('span', null, 'D-DAY'), h('b', null, String(rows.length))),
    h('div', { class: 'dd-list' }, rows.map((e, i) => {
      const [bg, edge, ink] = TINTS[i % TINTS.length];
      const text = ddayText(e, today);
      const [d, n] = splitD(text);
      const card = h('div', { class: 'dd-card' + (text === 'D-DAY' ? ' today' : '') },
        h('div', { class: 'dd-ic' }, txt(e.emoji) || '💗'),
        h('div', { class: 'dd-info' },
          h('div', { class: 'dd-top' },
            h('div', { class: 'dd-name' }, txt(e.name)),
            h('em', { class: 'dd-tag' }, e.kind === 'couple' ? [icon('heart', 11), '커플'] : 'D-DAY')),
          h('div', { class: 'dd-big', 'aria-label': text },
            d ? h('span', { class: 'dd-d' }, d) : null,
            h('span', { class: 'dd-n' + (d ? '' : ' day') }, n)),
          h('div', { class: 'dd-date' }, icon('calendar', 12), ymdDots(e.date))));
      // style 객체로는 CSS 변수가 적용되지 않아서 직접 지정해요
      card.style.setProperty('--dd-bg', bg);
      card.style.setProperty('--dd-edge', edge);
      card.style.setProperty('--dd-ink', ink);
      card.style.setProperty('--i', String(i));
      return card;
    })));
  modal({ body, wide: false });
}
