// content/auth_sync.js
// 이 스크립트는 모티버스 웹앱(localhost 등)에 주입되어, 
// 웹의 localStorage에 있는 Supabase 인증 토큰을 확장 프로그램의 chrome.storage 공유소로 복사합니다.

const SUPABASE_PROJECT_REF = 'gnpeluvwykdiadwniled';
const AUTH_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

function syncAuthToExtension() {
    try {
        const token = window.localStorage.getItem(AUTH_KEY);
        if (token) {
            chrome.storage.local.set({ [AUTH_KEY]: token }, () => {
                // 성공적으로 동기화 됨
            });
        } else {
            chrome.storage.local.remove([AUTH_KEY]);
        }
    } catch (e) {
        console.error("Auth sync error:", e);
    }
}

// 1. 페이지 로드 시 즉시 동기화
syncAuthToExtension();

// 2. 로그인/로그아웃 등 로컬 스토리지 변경 시 동기화 (같은 브라우저의 다른 창 대응)
window.addEventListener('storage', (e) => {
    if (e.key === AUTH_KEY) {
        syncAuthToExtension();
    }
});

// 3. SPA(Single Page App) 특성 상 즉각적인 로그인을 잡기 위해 주기적으로 동기화 체크 (2초마다)
setInterval(syncAuthToExtension, 2000);
