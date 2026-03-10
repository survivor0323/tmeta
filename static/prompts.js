// prompts.js - Motiverse Prompt Hub Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation Logic
    const navPromptHub = document.getElementById('navPromptHub');
    const promptHubView = document.getElementById('promptHubView');

    // Existing main views to hide
    const referenceView = document.getElementById('referenceView');
    const creativeView = document.getElementById('creativeView');
    const labsView = document.getElementById('labsView');
    const monitorView = document.getElementById('monitorView');

    if (navPromptHub) {
        navPromptHub.addEventListener('click', (e) => {
            e.preventDefault();
            // Active current nav menu, remove others
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            navPromptHub.parentElement.classList.add('active');

            // Show prompt hub, hide others
            if (promptHubView) promptHubView.classList.remove('hidden');
            if (referenceView) referenceView.classList.add('hidden');
            if (creativeView) creativeView.classList.add('hidden');
            if (labsView) labsView.classList.add('hidden');
            if (monitorView) monitorView.classList.add('hidden');

            // Hide/Show common header icons
            document.getElementById('monitorBtn')?.classList.add('hidden');
            document.getElementById('boardsBtn')?.classList.add('hidden');
            document.getElementById('historyBtn')?.classList.add('hidden');
            document.getElementById('bookmarkBtn')?.classList.add('hidden');

            loadPrompts();

            // Automatically show extension install modal if not dismissed
            const extInstallModal = document.getElementById('extInstallModal');
            if (extInstallModal && localStorage.getItem('hideMOTIExtensionPopup') !== 'true') {
                setTimeout(() => {
                    extInstallModal.classList.remove('hidden');
                }, 500);
            }
        });
    }

    // Modal Logic
    const promptCreateBtn = document.getElementById('promptCreateBtn');
    const closePromptModal = document.getElementById('closePromptModal');
    const promptModal = document.getElementById('promptModal');

    if (promptCreateBtn) {
        promptCreateBtn.addEventListener('click', openPromptCreateModal);
    }
    if (closePromptModal) {
        closePromptModal.addEventListener('click', () => {
            promptModal.classList.add('hidden');
        });
    }

    // Modal Background Click
    window.addEventListener('click', (e) => {
        if (e.target === promptModal) {
            promptModal.classList.add('hidden');
        }
    });

    // Search functionality
    const promptSearchBtn = document.getElementById('promptSearchBtn');
    if (promptSearchBtn) {
        promptSearchBtn.addEventListener('click', loadPrompts);
    }
    const promptSearchInput = document.getElementById('promptSearchInput');
    if (promptSearchInput) {
        promptSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loadPrompts();
        });
    }

    const promptCategoryTabs = document.querySelectorAll('#promptCategoryFilterUI .tab-chip');
    promptCategoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            promptCategoryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadPrompts();
        });
    });
    // Chrome Extension Install Modal Logic
    const extInstallModal = document.getElementById('extInstallModal');
    const openExtInstallBtn = document.getElementById('openExtInstallBtn');
    const closeExtInstallModalBtn = document.getElementById('closeExtInstallModalBtn');
    const hideExtInstallCheck = document.getElementById('hideExtInstallCheck');

    if (extInstallModal) {

        // Open manually
        if (openExtInstallBtn) {
            openExtInstallBtn.addEventListener('click', () => {
                extInstallModal.classList.remove('hidden');
            });
        }

        // Close logic
        const closeModal = () => {
            if (hideExtInstallCheck && hideExtInstallCheck.checked) {
                localStorage.setItem('hideMOTIExtensionPopup', 'true');
            }
            extInstallModal.classList.add('hidden');
        };

        if (closeExtInstallModalBtn) {
            closeExtInstallModalBtn.addEventListener('click', closeModal);
        }

        extInstallModal.addEventListener('click', (e) => {
            if (e.target === extInstallModal) {
                closeModal();
            }
        });
    }
});
async function loadPrompts() {
    const grid = document.getElementById('promptsGrid');
    const loading = document.getElementById('promptLoading');
    const searchInput = document.getElementById('promptSearchInput')?.value?.trim() || '';
    const activeTab = document.querySelector('#promptCategoryFilterUI .tab-chip.active');
    const categorySelect = activeTab ? activeTab.getAttribute('data-category') : '';

    grid.innerHTML = '';
    loading.classList.remove('hidden');

    try {
        const { data, error } = await window.supabaseClient.rpc('get_hub_prompts', {
            p_category: categorySelect || null,
            p_search_keyword: searchInput || null
        });

        if (error) throw error;

        loading.classList.add('hidden');
        renderPrompts(data || []);
    } catch (err) {
        console.error("Failed to load prompts", err);
        loading.classList.add('hidden');
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">데이터를 불러오는 데 실패했습니다: ${err.message}</div>`;
    }
}

function renderPrompts(prompts) {
    const grid = document.getElementById('promptsGrid');
    grid.innerHTML = '';

    if (!prompts || prompts.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 3rem; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">등록된 프롬프트가 없습니다.</div>`;
        return;
    }

    prompts.forEach(p => {
        // Category Styling Map based on UI reference
        const catStyles = {
            '시장 조사': { bg: '#eff6ff', text: '#2563eb', icon: 'fa-solid fa-magnifying-glass-chart' },
            '카피라이팅': { bg: '#fff7ed', text: '#ea580c', icon: 'fa-solid fa-pen-nib' },
            '소셜': { bg: '#fdf4ff', text: '#c026d3', icon: 'fa-solid fa-hashtag' },
            '크리에이티브': { bg: '#f5f3ff', text: '#7c3aed', icon: 'fa-solid fa-palette' },
            '영상': { bg: '#fefce8', text: '#ca8a04', icon: 'fa-solid fa-video' },
            '캠페인': { bg: '#fef2f2', text: '#dc2626', icon: 'fa-solid fa-bullhorn' },
            '최적화': { bg: '#ecfdf5', text: '#059669', icon: 'fa-solid fa-chart-line' },
            '클라이언트': { bg: '#f1f5f9', text: '#475569', icon: 'fa-solid fa-handshake' },
            '브랜드': { bg: '#f0fdf4', text: '#16a34a', icon: 'fa-solid fa-fingerprint' },
            '운영': { bg: '#fffbeb', text: '#b45309', icon: 'fa-solid fa-briefcase' },
            '개발': { bg: '#e0e7ff', text: '#4338ca', icon: 'fa-solid fa-code' },
            '기타': { bg: '#f8fafc', text: '#64748b', icon: 'fa-solid fa-tag' }
        };
        // Find matching style or fallback to default green
        const matchedKey = Object.keys(catStyles).find(k => p.category && p.category.includes(k));
        const styleInfo = matchedKey ? catStyles[matchedKey] : { bg: '#ecfdf5', text: '#10b981', icon: 'fa-solid fa-tag' };

        const card = document.createElement('div');
        card.style.cssText = "background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 1.5rem; display: flex; flex-direction: column; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative; min-height: 280px;";

        card.onmouseover = () => {
            card.style.borderColor = '#bfdbfe';
            card.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';
            card.style.transform = "translateY(-2px)";
        };
        card.onmouseout = () => {
            card.style.borderColor = '#e2e8f0';
            card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            card.style.transform = "none";
        };

        card.onclick = (e) => {
            // prevent opening modal if clicking on top-right actions
            if (!e.target.closest('.action-btn')) openPromptDetailModal(p);
        };

        // Extract tags or fallback
        const tagList = p.tags && Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : (p.source_name ? [p.source_name] : []);
        const tagsHtml = tagList.length > 0 ? tagList.slice(0, 2).map(tag =>
            `<span style="font-size: 0.75rem; font-weight: 600; color: #3b82f6; cursor: pointer; padding: 0;">${tag}</span>`
        ).join('<span style="color:#cbd5e1; margin:0 4px;">·</span>') : '';

        // Short description logic
        const descText = p.result_text ? p.result_text : (p.source_name ? p.source_name + ' 기반으로 작성된 맞춤형 프롬프트입니다.' : 'AI 비즈니스 및 실무 작업을 돕는 프롬프트입니다.');

        // Escape helper
        const escapeHtml = (text) => (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safePromptForCopy = escapeHtml(p.prompt_text).replace(/'/g, "\\'").replace(/\n/g, '\\n');

        card.innerHTML = `
            <!-- Top Row: Category and Action Icons -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <!-- Category Tag -->
                <div style="background: ${styleInfo.bg}; color: ${styleInfo.text}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border: 1px solid ${styleInfo.text}33;">
                    <i class="${styleInfo.icon}"></i> ${p.category || '기타'}
                </div>
                <!-- Action Icons -->
                <div style="display: flex; gap: 8px;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText('${safePromptForCopy}'); alert('프롬프트가 클립보드에 복사되었습니다.'); event.stopPropagation();" style="width: 28px; height: 28px; border-radius: 50%; background: #10b981; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" title="프롬프트 복사" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'">
                        <i class="fa-regular fa-copy" style="font-size: 0.85rem;"></i>
                    </button>
                    <!-- Future bookmark button -->
                    <button class="action-btn" style="width: 28px; height: 28px; border-radius: 50%; background: #f59e0b; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" title="즐겨찾기" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='none'">
                        <i class="fa-regular fa-star" style="font-size: 0.85rem;"></i>
                    </button>
                </div>
            </div>

            <!-- Title -->
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #2563eb; margin: 0 0 0.5rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-family: 'Pretendard', sans-serif;">
                ${escapeHtml(p.title)}
            </h3>

            <!-- Short Description / Subtitle -->
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.2rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${escapeHtml(descText)}
            </div>

            <!-- Divider -->
            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 0 0 1rem 0;" />

            <!-- Main Prompt Preview (Dimmed Gray text) -->
            <div style="flex: 1; font-size: 0.85rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;">
                ${escapeHtml(p.prompt_text)}
            </div>

            <!-- Footer: Tags and Comments -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.5rem;">
                <div style="display: flex; gap: 4px; overflow: hidden; align-items: center;">
                    ${tagsHtml}
                </div>
                <div style="font-size: 0.85rem; color: #94a3b8; font-weight: 500; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-regular fa-comment-dots" style="font-size: 0.9rem;"></i> ${p.usage_count || 0}
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openPromptCreateModal() {
    if (!window._motiverseSession) {
        alert("로그인이 필요합니다.");
        document.getElementById('loginBtn')?.click();
        return;
    }

    const modal = document.getElementById('promptModal');
    const body = document.getElementById('promptModalBody');

    body.innerHTML = `
            < h2 style = "font-size: 1.5rem; font-weight: 700; text-align: center; margin-bottom: 2rem; color: #1e293b;" > <i class="fa-solid fa-pen-nib" style="color:#3b82f6;"></i> 사내 AI 프롬프트 등록</h2 >
                <div style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem;">

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:0.4rem;">제목 <span style="color:#ef4444">*</span></label>
                            <input type="text" id="p_title" placeholder="예: [블로그 작성용] 제품 장점 뽑아주는 마법 주문" style="width:100%; padding: 0.8rem; border-radius:8px; border:1px solid #cbd5e1; outline:none;" />
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; margin-bottom:0.4rem;">카테고리</label>
                            <select id="p_category" style="width:100%; padding: 0.8rem; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
                                <option value="일반" selected>일반</option>
                                <option value="시장 조사 및 전략 (Insight & Strategy)">시장 조사·전략</option>
                                <option value="카피라이팅 및 텍스트 (Copywriting)">카피라이팅·텍스트</option>
                                <option value="소셜 미디어 및 콘텐츠 (Social & Viral)">소셜·콘텐츠</option>
                                <option value="시각적 크리에이티브 (Visual Concept)">시각적 크리에이티브</option>
                                <option value="영상 기획 및 스토리보드 (Video & Storyboard)">영상·스토리보드</option>
                                <option value="캠페인 및 프로모션 (Campaign & Promo)">캠페인·프로모션</option>
                                <option value="검색 최적화 및 광고 관리 (SEO & Paid Ads)">SEO·광고 관리</option>
                                <option value="클라이언트 관리 및 보고 (Client & Report)">클라이언트·보고</option>
                                <option value="브랜드 아이덴티티 및 정립 (Branding)">브랜드·정립</option>
                                <option value="운영 및 행정 (Operations & Admin)">운영·행정</option>
                                <option value="개발 및 프로그래밍 (Development)">개발·프로그래밍</option>
                                <option value="기타 (Others)">기타</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; background: #f8fafc; padding: 1rem; border-radius: 8px;">
                        <div>
                            <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:0.4rem;">출처 (플랫폼/모델)</label>
                            <input type="text" id="p_source_name" placeholder="예: ChatGPT, Midjourney" style="width:100%; padding: 0.6rem; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:0.85rem;" />
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:0.4rem;">사용 AI 모델</label>
                            <input type="text" id="p_source_model" placeholder="예: GPT-4o, DALL-E 3" style="width:100%; padding: 0.6rem; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:0.85rem;" />
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:0.4rem;">공유 URL (GPTs 등)</label>
                            <input type="text" id="p_source_url" placeholder="https://..." style="width:100%; padding: 0.6rem; border-radius:6px; border:1px solid #cbd5e1; outline:none; font-size:0.85rem;" />
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-weight:600; margin-bottom:0.4rem;">💡 핵심 프롬프트 (주문) <span style="color:#ef4444">*</span></label>
                        <textarea id="p_prompt_text" rows="5" placeholder="다음에 내가 입력할 [제품명]에 대해 블로그 포스팅 초안을 작성해줘. 타겟은 2030 여성이고 친근한 톤앤매너로 부탁해." style="width:100%; padding: 0.8rem; border-radius:8px; border:1px solid #cbd5e1; outline:none; resize:vertical; font-family: monospace; line-height: 1.5;"></textarea>
                    </div>

                    <hr style="border:0; border-top:1px dashed #cbd5e1;" />

                    <div>
                        <label style="display:block; font-weight:600; margin-bottom:0.4rem;">✨ 결과물 예시 (텍스트)</label>
                        <textarea id="p_result_text" rows="3" placeholder="결과물 텍스트 예시를 붙여넣으세요 (또는 이미지 URL 대신 사용)" style="width:100%; padding: 0.8rem; border-radius:8px; border:1px solid #cbd5e1; outline:none; background: #f8fafc; resize:vertical;"></textarea>
                    </div>

                    <div>
                        <label style="display:block; font-weight:600; margin-bottom:0.4rem;">🖼️ 결과물 이미지 URL (선택사항)</label>
                        <input type="text" id="p_result_image_url" placeholder="https://..." style="width:100%; padding: 0.8rem; border-radius:8px; border:1px solid #cbd5e1; outline:none;" />
                    </div>

                    <button id="p_submit_btn" style="background:#3b82f6; color:white; padding:1rem; border-radius:8px; font-weight:700; border:none; margin-top:1rem; cursor:pointer;">프롬프트 라이브러리에 등록하기</button>
                </div>
        `;

    document.getElementById('p_submit_btn').onclick = async () => {
        const title = document.getElementById('p_title').value.trim();
        const category = document.getElementById('p_category').value;
        const source_name = document.getElementById('p_source_name').value.trim();
        const source_model = document.getElementById('p_source_model').value.trim();
        const source_url = document.getElementById('p_source_url').value.trim();
        const prompt_text = document.getElementById('p_prompt_text').value.trim();
        const result_text = document.getElementById('p_result_text').value.trim();
        const result_image_url = document.getElementById('p_result_image_url').value.trim();

        if (!title || !prompt_text) {
            alert('필수 입력 항목(제목, 핵심 프롬프트)을 채워주세요.');
            return;
        }

        document.getElementById('p_submit_btn').disabled = true;
        document.getElementById('p_submit_btn').innerText = '저장 중...';

        try {
            const { error } = await window.supabaseClient.from('hub_prompts').insert({
                user_id: window._motiverseSession.user.id,
                title,
                category,
                source_name,
                source_model,
                source_url,
                prompt_text,
                result_text,
                result_image_url
            });

            if (error) throw error;

            alert('프롬프트가 성공적으로 등록되었습니다!');
            modal.classList.add('hidden');
            loadPrompts();

        } catch (e) {
            alert('저장에 실패했습니다: ' + e.message);
            document.getElementById('p_submit_btn').disabled = false;
            document.getElementById('p_submit_btn').innerText = '프롬프트 라이브러리에 등록하기';
        }
    };

    modal.classList.remove('hidden');
}

function openPromptDetailModal(p) {
    const modal = document.getElementById('promptModal');
    const body = document.getElementById('promptModalBody');

    // Category Styling Map based on UI reference
    const catStyles = {
        '시장 조사': { bg: '#eff6ff', text: '#2563eb', icon: 'fa-solid fa-magnifying-glass-chart' },
        '카피라이팅': { bg: '#fff7ed', text: '#ea580c', icon: 'fa-solid fa-pen-nib' },
        '소셜': { bg: '#fdf4ff', text: '#c026d3', icon: 'fa-solid fa-hashtag' },
        '크리에이티브': { bg: '#f5f3ff', text: '#7c3aed', icon: 'fa-solid fa-palette' },
        '영상': { bg: '#fefce8', text: '#ca8a04', icon: 'fa-solid fa-video' },
        '캠페인': { bg: '#fef2f2', text: '#dc2626', icon: 'fa-solid fa-bullhorn' },
        '최적화': { bg: '#ecfdf5', text: '#059669', icon: 'fa-solid fa-chart-line' },
        '클라이언트': { bg: '#f1f5f9', text: '#475569', icon: 'fa-solid fa-handshake' },
        '브랜드': { bg: '#f0fdf4', text: '#16a34a', icon: 'fa-solid fa-fingerprint' },
        '운영': { bg: '#fffbeb', text: '#b45309', icon: 'fa-solid fa-briefcase' },
        '개발': { bg: '#e0e7ff', text: '#4338ca', icon: 'fa-solid fa-code' },
        '기타': { bg: '#f8fafc', text: '#64748b', icon: 'fa-solid fa-tag' }
    };
    const matchedKey = Object.keys(catStyles).find(k => p.category && p.category.includes(k));
    const styleInfo = matchedKey ? catStyles[matchedKey] : { bg: '#ecfdf5', text: '#10b981', icon: 'fa-solid fa-tag' };

    const escapeHtml = (text) => (text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safePromptForCopy = escapeHtml(p.prompt_text).replace(/'/g, "\\'").replace(/\n/g, '\\n');

    // Tags list without '일반' default
    const detailTagList = p.tags && Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : (p.source_name ? [p.source_name] : []);

    body.innerHTML = `
        <!-- Header Section: Category and Tags -->
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem;">
            <div style="background: ${styleInfo.bg}; color: ${styleInfo.text}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; border: 1px solid ${styleInfo.text}33;">
                <i class="${styleInfo.icon}"></i> ${p.category || '기타'}
            </div>
            ${detailTagList.length > 0 ? detailTagList.map(t => `<span style="background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-hashtag" style="font-size: 0.75rem; color:#93c5fd; margin-right:2px;"></i>${escapeHtml(t)}</span>`).join('') : ''}
        </div>

        <!-- Title and Source -->
        <div style="margin-bottom: 2rem;">
            <h2 style="font-size: 1.7rem; font-weight: 800; color: #1e293b; margin: 0 0 0.5rem 0; font-family: 'Pretendard', sans-serif; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${escapeHtml(p.title)}</h2>
            ${p.source_name || p.source_model ? `
                <div style="font-size: 0.95rem; font-weight: 600; color: #2563eb;">
                    ${p.source_name ? `<span style="cursor:pointer; text-decoration: underline; text-underline-offset: 4px;">${escapeHtml(p.source_name)}</span>` : ''}
                    ${p.source_model ? `<span style="margin-left: 0.5rem; color: #64748b; font-weight: 500;">(${escapeHtml(p.source_model)})</span>` : ''}
                </div>
            ` : ''}
        </div>

        <!-- Example Conversions (If result_text or example usage) 
             For now, we place a static placeholder if none, or display result_text snippets -->
        <div style="margin-bottom: 2.5rem;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-regular fa-comment-dots"></i> PREVIEW / EXAMPLE
            </div>
            ${p.result_image_url ? `<img src="${p.result_image_url}" style="max-width:100%; max-height: 250px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 1rem; object-fit: cover;" />` : ''}
            <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 1rem 1.2rem; border-radius: 8px; font-size: 0.9rem; color: #475569; line-height: 1.6; max-height: 350px; overflow-y: auto; white-space: pre-wrap;">
                "${p.result_text ? escapeHtml(p.result_text) : escapeHtml(p.title) + '에 최적화된 결과물을 도출합니다.'}"
            </div>
        </div>

        <!-- Core Prompt Section (System Instructions) -->
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1.2rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-solid fa-code"></i> SYSTEM INSTRUCTIONS
                </div>
                <button id="copyPromptBtn" style="background: white; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: #475569; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 4px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'">
                    <i class="fa-regular fa-copy"></i> Copy
                </button>
            </div>
            <div style="padding: 1.5rem; color: #334155; font-family: 'Pretendard', sans-serif; font-size: 0.95rem; line-height: 1.8; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${escapeHtml(p.prompt_text)}</div>
        </div>

        <!-- Footer Meta Data -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.8rem; color: #94a3b8;">
                Updated: ${new Date(p.created_at).toLocaleDateString()}
            </div>
            
            <button id="usePromptBtn" style="background: #0f172a; color: white; padding: 0.7rem 1.2rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.2s;" onmouseover="this.style.background='#1e293b'" onmouseout="this.style.background='#0f172a'">
                <i class="fa-regular fa-copy"></i> 프롬프트 복사
            </button>
        </div>
    `;

    document.getElementById('copyPromptBtn').onclick = async function () {
        try {
            await navigator.clipboard.writeText(p.prompt_text);
            this.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i> 복사됨';
            setTimeout(() => { this.innerHTML = '<i class="fa-regular fa-copy"></i> 복사하기'; }, 2000);
        } catch (e) {
            alert('복사 실패');
        }
    };

    document.getElementById('usePromptBtn').onclick = async () => {
        // Increment usage count in DB
        if (window.supabaseClient) {
            await window.supabaseClient.rpc('increment_prompt_usage', { p_prompt_id: p.id });
        }

        // Open url if provided, else copy to clipboard
        if (p.source_url) {
            window.open(p.source_url, '_blank');
        } else {
            document.getElementById('copyPromptBtn').click();
            alert('복사되었습니다! AI 플랫폼 탭으로 이동하여 입력창에 붙여넣어주세요.');
        }

        // reload list silently
        loadPrompts();
    };

    modal.classList.remove('hidden');
}
