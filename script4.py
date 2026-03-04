import re

with open('static/creative.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

# 1. Update updateSafeZoneGuide
old_safe_zone_fn = """    function updateSafeZoneGuide(width, height) {
        // TODO: 사이즈별 여백/규칙에 따른 세이프존 렌더링 로직 연동
        const overlay = document.getElementById('safeZoneOverlay');
        if(overlay) {
            // 임시
            overlay.style.display = 'none';
        }
    }"""

new_safe_zone_fn = """    function updateSafeZoneGuide(width, height, platform) {
        const overlay = document.getElementById('safeZoneOverlay');
        if (!overlay) return;

        // 캔버스의 실제 표시 크기/스케일 찾기
        const canvasEl = document.querySelector('.canvas-container');
        if (!canvasEl) return;

        // Reset overlay
        overlay.style.display = 'none';
        overlay.style.boxShadow = 'none';
        overlay.style.border = 'none';
        overlay.innerHTML = ''; // Clear badges

        // Match overlay to canvas container visually
        const transform = canvasEl.style.transform;
        const widthPx = parseInt(canvasEl.style.width || canvasEl.width);
        const heightPx = parseInt(canvasEl.style.height || canvasEl.height);

        overlay.style.width = widthPx + 'px';
        overlay.style.height = heightPx + 'px';
        overlay.style.left = canvasEl.style.left;
        overlay.style.top = canvasEl.style.top;
        overlay.style.transform = transform;
        overlay.style.transformOrigin = canvasEl.style.transformOrigin;

        if (platform === 'meta' && width === 1080 && height === 1920) {
            // Meta Reels: Top/Bottom 15% restricted
            overlay.style.display = 'block';
            
            // Generate warning badges and gradients
            // Use clipping path to obscure the 15% top and 15% bottom
            overlay.style.background = 'linear-gradient(to bottom, rgba(239,68,68,0.4) 15%, transparent 15%, transparent 85%, rgba(239,68,68,0.4) 85%)';
            overlay.innerHTML = `
                <div style="position: absolute; top: 5%; left: 50%; transform: translateX(-50%); background: rgba(239, 68, 68, 0.9); color: white; padding: 4px 12px; font-size: 1.5rem; border-radius: 4px; font-weight: bold;">
                    UI Overlap Zone (Profile)
                </div>
                <div style="position: absolute; bottom: 5%; left: 50%; transform: translateX(-50%); background: rgba(239, 68, 68, 0.9); color: white; padding: 4px 12px; font-size: 1.5rem; border-radius: 4px; font-weight: bold;">
                    UI Overlap Zone (Action & Text)
                </div>`;
        } else if (platform === 'kakao' && width === 720 && height === 1280) {
            // Kakao 9:16 Full Screen (Top/Bottom 89px, Side 47px margin based on 720x1280)
            overlay.style.display = 'block';
            overlay.style.border = '2px dashed rgba(239, 68, 68, 0.8)';
            const hVal = (89/1280)*100;
            const wVal = (47/720)*100;
            overlay.style.clipPath = `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${wVal}% ${hVal}%, ${wVal}% ${100-hVal}%, ${100-wVal}% ${100-hVal}%, ${100-wVal}% ${hVal}%, ${wVal}% ${hVal}%)`;
            overlay.style.backgroundColor = 'rgba(239,68,68,0.3)';
            overlay.innerHTML = `
                <div style="position: absolute; top: calc(${hVal}% + 10px); left: 50%; transform: translateX(-50%); background: rgba(239, 68, 68, 0.9); color: white; padding: 4px 12px; font-size: 1.5rem; border-radius: 4px; font-weight: bold;">
                    Kakao Safe Margin Line
                </div>`;
        } else if (platform === 'naver' && width === 1200 && height === 1800) {
           // Naver doesn't have strict UI overlap zones like Reels, but prohibits solid background.
           // However, let's keep it simple.
        }
    }"""

js_content = js_content.replace(old_safe_zone_fn, new_safe_zone_fn)

# Also update updateCanvasResolution to pass the platform
js_content = js_content.replace(
    'updateSafeZoneGuide(width, height);',
    "const currentPlatform = document.querySelector('#creativePlatformTabs .active')?.dataset?.platform || 'naver';\n        updateSafeZoneGuide(width, height, currentPlatform);"
)

# 2. Add Step 3 Logic (btnPreviewRender)
step3_logic = """

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
"""

js_content = js_content.replace("    // Initialize default platform on load", step3_logic + "\n    // Initialize default platform on load")

with open('static/creative.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Updated creative.js with Step 3 logic")
