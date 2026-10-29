// 글 종류 3가지
export const KINDS = {
  style:     { label: '그림체',   desc: '그림체 프롬 · 부정 · 생성 설정', icon: 'palette' },
  character: { label: '캐릭터',   desc: '캐릭터 프롬 + 의상 등 변형',     icon: 'user' },
  scene:     { label: '배포 프롬', desc: '상황·꾸밈 프롬',                 icon: 'sparkle' },
};
/** 예전 글(kind 없음)은 그림체로 취급 */
export const kindOf = (p) => (KINDS[p?.kind] ? p.kind : 'style');
