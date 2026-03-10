// Supabase JS will be loaded before this from lib/supabase-js.js

const SUPABASE_URL = 'https://gnpeluvwykdiadwniled.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_w7r4IY60O392RTqPmUGRhg_rs_pJKuF';

const chromeStorageAdapter = {
    getItem: (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key] || null);
            });
        });
    },
    setItem: (key, value) => {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, () => resolve());
        });
    },
    removeItem: (key) => {
        return new Promise((resolve) => {
            chrome.storage.local.remove([key], () => resolve());
        });
    }
};

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: chromeStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const contentLoading = document.getElementById('contentLoading');
    const contentAuth = document.getElementById('contentAuth');
    const contentMain = document.getElementById('contentMain');
    const userGreeting = document.getElementById('userGreeting');

    // 1. Check if user is logged in
    const { data: { session } } = await supabaseClient.auth.getSession();

    contentLoading.classList.add('hidden');

    if (!session) {
        contentAuth.classList.remove('hidden');
        return;
    }

    // 2. User is logged in
    currentUser = session.user;
    contentMain.classList.remove('hidden');
    userGreeting.textContent = `안녕하세요, ${currentUser.user_metadata.full_name || '마케터'}님!`;

    const autoResize = (el) => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

    // Load saved manual inputs to survive popup closing
    chrome.storage.local.get(['manualPrompt', 'manualResult', 'lastAssets'], (result) => {
        if (result.manualPrompt) {
            manualPrompt.value = result.manualPrompt;
            setTimeout(() => autoResize(manualPrompt), 0);
        }
        if (result.manualResult) {
            manualResult.value = result.manualResult;
            setTimeout(() => autoResize(manualResult), 0);
        }
        if (result.lastAssets && result.lastAssets.length > 0) {
            renderAssetsUI(result.lastAssets);
        }
    });

    const saveToLocal = (e) => {
        const el = e.target;
        autoResize(el);

        chrome.storage.local.set({
            manualPrompt: manualPrompt.value,
            manualResult: manualResult.value
        });
    };
    manualPrompt.addEventListener('input', saveToLocal);
    manualResult.addEventListener('input', saveToLocal);

    // Expose autoResize globally for handleCaptureAI to use
    window.autoResize = autoResize;

    document.getElementById('btnOpenWeb').addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:8000' }); // TODO: Change to prod URL later
    });

    document.getElementById('btnCaptureCurrent').addEventListener('click', handleCaptureAI);
    document.getElementById('btnSaveManual').addEventListener('click', handleManualSave);
});

async function handleCaptureAI() {
    const statusMsg = document.getElementById('statusMessage');
    statusMsg.textContent = '현재 열려있는 AI 탭을 분석하는 중...';
    statusMsg.style.color = '#3b82f6';

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url.match(/chatgpt\.com|claude\.ai|gemini\.google\.com|midjourney\.com/i)) {
        statusMsg.textContent = '지원되는 AI 서비스 페이지가 아닙니다.';
        statusMsg.style.color = '#ef4444';
        return;
    }

    // content script에 데이터 추출 요청
    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PROMPT' }, async (response) => {
        if (chrome.runtime.lastError || !response) {
            statusMsg.textContent = '프롬프트 추출 실패. 페이지를 새로고침 해보세요.';
            statusMsg.style.color = '#ef4444';
            return;
        }

        if (!response.success) {
            statusMsg.textContent = response.message || '추출 실패';
            statusMsg.style.color = '#ef4444';
            return;
        }

        // 캡처한 내용을 화면 폼에 채운 뒤 로컬저장 (미리보기/수정용)
        const promptEl = document.getElementById('manualPrompt');
        const resultEl = document.getElementById('manualResult');

        promptEl.value = response.data.prompt || '';
        resultEl.value = response.data.result || '';

        if (window.autoResize) {
            window.autoResize(promptEl);
            window.autoResize(resultEl);
        }
        chrome.storage.local.set({
            manualPrompt: response.data.prompt,
            manualResult: response.data.result,
            lastSource: response.data.source, // 나중에 저장 시 출처 기록 위함
            lastAssets: response.data.assets || [] // 캡처된 에셋들 저장
        });

        statusMsg.textContent = '✨ 캡처 성공! 내용을 확인/수정 후 저장하세요. (다양한 결과형태 감지됨)';
        statusMsg.style.color = '#10b981';

        // Render assets in UI
        if (response.data.assets && response.data.assets.length > 0) {
            renderAssetsUI(response.data.assets);
        } else {
            const container = document.getElementById('assetsContainer');
            if (container) container.innerHTML = '';
        }
    });
}

function renderAssetsUI(assets) {
    const container = document.getElementById('assetsContainer');
    if (!container) return;

    container.innerHTML = '';

    assets.forEach(asset => {
        let el = document.createElement('div');
        el.style.cssText = "flex-shrink: 0; width: 60px; height: 60px; border-radius: 6px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; background: #f8fafc; overflow: hidden; position: relative;";

        if (asset.type === 'image') {
            const img = document.createElement('img');
            img.src = asset.url;
            img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";
            el.appendChild(img);
        } else if (asset.type === 'video') {
            el.innerHTML = '<span style="font-size: 1.2rem;">🎥</span>';
        } else if (asset.type === 'canvas') {
            el.innerHTML = '<span style="font-size: 1.2rem;">💻</span>';
        }

        container.appendChild(el);
    });
}

async function handleManualSave() {
    const prompt = document.getElementById('manualPrompt').value.trim();
    const result = document.getElementById('manualResult').value.trim();
    const statusMsg = document.getElementById('statusMessage');

    if (!prompt) {
        statusMsg.textContent = '핵심 프롬프트를 입력해주세요.';
        statusMsg.style.color = '#ef4444';
        return;
    }

    statusMsg.textContent = 'AI가 제목을 생성하며 저장 중입니다...';
    statusMsg.style.color = '#3b82f6';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        let finalTitle = prompt.substring(0, 15) + '...'; // fallback
        let finalCategory = '기타';

        // 사용자가 이미 AI 버튼을 눌렀거나 캡처 후 자동 생성된 제목이 있는지 확인 
        if (window.lastGeneratedTitle) {
            finalTitle = window.lastGeneratedTitle;
        }

        if (session) {
            // AI 제목 및 카테고리 생성 API 호출
            try {
                const res = await fetch('http://localhost:8000/api/v1/generate-prompt-title', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ prompt_text: prompt, result_text: result })
                });
                if (res.ok) {
                    const json = await res.json();
                    if (json.status === 'success') {
                        if (json.data.title) finalTitle = json.data.title;
                        if (json.data.category) finalCategory = json.data.category;
                    }
                }
            } catch (e) {
                console.warn('Title/Category generation failed', e);
            }
        }

        // 마지막으로 사용된 캡처 출처 및 에셋 가져오기
        const locSource = await chromeStorageAdapter.getItem('lastSource');
        const sourceName = locSource || '수동입력';
        const rawAssets = await chromeStorageAdapter.getItem('lastAssets') || [];

        // 에셋(이미지/비디오) Supabase Storage에 업로드 (3단계)
        let finalAssets = [];
        if (rawAssets.length > 0) {
            statusMsg.textContent = '멀티모달 결과물을 서버에 안전하게 업로드 중입니다...';

            for (let idx = 0; idx < rawAssets.length; idx++) {
                let asset = rawAssets[idx];

                if (asset.type === 'image' || asset.type === 'video') {
                    try {
                        // 원래 사이트의 URL을 fetch해서 Blob으로 가져옵니다
                        const fileRes = await fetch(asset.url);
                        const blob = await fileRes.blob();

                        // 고유 파일명 생성
                        const ext = blob.type.split('/')[1] || (asset.type === 'image' ? 'png' : 'mp4');
                        const fileName = `${currentUser.id}/${Date.now()}_${idx}.${ext}`;

                        // Supabase Storage에 업로드
                        const { data: uploadData, error: uploadError } = await supabaseClient.storage
                            .from('prompt-assets')
                            .upload(fileName, blob, { upsert: true });

                        if (!uploadError) {
                            // 업로드 성공 시 Public URL로 치환
                            const { data: { publicUrl } } = supabaseClient.storage
                                .from('prompt-assets')
                                .getPublicUrl(fileName);

                            asset.url = publicUrl;
                        } else {
                            console.warn('Asset upload error:', uploadError);
                        }
                    } catch (e) {
                        console.warn('Asset fetch/upload error:', e);
                        // CORS 등의 에러로 인해 실패할 수 있음. 실패 시 원본 URL 유지
                    }
                }
                finalAssets.push(asset);
            }
        }

        statusMsg.textContent = '최종 데이터를 DB에 등록 중입니다...';

        const { error } = await supabaseClient.from('hub_prompts').insert({
            title: finalTitle,
            prompt_text: prompt,
            source_name: sourceName,
            user_id: currentUser.id,
            category: finalCategory,
            result_text: result || null,
            result_assets: finalAssets // JSONB 컬럼에 추가 저장
        });

        if (error) throw error;

        statusMsg.textContent = '✨ 저장 완료! 제목: ' + finalTitle;
        statusMsg.style.color = '#10b981';
        document.getElementById('manualPrompt').value = '';
        document.getElementById('manualResult').value = '';
        window.lastGeneratedTitle = null;

        // Clear local storage on success
        chrome.storage.local.remove(['manualPrompt', 'manualResult', 'lastSource', 'lastAssets']);
        const container = document.getElementById('assetsContainer');
        if (container) container.innerHTML = '';

    } catch (err) {
        statusMsg.textContent = '저장 실패: ' + err.message;
        statusMsg.style.color = '#ef4444';
    }
}
