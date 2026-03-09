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
    const platformTabs = document.querySelectorAll("#platformFilters .tab-chip[data-platform]");

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
        const adDetailModal = document.getElementById('adDetailModal');
        if (adDetailModal && e.target === adDetailModal) {
            adDetailModal.classList.add('hidden');
            const v = document.getElementById('adDetailModalBody').querySelector('video');
            if (v) v.pause();
        }
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

        const brandCardContainer = document.getElementById("extractedBrandCardContainer");
        if (brandCardContainer) brandCardContainer.classList.add("hidden");

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
                const brandCardContainer = document.getElementById("extractedBrandCardContainer");
                if (brandCardContainer) brandCardContainer.classList.add("hidden");
                adGrid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;font-size:1rem;line-height:1.6;word-break:keep-all;">${jsonResponse.message}</div>`;
                return;
            }

            const data = jsonResponse.data;
            window.currentAdsData = data;
            window.currentAdsPage = 1;
            window._lastSearchQuery = rawInput;
            window._lastSearchPlatform = selectedPlatform;

            // Render Extracted Brand profile block similar to Competitor Monitoring
            const brandCardContainer = document.getElementById("extractedBrandCardContainer");
            if (brandCardContainer) {
                if (data && data.length > 0) {
                    const brandName = data[0].brand || rawInput;
                    const match = brandName.match(/[A-Z가-힣0-9]/i);
                    const iconChar = match ? match[0] : 'K';

                    let bgCol = "#3b82f6";
                    if (selectedPlatform === "instagram") bgCol = "#e1306c";
                    else if (selectedPlatform === "tiktok") bgCol = "#000000";
                    else if (selectedPlatform === "google") bgCol = "#ea4335";

                    const platformDisplay = selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1);

                    // Check if the search query might be a generic keyword rather than a specific brand name.
                    let isGenericKeyword = false;
                    const cleanBrand = brandName.toLowerCase();
                    const cleanRaw = rawInput.toLowerCase();

                    const tiktokSearchType = document.getElementById('tiktokSearchType')?.value;
                    if (selectedPlatform === 'tiktok' && tiktokSearchType === 'keyword') {
                        isGenericKeyword = true;
                    } else if (cleanBrand !== cleanRaw && !cleanBrand.includes(cleanRaw)) {
                        isGenericKeyword = true;
                    } else if (cleanBrand === cleanRaw && (/^[가-힣]+$/.test(cleanBrand) || cleanBrand.includes(' '))) {
                        // If it's a pure Korean word without English account names or contains spaces, treat as keyword
                        isGenericKeyword = true;
                    }

                    if (isGenericKeyword) {
                        // Keyword Search UI
                        brandCardContainer.innerHTML = `
                             <div style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                 <div style="display: flex; align-items: center; gap: 1rem;">
                                     <div style="width: 50px; height: 50px; border-radius: 50%; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f1f5f9; flex-shrink: 0;">
                                         <i class="fa-solid fa-magnifying-glass" style="color: #64748b; font-size: 1.4rem;"></i>
                                     </div>
                                     <div style="line-height: 1.4;">
                                         <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                                             '${rawInput}' 관련 레퍼런스 모음
                                         </div>
                                         <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
                                             모티버스 AI가 <span style="font-weight: 600; color: ${bgCol};">${platformDisplay}</span>에서 추출한 <strong>${data.length}</strong>개의 실전 게재 레퍼런스
                                         </div>
                                     </div>
                                 </div>
                                 <div>
                                     <button data-brand="${rawInput.replace(/"/g, '&quot;')}" data-platform="${selectedPlatform}" style="background: white; border: 1px solid #cbd5e1; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'" onclick="if(window.addCompetitorDirectly) { window.addCompetitorDirectly(this.dataset.brand, this.dataset.platform, window.currentAdsData, true); } else { document.getElementById('monitorBtn').click(); }">
                                         <i class="fa-solid fa-plus" style="margin-right: 0.3rem;"></i> 키워드 모니터링 추가
                                     </button>
                                 </div>
                             </div>
                         `;
                    } else {
                        // Brand Search UI
                        brandCardContainer.innerHTML = `
                             <div style="padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid #e2e8f0; border-radius: 12px; background: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                 <div style="display: flex; align-items: center; gap: 1rem;">
                                     <div style="width: 50px; height: 50px; border-radius: 50%; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; flex-shrink: 0;">
                                         <span style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; background: ${bgCol}; color: white; width: 100%; height: 100%; font-size: 1.4rem; font-weight: bold;">${iconChar}</span>
                                     </div>
                                     <div style="line-height: 1.4;">
                                         <div style="font-weight: 700; font-size: 1.1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                                             ${brandName} <i class="fa-solid fa-circle-check" style="color: ${bgCol}; font-size: 0.9rem;"></i>
                                         </div>
                                         <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem;">
                                             모티버스 AI가 <span style="font-weight: 600; color: ${bgCol};">${platformDisplay}</span>에서 추출한 <strong>${data.length}</strong>개의 실전 게재 레퍼런스
                                         </div>
                                     </div>
                                 </div>
                                 <div>
                                     <button data-brand="${brandName.replace(/"/g, '&quot;')}" data-platform="${selectedPlatform}" style="background: white; border: 1px solid #cbd5e1; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; color: #475569; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'" onclick="if(window.addCompetitorDirectly) { window.addCompetitorDirectly(this.dataset.brand, this.dataset.platform, window.currentAdsData); } else { document.getElementById('monitorBtn').click(); }">
                                         <i class="fa-solid fa-plus" style="margin-right: 0.3rem;"></i> 모니터링 추가
                                     </button>
                                 </div>
                             </div>
                         `;
                    }
                    brandCardContainer.classList.remove("hidden");
                } else {
                    brandCardContainer.classList.add("hidden");
                }
            }

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
            ? `<video class="ad-media" src="${ad.media_url}" autoplay loop muted playsinline referrerpolicy="no-referrer"></video>`
            : `<img class="ad-media" src="${ad.media_url}" alt="Ad Image" referrerpolicy="no-referrer">`;

        card.innerHTML = `
            <div class="ad-media-wrapper">
                ${mediaTag}
                
                <!-- 상단 좌측: 반응도 오버레이 -->
                ${(ad.likes !== undefined && ad.comments !== undefined) ? `
                <div class="overlay-top-left">
                    <div class="reaction-badge"><i class="fa-solid fa-heart"></i> ${ad.likes.toLocaleString()}</div>
                    <div class="reaction-badge"><i class="fa-solid fa-comment"></i> ${ad.comments.toLocaleString()}</div>
                </div>` : ''}

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
                        : `<div class="status-badge"><i class="fa-regular fa-calendar"></i> ${window._runDaysFallback ? ad._runDays : (ad._runDays || ad.active_days || 30)}일간 게재</div>
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
            <div class="ad-details" style="flex-direction:column;align-items:stretch;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="brand-name">
                        <div class="brand-avatar">${ad.brand.charAt(0).toUpperCase()}</div> ${ad.brand}
                    </div>
                    <button class="btn-ai-analyze analyze-single-btn" title="상세 기획 의도 분석"><i class="fa-solid fa-wand-magic-sparkles"></i> 딥다이브</button>
                </div>
                ${ad.hashtags && ad.hashtags.length > 0 ?
                `<div class="hashtags-container" style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">
                        ${ad.hashtags.map(tag => `<span style="font-size: 0.75rem; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px;">${tag}</span>`).join('')}
                    </div>` : ''}
                ${(ad.direct_link && ad.platform !== 'tiktok') ? `<button class="btn-landing-analyze" style="margin-top:0.5rem;" onclick="event.stopPropagation();window.analyzeLandingPage('${ad.direct_link.replace(/'/g, "\\'")}')" title="광고 랜딩페이지 OG·CTA 분석"><i class="fa-solid fa-globe"></i> 랜딩페이지 분석</button>` : ''}
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
                ad.is_bookmarked = false;
                ad.bookmark_id = null;
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
                    ad.is_bookmarked = true;
                    ad.bookmark_id = saved.id;
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

            let videoFrames = null;
            if (ad.media_type === "video") {
                try {
                    const statusP = modalLoading.querySelector('p');
                    if (statusP) statusP.innerText = "브라우저에서 영상 주요 장면을 추출 중입니다... 최장 10초 소요";
                    videoFrames = await extractVideoFrames(ad.media_url);
                    if (statusP) statusP.innerText = "이 AI는 여러 전문가 모델이 연결되어 조금 시간이 걸립니다...";
                } catch (err) {
                    console.warn("로컬 비디오 프레임 추출 실패 (CORS 등)", err);
                }
            }

            try {
                const res = await fetch("/api/v1/analyze-single", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        media_url: ad.media_url,
                        media_type: ad.media_type,
                        video_frames: videoFrames
                    })
                });
                if (!res.ok) throw new Error("분석 서버 응답 에러");

                const jsonRes = await res.json();

                // 비디오 분석 불가 안내 (alert 대신 모달에 표시)
                if (jsonRes.status === "error" && jsonRes.message) {
                    modalLoading.classList.add("hidden");
                    modalHook.innerHTML = `<span style="font-size:1.5rem;">🚨</span>`;
                    modalBody.innerHTML = `<p style="text-align:center;color:#ef4444;font-size:1rem;margin-top:0.5rem;">${jsonRes.message}</p>`;
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

        // 광고 썸네일(미디어 래퍼) 클릭 시 상세 모달 오픈
        const mediaWrapper = card.querySelector('.ad-media-wrapper');
        mediaWrapper.style.cursor = 'pointer';
        mediaWrapper.addEventListener('click', (e) => {
            // 원본 링크, 북마크 버튼 등 클릭 시 모달 오픈 방지
            if (e.target.closest('.meta-link-btn') || e.target.closest('.ad-bookmark-btn') || e.target.closest('.single-analyze-btn')) return;

            // 모달 오픈 전 비디오가 있다면 일시정지 (선택사항)
            if (ad.media_type === "video") {
                const videoEl = card.querySelector('video');
                if (videoEl && !videoEl.paused) videoEl.pause();
            }

            if (typeof window.showAdDetailModal === 'function') {
                window.showAdDetailModal(ad);
            }
        });

        return card;
    }
    window.createAdCard = createAdCard;

    // ─── 히스토리 & 북마크 모아보기 (전체 화면) ────────────────────────
    // 오버레이 클릭 시 모달 닫기
    document.getElementById('panelOverlay')?.addEventListener('click', () => {
        document.getElementById('panelOverlay').classList.add('hidden');
    });

    // 히스토리 전체 조회
    document.getElementById('historyBtn')?.addEventListener('click', async () => {
        if (!window._motiverseSession) { alert("로그인이 필요합니다."); return; }

        const existingBanner = document.getElementById("historyBanner");
        if (existingBanner) existingBanner.remove();

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

        const existingBanner = document.getElementById("historyBanner");
        if (existingBanner) existingBanner.remove();

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
        ? `<video class="preview-media" src="${ad.media_url}" autoplay loop muted controls playsinline referrerpolicy="no-referrer"></video>`
        : `<img class="preview-media" src="${ad.image_url || ad.media_url || ''}" alt="" referrerpolicy="no-referrer">`;
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
                    adGrid.innerHTML = `<div style="text-align:center;width:100%;grid-column:1 / -1;padding:3rem;color:#64748b;font-size:1rem;line-height:1.6;word-break:keep-all;">
                        이전에 <b>'${detail.query}'</b> 및 대체 키워드들로 반복 탐색했으나 레퍼런스(광고)를 발견하지 못한 기록입니다.<br>다른 브랜드명이나 영문, 혹은 다른 키워드로 다시 검색해 보세요.
                    </div>`;
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

                // 이전 검색의 브랜드 카드 및 AI 추천 검색어 숨기기
                const brandCardContainer = document.getElementById("extractedBrandCardContainer");
                if (brandCardContainer) {
                    brandCardContainer.classList.add("hidden");
                }
                const aiRecommendations = document.getElementById("aiRecommendations");
                if (aiRecommendations) {
                    aiRecommendations.classList.add("hidden");
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

// ─── 원본 보기 & 메타광고 상세 모달 오픈 ──────────────────────────
window.showAdDetailModal = function (ad) {
    const modal = document.getElementById('adDetailModal');
    const modalBody = document.getElementById('adDetailModalBody');
    if (!modal || !modalBody) return;

    // 모달 초기화
    modalBody.innerHTML = '';

    const bodyText = ad.body ? ad.body.replace(/\n/g, '<br>') : '';

    // 플랫폼별 라벨/아이콘
    let platformDisplay = 'Meta';
    let platformIcons = '<i class="fa-brands fa-facebook" style="color:#1877f2"></i> <i class="fa-brands fa-instagram" style="color:#d946ef"></i> <i class="fa-brands fa-facebook-messenger" style="color:#00b2ff"></i>';

    if (ad.platform === 'instagram') {
        platformDisplay = 'Instagram';
        platformIcons = '<i class="fa-brands fa-instagram" style="color:#d946ef"></i>';
    } else if (ad.platform === 'tiktok') {
        platformDisplay = 'TikTok';
        platformIcons = '<i class="fa-brands fa-tiktok"></i>';
    } else if (ad.platform === 'google') {
        platformDisplay = 'Google Ads';
        platformIcons = '<i class="fa-brands fa-google" style="color:#ea4335"></i>';
    }

    const contentHtml = `
        <div style="display:flex; flex-direction:column; gap: 1rem;">
            <!-- 모달 헤더 (플랫폼 & 게재 정보) -->
            <div style="color: #64748b; font-size: 0.9rem; line-height:1.6;">
                <span style="color: #047857; background: #d1fae5; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; margin-right: 8px; font-weight:bold;">
                    <i class="fa-solid fa-circle-check"></i> 활성
                </span><br>
                ${ad.ad_id ? `<span style="display:inline-block; margin-top:5px;">라이브러리 ID: ${ad.ad_id}</span><br>` : ''}
                ${ad.start_date && ad.start_date !== 'N/A' ? `<span>${ad.start_date}에 게재 시작함</span><br>` : ''}
                <span>플랫폼: ${platformIcons}</span>
            </div>
            
            <!-- 광고 실제 보이는 모습 래퍼 -->
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top:0.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <!-- 프로필 영역 -->
                <div style="display:flex; align-items:center; gap: 10px; padding: 1rem 1.2rem;">
                    <div style="width:40px; height:40px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#64748b; overflow: hidden; border: 1px solid #e2e8f0;">
                        ${ad.brand ? (ad.brand_avatar_url ? `<img src="${ad.brand_avatar_url}" style="width:100%; height:100%; object-fit: cover;" />` : ad.brand.charAt(0).toUpperCase()) : 'B'}
                    </div>
                    <div style="line-height:1.2;">
                        <span style="font-size: 1rem; color:#0f172a; font-weight: bold;">${ad.brand || '광고주'}</span><br>
                        <span style="color: #64748b; font-size: 0.75rem;">광고</span>
                    </div>
                </div>
                
                <!-- 본문 텍스트 -->
                ${bodyText ? `
                <div style="padding: 0 1.2rem 1rem 1.2rem; font-size: 0.95rem; line-height: 1.5; color:#1e293b;">
                    ${bodyText}
                </div>` : ''}
                
                <!-- 이미지/영상 원본 -->
                <div style="background:#f8fafc; text-align:center;">
                    ${ad.media_type === "video"
            ? `<video controls autoplay loop playsinline src="${ad.media_url}" style="max-width:100%; max-height: 500px; display:block; margin:0 auto;" referrerpolicy="no-referrer"></video>`
            : `<img src="${ad.media_url}" alt="${ad.brand || 'Ad'}" style="width:100%; display:block; margin:0 auto;" referrerpolicy="no-referrer">`}
                </div>
                
                <!-- 하단 CTA 영역 -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.8rem 1.2rem; background:#f0f2f5; border-top: 1px solid #e2e8f0; cursor:pointer;" onclick="window.open('${ad.direct_link || (ad.ad_id ? `https://www.facebook.com/ads/library/?id=${ad.ad_id}` : '#')}', '_blank')">
                    <div style="display:flex; flex-direction:column; gap:0.2rem;">
                        ${ad.domain ? `<span style="color: #64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">${ad.domain.replace(/^https?:\/\//, '').toUpperCase()}</span>` : `<span style="color: #64748b; font-size:0.75rem; font-weight:600; text-transform:uppercase;">${ad.brand || '광고주'}</span>`}
                        ${ad.headline ? `<span style="font-weight: bold; color: #1c1e21; font-size:0.95rem; line-height:1.2;">${ad.headline}</span>` : `<span style="font-weight: bold; color: #1c1e21; font-size:0.95rem; line-height:1.2;">${ad.analysis_report?.cta || '자세히 알아보기'}</span>`}
                    </div>
                    <a href="${ad.direct_link || (ad.ad_id ? `https://www.facebook.com/ads/library/?id=${ad.ad_id}` : '#')}" target="_blank" style="background: #e2e8f0; color: #1c1e21; padding: 0.4rem 1rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; text-decoration:none; transition: background 0.2s; white-space:nowrap;" onclick="event.stopPropagation()">${ad.cta_text || '더 알아보기'}</a>
                </div>
            </div>
        </div>
    `;

    modalBody.innerHTML = contentHtml;
    modal.classList.remove('hidden');
};

// --- Video Frame Extraction Logic ---
async function extractVideoFrames(videoUrl, frameCount = 3) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; // Important for CORS
        video.muted = true;
        video.src = videoUrl;
        video.playsInline = true;

        video.addEventListener('loadedmetadata', async () => {
            const duration = video.duration || 10;
            const frames = [];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const times = [0.1, duration * 0.33, duration * 0.66];

            for (let t of times) {
                await new Promise((resSeek) => {
                    video.onseeked = () => {
                        const scale = Math.min(640 / (video.videoWidth || 640), 360 / (video.videoHeight || 360), 1);
                        canvas.width = (video.videoWidth || 640) * scale;
                        canvas.height = (video.videoHeight || 360) * scale;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        try {
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                            frames.push(dataUrl.split(',')[1]); // only base64 string
                        } catch (e) {
                            console.warn("Canvas Tainted (CORS) - cannot extract frame");
                        }
                        resSeek();
                    };
                    video.onerror = () => resSeek();
                    video.currentTime = t;
                });
            }
            resolve(frames);
        });

        video.addEventListener('error', (e) => reject(e));
        video.load();
    });
}
