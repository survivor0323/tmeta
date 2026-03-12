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

    // === Image Upload & Thumbnails ===
    let uploadedCreativeImages = []; // Array of base64 strings
    const creativeImageUploadBtn = document.getElementById('creativeImageUploadBtn');
    const creativeImageUploadInput = document.getElementById('creativeImageUploadInput');
    const creativeImagePreviewContainer = document.getElementById('creativeImagePreviewContainer');

    function updateCreativeImagePreviews() {
        if (!creativeImagePreviewContainer) return;
        creativeImagePreviewContainer.innerHTML = '';
        
        uploadedCreativeImages.forEach((imgB64, index) => {
            const wrap = document.createElement('div');
            wrap.style.position = 'relative';
            wrap.style.flexShrink = '0';
            wrap.style.width = '64px';
            wrap.style.height = '64px';
            wrap.style.borderRadius = '8px';
            wrap.style.overflow = 'hidden';
            wrap.style.border = '1px solid #e2e8f0';

            const img = document.createElement('img');
            img.src = imgB64;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            const btn = document.createElement('button');
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            btn.style.position = 'absolute';
            btn.style.top = '2px';
            btn.style.right = '2px';
            btn.style.width = '16px';
            btn.style.height = '16px';
            btn.style.background = 'rgba(0,0,0,0.5)';
            btn.style.color = '#fff';
            btn.style.border = 'none';
            btn.style.borderRadius = '50%';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.fontSize = '10px';
            btn.style.cursor = 'pointer';

            btn.onclick = () => {
                uploadedCreativeImages.splice(index, 1);
                updateCreativeImagePreviews();
            };

            const numBadge = document.createElement('div');
            numBadge.innerText = (index + 1).toString();
            numBadge.style.position = 'absolute';
            numBadge.style.bottom = '2px';
            numBadge.style.left = '2px';
            numBadge.style.background = 'var(--accent-blue)';
            numBadge.style.color = '#fff';
            numBadge.style.fontSize = '10px';
            numBadge.style.fontWeight = 'bold';
            numBadge.style.padding = '0 4px';
            numBadge.style.borderRadius = '4px';

            wrap.appendChild(img);
            wrap.appendChild(btn);
            wrap.appendChild(numBadge);
            creativeImagePreviewContainer.appendChild(wrap);
        });
    }

    if (creativeImageUploadBtn && creativeImageUploadInput) {
        creativeImageUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (uploadedCreativeImages.length >= 5) {
                alert("이미지는 최대 5장까지 업로드할 수 있습니다.");
                return;
            }
            creativeImageUploadInput.click();
        });

        creativeImageUploadInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            
            if (uploadedCreativeImages.length + files.length > 5) {
                alert("이미지는 최대 5장까지 업로드할 수 있습니다.");
            }

            const filesToProcess = files.slice(0, 5 - uploadedCreativeImages.length);
            
            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    uploadedCreativeImages.push(evt.target.result);
                    updateCreativeImagePreviews();
                };
                reader.readAsDataURL(file);
            });
            
            // reset input
            creativeImageUploadInput.value = '';
        });
    }

        const creativeGenerateBtn = document.getElementById('creativeGenerateBtn');
        const creativeEmptyState = document.getElementById('creativeEmptyState');
        const creativeResultArea = document.getElementById('creativeResultArea');
        const mjPromptText = document.getElementById('mjPromptText');
        const sdPromptText = document.getElementById('sdPromptText');
        const creativePreviewGallery = document.getElementById('creativePreviewGallery');
    
        if (creativeGenerateBtn) {
            creativeGenerateBtn.addEventListener('click', async () => {
                const promptInput = promptTextarea?.value.trim();
                if (!promptInput) {
                    alert("생성할 이미지의 프롬프트를 입력해주세요.");
                    promptTextarea?.focus();
                    return;
                }
    
                // Get configurations
                const ratioSelect = document.getElementById('creativeRatioSelect');
                const vibeSelect = document.getElementById('creativeVibeSelect');
                const lightingSelect = document.getElementById('creativeLightingSelect');
                const cameraSelect = document.getElementById('creativeCameraSelect');
                
                const ratio = ratioSelect ? ratioSelect.value : "1:1";
                const vibe = vibeSelect ? vibeSelect.value : "자동";
                const lighting = lightingSelect ? lightingSelect.value : "자동";
                const camera = cameraSelect ? cameraSelect.value : "자동";
    
                // UI Update: Hide empty state, show result area, set loading UX
                if (creativeEmptyState) creativeEmptyState.style.display = 'none';
                if (creativeResultArea) {
                    creativeResultArea.style.display = 'grid'; // display grid for result area
                }
                
                if (mjPromptText) mjPromptText.innerHTML = '<span style="color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> AI가 프롬프트를 설계 중입니다...</span>';
                if (sdPromptText) sdPromptText.innerHTML = '<span style="color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> AI가 프롬프트를 설계 중입니다...</span>';
                if (creativePreviewGallery) creativePreviewGallery.innerHTML = '<div style="color: #94a3b8; font-size: 0.9rem;"><i class="fa-solid fa-spinner fa-spin"></i> 스토리보드 시안 렌더링 중...</div>';
                
                // Disable inputs
                creativeGenerateBtn.disabled = true;
                creativeGenerateBtn.style.opacity = '0.7';
                if (promptTextarea) promptTextarea.disabled = true;
                
                // Scroll result area to view
                const mainArea = document.getElementById('creativeMainArea');
                if (mainArea) {
                    mainArea.scrollTop = 0;
                }
    
                try {
                    const res = await fetch('/api/v1/generate-cf-prompt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            prompt: promptInput, 
                            aspect_ratio: ratio, 
                            vibe: vibe,
                            lighting: lighting,
                            camera: camera,
                            reference_images: uploadedCreativeImages
                        })
                    });
                    const result = await res.json();
                    
                    if (result.status === 'success' && result.data) {
                        mjPromptText.innerText = result.data.mj_prompt || "프롬프트를 생성할 수 없습니다.";
                        sdPromptText.innerText = result.data.sd_prompt || "프롬프트를 생성할 수 없습니다.";
                        
                        if (result.data.image_b64) {
                            creativePreviewGallery.innerHTML = `<img src="${result.data.image_b64}" style="width: 100%; height: auto; border-radius: 8px; object-fit: contain; max-height: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">`;
                        } else {
                            creativePreviewGallery.innerHTML = '<div style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> 시안 이미지를 가져오지 못했습니다.</div>';
                        }
                    } else {
                        throw new Error(result.message || '알 수 없는 오류');
                    }
    
                } catch (err) {
                    console.error("생성 에러:", err);
                    mjPromptText.innerText = `에러 발생: ${err.message}`;
                    sdPromptText.innerText = `에러 발생: ${err.message}`;
                    creativePreviewGallery.innerHTML = `<div style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> 시안 렌더링 에러: ${err.message}</div>`;
                } finally {
                    creativeGenerateBtn.disabled = false;
                    creativeGenerateBtn.style.opacity = '1';
                    if (promptTextarea) promptTextarea.disabled = false;
                }
            });
        }
        
        function createPlaceholder(ratio, modelName, promptStr) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'gallery-item placeholder-box';
            
            const aspectMapping = {
                "1:1": "1 / 1",
                "3:4": "3 / 4",
                "16:9": "16 / 9",
                "9:16": "9 / 16"
            };
            const cssRatio = aspectMapping[ratio] || "1 / 1";
            const isTall = ratio === "3:4" || ratio === "9:16";
            let gridSpan = isTall ? 'grid-row: span 2;' : '';
    
            itemDiv.style.cssText = `
                position: relative;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: var(--shadow-sm);
                aspect-ratio: ${cssRatio};
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                ${gridSpan}
            `;
            
            // Gemini-style spinner and model name
            itemDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; color: #475569; font-size: 0.95rem; font-weight: 600;">
                    <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-wand-magic-sparkles text-gradient" style="font-size: 14px; position: absolute; z-index: 2; background: linear-gradient(135deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"></i>
                        <svg viewBox="0 0 50 50" style="width: 32px; height: 32px; position: absolute; animation: spin 1.5s linear infinite;">
                            <circle cx="25" cy="25" r="20" fill="none" class="spinner-track" stroke="#e2e8f0" stroke-width="3"></circle>
                            <circle cx="25" cy="25" r="20" fill="none" class="spinner-head" stroke="url(#spinnerGrad)" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 100" stroke-dashoffset="0"></circle>
                            <defs>
                                <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#3b82f6" />
                                    <stop offset="100%" stop-color="#10b981" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <span>${modelName} 로딩 중...</span>
                </div>
            `;
            return itemDiv;
        }
        
        function showPlaceholderError(placeholderEl, errorMsg) {
            placeholderEl.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 1rem;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                    <div style="font-size: 0.85rem; font-weight: 600; line-height: 1.4;">이미지 생성 실패</div>
                    <div style="font-size: 0.75rem; color: #ef4444; opacity: 0.8; margin-top: 0.3rem;">${escapeHtml(errorMsg)}</div>
                </div>
            `;
        }
    
        function replacePlaceholderWithImage(placeholderEl, imgSrc, promptStr, ratio) {
            const tempDiv = document.createElement('div');
            // Re-use logic from appendImageToGallery
            const isTall = ratio === "3:4" || ratio === "9:16";
            
            placeholderEl.innerHTML = `
                <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block;" alt="Generated Image" />
                <div class="gallery-overlay" style="position: absolute; bottom: 0; left: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 16px; color: white; opacity: 0; transition: opacity 0.2s;">
                    <p style="margin: 0; font-size: 0.85rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(promptStr)}</p>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="gallery-action-btn" title="다운로드" onclick="downloadImage('${imgSrc}', 'creative_image_${Date.now()}.jpg', event)" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-download"></i>
                        </button>
                        <button class="gallery-action-btn expand-btn" title="크게 보기" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-expand"></i>
                        </button>
                    </div>
                </div>
            `;
            
            placeholderEl.style.background = '#1e293b';
            placeholderEl.style.border = 'none';
            placeholderEl.style.cursor = 'pointer';
            
            // Events 
            placeholderEl.addEventListener('mouseenter', () => {
                placeholderEl.querySelector('.gallery-overlay').style.opacity = '1';
                placeholderEl.style.transform = 'translateY(-2px)';
                placeholderEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
            });
            placeholderEl.addEventListener('mouseleave', () => {
                placeholderEl.querySelector('.gallery-overlay').style.opacity = '0';
                placeholderEl.style.transform = 'none';
                placeholderEl.style.boxShadow = 'var(--shadow-sm)';
            });
            
            placeholderEl.querySelector('.expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const newTab = window.open();
                newTab.document.write('<style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh;}img{max-width:100%;max-height:100%;}</style>' + 
                    `<img src="${imgSrc}" />`);
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
