import { h, icon, debounce } from './util.js';
import { state, checkAdminExists, signIn, signUp, handleAvailable, friendly, normalizeHandle, HANDLE_RE } from './store.js';
import { applyTheme, DEFAULT_THEME } from './theme.js';
import { APP_NAME } from './config.js';

export async function home({ root }) {
  if (state.me) { location.replace('#/u/' + state.me.handle); return; }
  applyTheme(DEFAULT_THEME);
  document.title = APP_NAME;
  let adminExists = true;
  try { adminExists = await checkAdminExists(); } catch { /* 오프라인 등 */ }

  const feats = [
    ['globe', '공개', '링크를 아는 누구나 볼 수 있어요. 내 블로그에도 예쁘게 전시돼요.'],
    ['lock', '비밀번호', '비밀번호를 아는 사람만 열 수 있어요. 내용은 브라우저에서 암호화돼요.'],
    ['eye-off', '비공개', '나만 보는 백업 공간. 이미지와 설정값까지 통째로 보관해요.'],
  ];
  root.append(
    h('section', { class: 'hero' },
      h('div', { class: 'hero-mark' }, icon('sparkle', 26)),
      h('h1', null, '내 프롬프트를,', h('br'), '예쁘게 모아두는 서랍'),
      h('p', { class: 'lead' }, 'NovelAI 프롬프트와 이미지를 백업하고, 링크 하나로 가볍게 공유하세요. 이미지에서 프롬프트를 바로 가져올 수도 있어요.'),
      h('div', { class: 'hero-cta' },
        adminExists
          ? [h('a', { class: 'btn primary lg', href: '#/login' }, '로그인'), h('a', { class: 'btn lg', href: '#/join' }, '초대코드로 가입')]
          : h('a', { class: 'btn primary lg', href: '#/join' }, '관리자 계정 만들기')),
      !adminExists ? h('p', { class: 'hint' }, '아직 관리자가 없어요. 가장 먼저 가입하는 계정이 관리자가 됩니다.') : null),
    h('div', { class: 'feat-grid' }, feats.map(([ic, t, d]) =>
      h('div', { class: 'feat' }, h('div', { class: 'feat-ic' }, icon(ic, 20)), h('h3', null, t), h('p', null, d)))));
}

export async function login({ root, query }) {
  if (state.me) { location.replace('#/u/' + state.me.handle); return; }
  applyTheme(DEFAULT_THEME);
  document.title = '로그인 · ' + APP_NAME;
  const handle = h('input', { class: 'input', autocomplete: 'username', placeholder: '아이디', autocapitalize: 'off', spellcheck: 'false' });
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: '비밀번호' });
  const err = h('div', { class: 'form-err' });
  const btn = h('button', { class: 'btn primary lg block', type: 'submit' }, '로그인');
  root.append(h('div', { class: 'auth-wrap' },
    h('form', {
      class: 'auth-card',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        btn.disabled = true;
        try {
          await signIn(handle.value, pw.value);
          const next = query.get('next');
          location.hash = next ? '#' + next : '#/u/' + state.me.handle;
        } catch (ex) { err.textContent = friendly(ex); }
        finally { btn.disabled = false; }
      },
    },
    h('h2', null, '다시 만나서 반가워요'),
    h('p', { class: 'sub' }, '아이디와 비밀번호로 로그인하세요.'),
    h('div', { class: 'field' }, h('label', null, '아이디'), handle),
    h('div', { class: 'field' }, h('label', null, '비밀번호'), pw),
    err, btn,
    h('p', { class: 'auth-foot' }, '초대코드가 있나요? ', h('a', { href: '#/join' }, '가입하기')))));
  handle.focus();
}

export async function join({ root, params }) {
  if (state.me) { location.replace('#/u/' + state.me.handle); return; }
  applyTheme(DEFAULT_THEME);
  document.title = '가입 · ' + APP_NAME;
  let adminExists = true;
  try { adminExists = await checkAdminExists(); } catch { /* */ }

  const code = h('input', { class: 'input mono', placeholder: '초대코드', value: (params[0] || '').toUpperCase(), autocapitalize: 'characters', spellcheck: 'false' });
  const handle = h('input', { class: 'input', placeholder: '영문 소문자·숫자·_ 3~20자', autocapitalize: 'off', spellcheck: 'false', autocomplete: 'username' });
  const handleMsg = h('div', { class: 'hint-line' });
  const display = h('input', { class: 'input', placeholder: '블로그에 표시될 이름 (나중에 바꿀 수 있어요)', maxlength: '30' });
  const pw = h('input', { class: 'input', type: 'password', placeholder: '6자 이상', autocomplete: 'new-password' });
  const pw2 = h('input', { class: 'input', type: 'password', placeholder: '비밀번호 확인', autocomplete: 'new-password' });
  const err = h('div', { class: 'form-err' });
  const btn = h('button', { class: 'btn primary lg block', type: 'submit' }, adminExists ? '가입하기' : '관리자 계정 만들기');

  const check = debounce(async () => {
    const v = normalizeHandle(handle.value);
    if (!v) { handleMsg.textContent = ''; return; }
    if (!HANDLE_RE.test(v)) { handleMsg.textContent = '영문 소문자·숫자·밑줄(_) 3~20자만 쓸 수 있어요'; handleMsg.className = 'hint-line bad'; return; }
    try {
      const ok = await handleAvailable(v);
      handleMsg.textContent = ok ? '사용할 수 있는 아이디예요' : '이미 사용 중인 아이디예요';
      handleMsg.className = 'hint-line ' + (ok ? 'good' : 'bad');
    } catch { handleMsg.textContent = ''; }
  }, 400);
  handle.addEventListener('input', check);

  root.append(h('div', { class: 'auth-wrap' },
    h('form', {
      class: 'auth-card',
      onsubmit: async (e) => {
        e.preventDefault();
        err.textContent = '';
        if (pw.value !== pw2.value) { err.textContent = '비밀번호가 서로 달라요'; return; }
        btn.disabled = true;
        try {
          await signUp({ handle: handle.value, password: pw.value, display: display.value, inviteCode: code.value });
          location.hash = '#/u/' + state.me.handle;
        } catch (ex) { err.textContent = friendly(ex); }
        finally { btn.disabled = false; }
      },
    },
    h('h2', null, adminExists ? '나만의 서랍 만들기' : '관리자 계정 만들기'),
    h('p', { class: 'sub' }, adminExists ? '초대코드가 있으면 바로 내 공간을 받을 수 있어요.' : '이 사이트의 첫 계정이에요. 이 계정이 관리자가 되고, 초대코드를 만들 수 있어요.'),
    adminExists ? h('div', { class: 'field' }, h('label', null, '초대코드'), code) : null,
    h('div', { class: 'field' }, h('label', null, '아이디'), handle, handleMsg),
    h('div', { class: 'field' }, h('label', null, '표시 이름'), display),
    h('div', { class: 'field' }, h('label', null, '비밀번호'), pw, h('div', { class: 'spacer-8' }), pw2),
    h('p', { class: 'hint-line' }, '비밀번호를 잊으면 복구할 방법이 없어요. 꼭 기억해 두세요.'),
    err, btn,
    h('p', { class: 'auth-foot' }, '이미 계정이 있나요? ', h('a', { href: '#/login' }, '로그인')))));
}
