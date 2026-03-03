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


    // 플랫폼 필터 DOM
    const platformTabs = document.querySelectorAll(".tab-chip");

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
                adGrid.innerHTML = `<div style="text-align:center;width:100%;color:#ef4444;font-size:1rem;padding:2rem;">${jsonResponse.message}</div>`;
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
        bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
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
});

// ─── 사이드 패널 로직 ─────────────────────────────────
function openPanel(panelId) {
    document.getElementById(panelId).classList.add('open');
    document.getElementById('panelOverlay').classList.remove('hidden');
}
function closeAllPanels() {
    document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('open'));
    document.getElementById('panelOverlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    // 오버레이 클릭 시 패널 닫기
    document.getElementById('panelOverlay')?.addEventListener('click', closeAllPanels);
    document.getElementById('historyPanelClose')?.addEventListener('click', closeAllPanels);
    document.getElementById('bookmarkPanelClose')?.addEventListener('click', closeAllPanels);

    // 히스토리 패널 열기
    document.getElementById('historyBtn')?.addEventListener('click', async () => {
        openPanel('historyPanel');
        await loadHistoryPanel();
    });

    // 북마크 패널 열기
    document.getElementById('bookmarkBtn')?.addEventListener('click', async () => {
        openPanel('bookmarkPanel');
        await loadBookmarkPanel();
    });
});

// 플랫폼 이름 매핑
const PLATFORM_LABELS = { meta: 'Meta', tiktok: 'TikTok', instagram: 'Instagram', google: 'Google Ads' };

async function loadHistoryPanel() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<p class="panel-empty">히스토리 불러오는 중...</p>';
    if (!window._motiverseSession) {
        list.innerHTML = '<p class="panel-empty">로그인이 필요합니다.</p>';
        return;
    }
    try {
        const items = await window.loadHistoryFromDB();
        if (!items || !items.length) {
            list.innerHTML = '<p class="panel-empty">검색 히스토리가 없습니다.</p>';
            return;
        }
        list.innerHTML = items.map(item => {
            const dt = new Date(item.created_at);
            const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
            return `<div class="history-item" data-id="${item.id}">
                <span class="history-query">${item.query}</span>
                <div class="history-meta">
                    <span class="platform-badge">${PLATFORM_LABELS[item.platform] || item.platform || ''}</span>
                    <span>${dateStr}</span>
                </div>
            </div>`;
        }).join('');
        // 클릭 시 DB에서 소재 로드 (재API 호출 없음)
        list.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', async () => {
                closeAllPanels();
                const detail = await window.loadHistoryDetailFromDB(el.dataset.id);
                if (!detail) return;
                window.currentAdsData = detail.ads_data || [];
                window.currentAdsPage = 1;
                window._lastSearchQuery = detail.query;
                window._lastSearchPlatform = detail.platform;
                document.getElementById('competitorInput').value = detail.query;
                document.getElementById('resultsSection').classList.remove('hidden');
                document.getElementById('loadingState').classList.add('hidden');
                renderAdsPage();
            });
        });
    } catch (e) {
        console.error('[히스토리 패널]', e);
        list.innerHTML = '<p class="panel-empty">불러오기 실패</p>';
    }
}

async function loadBookmarkPanel() {
    const list = document.getElementById('bookmarkList');
    list.innerHTML = '<p class="panel-empty">북마크 불러오는 중...</p>';
    if (!window._motiverseSession) { list.innerHTML = '<p class="panel-empty">로그인이 필요합니다.</p>'; return; }
    try {
        const items = await window.loadBookmarksFromDB();
        if (!items.length) { list.innerHTML = '<p class="panel-empty">북마크가 없습니다.</p>'; return; }
        list.innerHTML = '';
        items.forEach(item => {
            const ad = item.ad_data;
            const card = document.createElement('div');
            card.className = 'bookmark-card';
            const thumb = ad.media_type === 'video'
                ? `<div class="bookmark-thumb bm-video-thumb"><i class="fa-solid fa-play"></i></div>`
                : `<img class="bookmark-thumb" src="${ad.image_url || ad.media_url || ''}" alt="" onerror="this.style.display='none'">`;
            card.innerHTML = `
                ${thumb}
                <div class="bookmark-info">
                    <span class="bookmark-brand">${ad.brand || ''}</span>
                    <span class="bookmark-query">🔍 ${item.query || ''} · ${PLATFORM_LABELS[item.platform] || item.platform}</span>
                    <p class="bookmark-body">${ad.body || ad.analysis_report?.hook || ''}</p>
                </div>
                <button class="bookmark-remove-btn" data-id="${item.id}" title="삭제"><i class="fa-solid fa-xmark"></i></button>
            `;
            // 클릭 시 광고 원본 미리보기 모달
            card.querySelector('.bookmark-info').addEventListener('click', () => {
                showAdPreviewModal(ad, item.query, item.platform);
            });
            card.querySelector('.bookmark-thumb')?.addEventListener('click', () => {
                showAdPreviewModal(ad, item.query, item.platform);
            });
            // 삭제 버튼 - 메인 카드 북마크 버튼도 동기화
            card.querySelector('.bookmark-remove-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const bId = e.currentTarget.dataset.id;
                await window.deleteBookmarkFromDB(bId);
                // 메인 카드 북마크 버튼 동기화
                const cardBtn = window._bookmarkBtnMap?.get(bId);
                if (cardBtn) {
                    cardBtn.classList.remove('bookmarked');
                    cardBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
                    cardBtn.dataset.bookmarkId = '';
                    window._bookmarkBtnMap?.delete(bId);
                }
                card.remove();
                if (!list.children.length) list.innerHTML = '<p class="panel-empty">북마크가 없습니다.</p>';
            });
            list.appendChild(card);
        });
    } catch (e) { list.innerHTML = '<p class="panel-empty">불러오기 실패</p>'; }
}

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
                if (!detail || !detail.ads_data?.length) {
                    adGrid.innerHTML = `<div style="text-align:center;width:100%;color:#94a3b8;padding:2rem;">저장된 소재가 없습니다. 다시 검색해보세요.</div>`;
                    return;
                }
                window.currentAdsData = detail.ads_data;
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

                renderAdsPage();
            });
            list.appendChild(btn);
        });
        container.classList.remove('hidden');
    } catch (e) {
        console.error('[최근 검색 칩]', e);
        container.classList.add('hidden');
    }
};

// ─── 관리자 대시보드 로직 ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const adminBtn = document.getElementById('adminBtn');
    const adminModal = document.getElementById('adminModal');
    const closeAdminBtn = document.getElementById('closeAdminBtn');
    const adminTabs = document.querySelectorAll('.admin-tabs .tab-chip');
    const adminPanels = document.querySelectorAll('.admin-view-panel');

    if (adminBtn) {
        adminBtn.addEventListener('click', async () => {
            adminModal.classList.remove('hidden');
            await loadAdminData();
        });
    }

    if (closeAdminBtn) {
        closeAdminBtn.addEventListener('click', () => {
            adminModal.classList.add('hidden');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === adminModal) adminModal.classList.add('hidden');
    });

    // Tab Switching
    adminTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            adminPanels.forEach(p => p.classList.add('hidden'));

            const targetId = tab.id.replace('adminTab', 'adminView');
            document.getElementById(targetId)?.classList.remove('hidden');
        });
    });
});

async function loadAdminData() {
    const loading = document.getElementById('adminLoading');
    loading.classList.remove('hidden');

    try {
        const { data, error } = await window.supabaseClient.rpc('get_admin_dashboard_data');
        if (error) throw error;

        // 1. Overview
        const users = data.users || [];
        const history = data.history || [];
        const usage = data.api_usage || [];

        document.getElementById('statTotalUsers').innerText = users.length;
        document.getElementById('statTotalSearches').innerText = history.length;
        document.getElementById('statTotalApi').innerText = usage.length;
        const totalTokens = usage.reduce((sum, item) => sum + (item.tokens_used || 0), 0);
        document.getElementById('statTotalTokens').innerText = totalTokens.toLocaleString();

        // 2. Users Table
        const usersTbody = document.getElementById('adminUsersTbody');
        usersTbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.email}</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td>${u.last_login ? new Date(u.last_login).toLocaleString() : '-'}</td>
                <td>
                    <button class="toggle-admin-btn ${u.is_admin ? 'is-admin' : ''}" 
                            data-email="${u.email}" data-status="${u.is_admin}">
                        ${u.is_admin ? '<i class="fa-solid fa-check"></i> 관리자 해제' : '관리자 지정'}
                    </button>
                </td>
            </tr>
        `).join('');

        // Admin Toggle Logic
        document.querySelectorAll('.toggle-admin-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget;
                const email = target.dataset.email;
                const currentStatus = target.dataset.status === 'true';
                if (confirm(`${email}님의 관리자 권한을 ${currentStatus ? '해제' : '부여'}하시겠습니까?`)) {
                    const { error: rpcErr } = await window.supabaseClient.rpc('toggle_admin_status', {
                        target_email: email,
                        assign_admin: !currentStatus
                    });
                    if (rpcErr) {
                        alert("권한 변경 실패: " + rpcErr.message);
                    } else {
                        alert("권한이 변경되었습니다.");
                        loadAdminData(); // Refresh UI
                    }
                }
            });
        });

        // 3. Queries Table
        const queriesTbody = document.getElementById('adminQueriesTbody');
        queriesTbody.innerHTML = history.map(h => `
            <tr>
                <td><span title="${h.user_id}">${h.email || '알 수 없음'}</span></td>
                <td><strong>${h.query}</strong></td>
                <td><span class="platform-badge">${PLATFORM_LABELS[h.platform] || h.platform}</span></td>
                <td>${h.country || 'Global'}</td>
                <td>${h.created_at ? new Date(h.created_at).toLocaleString() : '-'}</td>
            </tr>
        `).join('');

        // 4. API Usage Table
        const usageTbody = document.getElementById('adminUsageTbody');
        usageTbody.innerHTML = usage.map(u => `
            <tr>
                <td><span title="${u.user_id}">${u.email || '알 수 없음'}</span></td>
                <td><code>${u.endpoint}</code></td>
                <td style="color:var(--accent-indigo); font-weight:bold;">${(u.tokens_used || 0).toLocaleString()}</td>
                <td>${u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
            </tr>
        `).join('');

    } catch (e) {
        console.error("Admin Load Error", e);
        alert("데이터를 가져오는 데 실패했습니다. (DB 마이그레이션이 적용되었는지 확인하세요)");
    } finally {
        loading.classList.add('hidden');
    }
}
