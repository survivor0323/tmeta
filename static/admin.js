// admin.js - 관리자 대시보드 전용 스크립트
let globalAdminData = null;

const PLATFORM_LABELS = { meta: 'Meta', tiktok: 'TikTok', instagram: 'Instagram', google: 'Google Ads' };

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 로그인 상태 대기 및 체크
    await checkAdminAccess();

    // 2. 탭 전환 이벤트 리스너
    const adminTabs = document.querySelectorAll('.admin-tabs .tab-chip');
    const adminPanels = document.querySelectorAll('.admin-view-panel');
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            adminPanels.forEach(p => p.classList.add('hidden'));
            const targetId = tab.dataset.target;
            document.getElementById(targetId)?.classList.remove('hidden');
        });
    });

    // 3. 개별 유저 선택 이벤트
    const detailUserSelect = document.getElementById('detailUserSelect');
    detailUserSelect.addEventListener('change', (e) => {
        if (!e.target.value) {
            document.getElementById('userDetailData').classList.add('hidden');
            document.getElementById('userDetailEmpty').classList.remove('hidden');
        } else {
            document.getElementById('userDetailEmpty').classList.add('hidden');
            renderUserDetail(e.target.value);
            document.getElementById('userDetailData').classList.remove('hidden');
        }
    });
});

async function checkAdminAccess() {
    // 세션 지연 로드 대응
    let ms = 0;
    while (!window._motiverseSession && ms < 3000) {
        await new Promise(r => setTimeout(r, 100));
        ms += 100;
    }

    if (!window._motiverseSession) {
        alert("로그인이 필요합니다. 메인 화면으로 돌아갑지다.");
        window.location.href = "/";
        return;
    }

    // 이름 세팅
    const user = window._motiverseSession.user;
    document.getElementById('adminEmailDisplay').innerText = user.email;

    // 관리자 여부는 rpc 호출 결과로 직통 검증
    await loadAdminData();
}

async function loadAdminData() {
    const loading = document.getElementById('adminLoading');
    const content = document.getElementById('adminContent');
    loading.classList.remove('hidden');
    content.classList.add('hidden');

    try {
        const { data, error } = await window.supabaseClient.rpc('get_admin_dashboard_data');
        if (error) {
            // 권한이 없거나 마이그레이션이 안됨
            console.error(error);
            alert("관리자 권한이 없거나 마이그레이션이 되지 않았습니다.\n(메인 화면으로 이동합니다)\n" + error.message);
            window.location.href = "/";
            return;
        }

        globalAdminData = data;
        renderOverview(data);
        renderUsers(data.users);
        populateUserDetailSelect(data.users);
        renderAllQueries(data.history);

        content.classList.remove('hidden');
    } catch (e) {
        console.error("Admin Load Error", e);
        alert(`데이터를 가져오는 데 실패했습니다.\n\n[상세 에러 내용]\n${e.message || JSON.stringify(e)}`);
    } finally {
        loading.classList.add('hidden');
    }
}

function renderOverview(data) {
    const users = data.users || [];
    const history = data.history || [];
    const usage = data.api_usage || [];

    document.getElementById('statTotalUsers').innerText = users.length;
    document.getElementById('statTotalSearches').innerText = history.length;
    document.getElementById('statTotalApi').innerText = usage.length;
    const totalTokens = usage.reduce((sum, item) => sum + (item.tokens_used || 0), 0);
    document.getElementById('statTotalTokens').innerText = totalTokens.toLocaleString();
}

function renderUsers(users) {
    const tbody = document.getElementById('adminUsersTbody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.email}</strong></td>
            <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
            <td>${u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
            <td>${u.is_admin ? '<span style="color:#10b981;font-weight:600;"><i class="fa-solid fa-shield-halved"></i> 관리자</span>' : '일반'}</td>
            <td>
                <button class="toggle-admin-btn ${u.is_admin ? 'is-admin' : ''}" 
                        data-email="${u.email}" data-status="${u.is_admin}">
                    ${u.is_admin ? '권한 해제' : '권한 지정'}
                </button>
            </td>
        </tr>
    `).join('');

    // Toggle Admin Button
    document.querySelectorAll('.toggle-admin-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const email = e.currentTarget.dataset.email;
            const currentStatus = e.currentTarget.dataset.status === 'true';
            if (confirm(`${email}님의 관리자 권한을 ${currentStatus ? '해제' : '부여'}하시겠습니까?`)) {
                const { error: rpcErr } = await window.supabaseClient.rpc('toggle_admin_status', {
                    target_email: email,
                    assign_admin: !currentStatus
                });
                if (rpcErr) {
                    alert("권한 변경 실패: " + rpcErr.message);
                } else {
                    alert("정상 처리되었습니다.");
                    loadAdminData();
                }
            }
        });
    });
}

// ─── 페이징 및 필터용 전역 상태 ────────────────────────
let udCurrentPage = 1;
let bmkCurrentPage = 1;
let gqCurrentPage = 1;
const ITEMS_PER_PAGE = 20;

function filterByDate(dataArray, startStr, endStr) {
    if (!startStr && !endStr) return dataArray;
    let start = startStr ? new Date(startStr) : new Date('1970-01-01');
    let end = endStr ? new Date(endStr) : new Date('2099-12-31');
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return dataArray.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= start && itemDate <= end;
    });
}

function renderPaginationControls(containerId, totalItems, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    let html = '';

    if (currentPage > 1) {
        html += `<button class="btn" style="padding:0.2rem 0.6rem;" onclick="${onPageChange}(${currentPage - 1})">&lt;</button>`;
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const activeStyle = i === currentPage ? 'background:var(--accent-indigo);color:white;' : 'background:transparent;color:var(--text-main);';
        html += `<button class="btn" style="padding:0.2rem 0.6rem; ${activeStyle}" onclick="${onPageChange}(${i})">${i}</button>`;
    }

    if (currentPage < totalPages) {
        html += `<button class="btn" style="padding:0.2rem 0.6rem;" onclick="${onPageChange}(${currentPage + 1})">&gt;</button>`;
    }

    container.innerHTML = html;
}

window.changeUdHistoryPage = function (page) {
    udCurrentPage = page;
    const userId = document.getElementById('detailUserSelect').value;
    if (userId) renderUserDetail(userId);
};

window.changeUdBookmarkPage = function (page) {
    bmkCurrentPage = page;
    const userId = document.getElementById('detailUserSelect').value;
    if (userId) renderUserDetail(userId);
};

window.changeGqPage = function (page) {
    gqCurrentPage = page;
    renderAllQueries(globalAdminData?.history || []);
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('udDateFilterBtn')?.addEventListener('click', () => {
        udCurrentPage = 1;
        bmkCurrentPage = 1;
        const userId = document.getElementById('detailUserSelect').value;
        if (userId) renderUserDetail(userId);
    });

    document.getElementById('udDateResetBtn')?.addEventListener('click', () => {
        document.getElementById('udStartDate').value = '';
        document.getElementById('udEndDate').value = '';
        udCurrentPage = 1;
        bmkCurrentPage = 1;
        const userId = document.getElementById('detailUserSelect').value;
        if (userId) renderUserDetail(userId);
    });

    document.getElementById('gqDateFilterBtn')?.addEventListener('click', () => {
        gqCurrentPage = 1;
        renderAllQueries(globalAdminData?.history || []);
    });

    document.getElementById('gqDateResetBtn')?.addEventListener('click', () => {
        document.getElementById('gqStartDate').value = '';
        document.getElementById('gqEndDate').value = '';
        gqCurrentPage = 1;
        renderAllQueries(globalAdminData?.history || []);
    });
});

function populateUserDetailSelect(users) {
    const select = document.getElementById('detailUserSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- 사용자를 선택하세요 --</option>';
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.user_id;
        opt.textContent = `${u.email} ${u.is_admin ? '(관리자)' : ''}`;
        select.appendChild(opt);
    });
}

function renderAllQueries(history) {
    const startStr = document.getElementById('gqStartDate')?.value;
    const endStr = document.getElementById('gqEndDate')?.value;
    const filteredHistory = filterByDate(history, startStr, endStr);

    const startIndex = (gqCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedHistory = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const tbody = document.getElementById('adminQueriesTbody');
    if (!tbody) return;

    if (paginatedHistory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">검색 이력이 없습니다.</td></tr>';
    } else {
        tbody.innerHTML = paginatedHistory.map(h => `
            <tr>
                <td>${h.email || '알 수 없음'}</td>
                <td><strong>${h.query}</strong></td>
                <td><span class="platform-badge">${PLATFORM_LABELS[h.platform] || h.platform}</span></td>
                <td>${h.created_at ? new Date(h.created_at).toLocaleString() : '-'}</td>
            </tr>
        `).join('');
    }

    renderPaginationControls('adminQueriesPagination', filteredHistory.length, gqCurrentPage, 'changeGqPage');
}

function renderUserDetail(userId) {
    if (!globalAdminData) return;

    const startStr = document.getElementById('udStartDate')?.value;
    const endStr = document.getElementById('udEndDate')?.value;

    let history = (globalAdminData.history || []).filter(h => h.user_id === userId);
    let usage = (globalAdminData.api_usage || []).filter(u => u.user_id === userId);
    let bookmarks = (globalAdminData.bookmarks || []).filter(b => b.user_id === userId);

    history = filterByDate(history, startStr, endStr);
    usage = filterByDate(usage, startStr, endStr);
    bookmarks = filterByDate(bookmarks, startStr, endStr);

    const totalToken = usage.reduce((s, u) => s + (u.tokens_used || 0), 0);

    // 1. 스탯 갱신
    document.getElementById('udTotalSearch').innerText = history.length;
    document.getElementById('udTotalBookmark').innerText = bookmarks.length;
    document.getElementById('udTotalToken').innerText = totalToken.toLocaleString();

    // 2. 사용자 검색 이력 테이블
    const hBody = document.getElementById('udHistoryTbody');
    const hStartIndex = (udCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedHistory = history.slice(hStartIndex, hStartIndex + ITEMS_PER_PAGE);

    if (paginatedHistory.length === 0) {
        hBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">검색 이력이 없습니다.</td></tr>';
    } else {
        hBody.innerHTML = paginatedHistory.map(h => `
            <tr>
                <td><strong>${h.query}</strong></td>
                <td><span class="platform-badge">${PLATFORM_LABELS[h.platform] || h.platform}</span></td>
                <td>${h.country || 'Global'}</td>
                <td>${h.created_at ? new Date(h.created_at).toLocaleString() : '-'}</td>
            </tr>
        `).join('');
    }
    renderPaginationControls('udHistoryPagination', history.length, udCurrentPage, 'changeUdHistoryPage');

    // 3. 사용자 북마크 테이블
    const bBody = document.getElementById('udBookmarkTbody');
    const bStartIndex = (bmkCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedBookmarks = bookmarks.slice(bStartIndex, bStartIndex + ITEMS_PER_PAGE);

    if (paginatedBookmarks.length === 0) {
        bBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">북마크 내역이 없습니다.</td></tr>';
    } else {
        bBody.innerHTML = paginatedBookmarks.map(b => {
            const ad = b.ad_data || {};
            return `
            <tr>
                <td><strong>${b.query || '없음'}</strong></td>
                <td>${ad.brand || '알 수 없음'} <span style="font-size:0.8rem;color:#64748b;">(${PLATFORM_LABELS[b.platform] || b.platform})</span></td>
                <td>${b.created_at ? new Date(b.created_at).toLocaleString() : '-'}</td>
            </tr>
        `}).join('');
    }
    renderPaginationControls('udBookmarkPagination', bookmarks.length, bmkCurrentPage, 'changeUdBookmarkPage');
}
