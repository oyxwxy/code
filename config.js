// ───────── 설정 ─────────
export const firebaseConfig = {
  apiKey: "AIzaSyCPcmzZ7K61n7GYG6TuozrOxlr10bqcUcQ",
  authDomain: "code-94e7e.firebaseapp.com",
  projectId: "code-94e7e",
  storageBucket: "code-94e7e.firebasestorage.app",
  messagingSenderId: "232867379460",
  appId: "1:232867379460:web:048d2fd7b38cb05128f851",
  measurementId: "G-4XQ5NKRR9N"
};

export const APP_NAME = 'Drawer';

// 아이디를 Firebase 이메일 로그인용 주소로 바꿀 때 쓰는 가짜 도메인 (실제 메일은 발송되지 않아요)
export const AUTH_DOMAIN = 'pbox.local';

export const MAX_IMAGES = 12;          // 글 하나당 이미지 최대 장수

// 새 기능을 먼저 테스트할 계정. 관리자이거나 여기 적힌 아이디면 isBeta() 가 true 예요.
// 새 기능은 `if (isBeta()) { … }` 로 감싸서 올리고, 문제없으면 감싼 걸 풀어 전체에 적용하세요.
export const BETA_HANDLES = ['wxyz'];

// 배너 기능: true 면 전체 공개(로그인 안 한 방문자도 봐요). false 면 관리자·BETA_HANDLES 에게만 보여요.
export const NEIGHBORS_FOR_ALL = true;

// 디데이 기능: true 면 전체 공개. false 면 관리자·BETA_HANDLES 에게만 보여요.
export const DDAY_FOR_ALL = true;

// 대문 배너 슬라이드(여러 장 자동 넘김): true 면 전체 공개. false 면 관리자·BETA_HANDLES 에게만 보여요.
export const BANNER_SLIDE_FOR_ALL = true;

// 스킨(페이지 스킨 · 프롬 모음 · 프롬창): true 면 전체 공개. false 면 관리자·BETA_HANDLES 에게만 보이고 고를 수 있어요.
export const SKINS_FOR_ALL = true;
// 아직 테스트 중인 페이지 스킨: 여기 적힌 스킨은 관리자·BETA_HANDLES 만 고르고 볼 수 있어요 (다른 사람에게는 스킨 없이 보여요). 공개하려면 목록에서 빼요.
export const BETA_SKINS = [];   // 비어 있으면 전부 공개
// 아직 테스트 중인 프롬 모음(글 목록) 스킨: 관리자·BETA_HANDLES 만
export const BETA_SHELVES = [];   // 비어 있으면 전부 공개
// 아직 테스트 중인 프롬창(글 보기) 스킨: 관리자·BETA_HANDLES 만
export const BETA_PVIEWS = [];   // 비어 있으면 전부 공개

// 이미지 호스팅(ImgBB) API 키. 브라우저 코드에 들어가므로 공개된다는 점을 알고 쓰세요
export const IMGBB_KEY = 'cd95c1a1e9387659cd79b2b33902dce1';
