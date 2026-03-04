document.addEventListener("DOMContentLoaded", () => {
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
    });

    navCreative.addEventListener("click", (e) => {
        e.preventDefault();
        navCreative.parentElement.classList.add("active");
        navReference.parentElement.classList.remove("active");
        creativeView.classList.remove("hidden");
        referenceView.classList.add("hidden");

        // 캔버스 초기화 호출 (최초 열릴 때 한 번)
        if (!window.creativeCanvasInstance) {
            initCreativeCanvas();
        }
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
                // updateSizeOptionsByPlatform(platform);
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
        } else if (platform === 'kakao') {
            options = `
                <option value="1200x600">와이드 피드 (1200x600)</option>
                <option value="500x500">배너 (500x500)</option>
                <option value="720x1280">풀스크린 (720x1280)</option>
                <option value="800x1000">세로형 (800x1000)</option>
            `;
            warningEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>Safe Zone 침범 주의 (투명도 불가)</span>';
        } else if (platform === 'meta') {
            options = `
                <option value="1080x1080">스퀘어 (1080x1080)</option>
                <option value="1080x1350">세로형 피드 (1080x1350)</option>
                <option value="1080x1920">스토리/릴스 (1080x1920)</option>
            `;
            warningEl.innerHTML = '<i class="fa-solid fa-info-circle" style="margin-right:0.4rem; color: #3b82f6;"></i> <span style="color: #3b82f6;">상하단 릴스 UI 가려짐 주의 (Safe Zone)</span>';
            warningEl.style.background = '#eff6ff';
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
        updateSafeZoneGuide(width, height);
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
});
