import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export * from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
export * from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'ko';   // 비밀번호 재설정·확인 메일을 한국어로
export const db = getFirestore(app);
