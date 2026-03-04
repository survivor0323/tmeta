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

    platformTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // 활성 탭 디자인 변경
            platformTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const platform = tab.dataset.platform;
            updateSizeOptionsByPlatform(platform);
        });
    });

    sizeSelect.addEventListener('change', (e) => {
        const [w, h] = e.target.value.split('x').map(Number);
        updateCanvasResolution(w, h);
    });

    function updateSizeOptionsByPlatform(platform) {
        // 플랫폼별 옵션 동적 갱신
        let options = '';
        if (platform === 'naver') {
            options = `
                <option value="1200x628">피드 및 네이티브 (1200x628)</option>
                <option value="600x600">스퀘어 썸네일 (600x600)</option>
                <option value="342x228">PC 스마트채널 (342x228)</option>
                <option value="1200x1800">세로형 피드 (1200x1800)</option>
            `;
            document.getElementById('creativeRuleWarning').innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>텍스트 면적 20% 이내 (단색 배경 불가)</span>';
        } else if (platform === 'kakao') {
            options = `
                <option value="1200x600">와이드 피드 (1200x600)</option>
                <option value="500x500">배너 (500x500)</option>
                <option value="720x1280">풀스크린 (720x1280)</option>
                <option value="800x1000">세로형 (800x1000)</option>
            `;
            document.getElementById('creativeRuleWarning').innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right:0.4rem;"></i> <span>Safe Zone 침범 주의 (투명도 불가)</span>';
        } else if (platform === 'meta') {
            options = `
                <option value="1080x1080">스퀘어 (1080x1080)</option>
                <option value="1080x1350">세로형 피드 (1080x1350)</option>
                <option value="1080x1920">스토리/릴스 (1080x1920)</option>
            `;
            document.getElementById('creativeRuleWarning').innerHTML = '<i class="fa-solid fa-info-circle" style="margin-right:0.4rem; color: #3b82f6;"></i> <span style="color: #3b82f6;">상하단 릴스 UI 가려짐 주의 (Safe Zone)</span>';
            document.getElementById('creativeRuleWarning').style.background = '#eff6ff';
        }

        const selectEl = document.getElementById('canvasSizeSelect');
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
        // 임시
        overlay.style.display = 'none';
    }
});
