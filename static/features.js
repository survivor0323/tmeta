// ================================================================
// features.js - P1~P4 신규 기능 프론트엔드 로직
// P1: 경쟁사 자동 모니터링
// P3: 보드/컬렉션
// P4: 랜딩페이지 분석
// ================================================================

const PLATFORM_LABELS = {
    meta: 'Meta', instagram: 'Instagram', tiktok: 'TikTok', google: 'Google Ads'
};

document.addEventListener('DOMContentLoaded', () => {

    // ═══════════════════════════════════════════════════
    // P1: 경쟁사 모니터링
    // ═══════════════════════════════════════════════════

    const monitorBtn = document.getElementById('monitorBtn');
    const monitorModal = document.getElementById('monitorModal');

    monitorBtn?.addEventListener('click', () => {
        monitorModal.classList.remove('hidden');
        loadMonitors();
        loadAlerts();
    });

    // 모달 외부 클릭 닫기
    monitorModal?.addEventListener('click', e => {
        if (e.target === monitorModal) monitorModal.classList.add('hidden');
    });

    // 브랜드 등록
    document.getElementById('addMonitorBtn')?.addEventListener('click', async () => {
        const brand = document.getElementById('monitorBrandInput').value.trim();
        const platform = document.getElementById('monitorPlatformSelect').value;
        if (!brand) { alert('브랜드명을 입력하세요.'); return; }
        if (!window._motiverseSession) { alert('로그인이 필요합니다.'); return; }

        try {
            const res = await fetch('/api/v1/monitors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...window.getAuthHeaders() },
                body: JSON.stringify({ brand_name: brand, platform, country: document.getElementById('countryFilter')?.value || 'KR' })
            });
            const json = await res.json();
            if (json.status === 'error') { alert(json.message); return; }
            document.getElementById('monitorBrandInput').value = '';
            loadMonitors();
        } catch (e) { alert('등록 실패: ' + e.message); }
    });

    // 모니터링 목록 로드
    async function loadMonitors() {
        const list = document.getElementById('monitorList');
        if (!list || !window._motiverseSession) return;
        try {
            const res = await fetch('/api/v1/monitors', { headers: window.getAuthHeaders() });
            const json = await res.json();
            if (!json.data || !json.data.length) {
                list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:1rem;">아직 모니터링 중인 브랜드가 없습니다.</p>';
                return;
            }
            list.innerHTML = json.data.map(m => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:0.5rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-weight:600;">${m.brand_name}</span>
                        <span style="font-size:0.75rem;background:#eff6ff;color:#3b82f6;padding:2px 8px;border-radius:100px;">${PLATFORM_LABELS[m.platform] || m.platform}</span>
                        <span style="font-size:0.7rem;color:#94a3b8;">${m.last_checked_at ? '최종: ' + new Date(m.last_checked_at).toLocaleDateString('ko-KR') : '미체크'}</span>
                    </div>
                    <button onclick="deleteMonitor('${m.id}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:1rem;" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = '<p style="color:#ef4444;">목록 로드 실패</p>'; }
    }

    window.deleteMonitor = async (id) => {
        if (!confirm('이 브랜드 모니터링을 삭제하시겠습니까?')) return;
        await fetch(`/api/v1/monitors/${id}`, { method: 'DELETE', headers: window.getAuthHeaders() });
        loadMonitors();
    };

    // 즉시 체크
    document.getElementById('checkNowBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('checkNowBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 체크 중...';
        try {
            const res = await fetch('/api/v1/monitors/check-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...window.getAuthHeaders() }
            });
            const json = await res.json();
            alert(json.message);
            loadAlerts();
            loadMonitors();
        } catch (e) { alert('체크 실패: ' + e.message); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-sync"></i> 지금 체크하기';
        }
    });

    // 알림 목록
    async function loadAlerts() {
        const list = document.getElementById('alertList');
        if (!list || !window._motiverseSession) return;
        try {
            const res = await fetch('/api/v1/monitor-alerts', { headers: window.getAuthHeaders() });
            const json = await res.json();
            const alertDot = document.getElementById('alertDot');

            if (!json.data || !json.data.length) {
                list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:0.5rem;">알림이 없습니다.</p>';
                if (alertDot) alertDot.classList.add('hidden');
                return;
            }

            const unread = json.data.filter(a => !a.is_read).length;
            if (alertDot) {
                if (unread > 0) alertDot.classList.remove('hidden');
                else alertDot.classList.add('hidden');
            }

            list.innerHTML = json.data.slice(0, 20).map(a => `
                <div style="padding:0.6rem;border:1px solid ${a.is_read ? '#e2e8f0' : '#bfdbfe'};border-radius:8px;margin-bottom:0.4rem;background:${a.is_read ? '#fff' : '#eff6ff'};cursor:pointer;" onclick="viewAlertAds('${a.id}', ${JSON.stringify(a.ads_data || []).replace(/"/g, '&quot;')})">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        ${!a.is_read ? '<span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;flex-shrink:0;"></span>' : ''}
                        <strong>${a.brand_name}</strong>
                        <span style="font-size:0.8rem;color:#3b82f6;">${a.new_ads_count}개 새 광고</span>
                        <span style="margin-left:auto;font-size:0.7rem;color:#94a3b8;">${new Date(a.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = '<p style="color:#ef4444;">알림 로드 실패</p>'; }
    }

    // 알림 클릭 → 해당 광고를 메인 그리드에 표시
    window.viewAlertAds = async (alertId, adsData) => {
        // 읽음 처리
        fetch(`/api/v1/monitor-alerts/${alertId}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...window.getAuthHeaders() }
        }).catch(() => { });

        // 모달 닫기
        monitorModal.classList.add('hidden');

        // 광고 렌더링
        if (adsData && adsData.length > 0) {
            window.currentAdsData = adsData;
            window.currentAdsPage = 1;
            const adGrid = document.getElementById('adGrid');
            adGrid.innerHTML = '';
            document.getElementById('resultsSection').classList.remove('hidden');
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('competitorInput').value = `모니터링 알림 소재`;
            if (typeof window.renderAdsPage === 'function') window.renderAdsPage();
        }
    };


    // ═══════════════════════════════════════════════════
    // P3: 보드 / 컬렉션
    // ═══════════════════════════════════════════════════

    const boardsBtn = document.getElementById('boardsBtn');
    const boardModal = document.getElementById('boardModal');

    boardsBtn?.addEventListener('click', () => {
        boardModal.classList.remove('hidden');
        loadBoards();
    });
    boardModal?.addEventListener('click', e => {
        if (e.target === boardModal) boardModal.classList.add('hidden');
    });

    // 보드 생성
    document.getElementById('createBoardBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('boardNameInput').value.trim();
        const color = document.getElementById('boardColorInput').value;
        if (!name) { alert('보드 이름을 입력하세요.'); return; }
        if (!window._motiverseSession) { alert('로그인이 필요합니다.'); return; }

        try {
            const res = await fetch('/api/v1/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...window.getAuthHeaders() },
                body: JSON.stringify({ name, color })
            });
            const json = await res.json();
            if (json.status === 'error') { alert(json.message); return; }
            document.getElementById('boardNameInput').value = '';
            loadBoards();
        } catch (e) { alert('보드 생성 실패: ' + e.message); }
    });

    // 보드 목록
    async function loadBoards() {
        const list = document.getElementById('boardList');
        if (!list || !window._motiverseSession) return;
        try {
            const res = await fetch('/api/v1/boards', { headers: window.getAuthHeaders() });
            const json = await res.json();
            if (!json.data || !json.data.length) {
                list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:1rem;">보드가 없습니다. 새 보드를 만들어 북마크를 정리해보세요!</p>';
                return;
            }
            list.innerHTML = json.data.map(b => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:0.5rem;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='${b.color}'" onmouseout="this.style.borderColor='#e2e8f0'" onclick="viewBoard('${b.id}', '${b.name}')">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <div style="width:12px;height:12px;border-radius:3px;background:${b.color};"></div>
                        <span style="font-weight:600;">${b.name}</span>
                        ${b.description ? `<span style="font-size:0.8rem;color:#94a3b8;">${b.description}</span>` : ''}
                    </div>
                    <button onclick="event.stopPropagation();deleteBoard('${b.id}')" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.9rem;" title="삭제"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = '<p style="color:#ef4444;">보드 로드 실패</p>'; }
    }

    window.deleteBoard = async (id) => {
        if (!confirm('이 보드를 삭제하시겠습니까? (저장된 북마크는 유지됩니다)')) return;
        await fetch(`/api/v1/boards/${id}`, { method: 'DELETE', headers: window.getAuthHeaders() });
        loadBoards();
    };

    // 보드 클릭 → 해당 보드의 북마크를 메인 그리드에 표시
    window.viewBoard = async (boardId, boardName) => {
        boardModal.classList.add('hidden');
        const resultsSection = document.getElementById('resultsSection');
        const loadingState = document.getElementById('loadingState');
        const adGrid = document.getElementById('adGrid');

        resultsSection.classList.remove('hidden');
        loadingState.classList.remove('hidden');
        loadingState.querySelector('p').innerText = `"${boardName}" 보드의 소재를 불러오는 중...`;
        adGrid.innerHTML = '';

        try {
            const res = await fetch(`/api/v1/boards/${boardId}/bookmarks`, { headers: window.getAuthHeaders() });
            const json = await res.json();
            loadingState.classList.add('hidden');

            if (!json.data || !json.data.length) {
                adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;">이 보드에 저장된 북마크가 없습니다.</div>';
                return;
            }

            const flatAds = json.data.map(item => {
                let ad = item.ad_data;
                if (typeof ad === 'string') try { ad = JSON.parse(ad); } catch (e) { ad = null; }
                if (!ad || typeof ad !== 'object') return null;
                ad.is_bookmarked = true;
                ad.bookmark_id = item.id;
                return ad;
            }).filter(Boolean);

            window.currentAdsData = flatAds;
            window.currentAdsPage = 1;
            document.getElementById('competitorInput').value = `📁 ${boardName}`;
            if (typeof window.renderAdsPage === 'function') window.renderAdsPage();
        } catch (e) {
            loadingState.classList.add('hidden');
            adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#ef4444;">보드 데이터 로드 실패</div>';
        }
    };


    // ═══════════════════════════════════════════════════
    // P4: 랜딩페이지 분석
    // ═══════════════════════════════════════════════════

    window.analyzeLandingPage = async (url) => {
        const modal = document.getElementById('landingModal');
        const loading = document.getElementById('landingLoading');
        const result = document.getElementById('landingResult');

        modal.classList.remove('hidden');
        loading.classList.remove('hidden');
        result.innerHTML = '';

        try {
            const res = await fetch('/api/v1/analyze-landing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const json = await res.json();
            loading.classList.add('hidden');

            if (json.status === 'error') {
                result.innerHTML = `<p style="color:#ef4444;text-align:center;">${json.message}</p>`;
                return;
            }

            const d = json.data;
            result.innerHTML = `
                <div class="ai-analysis-block">
                    <span class="analysis-label"><i class="fa-solid fa-globe"></i> 도메인 & 리다이렉트</span>
                    <p class="analysis-text">
                        <strong>${d.domain}</strong><br>
                        최종 URL: <a href="${d.final_url}" target="_blank" style="color:#3b82f6;word-break:break-all;">${d.final_url}</a><br>
                        ${d.redirect_count > 0 ? `리다이렉트: ${d.redirect_count}회 (${d.redirect_chain.map(u => `<code style="font-size:0.7rem;">${u}</code>`).join(' → ')})` : '리다이렉트 없음'}
                    </p>
                </div>
                ${d.og_data?.image ? `<div style="margin-bottom:1rem;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;"><img src="${d.og_data.image}" style="width:100%;max-height:200px;object-fit:cover;" alt="OG Image"></div>` : ''}
                <div class="ai-analysis-block">
                    <span class="analysis-label"><i class="fa-solid fa-tag"></i> OG 메타 정보</span>
                    <p class="analysis-text">
                        ${d.og_data?.title ? `<strong>제목:</strong> ${d.og_data.title}<br>` : ''}
                        ${d.og_data?.description ? `<strong>설명:</strong> ${d.og_data.description}<br>` : ''}
                        ${d.og_data?.site_name ? `<strong>사이트:</strong> ${d.og_data.site_name}<br>` : ''}
                        ${d.og_data?.type ? `<strong>유형:</strong> ${d.og_data.type}` : ''}
                        ${!d.og_data || Object.keys(d.og_data).length === 0 ? '<span style="color:#94a3b8;">OG 메타 정보가 없습니다.</span>' : ''}
                    </p>
                </div>
                ${d.cta_buttons?.length > 0 ? `
                <div class="ai-analysis-block">
                    <span class="analysis-label"><i class="fa-solid fa-bullseye"></i> CTA 버튼 (${d.cta_buttons.length}개 감지)</span>
                    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.5rem;">
                        ${d.cta_buttons.map(c => `<span style="background:#eff6ff;color:#3b82f6;padding:4px 10px;border-radius:6px;font-size:0.85rem;font-weight:600;">${c}</span>`).join('')}
                    </div>
                </div>` : ''}
            `;
        } catch (e) {
            loading.classList.add('hidden');
            result.innerHTML = `<p style="color:#ef4444;text-align:center;">분석 실패: ${e.message}</p>`;
        }
    };

    // 랜딩페이지 모달 외부 클릭 닫기
    document.getElementById('landingModal')?.addEventListener('click', e => {
        if (e.target.id === 'landingModal') e.target.classList.add('hidden');
    });

});
