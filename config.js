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

// 이웃 배너 기능: false 면 관리자·BETA_HANDLES 에게만 보여요. 전체에 열려면 true 로 바꾸세요.
export const NEIGHBORS_FOR_ALL = false;

// 디데이 기능: false 면 관리자·BETA_HANDLES 에게만 보여요. 전체에 열려면 true.
export const DDAY_FOR_ALL = false;

// 이미지 호스팅(ImgBB) API 키. 브라우저 코드에 들어가므로 공개된다는 점을 알고 쓰세요
export const IMGBB_KEY = 'cd95c1a1e9387659cd79b2b33902dce1';
