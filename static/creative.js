// === Wizard Step Navigation (Global) ===
window.goWizardStep = function (step) {
    // Hide all panels
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.add('hidden'));
    // Show target
    const target = document.getElementById('wizardStep' + step);
    if (target) target.classList.remove('hidden');

    // Update step indicators
    document.querySelectorAll('.wizard-step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        const numEl = s.querySelector('.wizard-num');
        const labelEl = s.querySelector('span');
        if (sNum <= step) {
            s.classList.add('active');
            if (numEl) { numEl.style.background = 'var(--accent-blue)'; numEl.style.color = 'white'; }
            if (labelEl) labelEl.style.color = 'var(--text-main)';
        } else {
            s.classList.remove('active');
            if (numEl) { numEl.style.background = '#e2e8f0'; numEl.style.color = '#94a3b8'; }
            if (labelEl) labelEl.style.color = '#94a3b8';
        }
    });
    // Update connecting lines
    document.querySelectorAll('.wizard-line').forEach((line, i) => {
        line.style.background = (i + 1 < step) ? 'var(--accent-blue)' : '#e2e8f0';
    });

    // Step 3 진입 시: On Image Texts 미리보기 동기화
    if (step === 3) {
        const main = document.getElementById('copyMain');
        const sub = document.getElementById('copySub');
        const cta = document.getElementById('copyCta');
        const pMain = document.getElementById('previewCopyMain');
        const pSub = document.getElementById('previewCopySub');
        const pCta = document.getElementById('previewCopyCta');
        if (main && pMain) pMain.textContent = main.value;
        if (sub && pSub) pSub.textContent = sub.value;
        if (cta && pCta) pCta.textContent = cta.value;

        // 캔버스 초기화 (최초 열릴 때)
        if (!window.creativeCanvasInstance && window.fabric) {
            setTimeout(() => {
                if (typeof initCreativeCanvas === 'function') initCreativeCanvas();
            }, 100);
        }
    }

    // 스크롤 맨 위로
    document.querySelector('#creativeView main')?.scrollTo(0, 0);
};

document.addEventListener("DOMContentLoaded", () => {
    // Wizard step indicator click
    document.querySelectorAll('.wizard-step').forEach(s => {
        s.addEventListener('click', () => {
            window.goWizardStep(parseInt(s.dataset.step));
        });
    });

    // === Tab Switching Logic ===
    const navReference = document.getElementById("navReference");
    const navCreative = document.getElementById("navCreative");
    const referenceView = document.getElementById("referenceView");
    const creativeView = document.getElementById("creativeView");

    navReference.addEventListener("click", (e) => {
        e.preventDefault();
        navReference.parentElement.classList.add("active");
        navCreative.parentElement.classList.remove("active");

        referenceView.classList.remove("hidden");
        creativeView.classList.add("hidden");

        // Show icons if user is logged in
        if (!document.getElementById('userInfo')?.classList.contains('hidden')) {
            document.getElementById('monitorBtn')?.classList.remove('hidden');
            document.getElementById('boardsBtn')?.classList.remove('hidden');
            document.getElementById('historyBtn')?.classList.remove('hidden');
            document.getElementById('bookmarkBtn')?.classList.remove('hidden');
        }
    });

    navCreative.addEventListener("click", (e) => {
        e.preventDefault();
        navCreative.parentElement.classList.add("active");
        navReference.parentElement.classList.remove("active");

        creativeView.classList.remove("hidden");
        referenceView.classList.add("hidden");

        // Hide icons
        document.getElementById('monitorBtn')?.classList.add('hidden');
        document.getElementById('boardsBtn')?.classList.add('hidden');
        document.getElementById('historyBtn')?.classList.add('hidden');
        document.getElementById('bookmarkBtn')?.classList.add('hidden');

        // 위저드 Step 1으로 초기화
        window.goWizardStep(1);
    });

    // === Fabric.js Canvas Initialization ===
    function initCreativeCanvas() {
        if (!window.fabric) return;

        // 캔버스 사이즈 비율 처리 (실제 렌더 사이즈 vs 화면 표시 사이즈)
        const wrapper = document.getElementById("canvasWrapper");

        // 캔버스 초기화 (예: 1200x628 피드)
        window.creativeCanvasInstance = new fabric.Canvas('creativeCanvas', {
            width: 1200,
            height: 628,
            backgroundColor: '#ffffff'
        });

        // HTML 캔버스 요소를 래퍼 크기에 맞게 스케일
        resizeCanvasToDisplaySize();

        // 브라우저 리사이즈 시 비율 유지 처리
        window.addEventListener('resize', resizeCanvasToDisplaySize);
    }

    function resizeCanvasToDisplaySize() {
        const wrapper = document.getElementById("canvasWrapper");
        const canvas = window.creativeCanvasInstance;
        if (!canvas) return;

        // 실제 캔버스 내부 해상도 (e.g. 1200x628)
        const baseWidth = canvas.getWidth();
        const baseHeight = canvas.getHeight();

        const wrapperWidth = wrapper.clientWidth - 40; // 여백 20px씩
        const wrapperHeight = wrapper.clientHeight - 40;

        const scale = Math.min(
            wrapperWidth / baseWidth,
            wrapperHeight / baseHeight
        );

        // 컨테이너/캔버스의 CSS 표시 속성만 변경
        const canvasEl = document.querySelector('.canvas-container');
        if (canvasEl) {
            canvasEl.style.position = 'absolute';
            canvasEl.style.left = '50%';
            canvasEl.style.top = '50%';
            canvasEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
            canvasEl.style.transformOrigin = 'center center';
        }

        document.getElementById('canvasEmptyState').style.display = 'none';
        canvas.calcOffset();
    }

    // === 플랫폼 & 사이즈 변경 로직 (기초) ===
    const platformTabs = document.querySelectorAll('#creativePlatformTabs .tab-chip');
    const sizeSelect = document.getElementById('canvasSizeSelect');

    if (platformTabs && platformTabs.length > 0) {
        platformTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // 활성 탭 디자인 변경
                platformTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const platform = tab.dataset.platform;
                updateSizeOptionsByPlatform(platform);
            });
        });
    }

    if (sizeSelect) {
        sizeSelect.addEventListener('change', (e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            updateCanvasResolution(w, h);
        });
    }

    function updateSizeOptionsByPlatform(platform) {
        // 플랫폼별 옵션 동적 갱신
        const selectEl = document.getElementById('canvasSizeSelect');
        const warningEl = document.getElementById('creativeRuleWarning');
        if (!selectEl || !warningEl) return;

        let options = '';
        if (platform === 'naver') {
            options = `
                <option value="1200x628">피드 및 네이티브 (1200x628)</option>
                <option value="600x600">스퀘어 썸네일 (600x600)</option>
                <option value="342x228">PC 스마트채널 (342x228)</option>
                <option value="1200x1800">세로형 피드 (1200x1800)</option>
            `;
            warningEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>텍스트 면적 20% 이내 (단색 배경 불가)</span>';
            warningEl.style.background = '#fff1f2';
            warningEl.style.color = '#e11d48';
            warningEl.style.borderColor = '#ffe4e6';
        } else if (platform === 'kakao') {
            options = `
                <option value="1200x600">와이드 피드 (1200x600)</option>
                <option value="500x500">배너 (500x500)</option>
                <option value="720x1280">풀스크린 (720x1280)</option>
                <option value="800x1000">세로형 (800x1000)</option>
            `;
            warningEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>Safe Zone 침범 주의 (투명도 불가)</span>';
            warningEl.style.background = '#fffbeb';
            warningEl.style.color = '#d97706';
            warningEl.style.borderColor = '#fef3c7';
        } else if (platform === 'meta') {
            options = `
                <option value="1080x1080">스퀘어 (1080x1080)</option>
                <option value="1080x1350">세로형 피드 (1080x1350)</option>
                <option value="1080x1920">스토리/릴스 (1080x1920)</option>
            `;
            warningEl.innerHTML = '<i class="fa-solid fa-info-circle" style="margin-right:0.4rem;"></i> <span>상하단 릴스 UI 가려짐 주의 (Safe Zone)</span>';
            warningEl.style.background = '#eff6ff';
            warningEl.style.color = '#2563eb';
            warningEl.style.borderColor = '#dbeafe';
        }

        selectEl.innerHTML = options;


        // 첫 번째 사이즈로 변경 유도
        const [w, h] = selectEl.value.split('x').map(Number);
        updateCanvasResolution(w, h);
    }

    function updateCanvasResolution(width, height) {
        const canvas = window.creativeCanvasInstance;
        if (!canvas) return;

        canvas.setWidth(width);
        canvas.setHeight(height);

        // 리사이즈
        resizeCanvasToDisplaySize();
        // 세이프존 가이드라인 업데이트 (추후 구현)
        const currentPlatform = document.querySelector('#creativePlatformTabs .active')?.dataset?.platform || 'naver';
        updateSafeZoneGuide(width, height, currentPlatform);
    }

    function updateSafeZoneGuide(width, height) {
        // TODO: 사이즈별 여백/규칙에 따른 세이프존 렌더링 로직 연동
        const overlay = document.getElementById('safeZoneOverlay');
        if (overlay) {
            // 임시
            overlay.style.display = 'none';
        }
    }

    // === Step 1: Create Brand Logic ===
    const brandLogoInput = document.getElementById('brandLogo');
    const brandLogoPreview = document.getElementById('brandLogoPreview');
    // btnScanWebsite, brandWebsiteUrl, brandName → 아래 API 연동 블록에서 직접 접근
    const brandCustomFont = document.getElementById('brandCustomFont');
    const brandCustomFontLabel = document.getElementById('brandCustomFontLabel');
    const brandColor1 = document.getElementById('brandColor1');
    const brandColor2 = document.getElementById('brandColor2');

    // 1-1. Logo Preview
    if (brandLogoInput && brandLogoPreview) {
        brandLogoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    brandLogoPreview.innerHTML = `<img src="${event.target.result}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`;
                };
                reader.readAsDataURL(file);
            } else {
                brandLogoPreview.innerHTML = '<i class="fa-solid fa-image"></i>';
            }
        });
    }

    // 1-2. Website Scan → 아래 API 연동 코드에서 처리



    // 1-3. Custom Font Load
    if (brandCustomFont && brandCustomFontLabel) {
        brandCustomFont.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async function (event) {
                    try {
                        const fontName = 'CustomBrandFont_' + Date.now();
                        const font = new FontFace(fontName, event.target.result);
                        await font.load();
                        document.fonts.add(font);

                        brandCustomFontLabel.textContent = file.name;
                        brandCustomFontLabel.style.color = '#10b981';
                        // 글로벌 객체나 상태에 저장하여 Fabric.js 에서 사용 가능하도록 할 수 있음
                        window.currentBrandFont = fontName;
                        alert('커스텀 폰트가 성공적으로 로드되었습니다. 텍스트 요소에 적용됩니다.');
                    } catch (err) {
                        console.error('폰트 로드 실패:', err);
                        alert('폰트 파일을 로드하는데 실패했습니다.');
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                brandCustomFontLabel.textContent = 'Default (Pretendard)';
                brandCustomFontLabel.style.color = '#94a3b8';
                window.currentBrandFont = null;
            }
        });
    }



    // Step 3: Render Preview → 아래 Generate Creative에서 처리



    // Initialize default platform on load
    if (document.getElementById('canvasSizeSelect')) {
        updateSizeOptionsByPlatform('naver');
    }

    // ═══════════════════════════════════════════════════════
    // Step 1: Website Scan → /api/v1/scan-brand
    // ═══════════════════════════════════════════════════════
    const btnScanWebsite = document.getElementById('btnScanWebsite');
    if (btnScanWebsite) {
        btnScanWebsite.addEventListener('click', async () => {
            const urlInput = document.getElementById('brandWebsiteUrl');
            const url = urlInput?.value?.trim();
            if (!url) { alert('웹사이트 URL을 입력하세요.'); return; }

            btnScanWebsite.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 스캔 중...';
            btnScanWebsite.disabled = true;

            try {
                const res = await fetch('/api/v1/scan-brand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                const json = await res.json();
                if (json.status === 'success' && json.data) {
                    const d = json.data;
                    if (d.brand_name && document.getElementById('brandName')) {
                        document.getElementById('brandName').value = d.brand_name;
                    }
                    if (d.color1 && document.getElementById('brandColor1')) {
                        document.getElementById('brandColor1').value = d.color1;
                    }
                    if (d.color2 && document.getElementById('brandColor2')) {
                        document.getElementById('brandColor2').value = d.color2;
                    }
                    // 스캔 결과 간단 표시
                    const info = [];
                    if (d.brand_name) info.push(`브랜드: ${d.brand_name}`);
                    if (d.color1) info.push(`메인컬러: ${d.color1}`);
                    if (d.domain) info.push(`도메인: ${d.domain}`);

                    let alertMsg = `웹사이트 스캔 완료!\n${info.join('\n')}`;
                    if (json.message) {
                        alertMsg += `\n\n* 참고: ${json.message}`;
                    }
                    alert(alertMsg);
                } else {
                    alert('스캔에 문제가 발생했습니다: ' + (json.message || '알 수 없는 오류'));
                }
            } catch (e) {
                alert('스캔 오류: ' + e.message);
            } finally {
                btnScanWebsite.innerHTML = '<i class="fa-solid fa-globe" style="margin-right: 0.3rem;"></i> 스캔';
                btnScanWebsite.disabled = false;
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Step 1: Brand Save/Load → /api/v1/brands + localStorage fallback
    // ═══════════════════════════════════════════════════════
    const savedBrandSelect = document.getElementById('savedBrandSelect');
    const btnSaveBrand = document.getElementById('btnSaveBrand');

    async function loadSavedBrandsList() {
        if (!savedBrandSelect) return;
        savedBrandSelect.innerHTML = '<option value="">저장된 브랜드 불러오기</option>';

        // Supabase API 시도 → 실패 시 localStorage fallback
        if (window._motiverseSession) {
            try {
                const res = await fetch('/api/v1/brands', { headers: window.getAuthHeaders?.() || {} });
                const json = await res.json();
                if (json.data && json.data.length > 0) {
                    json.data.forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b.id;
                        opt.dataset.source = 'api';
                        opt.dataset.brandData = JSON.stringify(b);
                        opt.textContent = `${b.name} (${b.url || 'API 저장'})`;
                        savedBrandSelect.appendChild(opt);
                    });
                    return;
                }
            } catch (e) { console.warn('API 브랜드 로드 실패, localStorage 사용:', e); }
        }

        // localStorage fallback
        const brands = JSON.parse(localStorage.getItem('savedBrands') || '[]');
        brands.forEach((b, i) => {
            const opt = document.createElement('option');
            opt.value = `local_${i}`;
            opt.dataset.source = 'local';
            opt.dataset.brandData = JSON.stringify(b);
            opt.textContent = `${b.name} (${b.url || '로컬'})`;
            savedBrandSelect.appendChild(opt);
        });
    }

    if (btnSaveBrand) {
        btnSaveBrand.addEventListener('click', async () => {
            const name = document.getElementById('brandName')?.value?.trim();
            if (!name) { alert('브랜드명을 입력해주세요.'); return; }

            const brandData = {
                name,
                url: document.getElementById('brandWebsiteUrl')?.value || '',
                color1: document.getElementById('brandColor1')?.value || '#0f172a',
                color2: document.getElementById('brandColor2')?.value || '#3b82f6',
            };

            btnSaveBrand.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btnSaveBrand.disabled = true;

            try {
                // Supabase 저장 시도
                if (window._motiverseSession) {
                    const res = await fetch('/api/v1/brands', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(window.getAuthHeaders?.() || {}) },
                        body: JSON.stringify(brandData)
                    });
                    const json = await res.json();
                    if (json.status === 'success') {
                        await loadSavedBrandsList();
                        alert(`"${name}" 브랜드가 서버에 저장되었습니다!`);
                        btnSaveBrand.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 0.3rem;"></i> 저장';
                        btnSaveBrand.disabled = false;
                        return;
                    }
                }
            } catch (e) { console.warn('API 저장 실패, localStorage 사용:', e); }

            // localStorage fallback
            const brands = JSON.parse(localStorage.getItem('savedBrands') || '[]');
            const existing = brands.findIndex(b => b.name === name);
            if (existing >= 0) brands[existing] = { ...brandData, savedAt: new Date().toISOString() };
            else brands.push({ ...brandData, savedAt: new Date().toISOString() });
            localStorage.setItem('savedBrands', JSON.stringify(brands));
            await loadSavedBrandsList();
            alert(`"${name}" 브랜드가 로컬에 저장되었습니다!`);

            btnSaveBrand.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 0.3rem;"></i> 저장';
            btnSaveBrand.disabled = false;
        });
    }

    if (savedBrandSelect) {
        savedBrandSelect.addEventListener('change', (e) => {
            const selected = e.target.selectedOptions[0];
            if (!selected || !selected.dataset.brandData) return;
            try {
                const brand = JSON.parse(selected.dataset.brandData);
                if (document.getElementById('brandName')) document.getElementById('brandName').value = brand.name || '';
                if (document.getElementById('brandWebsiteUrl')) document.getElementById('brandWebsiteUrl').value = brand.url || '';
                if (document.getElementById('brandColor1')) document.getElementById('brandColor1').value = brand.color1 || '#0f172a';
                if (document.getElementById('brandColor2')) document.getElementById('brandColor2').value = brand.color2 || '#3b82f6';
            } catch (err) { console.error('브랜드 데이터 파싱 실패:', err); }
            savedBrandSelect.value = '';
        });
        loadSavedBrandsList();
    }

    // ═══════════════════════════════════════════════════════
    // Step 2: Reference Load → /api/v1/monitor-alerts (실제 API)
    // ═══════════════════════════════════════════════════════
    const btnLoadReferences = document.getElementById('btnLoadReferences');
    const referenceList = document.getElementById('referenceList');
    window._selectedReferences = []; // 선택된 레퍼런스 광고 데이터

    if (btnLoadReferences && referenceList) {
        btnLoadReferences.addEventListener('click', async () => {
            btnLoadReferences.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...';
            btnLoadReferences.disabled = true;

            try {
                // 실제 모니터링 알림 API 호출
                const headers = window.getAuthHeaders?.() || {};
                const res = await fetch('/api/v1/monitor-alerts', { headers });
                const json = await res.json();

                referenceList.innerHTML = '';
                window._selectedReferences = [];
                updateSelectedCount();

                if (!json.data || json.data.length === 0) {
                    referenceList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;"><i class="fa-solid fa-circle-info" style="margin-right: 0.3rem;"></i> 모니터링 알림이 없습니다. 먼저 경쟁사를 등록하고 체크해주세요.</div>';
                    return;
                }

                // 알림에서 광고 추출해서 그리드로 표시
                let totalAds = 0;
                json.data.forEach(alert => {
                    const adsData = alert.ads_data || [];
                    adsData.forEach((ad, i) => {
                        totalAds++;
                        const card = document.createElement('div');
                        card.className = 'ref-card';
                        card.dataset.adData = JSON.stringify(ad);
                        card.style.cssText = 'border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; position: relative;';

                        const mediaUrl = ad.media_url || '';
                        const isVideo = ad.media_type === 'video';
                        const brandName = ad.brand || alert.brand_name || '';
                        const platform = ad.platform || '';

                        // 실제 이미지가 있으면 표시, 없으면 그라디언트
                        const mediaHtml = mediaUrl && !isVideo
                            ? `<img src="${mediaUrl}" style="width:100%;aspect-ratio:1;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div style="aspect-ratio:1;background:linear-gradient(135deg,${getRandomGradient()});display:none;align-items:center;justify-content:center;font-size:0.75rem;color:white;font-weight:600;text-align:center;padding:0.5rem;">${brandName}<br><span style="font-size:0.65rem;opacity:0.8;">${platform}</span></div>`
                            : `<div style="aspect-ratio:1;background:linear-gradient(135deg,${getRandomGradient()});display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:white;font-weight:600;text-align:center;padding:0.5rem;">${brandName}${isVideo ? '<br><span style="font-size:0.65rem;opacity:0.8;"><i class="fa-solid fa-video"></i> Video</span>' : `<br><span style="font-size:0.65rem;opacity:0.8;">${platform}</span>`}</div>`;

                        card.innerHTML = `
                            ${mediaHtml}
                            <div style="position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:white;border:2px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:transparent;" class="ref-check">
                                <i class="fa-solid fa-check"></i>
                            </div>
                            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:white;padding:3px 6px;font-size:0.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${brandName}</div>
                        `;

                        card.addEventListener('click', () => {
                            card.classList.toggle('selected');
                            const check = card.querySelector('.ref-check');
                            if (card.classList.contains('selected')) {
                                card.style.borderColor = 'var(--accent-blue)';
                                card.style.boxShadow = '0 0 0 1px var(--accent-blue)';
                                check.style.background = 'var(--accent-blue)';
                                check.style.borderColor = 'var(--accent-blue)';
                                check.style.color = 'white';
                                window._selectedReferences.push(ad);
                            } else {
                                card.style.borderColor = 'transparent';
                                card.style.boxShadow = 'none';
                                check.style.background = 'white';
                                check.style.borderColor = '#cbd5e1';
                                check.style.color = 'transparent';
                                window._selectedReferences = window._selectedReferences.filter(r => r !== ad);
                            }
                            updateSelectedCount();
                        });
                        referenceList.appendChild(card);
                    });
                });

                if (totalAds === 0) {
                    referenceList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;">광고 데이터를 찾을 수 없습니다.</div>';
                }

            } catch (e) {
                console.error('레퍼런스 로드 실패:', e);
                referenceList.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; font-size: 0.9rem; padding: 1rem;">로드 실패: ${e.message}</div>`;
            } finally {
                btnLoadReferences.innerHTML = '<i class="fa-solid fa-rotate" style="margin-right: 0.3rem;"></i> 모니터링 데이터에서 불러오기';
                btnLoadReferences.disabled = false;
            }
        });
    }

    function updateSelectedCount() {
        const count = window._selectedReferences?.length || 0;
        const el = document.getElementById('selectedRefCount');
        if (el) el.textContent = count;
    }

    function getRandomGradient() {
        const gradients = [
            '#667eea, #764ba2', '#f093fb, #f5576c', '#4facfe, #00f2fe',
            '#43e97b, #38f9d7', '#fa709a, #fee140', '#a18cd1, #fbc2eb',
            '#ffecd2, #fcb69f', '#89f7fe, #66a6ff', '#c471f5, #fa71cd',
            '#48c6ef, #6f86d6', '#feada6, #f5efef', '#a1c4fd, #c2e9fb'
        ];
        return gradients[Math.floor(Math.random() * gradients.length)];
    }

    // ═══════════════════════════════════════════════════════
    // Step 2: AI Strategy Generation → /api/v1/generate-strategy
    // ═══════════════════════════════════════════════════════
    const btnGenerateAI = document.getElementById('btnGenerateAI');
    if (btnGenerateAI) {
        btnGenerateAI.addEventListener('click', async () => {
            const brandName = document.getElementById('brandName')?.value?.trim() || '';
            const brandColor1 = document.getElementById('brandColor1')?.value || '#0f172a';
            const brandColor2 = document.getElementById('brandColor2')?.value || '#3b82f6';

            btnGenerateAI.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.3rem;"></i> AI 전략 생성 중...';
            btnGenerateAI.disabled = true;

            // 결과 영역 준비
            const strategyResult = document.getElementById('strategyResult');
            if (strategyResult) {
                strategyResult.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><i class="fa-solid fa-wand-magic-sparkles fa-2x fa-beat-fade" style="color:var(--accent-blue);"></i><p style="margin-top:1rem;">AI가 브랜드와 레퍼런스를 분석하여 최적의 전략을 생성하고 있습니다...</p></div>';
                strategyResult.classList.remove('hidden');
            }

            try {
                const payload = {
                    brand_name: brandName,
                    brand_color1: brandColor1,
                    brand_color2: brandColor2,
                    reference_ads: (window._selectedReferences || []).slice(0, 5)
                };

                const res = await fetch('/api/v1/generate-strategy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(window.getAuthHeaders?.() || {}) },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();

                if (json.status === 'success' && json.data) {
                    const s = json.data;

                    // Step 2 결과 표시
                    if (strategyResult) {
                        strategyResult.innerHTML = `
                            <div style="background: linear-gradient(135deg, #f0f9ff, #ede9fe); border-radius: 12px; padding: 1.2rem; margin-bottom: 1rem;">
                                <h4 style="margin: 0 0 0.5rem; color: var(--text-main); font-size: 1rem;"><i class="fa-solid fa-lightbulb" style="color: #f59e0b; margin-right: 0.3rem;"></i> 전략 요약 (15년차 CD 인사이트)</h4>
                                <p style="margin: 0; font-size: 0.9rem; color: var(--text-sub); line-height: 1.6;">${s.strategy_summary || ''}</p>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem;">
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.3rem;">타겟 오디언스</div>
                                    <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${s.target_audience || ''}</div>
                                </div>
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.3rem;">톤 앤 매너</div>
                                    <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${s.tone_and_manner || ''}</div>
                                </div>
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem; grid-column: 1 / -1;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.3rem;">비주얼 가이드 & 레이아웃</div>
                                    <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.4;">${s.visual_guide || ''}</div>
                                </div>
                            </div>
                            <div style="background: var(--accent-blue); color: white; border-radius: 10px; padding: 1rem; margin-bottom: 0.8rem;">
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.3rem;">AI 생성 메인 카피</div>
                                <div style="font-size: 1.3rem; font-weight: 700;">${s.main_headline || ''}</div>
                                <div style="font-size: 0.9rem; margin-top: 0.3rem; opacity: 0.9;">${s.sub_copy || ''}</div>
                                <div style="margin-top: 0.5rem;"><span style="background: white; color: var(--accent-blue); padding: 4px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">${s.cta_text || 'CTA'}</span></div>
                            </div>
                            ${s.alternative_headlines?.length > 0 ? `
                                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.8rem;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.4rem;"><i class="fa-solid fa-shuffle" style="margin-right: 0.3rem;"></i> 대안 헤드라인</div>
                                    ${s.alternative_headlines.map((h, i) => `<div style="font-size: 0.85rem; color: var(--text-main); padding: 0.3rem 0; border-bottom: 1px solid #f1f5f9; cursor: pointer;" class="alt-headline" data-text="${h?.replace?.(/"/g, '&quot;') || ''}" title="클릭하면 메인 카피에 적용">• ${h}</div>`).join('')}
                                </div>
                            ` : ''}
                        `;

                        // 대안 헤드라인 클릭 시 메인에 적용
                        strategyResult.querySelectorAll('.alt-headline').forEach(el => {
                            el.addEventListener('click', () => {
                                const text = el.dataset.text;
                                if (document.getElementById('copyMain')) document.getElementById('copyMain').value = text;
                            });
                        });
                    }

                    // Step 3 On Image Texts에 자동 입력
                    if (s.main_headline && document.getElementById('copyMain')) {
                        document.getElementById('copyMain').value = s.main_headline;
                    }
                    if (s.sub_copy && document.getElementById('copySub')) {
                        document.getElementById('copySub').value = s.sub_copy;
                    }
                    if (s.cta_text && document.getElementById('copyCta')) {
                        document.getElementById('copyCta').value = s.cta_text;
                    }
                    // AI 이미지 생성 프롬프트 자동 입력
                    if (s.ai_image_prompt && document.getElementById('creativePrompt')) {
                        document.getElementById('creativePrompt').value = s.ai_image_prompt;
                    }

                    // 전역에 저장 (Step 3에서 활용)
                    window._aiStrategy = s;

                } else {
                    if (strategyResult) {
                        strategyResult.innerHTML = `<div style="text-align:center;padding:1rem;color:#ef4444;">${json.message || 'AI 전략 생성 실패'}</div>`;
                    }
                }
            } catch (e) {
                console.error('AI 전략 생성 오류:', e);
                if (strategyResult) {
                    strategyResult.innerHTML = `<div style="text-align:center;padding:1rem;color:#ef4444;">오류: ${e.message}</div>`;
                }
            } finally {
                btnGenerateAI.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.3rem;"></i> AI 전략 생성';
                btnGenerateAI.disabled = false;
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Step 3: Image Type Selection Toggle (스타일 동적 변경)
    // ═══════════════════════════════════════════════════════
    window._selectedImgType = 'lifestyle';

    document.querySelectorAll('.img-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.img-type-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = '#f4f6f9';
                b.style.color = '#475569';
                b.style.fontWeight = '500';
                b.style.boxShadow = 'none';
            });
            btn.classList.add('active');
            btn.style.background = '#3b82f6';
            btn.style.color = 'white';
            btn.style.fontWeight = '600';
            btn.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.3)';
            window._selectedImgType = btn.dataset.type;
        });
    });

    // ═══════════════════════════════════════════════════════
    // Step 3: Product Image Upload
    // ═══════════════════════════════════════════════════════
    const productImageInput = document.getElementById('productImageInput');
    window._productImages = [];

    if (productImageInput) {
        productImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                window._productImages.push({
                    name: file.name,
                    dataUrl: ev.target.result,
                    file: file
                });

                // 썸네일 표시
                const previewArea = document.getElementById('productPreviewArea');
                const thumbnails = document.getElementById('productThumbnails');
                const emptyMsg = document.getElementById('productEmptyMsg');

                if (previewArea) previewArea.classList.remove('hidden');
                if (emptyMsg) emptyMsg.classList.add('hidden');

                if (thumbnails) {
                    const thumb = document.createElement('div');
                    thumb.style.cssText = 'position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;';
                    thumb.innerHTML = `
                        <img src="${ev.target.result}" style="width: 100%; height: 100%; object-fit: cover;" />
                        <div style="position: absolute; top: -4px; right: -4px; width: 18px; height: 18px; background: #ef4444; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; cursor: pointer;" 
                             onclick="this.parentElement.remove(); window._productImages.pop();">
                            <i class="fa-solid fa-xmark"></i>
                        </div>
                    `;
                    thumbnails.appendChild(thumb);
                }
            };
            reader.readAsDataURL(file);
            productImageInput.value = ''; // 같은 파일 재업로드 가능하게
        });
    }

    // ═══════════════════════════════════════════════════════
    // Step 3: AI Auto Prompt
    // ═══════════════════════════════════════════════════════
    const btnAutoPrompt = document.getElementById('btnAutoPrompt');
    if (btnAutoPrompt) {
        btnAutoPrompt.addEventListener('click', () => {
            const brandName = document.getElementById('brandName')?.value?.trim() || '';
            const imgType = window._selectedImgType || 'lifestyle';
            const strategy = window._aiStrategy || {};

            const typeLabels = {
                'realistic': '실사형 장면',
                'product': '제품 모형',
                'banner': '배너형 광고',
                'hero': '브랜드 히어로',
                'lifestyle': '라이프스타일',
                'event': '이벤트/프로모션'
            };

            const prompts = {
                'realistic': `${brandName} 제품이 자연광이 들어오는 세련된 공간에 자연스럽게 놓여 있는 실사 사진. 부드러운 그림자와 따뜻한 톤의 조명. 고급스러운 느낌.`,
                'product': `${brandName} 제품을 깨끗한 배경에서 상업용 사진 스타일로 촬영한 모습. 제품 디테일이 선명하게 보이는 스튜디오 라이팅.`,
                'banner': `${brandName}의 온라인 배너 광고. ${strategy.tone_and_manner || '모던하고 세련된'} 느낌. 주목도 높은 컬러 대비와 깔끔한 레이아웃.`,
                'hero': `${brandName} 브랜드의 히어로 이미지. 브랜드 아이덴티티를 강하게 전달하는 임팩트 있는 비주얼. 시네마틱한 구도와 조명.`,
                'lifestyle': `${brandName} 제품을 사용하는 사람들의 라이프스타일 장면. 자연스럽고 따뜻한 분위기. ${strategy.target_audience || '2030 세대'}가 공감할 수 있는 일상.`,
                'event': `${brandName}의 특별 할인 이벤트 프로모션 배너. 눈에 띄는 ${strategy.tone_and_manner || '역동적인'} 디자인. 긴급감과 혜택이 강조된 구성.`
            };

            const prompt = prompts[imgType] || prompts['lifestyle'];
            const promptEl = document.getElementById('creativePrompt');
            if (promptEl) {
                promptEl.value = prompt;
                promptEl.style.transition = 'box-shadow 0.3s';
                promptEl.style.boxShadow = '0 0 0 2px var(--accent-blue)';
                setTimeout(() => { promptEl.style.boxShadow = 'none'; }, 1500);
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Step 3: Generate Creative (Fabric.js 캔버스 렌더링)
    // ═══════════════════════════════════════════════════════
    const btnPreviewRender = document.getElementById('btnPreviewRender');
    if (btnPreviewRender) {
        btnPreviewRender.addEventListener('click', async () => {
            const canvas = window.creativeCanvasInstance;
            if (!canvas && window.fabric) {
                // 캔버스가 아직 없으면 초기화
                if (typeof initCreativeCanvas === 'function') initCreativeCanvas();
            }

            const fc = window.creativeCanvasInstance;
            if (!fc) {
                alert('캔버스를 초기화할 수 없습니다. Fabric.js를 확인해주세요.');
                return;
            }

            btnPreviewRender.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.3rem;"></i> 생성 중...';
            btnPreviewRender.disabled = true;

            try {
                // 캔버스 클리어
                fc.clear();

                // 사이즈 가져오기
                const sizeSelect = document.getElementById('canvasSizeSelect');
                const [cw, ch] = (sizeSelect?.value || '1200x628').split('x').map(Number);
                fc.setWidth(cw);
                fc.setHeight(ch);

                // 브랜드 컬러 (나중 텍스트 배치에 사용됨)
                const color1 = document.getElementById('brandColor1')?.value || '#0f172a';
                const color2 = document.getElementById('brandColor2')?.value || '#3b82f6';

                // 캔버스 사이즈에 맞는 Aspect Ratio 계산하여 전달
                let ar = "1:1";
                const ratio = cw / ch;
                if (ratio > 1.3) ar = "16:9";
                else if (ratio < 0.75) ar = "9:16";
                else if (ratio > 1.1) ar = "4:3";
                else if (ratio < 0.9) ar = "3:4";

                const promptInput = document.getElementById('creativePrompt')?.value || '멋진 브랜드 라이프스타일 이미지';

                try {
                    btnPreviewRender.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.3rem;"></i> AI 생성 중 (10~20초)...';
                    const imgRes = await fetch('/api/v1/generate-creative-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ prompt: promptInput, aspect_ratio: ar })
                    });
                    const imgJson = await imgRes.json();

                    if (imgJson.status === 'success' && imgJson.data?.image_b64) {
                        if (!window._creativeHistory) window._creativeHistory = [];
                        const newThumb = { id: Date.now(), b64: imgJson.data.image_b64, prompt: promptInput };
                        window._creativeHistory.push(newThumb);
                        window._currentActiveImageId = newThumb.id;
                        window._currentActiveImageB64 = newThumb.b64;
                        if (typeof window.renderCreativeThumbnailHistory === 'function') {
                            window.renderCreativeThumbnailHistory();
                        }
                        await window.applyCreativeCanvasLayout(window._currentActiveImageB64);
                    } else {
                        throw new Error(imgJson.message || '이미지 생성 실패');
                    }
                } catch (apiErr) {
                    console.error('API Error:', apiErr);
                    alert('AI 이미지 생성에 실패했습니다.\n\n에러 내용: ' + apiErr.message);
                    await window.applyCreativeCanvasLayout(null);
                }

            } catch (err) {
                console.error('크리에이티브 생성 오류:', err);
                alert('크리에이티브 생성 중 오류가 발생했습니다: ' + err.message);
            } finally {
                btnPreviewRender.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.3rem;"></i> Generate Creative';
                btnPreviewRender.disabled = false;
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Step 3: On Image Text 실시간 프리뷰 (dice 아이콘 → 랜덤)
    // ═══════════════════════════════════════════════════════
    document.querySelectorAll('.fa-dice').forEach(dice => {
        dice.addEventListener('click', () => {
            const input = dice.parentElement.querySelector('input');
            if (!input) return;
            const strategy = window._aiStrategy;
            if (!strategy) return;

            const id = input.id;
            if (id === 'copyMain' && strategy.alternative_headlines?.length) {
                const random = strategy.alternative_headlines[Math.floor(Math.random() * strategy.alternative_headlines.length)];
                input.value = random;
            } else if (id === 'copySub') {
                input.value = strategy.sub_copy || input.value;
            } else if (id === 'copyCta') {
                const ctas = ['지금 확인하기', '자세히 보기', '무료 체험하기', '시작하기', '지금 구매하기', '알아보기'];
                input.value = ctas[Math.floor(Math.random() * ctas.length)];
            }
        });
    });

});

// ============================================
// Thumbnails & Layout Drawing Logic
// ============================================
window._creativeHistory = [];
window._currentActiveImageId = null;
window._currentActiveImageB64 = null;

window.renderCreativeThumbnailHistory = function () {
    const container = document.getElementById('creativeThumbnailContainer');
    if (!container) return;
    if (window._creativeHistory.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    container.innerHTML = window._creativeHistory.map(item => `
        <div class="thumb-item" style="cursor: pointer; border: 3px solid ${window._currentActiveImageId === item.id ? 'var(--accent-blue)' : 'transparent'}; border-radius: 8px; overflow: hidden; min-width: 100px; max-width: 100px; height: 60px; box-shadow: var(--shadow-sm); position: relative; transition: all 0.2s;" onclick="loadCreativeThumbnail(${item.id})">
            <img src="${item.b64}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
    `).join('');
};

window.loadCreativeThumbnail = async function (id) {
    const item = window._creativeHistory.find(x => x.id === id);
    if (!item) return;
    window._currentActiveImageId = id;
    window._currentActiveImageB64 = item.b64;

    // update prompt input nicely
    const promptInput = document.getElementById('creativePrompt');
    if (promptInput && item.prompt) promptInput.value = item.prompt;

    window.renderCreativeThumbnailHistory();
    if (typeof window.applyCreativeCanvasLayout === 'function') {
        await window.applyCreativeCanvasLayout(item.b64);
    }
};

window.applyCreativeCanvasLayout = async function (imgB64) {
    const fc = window.creativeCanvasInstance;
    if (!fc) return;

    // 캔버스 클리어 및 리사이즈
    fc.clear();
    const sizeSelect = document.getElementById('canvasSizeSelect');
    const [cw, ch] = (sizeSelect?.value || '1200x628').split('x').map(Number);
    fc.setWidth(cw);
    fc.setHeight(ch);

    const color1 = document.getElementById('brandColor1')?.value || '#0f172a';
    const color2 = document.getElementById('brandColor2')?.value || '#3b82f6';

    // 1) 배경 이미지 셋업
    if (imgB64) {
        await new Promise((resolve) => {
            fabric.Image.fromURL(imgB64, (img) => {
                const scale = Math.max(cw / img.width, ch / img.height);
                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center',
                    left: cw / 2,
                    top: ch / 2
                });
                const overlay = new fabric.Rect({
                    left: 0, top: 0, width: cw, height: ch, fill: 'rgba(0,0,0,0.3)', selectable: false
                });
                fc.setBackgroundImage(img, fc.renderAll.bind(fc));
                fc.add(overlay);
                resolve();
            });
        });
    } else {
        fc.setBackgroundColor(
            new fabric.Gradient({
                type: 'linear',
                coords: { x1: 0, y1: 0, x2: cw, y2: ch },
                colorStops: [{ offset: 0, color: color1 }, { offset: 1, color: color2 }]
            }),
            fc.renderAll.bind(fc)
        );
    }

    // ============================================
    // 15년차 CD 크리에이티브 시각화 로직 적용 구역 
    // ============================================
    const hasProduct = (window._productImages && window._productImages.length > 0);

    const mainFont = 'Pretendard, sans-serif';
    const mainFontSize = Math.max(cw * 0.06, 44);
    const subFontSize = Math.max(cw * 0.022, 20);

    const leftOffset = cw * 0.5;
    const textOrigin = 'center';
    const textAlign = 'center';
    const textBoxWidth = cw * 0.8;

    // 🌟 브랜드 로고가 업로드되어 있다면 처리
    const logoImgEl = document.querySelector('#brandLogoPreview img');
    if (logoImgEl && logoImgEl.src) {
        await new Promise((resolve) => {
            fabric.Image.fromURL(logoImgEl.src, (img) => {
                const logoMaxH = ch * 0.1;
                const logoScale = logoMaxH / img.height;
                img.set({
                    scaleX: logoScale,
                    scaleY: logoScale,
                    originX: 'left',
                    originY: 'top',
                    left: cw * 0.04,
                    top: ch * 0.05,
                    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 10, offsetX: 0, offsetY: 2 })
                });
                fc.add(img);
                resolve();
            });
        });
    }

    // 1. 제품 이미지가 있다면 (가운데로 배치 요청 반영)
    if (hasProduct) {
        const imgData = window._productImages[0].dataUrl;
        await new Promise((resolve) => {
            fabric.Image.fromURL(imgData, (img) => {
                const maxW = cw * 0.5;
                const maxH = ch * 0.6;
                const scale = Math.min(maxW / img.width, maxH / img.height);
                img.set({
                    scaleX: scale,
                    scaleY: scale,
                    originX: 'center',
                    originY: 'center',
                    left: cw * 0.5,
                    top: ch * 0.5,
                    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.6)', blur: 30, offsetX: 0, offsetY: 15 })
                });
                fc.add(img);
                resolve();
            });
        });
    }

    // 2. 텍스트 정보 불러오기
    const mainText = document.getElementById('copyMain')?.value || '';
    const subText = document.getElementById('copySub')?.value || '';
    const ctaText = document.getElementById('copyCta')?.value || '';

    let currentY = hasProduct ? ch * 0.25 : ch * 0.35;

    // 메인 카피 (Slogan)
    if (mainText) {
        const mainObj = new fabric.Textbox(mainText, {
            left: leftOffset,
            top: currentY,
            originX: textOrigin,
            originY: 'top',
            width: textBoxWidth,
            fontFamily: mainFont,
            fontSize: mainFontSize,
            fontWeight: '900',
            fill: '#ffffff',
            textAlign: textAlign,
            lineHeight: 1.15,
            charSpacing: -20,
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.9)', blur: 18, offsetX: 2, offsetY: 4 })
        });
        fc.add(mainObj);
        currentY += (mainObj.height * mainObj.scaleY) + (hasProduct ? 20 : 30);
    }

    // 서브 카피 (Rationale)
    if (subText) {
        const subObj = new fabric.Textbox(subText, {
            left: leftOffset,
            top: currentY,
            originX: textOrigin,
            originY: 'top',
            width: textBoxWidth,
            fontFamily: mainFont,
            fontSize: subFontSize,
            fontWeight: '400',
            fill: 'rgba(255,255,255,0.95)',
            textAlign: textAlign,
            lineHeight: 1.45,
            charSpacing: 20,
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 8, offsetX: 1, offsetY: 2 })
        });
        fc.add(subObj);
        currentY += (subObj.height * subObj.scaleY) + (hasProduct ? 40 : 50);
    }

    // CTA 버튼 (Action)
    if (ctaText) {
        const ctaLabel = new fabric.Text(ctaText, {
            fontFamily: mainFont,
            fontSize: Math.max(cw * 0.016, 16),
            fontWeight: '800',
            fill: color1,
            originX: 'center',
            originY: 'center',
        });
        const ctaBg = new fabric.Rect({
            width: ctaLabel.width + 70,
            height: ctaLabel.height + 28,
            rx: 24,
            ry: 24,
            fill: '#ffffff',
            originX: 'center',
            originY: 'center',
            shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.4)', blur: 12, offsetX: 0, offsetY: 5 })
        });

        const ctaGroup = new fabric.Group([ctaBg, ctaLabel], {
            left: cw * 0.5,
            top: currentY,
            originX: 'center',
            originY: 'top',
            hoverCursor: 'pointer'
        });
        fc.add(ctaGroup);
    }

    // 캔버스 보이기
    const canvasEl = document.getElementById('creativeCanvas');
    if (canvasEl) canvasEl.style.display = 'block';
    const emptyState = document.getElementById('canvasEmptyState');
    if (emptyState) emptyState.style.display = 'none';

    fc.renderAll();

    // 리사이즈 맞추기
    if (typeof window.resizeCanvasToDisplaySize === 'function') {
        setTimeout(window.resizeCanvasToDisplaySize, 100);
    }
};
