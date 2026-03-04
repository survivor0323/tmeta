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
            canvasEl.style.transform = `scale(${scale})`;
            canvasEl.style.transformOrigin = 'center center';
            // CSS 위치 중앙 정렬
            canvasEl.style.position = 'absolute';
            canvasEl.style.left = `calc(50% - ${(baseWidth * scale) / 2}px)`;
            canvasEl.style.top = `calc(50% - ${(baseHeight * scale) / 2}px)`;
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
    const btnScanWebsite = document.getElementById('btnScanWebsite');
    const brandWebsiteUrl = document.getElementById('brandWebsiteUrl');
    const brandName = document.getElementById('brandName');
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

    // 1-2. Website Scan (Mock)
    if (btnScanWebsite && brandWebsiteUrl) {
        btnScanWebsite.addEventListener('click', () => {
            const url = brandWebsiteUrl.value.trim();
            if (!url) {
                alert('스캔할 웹사이트 URL을 입력해주세요.');
                return;
            }

            // UX 피드백
            const originalText = btnScanWebsite.innerHTML;
            btnScanWebsite.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning...';
            btnScanWebsite.disabled = true;

            // 모의 스캔(비동기 지연)
            setTimeout(() => {
                let mockName = 'Motiverse';
                try {
                    const parsedUrl = new URL(url);
                    mockName = parsedUrl.hostname.replace('www.', '').split('.')[0];
                    mockName = mockName.charAt(0).toUpperCase() + mockName.slice(1);
                } catch (e) { }

                if (brandName) brandName.value = mockName;
                if (brandColor1) brandColor1.value = '#0f172a';
                if (brandColor2) brandColor2.value = '#3b82f6';

                alert(`[${mockName}] 사이트 스캔 완료! 로고와 브랜드 컬러가 추출되었습니다.`);

                btnScanWebsite.innerHTML = originalText;
                btnScanWebsite.disabled = false;
            }, 1500);
        });
    }

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



    // === Step 3: Render Preview ===
    const btnPreviewRender = document.getElementById('btnPreviewRender');

    if (btnPreviewRender) {
        btnPreviewRender.addEventListener('click', () => {
            const canvas = window.creativeCanvasInstance;
            if (!canvas) {
                alert('캔버스가 초기화되지 않았습니다.');
                return;
            }

            // 숨겨져있던 캔버스 표시
            document.getElementById('creativeCanvas').style.display = 'block';
            document.getElementById('canvasEmptyState').style.display = 'none';
            // 표시 크기 다시 조율
            resizeCanvasToDisplaySize();

            const cWidth = canvas.getWidth();
            const cHeight = canvas.getHeight();

            // Clear canvas
            canvas.clear();

            // Background Color
            const bgHex = document.getElementById('brandColor1')?.value || '#0f172a';
            const accentHex = document.getElementById('brandColor2')?.value || '#3b82f6';

            // Set Background
            const bgRect = new fabric.Rect({
                left: 0,
                top: 0,
                width: cWidth,
                height: cHeight,
                fill: bgHex,
                selectable: false
            });
            canvas.add(bgRect);

            // Fetch texts
            const fontFam = window.currentBrandFont || 'Pretendard, Arial, sans-serif';
            const mainText = document.getElementById('copyMain')?.value || 'Main Headline';
            const subText = document.getElementById('copySub')?.value || 'Sub Copy';
            const ctaText = document.getElementById('copyCta')?.value || 'Learn More';

            // Add Top left Logo/BrandName placeholder if small or big
            const brandText = document.getElementById('brandName')?.value || 'Motiverse';
            const brandLabel = new fabric.Text(brandText, {
                left: 40,
                top: 40,
                fontFamily: fontFam,
                fontSize: Math.min(cWidth * 0.04, 30),
                fill: '#ffffff',
                opacity: 0.7,
                selectable: true
            });
            canvas.add(brandLabel);

            // Add Main Headline
            const headLabel = new fabric.Textbox(mainText, {
                left: 40,
                top: cHeight * 0.25,
                width: cWidth * 0.8,
                fontFamily: fontFam,
                fontSize: Math.min(cWidth * 0.08, 90),
                fill: '#ffffff',
                fontWeight: 'bold',
                lineHeight: 1.2,
                selectable: true
            });
            canvas.add(headLabel);

            // Add Sub Copy
            const sbLabel = new fabric.Textbox(subText, {
                left: 40,
                top: headLabel.top + headLabel.height + (cHeight * 0.05),
                width: cWidth * 0.8,
                fontFamily: fontFam,
                fontSize: Math.min(cWidth * 0.04, 40),
                fill: '#e2e8f0',
                lineHeight: 1.4,
                selectable: true
            });
            canvas.add(sbLabel);

            // Add CTA Button Shape
            const ctaGroup = new fabric.Group([
                new fabric.Rect({
                    originX: 'center',
                    originY: 'center',
                    fill: accentHex,
                    width: Math.min(cWidth * 0.4, 400),
                    height: Math.min(cHeight * 0.1, 80),
                    rx: Math.min(cHeight * 0.05, 40),
                    ry: Math.min(cHeight * 0.05, 40)
                }),
                new fabric.Text(ctaText, {
                    originX: 'center',
                    originY: 'center',
                    fontFamily: fontFam,
                    fontSize: Math.min(cWidth * 0.035, 30),
                    fill: '#ffffff',
                    fontWeight: 'bold'
                })
            ], {
                left: 40,
                top: sbLabel.top + sbLabel.height + (cHeight * 0.1),
                selectable: true,
                hoverCursor: 'pointer'
            });
            canvas.add(ctaGroup);

            // Update Safe zone bounds
            const currentPlatform = document.querySelector('#creativePlatformTabs .active')?.dataset?.platform || 'naver';
            updateSafeZoneGuide(cWidth, cHeight, currentPlatform);
        });
    }

    // Initialize default platform on load
    if (document.getElementById('canvasSizeSelect')) {
        updateSizeOptionsByPlatform('naver');
    }

    // === Brand Save/Load (localStorage) ===
    const savedBrandSelect = document.getElementById('savedBrandSelect');
    const btnSaveBrand = document.getElementById('btnSaveBrand');

    function loadSavedBrandsList() {
        if (!savedBrandSelect) return;
        const brands = JSON.parse(localStorage.getItem('savedBrands') || '[]');
        savedBrandSelect.innerHTML = '<option value="">저장된 브랜드 불러오기</option>';
        brands.forEach((b, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${b.name} (${b.url || '직접 입력'})`;
            savedBrandSelect.appendChild(opt);
        });
    }

    if (btnSaveBrand) {
        btnSaveBrand.addEventListener('click', () => {
            const name = document.getElementById('brandName')?.value?.trim();
            if (!name) { alert('브랜드명을 입력해주세요.'); return; }
            const brands = JSON.parse(localStorage.getItem('savedBrands') || '[]');
            const brand = {
                name,
                url: document.getElementById('brandWebsiteUrl')?.value || '',
                color1: document.getElementById('brandColor1')?.value || '#0f172a',
                color2: document.getElementById('brandColor2')?.value || '#3b82f6',
                savedAt: new Date().toISOString()
            };
            // 중복 체크
            const existing = brands.findIndex(b => b.name === name);
            if (existing >= 0) {
                brands[existing] = brand;
            } else {
                brands.push(brand);
            }
            localStorage.setItem('savedBrands', JSON.stringify(brands));
            loadSavedBrandsList();
            alert(`"${name}" 브랜드가 저장되었습니다!`);
        });
    }

    if (savedBrandSelect) {
        savedBrandSelect.addEventListener('change', (e) => {
            const idx = e.target.value;
            if (idx === '') return;
            const brands = JSON.parse(localStorage.getItem('savedBrands') || '[]');
            const brand = brands[parseInt(idx)];
            if (!brand) return;
            if (document.getElementById('brandName')) document.getElementById('brandName').value = brand.name;
            if (document.getElementById('brandWebsiteUrl')) document.getElementById('brandWebsiteUrl').value = brand.url || '';
            if (document.getElementById('brandColor1')) document.getElementById('brandColor1').value = brand.color1;
            if (document.getElementById('brandColor2')) document.getElementById('brandColor2').value = brand.color2;
            savedBrandSelect.value = '';
        });
        loadSavedBrandsList();
    }

    // === Reference Load from Monitoring Data ===
    const btnLoadReferences = document.getElementById('btnLoadReferences');
    const referenceList = document.getElementById('referenceList');

    if (btnLoadReferences && referenceList) {
        btnLoadReferences.addEventListener('click', () => {
            // 모니터링 데이터에서 광고 가져오기
            const monitorData = JSON.parse(localStorage.getItem('monitorCompanies') || '[]');
            if (monitorData.length === 0) {
                referenceList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;"><i class="fa-solid fa-circle-info" style="margin-right: 0.3rem;"></i> 등록된 모니터링 경쟁사가 없습니다. 먼저 경쟁사를 등록하세요.</div>';
                return;
            }

            btnLoadReferences.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...';
            btnLoadReferences.disabled = true;

            setTimeout(() => {
                // 모니터링 데이터의 최근 알림에서 광고 이미지 생성 (모의)
                referenceList.innerHTML = '';
                let totalAds = 0;

                monitorData.forEach(company => {
                    const companyName = company.name || company.brandName || '경쟁사';
                    const platforms = company.platforms || [company.platform || 'Meta'];
                    const platformList = Array.isArray(platforms) ? platforms : [platforms];

                    platformList.forEach(platform => {
                        // 각 플랫폼별 모의 광고 3개씩
                        for (let i = 1; i <= 3; i++) {
                            totalAds++;
                            const card = document.createElement('div');
                            card.className = 'ref-card';
                            card.style.cssText = 'border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; position: relative;';
                            card.innerHTML = `
                                <div style="aspect-ratio: 1; background: linear-gradient(135deg, ${getRandomGradient()}); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: white; font-weight: 600; text-align: center; padding: 0.5rem;">
                                    ${companyName}<br><span style="font-size: 0.65rem; opacity: 0.8;">${platform} #${i}</span>
                                </div>
                                <div style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: white; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: transparent;" class="ref-check">
                                    <i class="fa-solid fa-check"></i>
                                </div>
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
                                } else {
                                    card.style.borderColor = 'transparent';
                                    card.style.boxShadow = 'none';
                                    check.style.background = 'white';
                                    check.style.borderColor = '#cbd5e1';
                                    check.style.color = 'transparent';
                                }
                                updateSelectedCount();
                            });
                            referenceList.appendChild(card);
                        }
                    });
                });

                if (totalAds === 0) {
                    referenceList.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;">광고 데이터를 찾을 수 없습니다.</div>';
                }

                btnLoadReferences.innerHTML = '<i class="fa-solid fa-rotate" style="margin-right: 0.3rem;"></i> 모니터링 데이터에서 불러오기';
                btnLoadReferences.disabled = false;
            }, 800);
        });
    }

    function updateSelectedCount() {
        const count = document.querySelectorAll('#referenceList .ref-card.selected').length;
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

});
