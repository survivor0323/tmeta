document.addEventListener("DOMContentLoaded", () => {
    // === Tab Switching Logic ===
    const navReference = document.getElementById("navReference");
    const navCreative = document.getElementById("navCreative");
    const navLabs = document.getElementById("navLabs");
    const navMonitor = document.getElementById("navMonitor");
    const referenceView = document.getElementById("referenceView");
    const creativeView = document.getElementById("creativeView");
    const labsView = document.getElementById("labsView");
    const monitorView = document.getElementById("monitorView");
    const promptHubView = document.getElementById('promptHubView');

    function switchTab(activeNav, activeView) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (activeNav) activeNav.parentElement.classList.add("active");

        referenceView?.classList.add("hidden");
        creativeView?.classList.add("hidden");
        labsView?.classList.add("hidden");
        monitorView?.classList.add("hidden");
        promptHubView?.classList.add("hidden");

        if (activeView) activeView.classList.remove("hidden");

        // Action icons for non-Creative tabs
        const userInfo = document.getElementById('userInfo');
        const showIcons = (activeView === referenceView || activeView === labsView || activeView === monitorView) 
                            && userInfo && !userInfo.classList.contains('hidden');

        document.getElementById('monitorBtn')?.classList.toggle('hidden', !showIcons);
        document.getElementById('boardsBtn')?.classList.toggle('hidden', !showIcons);
        document.getElementById('historyBtn')?.classList.toggle('hidden', !showIcons);
        document.getElementById('bookmarkBtn')?.classList.toggle('hidden', !showIcons);
    }

    navReference?.addEventListener("click", (e) => { e.preventDefault(); switchTab(navReference, referenceView); });
    navCreative?.addEventListener("click", (e) => { e.preventDefault(); switchTab(navCreative, creativeView); });
    navLabs?.addEventListener("click", (e) => { e.preventDefault(); switchTab(navLabs, labsView); });
    navMonitor?.addEventListener("click", (e) => { e.preventDefault(); switchTab(navMonitor, monitorView); });


    // === Creative Studio Redesign Logic ===
    
    // Image count controls
    const creativeDecreaseCount = document.getElementById('creativeDecreaseCount');
    const creativeIncreaseCount = document.getElementById('creativeIncreaseCount');
    const creativeCountValue = document.getElementById('creativeCountValue');
    let currentImageCount = 1;

    creativeDecreaseCount?.addEventListener('click', () => {
        if (currentImageCount > 1) {
            currentImageCount--;
            if (creativeCountValue) creativeCountValue.textContent = currentImageCount;
        }
    });

    creativeIncreaseCount?.addEventListener('click', () => {
        if (currentImageCount < 4) {
            currentImageCount++;
            if (creativeCountValue) creativeCountValue.textContent = currentImageCount;
        }
    });

    // Textarea height auto-adjust & Enter to submit
    const promptTextarea = document.getElementById('creativeBottomPrompt');
    if (promptTextarea) {
        promptTextarea.addEventListener('input', function() {
            this.style.height = 'auto'; // Reset to auto to calculate new height
            let newHeight = Math.min(this.scrollHeight, 200); // Max height 200px
            this.style.height = newHeight + 'px';
            if (this.value === '') {
                this.style.height = '60px'; // Base height
            }
        });
        
        promptTextarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('creativeGenerateBtn')?.click();
            }
        });
    }

    const creativeGenerateBtn = document.getElementById('creativeGenerateBtn');
    const creativeEmptyState = document.getElementById('creativeEmptyState');
    const creativeLoading = document.getElementById('creativeLoading');
    const creativeGallery = document.getElementById('creativeGallery');

    if (creativeGenerateBtn) {
        creativeGenerateBtn.addEventListener('click', async () => {
            const promptInput = promptTextarea?.value.trim();
            if (!promptInput) {
                alert("생성할 이미지의 프롬프트를 입력해주세요.");
                promptTextarea?.focus();
                return;
            }

            // Get configuration
            const ratioSelect = document.getElementById('creativeRatioSelect');
            const modelSelect = document.getElementById('creativeModelSelect');
            const ratio = ratioSelect ? ratioSelect.value : "1:1";
            // const model = modelSelect ? modelSelect.value : "nanobanana_2"; // Currently backend does not support switching models, so we capture it but ignore or pass later

            // UI Update: Hide empty state, show gallery and loading
            if (creativeEmptyState) creativeEmptyState.classList.add('hidden');
            if (creativeGallery) creativeGallery.classList.remove('hidden');
            if (creativeLoading) creativeLoading.style.display = 'flex';
            
            // Disable inputs
            creativeGenerateBtn.disabled = true;
            creativeGenerateBtn.style.opacity = '0.7';
            if (promptTextarea) promptTextarea.disabled = true;

            try {
                // Generate 'currentImageCount' images one by one or concurrently.
                // Doing concurrently as they are separate API calls.
                const generatePromises = [];
                for (let i = 0; i < currentImageCount; i++) {
                    generatePromises.push(
                        fetch('/api/v1/generate-creative-image', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ prompt: promptInput, aspect_ratio: ratio })
                        }).then(res => res.json())
                    );
                }

                const results = await Promise.allSettled(generatePromises);

                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.status === 'success' && result.value.data?.image_b64) {
                        const imgB64 = result.value.data.image_b64;
                        appendImageToGallery(imgB64, promptInput, ratio);
                    } else {
                        console.error('이미지 생성 실패:', result);
                        alert(`일부 이미지 생성에 실패했습니다: ${result?.value?.message || '알 수 없는 오류'}`);
                    }
                });

            } catch (err) {
                console.error("생성 에러:", err);
                alert("이미지 생성 중 오류가 발생했습니다.");
            } finally {
                if (creativeLoading) creativeLoading.style.display = 'none';
                creativeGenerateBtn.disabled = false;
                creativeGenerateBtn.style.opacity = '1';
                if (promptTextarea) promptTextarea.disabled = false;
                
                // Scroll gallery to bottom
                const mainArea = document.getElementById('creativeMainArea');
                if (mainArea) {
                    mainArea.scrollTop = mainArea.scrollHeight;
                }
            }
        });
    }

    function appendImageToGallery(imgSrc, promptStr, ratio) {
        if (!creativeGallery) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'gallery-item';
        
        // Convert ratio string to CSS aspect-ratio
        const aspectMapping = {
            "1:1": "1 / 1",
            "3:4": "3 / 4",
            "16:9": "16 / 9",
            "9:16": "9 / 16"
        };
        const cssRatio = aspectMapping[ratio] || "1 / 1";
        const isTall = ratio === "3:4" || ratio === "9:16";
        
        // Let tall images take 2 row spans to improve layout flow
        let gridSpan = isTall ? 'grid-row: span 2;' : '';

        itemDiv.style.cssText = `
            position: relative;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            aspect-ratio: ${cssRatio};
            background: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            ${gridSpan}
        `;
        
        itemDiv.innerHTML = `
            <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Generated Image" />
            <div class="gallery-overlay" style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 16px; color: white; opacity: 0; transition: opacity 0.2s;">
                <p style="margin: 0; font-size: 0.85rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(promptStr)}</p>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="gallery-action-btn" title="다운로드" onclick="downloadImage('${imgSrc}', 'creative_image.jpg', event)" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="gallery-action-btn" title="크게 보기" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-expand"></i>
                    </button>
                </div>
            </div>
        `;

        itemDiv.addEventListener('mouseenter', () => {
            itemDiv.querySelector('.gallery-overlay').style.opacity = '1';
        });
        itemDiv.addEventListener('mouseleave', () => {
            itemDiv.querySelector('.gallery-overlay').style.opacity = '0';
        });

        itemDiv.addEventListener('mouseenter', () => {
            itemDiv.style.transform = 'translateY(-2px)';
            itemDiv.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
        });
        itemDiv.addEventListener('mouseleave', () => {
            itemDiv.style.transform = 'none';
            itemDiv.style.boxShadow = 'var(--shadow-sm)';
        });

        // Click to open full view modal (if needed later)
        itemDiv.querySelector('.fa-expand').parentElement.addEventListener('click', (e) => {
            e.stopPropagation();
            // Implement full screen modal if requested, for now just open in new tab
            const newTab = window.open();
            newTab.document.write('<style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:100%;max-height:100%;}</style>' + 
                `<img src="${imgSrc}" />`);
        });

        creativeGallery.appendChild(itemDiv);
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

});

// Global download function
window.downloadImage = function(dataUrl, filename, event) {
    if(event) event.stopPropagation();
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
