document.addEventListener("DOMContentLoaded", () => {
    const inputField = document.getElementById("competitorInput");
    const analyzeBtn = document.getElementById("analyzeBtn");

    const resultsSection = document.getElementById("resultsSection");
    const loadingState = document.getElementById("loadingState");
    const adGrid = document.getElementById("adGrid");

    // 모달 DOM
    const aiModal = document.getElementById("aiModal");
    const closeModalBtn = document.getElementById("closeModalBtn");
    const modalLoading = document.getElementById("modalLoading");
    const modalResult = document.getElementById("modalResult");
    const modalHook = document.getElementById("modalHook");
    const modalBody = document.getElementById("modalBody");
    const modalCta = document.getElementById("modalCta");

    // Enter 키로 검색 실행
    inputField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            analyzeBtn.click();
        }
    });


    // 플랫폼 필터 DOM (관리자 대시보드 탭 분리를 위해 속성 선택자 사용)
    const platformTabs = document.querySelectorAll(".tab-chip[data-platform]");

    // 플랫폼 선택 UI 이벤트
    platformTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const platform = tab.dataset.platform;

            // 현재 meta, tiktok, instagram, google 연동 완료
            if (platform !== "meta" && platform !== "tiktok" && platform !== "instagram" && platform !== "google") {
                alert(`현재 '${platform}' 플랫폼 연동은 준비 중입니다. 지원되는 플랫폼(Meta, TikTok, Instagram, Google Ads)을 선택해주세요.`);
                return;
            }

            // 활성화 토글
            platformTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const tiktokSearchType = document.getElementById("tiktokSearchType");
            if (tiktokSearchType) {
                if (platform === "tiktok") {
                    tiktokSearchType.classList.remove("hidden");
                } else {
                    tiktokSearchType.classList.add("hidden");
                }
            }
        });
    });

    // 모달 닫기 이벤트 리스너
    closeModalBtn.addEventListener("click", () => {
        aiModal.classList.add("hidden");
    });
    window.addEventListener("click", (e) => {
        if (e.target === aiModal) aiModal.classList.add("hidden");
    });

    const aiRecommendations = document.getElementById("aiRecommendations");

    analyzeBtn.addEventListener("click", async () => {
        const rawInput = inputField.value.trim();
        if (!rawInput) {
            alert("원하시는 스타일이나 브랜드 키워드를 입력해 주세요.");
            return;
        }

        // UI 상태 초기화 (로딩 표시, 그리드 비우기)
        adGrid.innerHTML = "";
        const existingLoadMore = document.getElementById("loadMoreBtnContainer");
        if (existingLoadMore) existingLoadMore.classList.add("hidden");
        aiRecommendations.classList.add("hidden");

        resultsSection.classList.remove("hidden");
        loadingState.classList.remove("hidden");
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = `검색 중... <i class="fa-solid fa-spinner fa-spin"></i>`;

        const existingBanner = document.getElementById("historyBanner");
        if (existingBanner) existingBanner.remove();

        // 비동기 파생 키워드 추천 로직 (블로킹 X)
        fetchKeywordRecommendations(rawInput);

        try {
            const activeTab = document.querySelector(".tab-chip.active");
            const selectedPlatform = activeTab ? activeTab.dataset.platform : "meta";
            const countryFilter = document.getElementById("countryFilter");
            const tiktokSearchType = document.getElementById("tiktokSearchType");

            const selectedCountry = countryFilter ? countryFilter.value : "KR";
            const selectedSearchType = tiktokSearchType && selectedPlatform === 'tiktok' ? tiktokSearchType.value : "keyword";

            const response = await fetch("/api/v1/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: rawInput,
                    platform: selectedPlatform,
                    country: selectedCountry,
                    search_type: selectedSearchType
                })
            });

            if (!response.ok) throw new Error("분석 서버의 응답이 원활하지 않습니다.");

            const jsonResponse = await response.json();
            loadingState.classList.add("hidden");

            if (jsonResponse.status === "error") {
                adGrid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;font-size:1rem;line-height:1.6;word-break:keep-all;">${jsonResponse.message}</div>`;
                return;
            }

            const data = jsonResponse.data;
            window.currentAdsData = data;
            window.currentAdsPage = 1;
            window._lastSearchQuery = rawInput;
            window._lastSearchPlatform = selectedPlatform;

            renderAdsPage();

            // 검색 히스토리 저장 (로그인 시 항상 저장)
            if (window.saveHistoryToDB) {
                window.saveHistoryToDB(rawInput, selectedPlatform, selectedCountry, data || [])
                    .then(() => {
                        // 저장 완료 후 최근 검색어 칩 갱신
                        if (window.loadRecentSearchChips) {
                            window._chipsLoaded = false; // 플래그 리셋해서 재로드 허용
                            window.loadRecentSearchChips();
                        }
                    })
                    .catch(() => { });
            }

        } catch (error) {
            alert(error.message);
            loadingState.classList.add("hidden");
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = `검색`;
        }
    });

    async function fetchKeywordRecommendations(keyword) {
        try {
            const res = await fetch("/api/v1/recommend-keywords", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyword })
            });

            if (!res.ok) return;
            const jsonRes = await res.json();

            if (jsonRes.status === "success" && Array.isArray(jsonRes.data) && jsonRes.data.length > 0) {
                // 기존 내용(라벨 보존, 하위 요소 삭제)
                aiRecommendations.innerHTML = `<span class="ai-recommend-label"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 추천 검색어</span>`;

                jsonRes.data.forEach(kw => {
                    const chip = document.createElement("div");
                    chip.className = "tab-chip";
                    chip.style.border = "1px solid #cce0ff"; // 추천용 연한 테두리
                    chip.style.background = "#fff";
                    chip.innerText = kw;

                    chip.addEventListener("click", () => {
                        inputField.value = kw;
                        analyzeBtn.click(); // 즉시 재검색 유도
                    });

                    aiRecommendations.appendChild(chip);
                });
                aiRecommendations.classList.remove("hidden");
            }
        } catch (e) {
            console.error("추천 검색어 로딩 실패:", e);
        }
    }

    window.renderAdsPage = renderAdsPage;
    function renderAdsPage() {
        const ITEMS_PER_PAGE = 9;

        if (!window.currentAdsData || window.currentAdsData.length === 0) {
            adGrid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;">조건에 맞는 레퍼런스를 찾지 못했습니다. 키워드나 필터를 변경해 보세요.</div>`;
            return;
        }

        const startIndex = (window.currentAdsPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = window.currentAdsData.slice(startIndex, endIndex);

        pageData.forEach(ad => {
            const card = createAdCard(ad);
            adGrid.appendChild(card);
        });

        const loadMoreContainer = document.getElementById("loadMoreBtnContainer");
        const loadMoreBtn = document.getElementById("loadMoreBtn");

        if (endIndex < window.currentAdsData.length) {
            loadMoreContainer.classList.remove("hidden");
            // 기존 이벤트 방지 후 새로 부착 (간단한 구현)
            loadMoreBtn.onclick = () => {
                window.currentAdsPage++;
                renderAdsPage();
            };
        } else {
            loadMoreContainer.classList.add("hidden");
        }
    }

    function createAdCard(ad) {
        const card = document.createElement("article");
        card.className = "ad-card";

        const mediaTag = ad.media_type === "video"
            ? `<video class="ad-media" src="${ad.media_url}" autoplay loop muted playsinline></video>`
            : `<img class="ad-media" src="${ad.media_url}" alt="Ad Image">`;

        // Mocking Data for UI
        const mockLikes = Math.floor(Math.random() * 500) + 10;
        const mockComments = Math.floor(Math.random() * 50);

        card.innerHTML = `
            <div class="ad-media-wrapper">
                ${mediaTag}
                
                <!-- 상단 좌측: 반응도 오버레이 -->
                <div class="overlay-top-left">
                    <div class="reaction-badge"><i class="fa-solid fa-heart"></i> ${mockLikes}</div>
                    <div class="reaction-badge"><i class="fa-solid fa-comment"></i> ${mockComments}</div>
                </div>

                <!-- 상단 우측: 오버레이 -->
                <div class="overlay-top-right">
                    ${ad.platform === 'tiktok'
                ? `<div class="status-badge"><i class="fa-brands fa-tiktok"></i> 비디오</div>
                           <div class="status-badge active">TikTok</div>`
                : ad.platform === 'instagram'
                    ? `<div class="status-badge"><i class="fa-brands fa-instagram"></i> 릴스</div>
                           <div class="status-badge active">Instagram</div>`
                    : ad.platform === 'google'
                        ? `<div class="status-badge"><i class="fa-brands fa-google"></i> 광고</div>
                           <div class="status-badge active">Google Ads</div>`
                        : `<div class="status-badge"><i class="fa-regular fa-calendar"></i> ${ad.active_days || 30}일간 게재</div>
                           <div class="status-badge active">게재 중</div>`
            }
                </div>

                <!-- 하단 우측: 원본 링크 -->
                <div class="overlay-bottom-right">
                    <a href="${ad.direct_link || `https://www.facebook.com/ads/library/?id=${ad.ad_id || ''}`}" target="_blank" class="meta-link-btn" title="광고 원본 보기" onclick="event.stopPropagation()">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                </div>

                <!-- 하버 시 나타나는 AI 분석 오버레이 (간략본) -->
                <div class="ai-overlay hidden-mobile">
                    <div class="ai-preview-label">AI Point 1</div>
                    <p class="ai-preview-text">${ad.analysis_report?.hook || 'AI 분석 대기중...'}</p>
                </div>
            </div>

            <!-- 하단 바디 -->
            <div class="ad-details">
                <div class="brand-name">
                    <div class="brand-avatar">${ad.brand.charAt(0).toUpperCase()}</div> ${ad.brand}
                </div>
                ${ad.hashtags && ad.hashtags.length > 0 ?
                `<div class="hashtags-container" style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${ad.hashtags.map(tag => `<span style="font-size: 0.75rem; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px;">${tag}</span>`).join('')}
                    </div>` : ''}
                <button class="btn-ai-analyze analyze-single-btn" style="margin-top:0.75rem;" title="상세 기획 의도 분석"><i class="fa-solid fa-wand-magic-sparkles"></i> 딥다이브</button>
            </div>
        `;

        // 북마크 버튼 (상단 우측, 배지와 겹치지 않도록 아이콘만 작게)
        const bookmarkBtn = document.createElement('button');
        bookmarkBtn.className = 'ad-bookmark-btn';
        bookmarkBtn.title = '북마크';
        if (ad.is_bookmarked) {
            bookmarkBtn.classList.add('bookmarked');
            bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
            bookmarkBtn.dataset.bookmarkId = ad.bookmark_id;
        } else {
            bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        }
        // 전역 Map에 등록하여 패널과 동기화
        if (!window._bookmarkBtnMap) window._bookmarkBtnMap = new Map();
        const adKey = ad.ad_id || ad.media_url || JSON.stringify(ad).slice(0, 60);
        card.dataset.adKey = adKey;
        bookmarkBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!window._motiverseSession) { alert('북마크는 로그인 후 사용 가능합니다.'); return; }
            const isBookmarked = bookmarkBtn.classList.contains('bookmarked');
            if (isBookmarked) {
                const bId = bookmarkBtn.dataset.bookmarkId;
                if (bId) {
                    await window.deleteBookmarkFromDB(bId);
                    window._bookmarkBtnMap?.delete(bId);
                }
                bookmarkBtn.classList.remove('bookmarked');
                bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                bookmarkBtn.dataset.bookmarkId = '';
            } else {
                const saved = await window.saveBookmarkToDB(
                    ad,
                    window._lastSearchQuery || '',
                    ad.platform || window._lastSearchPlatform || 'meta'
                );
                if (saved?.id) {
                    bookmarkBtn.classList.add('bookmarked');
                    bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
                    bookmarkBtn.dataset.bookmarkId = saved.id;
                    window._bookmarkBtnMap?.set(saved.id, bookmarkBtn);
                }
            }
        });
        card.querySelector('.ad-media-wrapper').appendChild(bookmarkBtn);
        window._bookmarkBtnMap?.set(adKey, bookmarkBtn);
        const singleAnalyzeBtn = card.querySelector('.analyze-single-btn');
        singleAnalyzeBtn.addEventListener("click", async () => {
            aiModal.classList.remove("hidden");
            modalLoading.classList.remove("hidden");
            modalResult.classList.add("hidden");

            // 결과 초기화
            modalHook.innerHTML = "";
            modalBody.innerHTML = "";
            modalCta.innerHTML = "";

            // 비디오 타입은 AI 분석 미지원
            if (ad.media_type === "video") {
                modalLoading.classList.add("hidden");
                modalHook.innerHTML = `<span style="font-size:1.5rem;">🎬</span>`;
                modalBody.innerHTML = `<p style="text-align:center;color:#64748b;font-size:1rem;margin-top:0.5rem;">비디오 AI 분석은 개발중입니다.</p>`;
                modalCta.innerHTML = "";
                modalResult.classList.remove("hidden");
                return;
            }

            try {
                const res = await fetch("/api/v1/analyze-single", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        media_url: ad.media_url,
                        media_type: ad.media_type
                    })
                });
                if (!res.ok) throw new Error("분석 서버 응답 에러");

                const jsonRes = await res.json();

                // 비디오 분석 불가 안내 (alert 대신 모달에 표시)
                if (jsonRes.status === "error" && jsonRes.message && jsonRes.message.includes("개발중")) {
                    modalLoading.classList.add("hidden");
                    modalHook.innerHTML = `<span style="font-size:1.5rem;">🎬</span>`;
                    modalBody.innerHTML = `<p style="text-align:center;color:#64748b;font-size:1rem;margin-top:0.5rem;">${jsonRes.message}</p>`;
                    modalCta.innerHTML = "";
                    modalResult.classList.remove("hidden");
                    return;
                }

                if (jsonRes.status === "error") throw new Error(jsonRes.message);

                modalHook.innerText = jsonRes.data.hook;
                modalBody.innerText = jsonRes.data.body;
                modalCta.innerText = jsonRes.data.cta;

                modalLoading.classList.add("hidden");
                modalResult.classList.remove("hidden");

            } catch (err) {
                alert("AI 기획 포인트 추출 중 에러가 발생했습니다: " + err.message);
                aiModal.classList.add("hidden");
            }
        });

        // 카드 전체 클릭 시 비디오 컨트롤 (선택사항)
        if (ad.media_type === "video") {
            const videoEl = card.querySelector('video');
            videoEl.addEventListener('click', () => {
                videoEl.paused ? videoEl.play() : videoEl.pause();
                videoEl.muted = !videoEl.muted;
            });
        }

        return card;
    }

    // ─── 히스토리 & 북마크 모아보기 (전체 화면) ────────────────────────
    // 오버레이 클릭 시 모달 닫기
    document.getElementById('panelOverlay')?.addEventListener('click', () => {
        document.getElementById('panelOverlay').classList.add('hidden');
    });

    // 히스토리 전체 조회
    document.getElementById('historyBtn')?.addEventListener('click', async () => {
        if (!window._motiverseSession) { alert("로그인이 필요합니다."); return; }

        const resultsSection = document.getElementById('resultsSection');
        const loadingState = document.getElementById('loadingState');
        const adGrid = document.getElementById('adGrid');

        resultsSection.classList.remove('hidden');
        loadingState.classList.remove('hidden');
        document.getElementById('loadingState').querySelector('p').innerText = "이전 검색 히스토리를 불러오는 중입니다...";
        adGrid.innerHTML = '';

        try {
            const data = await window.loadHistoryFromDB();

            let flatAds = [];
            const seenMap = new Set();
            if (data && Array.isArray(data)) {
                data.forEach(row => {
                    let adsArray = row.ads_data;

                    if (typeof adsArray === 'string') {
                        try { adsArray = JSON.parse(adsArray); } catch (e) { adsArray = null; }
                    }

                    if (adsArray && Array.isArray(adsArray)) {
                        adsArray.forEach(ad => {
                            if (!ad || typeof ad !== 'object') return;
                            const id = ad.ad_id || ad.media_url || ad.id || Math.random().toString();
                            if (id && !seenMap.has(id)) {
                                seenMap.add(id);
                                if (!ad.query) ad.query = row.query;
                                flatAds.push(ad);
                            }
                        });
                    }
                });
            }

            if (!flatAds.length) {
                loadingState.classList.add('hidden');
                adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;">검색 히스토리가 없습니다.</div>';
                return;
            }

            window.currentAdsData = flatAds;
            window.currentAdsPage = 1;
            document.getElementById('competitorInput').value = "나의 검색 히스토리 소재 모아보기";
            document.getElementById('loadingState').querySelector('p').innerText = "AI 에이전트가 완벽한 레퍼런스를 탐색하고 있습니다..."; // 초기화
            loadingState.classList.add('hidden');
            renderAdsPage();
        } catch (e) {
            console.error(e);
            alert("히스토리 에러 상세: " + e.message + "\n발생 위치: " + (e.stack ? e.stack.substring(0, 200) : 'stack 없음'));
            loadingState.classList.add('hidden');
        }
    });

    // 북마크 전체 조회
    document.getElementById('bookmarkBtn')?.addEventListener('click', async () => {
        if (!window._motiverseSession) { alert("로그인이 필요합니다."); return; }

        const resultsSection = document.getElementById('resultsSection');
        const loadingState = document.getElementById('loadingState');
        const adGrid = document.getElementById('adGrid');

        resultsSection.classList.remove('hidden');
        loadingState.classList.remove('hidden');
        document.getElementById('loadingState').querySelector('p').innerText = "북마크된 소재를 불러오는 중입니다...";
        adGrid.innerHTML = '';

        try {
            const items = await window.loadBookmarksFromDB();
            if (!items || !items.length) {
                loadingState.classList.add('hidden');
                adGrid.innerHTML = '<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;">북마크가 없습니다.</div>';
                return;
            }

            const flatAds = items.map(item => {
                let ad = item.ad_data;
                if (typeof ad === 'string') {
                    try { ad = JSON.parse(ad); } catch (e) { ad = null; }
                }

                if (!ad || typeof ad !== 'object') return null;
                ad.is_bookmarked = true;
                ad.bookmark_id = item.id;
                return ad;
            }).filter(Boolean);

            window.currentAdsData = flatAds;
            window.currentAdsPage = 1;
            document.getElementById('competitorInput').value = "내 북마크 소재 모아보기";
            document.getElementById('loadingState').querySelector('p').innerText = "AI 에이전트가 완벽한 레퍼런스를 탐색하고 있습니다..."; // 초기화
            loadingState.classList.add('hidden');
            renderAdsPage();

        } catch (e) {
            console.error(e);
            alert("북마크 에러 상세: " + e.message + "\n발생 위치: " + (e.stack ? e.stack.substring(0, 200) : 'stack 없음'));
            loadingState.classList.add('hidden');
        }
    });
});

// ─── 광고 원본 미리보기 모달 ───────────────────────────
function showAdPreviewModal(ad, query, platform) {
    // 기존 모달 제거
    document.getElementById('adPreviewModal')?.remove();
    const mediaHtml = ad.media_type === 'video'
        ? `<video class="preview-media" src="${ad.media_url}" autoplay loop muted controls playsinline></video>`
        : `<img class="preview-media" src="${ad.image_url || ad.media_url || ''}" alt="">`;
    const modal = document.createElement('div');
    modal.id = 'adPreviewModal';
    modal.className = 'ad-preview-modal';
    modal.innerHTML = `
        <div class="ad-preview-inner">
            <button class="ad-preview-close" id="adPreviewClose">&times;</button>
            <div class="ad-preview-media">${mediaHtml}</div>
            <div class="ad-preview-body">
                <div class="brand-name" style="margin-bottom:0.5rem;">
                    <div class="brand-avatar">${(ad.brand || '?').charAt(0).toUpperCase()}</div>
                    <strong>${ad.brand || ''}</strong>
                    <span style="margin-left:auto;font-size:0.8rem;color:#64748b;">🔍 ${query || ''} · ${PLATFORM_LABELS[platform] || platform}</span>
                </div>
                ${ad.body ? `<p style="font-size:0.9rem;color:#334155;margin-bottom:0.75rem;">${ad.body}</p>` : ''}
                ${ad.analysis_report?.hook ? `<div class="ai-analysis-block"><span class="analysis-label"><i class="fa-solid fa-video"></i> Hook</span><p class="analysis-text">${ad.analysis_report.hook}</p></div>` : ''}
                ${ad.analysis_report?.body ? `<div class="ai-analysis-block"><span class="analysis-label"><i class="fa-solid fa-bars-staggered"></i> Body</span><p class="analysis-text">${ad.analysis_report.body}</p></div>` : ''}
                ${ad.direct_link ? `<a href="${ad.direct_link}" target="_blank" class="meta-link-btn" style="display:inline-flex;align-items:center;gap:0.4rem;margin-top:0.75rem;font-size:0.85rem;padding:0.5rem 1rem;background:#3b82f620;border-radius:8px;color:#3b82f6;font-weight:600;text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> 원본 광고 보기</a>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));
    const closeModal = () => { modal.classList.remove('open'); setTimeout(() => modal.remove(), 300); };
    modal.querySelector('#adPreviewClose').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}

// ─── 최근 검색어 (검색창 아래, 텍스트 형태) ────────────────
async function loadHistoryChipFromDB() {
    if (!window._motiverseSession) return [];
    try {
        const { data, error } = await supabaseClient
            .from("search_history")
            .select("id, query, platform, created_at")
            .order("created_at", { ascending: false })
            .limit(20);
        if (error) return [];
        return data || [];
    } catch (e) { return []; }
}

window.loadRecentSearchChips = async () => {
    const container = document.getElementById('recentSearchBar');
    if (!container) return;
    if (!window._motiverseSession) { container.classList.add('hidden'); return; }
    try {
        const items = await loadHistoryChipFromDB();
        if (!items || !items.length) { container.classList.add('hidden'); return; }
        const seen = new Set();
        const unique = items.filter(i => {
            if (seen.has(i.query)) return false;
            seen.add(i.query);
            return true;
        }).slice(0, 7);

        container.innerHTML = `<span class="recent-label">최근 검색</span><div class="recent-chips-list" id="recentChipsList"></div>`;
        const list = container.querySelector('#recentChipsList');

        unique.forEach((item, idx) => {
            if (idx > 0) {
                const sep = document.createElement('span');
                sep.className = 'recent-sep';
                sep.textContent = '|';
                list.appendChild(sep);
            }
            const btn = document.createElement('button');
            btn.className = 'recent-chip';
            btn.textContent = item.query;
            btn.title = item.query;
            btn.addEventListener('click', async () => {
                const inputEl = document.getElementById('competitorInput');
                if (inputEl) inputEl.value = item.query;
                const resultsSection = document.getElementById('resultsSection');
                const loadingState = document.getElementById('loadingState');
                const adGrid = document.getElementById('adGrid');
                resultsSection.classList.remove('hidden');
                loadingState.classList.remove('hidden');
                adGrid.innerHTML = '';
                document.getElementById('loadMoreBtnContainer')?.classList.add('hidden');
                const detail = await window.loadHistoryDetailFromDB(item.id);
                loadingState.classList.add('hidden');
                let parsedData = detail.ads_data;
                if (typeof parsedData === 'string') {
                    try { parsedData = JSON.parse(parsedData); } catch (e) { parsedData = []; }
                }

                if (!parsedData || !parsedData.length) {
                    adGrid.innerHTML = `<div style="text-align:center;width:100%;color:#94a3b8;padding:2rem;">저장된 소재가 없습니다. 다시 검색해보세요.</div>`;
                    return;
                }
                window.currentAdsData = parsedData;
                window.currentAdsPage = 1;
                window._lastSearchQuery = detail.query;
                window._lastSearchPlatform = detail.platform;

                // 저장됐던 국가, 플랫폼 UI 복원
                if (detail.country) {
                    const countryEl = document.getElementById('countryFilter');
                    if (countryEl) countryEl.value = detail.country;
                }
                if (detail.platform) {
                    document.querySelectorAll('.tab-chip').forEach(tab => {
                        tab.classList.toggle('active', tab.dataset.platform === detail.platform);
                    });
                }

                // 저장 시점 배너 표시
                const savedAt = detail.created_at ? new Date(detail.created_at).toLocaleString('ko-KR') : '';
                const existingBanner = document.getElementById('historyBanner');
                if (existingBanner) existingBanner.remove();
                const banner = document.createElement('div');
                banner.id = 'historyBanner';
                banner.style.cssText = 'width:100%;padding:0.6rem 1rem;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;margin-bottom:1rem;color:#0369a1;font-size:0.83rem;display:flex;align-items:center;gap:0.5rem;';
                banner.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> <strong>${detail.query}</strong> 저장된 결과입니다 (${savedAt}) &nbsp;·&nbsp; <a href="#" id="reSearchBtn" style="color:#2563eb;font-weight:600;text-decoration:underline;">새로 검색하기</a>`;
                document.getElementById('adGrid').before(banner);
                document.getElementById('reSearchBtn')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    banner.remove();
                    document.getElementById('analyzeBtn').click();
                });

                if (typeof window.renderAdsPage === 'function') {
                    window.renderAdsPage();
                } else {
                    console.error("renderAdsPage function is not accessible globally.");
                }
            });
            list.appendChild(btn);
        });
        container.classList.remove('hidden');
    } catch (e) {
        console.error('[최근 검색 칩]', e);
        container.classList.add('hidden');
    }
};

// ─── 관리자 대시보드 오픈 로직 ──────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.open('/static/admin.html', '_blank');
        });
    }
});
