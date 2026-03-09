// =====================================================
// auth.js - Supabase Google OAuth 로그인/로그아웃 처리
// =====================================================

const SUPABASE_URL = "https://gnpeluvwykdiadwniled.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_w7r4IY60O392RTqPmUGRhg_rs_pJKuF";

// Supabase JS 클라이언트 초기화
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

// 현재 세션 (전역)
window._motiverseSession = null;

// ─── 세션 토큰 반환 헬퍼 ─────────────────────────────
window.getAuthHeaders = () => {
    const token = window._motiverseSession?.access_token;
    return token ? { "Authorization": `Bearer ${token}` } : {};
};

function updateAuthUI(session) {
    const loginBtn = document.getElementById("loginBtn");
    const userInfo = document.getElementById("userInfo");
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const historyBtn = document.getElementById("historyBtn");
    const bookmarkBtn = document.getElementById("bookmarkBtn");
    const adminBtn = document.getElementById("adminBtn");
    const monitorBtn = document.getElementById("monitorBtn");
    const boardsBtn = document.getElementById("boardsBtn");

    if (session && session.user) {
        window._motiverseSession = session;
        loginBtn.classList.add("hidden");
        userInfo.classList.remove("hidden");
        historyBtn.classList.remove("hidden");
        bookmarkBtn.classList.remove("hidden");
        if (monitorBtn) monitorBtn.classList.remove("hidden");
        if (boardsBtn) boardsBtn.classList.remove("hidden");

        const meta = session.user.user_metadata;
        const displayName = meta?.full_name || meta?.name || session.user.email?.split("@")[0] || "사용자";
        userName.textContent = displayName;

        const avatarUrl = meta?.avatar_url || meta?.picture || "";
        if (avatarUrl) {
            userAvatar.src = avatarUrl;
            userAvatar.style.display = "block";
            userAvatar.onerror = () => { userAvatar.style.display = "none"; };
        } else {
            userAvatar.style.display = "none";
        }

        // 로그인 성공 시 프로필 데이터베이스에 기록 & 관리자 여부 확인
        checkAdminAndUpsertProfile(session.user);

        // 최근 검색어 칩 로드 (한 번만)
        if (window.loadRecentSearchChips && !window._chipsLoaded) {
            window._chipsLoaded = true;
            setTimeout(() => {
                window.loadRecentSearchChips();
                if (typeof window.loadSavedBrandsList === 'function') window.loadSavedBrandsList();
                if (typeof window.loadMonitorState === 'function') window.loadMonitorState();
            }, 500);
        }
    } else {
        window._motiverseSession = null;
        loginBtn.classList.remove("hidden");
        userInfo.classList.add("hidden");
        historyBtn.classList.add("hidden");
        bookmarkBtn.classList.add("hidden");
        if (monitorBtn) monitorBtn.classList.add("hidden");
        if (boardsBtn) boardsBtn.classList.add("hidden");
        if (adminBtn) adminBtn.classList.add("hidden");
    }
}

// ─── 관리자 체크 및 프로필 갱신 (에러 무시 처리 포함) ────
async function checkAdminAndUpsertProfile(user) {
    const adminBtn = document.getElementById("adminBtn");
    if (!adminBtn) return;
    try {
        const { data, error } = await supabaseClient.rpc("upsert_profile_and_check_admin", {
            p_user_id: user.id,
            p_email: user.email
        });
        if (error) {
            console.warn("[Admin Check] RPC 실패 (마이그레이션 적용 전일 수 있습니다):", error.message);
            adminBtn.classList.add("hidden");
            return;
        }
        if (data && data.is_admin) {
            adminBtn.classList.remove("hidden");
        } else {
            adminBtn.classList.add("hidden");
        }
    } catch (e) {
        console.warn("[Admin Check] 예외 발생:", e.message);
        adminBtn.classList.add("hidden");
    }

    // 이어서 온보딩 프로필 체크 실행
    await checkProfileOnboarding();
}

// ─── 온보딩 체크 (이름, 회사, 부서) ────────────────────
async function checkProfileOnboarding() {
    const modal = document.getElementById("profileOnboardingModal");
    if (!modal) return;
    try {
        const { data, error } = await supabaseClient.rpc("get_my_profile");
        if (error || !data) {
            console.warn("[Onboarding Check] RPC 실패 (마이그레이션 전일 수 있습니다):", error?.message);
            return;
        }

        // 필수 정보가 하나라도 없으면 온보딩 팝업 표시
        if (!data.full_name || !data.company_id || !data.department) {
            const { data: companies, error: compErr } = await supabaseClient.rpc("get_companies");
            if (!compErr && companies) {
                const select = document.getElementById("onboardCompany");
                select.innerHTML = '<option value="" disabled selected>회사 선택</option>';
                companies.forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                });
            }

            // 기존 데이터가 있다면 채워줌 (부분 수정 방지)
            if (data.full_name) document.getElementById("onboardName").value = data.full_name;
            if (data.department) document.getElementById("onboardDept").value = data.department;

            modal.classList.remove("hidden");

            const btn = document.getElementById("saveOnboardBtn");
            btn.onclick = async () => {
                const companyId = document.getElementById("onboardCompany").value;
                const dept = document.getElementById("onboardDept").value.trim();
                const name = document.getElementById("onboardName").value.trim();

                if (!companyId || !dept || !name) {
                    alert("모든 정보(소속 회사, 부서명, 이름)를 입력해 주세요.");
                    return;
                }

                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 저장 중...';
                btn.disabled = true;

                const { error: saveErr } = await supabaseClient.rpc("update_my_profile", {
                    p_full_name: name,
                    p_company_id: companyId,
                    p_department: dept
                });

                if (saveErr) {
                    alert("저장에 실패했습니다. 다시 시도해 주세요.");
                    btn.innerHTML = '저장 및 시작하기';
                    btn.disabled = false;
                } else {
                    modal.classList.add("hidden");
                }
            };
        }
    } catch (e) {
        console.warn("[Onboarding Check] 예외 발생:", e.message);
    }
}

// ─── 구글 로그인 ─────────────────────────────────────
async function signInWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin }
    });
    if (error) console.error("Google 로그인 오류:", error.message);
}

// ─── 로그아웃 ────────────────────────────────────────
async function signOut() {
    await supabaseClient.auth.signOut();
    window._motiverseSession = null;
    updateAuthUI(null);
}

// ─── 초기화: 현재 세션 확인 및 변경 감지 ─────────────
async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    updateAuthUI(session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session);
    });

    // 버튼 이벤트 바인딩
    document.getElementById("loginBtn")?.addEventListener("click", signInWithGoogle);
    document.getElementById("logoutBtn")?.addEventListener("click", signOut);
}

document.addEventListener("DOMContentLoaded", initAuth);

// ─── Supabase DB 직접 접근 함수 (프론트에서 직접 저장) ──
window.saveHistoryToDB = async (query, platform, country, adsData) => {
    if (!window._motiverseSession) {
        console.log("[히스토리] 세션 없음 - 저장 건너뜀");
        return null;
    }
    const userId = window._motiverseSession.user.id;
    // ads_data 경량화: 핵심 필드만 추출 (payload 크기 축소)
    const slimAds = (adsData || []).slice(0, 100).map(ad => ({
        ad_id: ad.ad_id,
        brand: ad.brand,
        platform: ad.platform,
        media_url: ad.media_url,
        media_type: ad.media_type,
        image_url: ad.image_url,
        body: ad.body ? ad.body.slice(0, 200) : '',
        active_days: ad.active_days,
        direct_link: ad.direct_link,
        analysis_report: ad.analysis_report ? {
            hook: ad.analysis_report.hook ? ad.analysis_report.hook.slice(0, 300) : '',
            body: ad.analysis_report.body ? ad.analysis_report.body.slice(0, 300) : '',
        } : null,
    }));
    console.log(`[히스토리 저장 시도] query="${query}", ads=${slimAds.length}건, userId=${userId.slice(0, 8)}...`);
    try {
        const { data, error } = await supabaseClient
            .from("search_history")
            .insert({ user_id: userId, query, platform, country, ads_data: slimAds })
            .select()
            .single();
        if (error) {
            console.error("[히스토리 저장 실패]", error.code, error.message, error.details, error.hint);
        } else {
            console.log("[히스토리 저장 성공]", data?.id);
        }
        return data;
    } catch (e) {
        console.error("[히스토리 저장 예외]", e);
        return null;
    }
};

window.loadHistoryFromDB = async () => {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("search_history")
            .select("id, query, platform, ads_data, created_at")
            .order("created_at", { ascending: false })
            .limit(50);
        if (error) {
            console.error("[히스토리 조회 실패]", error.code, error.message, error.details);
            return [];
        }
        console.log("[히스토리 조회 성공]", data?.length, "건");
        return data || [];
    } catch (e) { console.error("[히스토리 조회 예외]", e); return []; }
};

window.loadHistoryDetailFromDB = async (id) => {
    if (!window._motiverseSession) return null;
    try {
        const { data, error } = await supabaseClient
            .from("search_history")
            .select("*")
            .eq("id", id)
            .single();
        if (error) { console.warn("히스토리 상세 오류:", error.message); return null; }
        return data;
    } catch (e) { return null; }
};

window.saveBookmarkToDB = async (adData, query, platform) => {
    if (!window._motiverseSession) return null;
    const userId = window._motiverseSession.user.id;
    try {
        const { data, error } = await supabaseClient
            .from("bookmarks")
            .insert({ user_id: userId, ad_data: adData, query, platform })
            .select()
            .single();
        if (error) console.warn("[북마크 저장 오류]", error.code, error.message);
        else console.log("[북마크 저장 성공]", data?.id);
        return data;
    } catch (e) { console.warn("북마크 저장 실패:", e); return null; }
};

window.deleteBookmarkFromDB = async (id) => {
    if (!window._motiverseSession) return;
    try {
        const { error } = await supabaseClient.from("bookmarks").delete().eq("id", id);
        if (error) console.warn("북마크 삭제 오류:", error.message);
    } catch (e) { }
};

window.loadBookmarksFromDB = async () => {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("bookmarks")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) { console.warn("북마크 조회 오류:", error.message); return []; }
        return data || [];
    } catch (e) { return []; }
};

// ─── [모니터링] 폴더/경쟁사 DB API ───
window.loadMonitorFoldersDB = async () => {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("monitor_folders")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) { console.warn("폴더 로드 에러", error); return []; }
        return data || [];
    } catch (e) { return []; }
};

window.saveMonitorFolderDB = async (name) => {
    if (!window._motiverseSession) return null;
    try {
        const { data, error } = await supabaseClient
            .from("monitor_folders")
            .insert({ user_id: window._motiverseSession.user.id, name })
            .select().single();
        if (error) { console.warn("폴더 저장 에러", error); return null; }
        return data;
    } catch (e) { return null; }
};

window.deleteMonitorFolderDB = async (id) => {
    if (!window._motiverseSession) return;
    try { await supabaseClient.from("monitor_folders").delete().eq("id", id); } catch (e) { }
};

window.renameMonitorFolderDB = async (id, newName) => {
    if (!window._motiverseSession) return;
    try { await supabaseClient.from("monitor_folders").update({ name: newName }).eq("id", id); } catch (e) { }
};

window.loadMonitoredBrandsDB = async () => {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("monitored_brands")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) { console.warn("모니터링 브랜드 로드 에러", error); return []; }
        return data || [];
    } catch (e) { return []; }
};

window.saveMonitoredBrandDB = async (brandData) => {
    if (!window._motiverseSession) return null;
    try {
        const { data, error } = await supabaseClient
            .from("monitored_brands")
            .insert({ ...brandData, user_id: window._motiverseSession.user.id })
            .select().single();
        if (error) { console.warn("모니터링 브랜드 저장 에러", error); return null; }
        return data;
    } catch (e) { return null; }
};

window.updateMonitoredBrandDB = async (id, updates) => {
    if (!window._motiverseSession) return;
    try { await supabaseClient.from("monitored_brands").update(updates).eq("id", id); } catch (e) { }
};

window.deleteMonitoredBrandDB = async (id) => {
    if (!window._motiverseSession) return;
    try { await supabaseClient.from("monitored_brands").delete().eq("id", id); } catch (e) { }
};

// ─── [크리에이티브 스튜디오] 브랜드 DB API ───
window.loadUserBrandsDB = async () => {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("user_brands")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) { console.warn("유저 브랜드 로드 에러", error); return []; }
        return data || [];
    } catch (e) { return []; }
};

window.saveUserBrandDB = async (brandData) => {
    if (!window._motiverseSession) return null;
    try {
        const { data, error } = await supabaseClient
            .from("user_brands")
            .insert({ ...brandData, user_id: window._motiverseSession.user.id })
            .select().single();
        if (error) { console.warn("유저 브랜드 저장 에러", error); return null; }
        return data;
    } catch (e) { return null; }
};

