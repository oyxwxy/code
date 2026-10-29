// 글 종류 3가지
export const KINDS = {
  style:     { label: '그림체',   desc: '그림체 프롬 · 부정 · 생성 설정', icon: 'palette' },
  character: { label: '캐릭터',   desc: '캐릭터 프롬 + 의상 등 변형',     icon: 'user' },
  scene:     { label: '배포 프롬', desc: '상황·꾸밈 프롬',                 icon: 'sparkle' },
};
/** 예전 글(kind 없음)은 그림체로 취급 */
export const kindOf = (p) => (KINDS[p?.kind] ? p.kind : 'style');

// 글쓴이가 정한 종류별 이름 · 공개 여부 (테마에 저장돼요. applyTheme이 여기로 흘려 넣어요)
export const MAX_KIND_NAME = 12;
const prefs = {};
export function setKindPrefs(p) {
  for (const k of Object.keys(KINDS)) {
    prefs[k] = { show: p?.[k]?.show !== false, name: typeof p?.[k]?.name === 'string' ? p[k].name.trim().slice(0, MAX_KIND_NAME) : '' };
  }
}
setKindPrefs({});
export const kindLabel = (k) => prefs[k]?.name || KINDS[k]?.label || '';
export const kindShown = (k) => prefs[k]?.show !== false;
