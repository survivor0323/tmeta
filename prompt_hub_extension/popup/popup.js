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
    chrome.storage.local.get(['manualPrompt', 'manualResult'], (result) => {
        if (result.manualPrompt) {
            manualPrompt.value = result.manualPrompt;
            setTimeout(() => autoResize(manualPrompt), 0);
        }
        if (result.manualResult) {
            manualResult.value = result.manualResult;
            setTimeout(() => autoResize(manualResult), 0);
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
    document.getElementById('btnAiAnalyze').addEventListener('click', handleAiAnalyze);
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
            lastSource: response.data.source // 나중에 저장 시 출처 기록 위함
        });

        statusMsg.textContent = '✨ 내용 캡처 성공! AI 카테고리 분류 분석 중...';
        statusMsg.style.color = '#3b82f6';

        await handleAiAnalyze();

        // setTimeout is used to overwrite the "AI analyze complete" message after a short delay
        setTimeout(() => {
            statusMsg.textContent = '✨ 캡처 성공! 내용을 확인/수정 후 저장하세요.';
            statusMsg.style.color = '#10b981';
        }, 3000);
    });
}

async function handleAiAnalyze() {
    const prompt = document.getElementById('manualPrompt').value.trim();
    const result = document.getElementById('manualResult').value.trim();
    const statusMsg = document.getElementById('statusMessage');

    if (!prompt) {
        statusMsg.textContent = '핵심 프롬프트를 먼저 입력해주세요.';
        statusMsg.style.color = '#ef4444';
        return;
    }

    statusMsg.textContent = 'AI가 내용을 분석 중입니다...';
    statusMsg.style.color = '#3b82f6';

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
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
                    if (json.data.category) {
                        const catSelect = document.getElementById('manualCategory');
                        for (let i = 0; i < catSelect.options.length; i++) {
                            if (json.data.category.includes(catSelect.options[i].value) || catSelect.options[i].value.includes(json.data.category)) {
                                catSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                    if (json.data.title) {
                        window.lastGeneratedTitle = json.data.title;
                    }
                    statusMsg.textContent = '✨ AI 자동 분류 완료!';
                    statusMsg.style.color = '#10b981';
                }
            } else {
                throw new Error('API 오류');
            }
        }
    } catch (e) {
        statusMsg.textContent = '분석에 실패했습니다.';
        statusMsg.style.color = '#ef4444';
    }
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

        // 사용자가 이미 AI 버튼을 눌렀거나 캡처 후 자동 생성된 제목이 있는지 확인 
        if (window.lastGeneratedTitle) {
            finalTitle = window.lastGeneratedTitle;
        } else if (session) {
            // AI 제목 생성 API 호출
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
                    if (json.status === 'success' && json.data.title) {
                        finalTitle = json.data.title;
                        if (json.data.category && document.getElementById('manualCategory').value === '일반') {
                            document.getElementById('manualCategory').value = json.data.category; // 방어 로직 (카테고리 업데이트 안되어있을 수도 있으니)
                        }
                    }
                }
            } catch (e) {
                console.warn('Title generation failed', e);
            }
        }

        const selectedCategory = document.getElementById('manualCategory').value || '일반';

        // 마지막으로 사용된 캡처 출처 가져오기
        const locResult = await chromeStorageAdapter.getItem('lastSource');
        const sourceName = locResult || '수동입력';

        const { error } = await supabaseClient.from('hub_prompts').insert({
            title: finalTitle,
            prompt_text: prompt,
            source_name: sourceName,
            user_id: currentUser.id,
            category: selectedCategory,
            result_text: result || null
        });

        if (error) throw error;

        statusMsg.textContent = '✨ 저장 완료! 제목: ' + finalTitle;
        statusMsg.style.color = '#10b981';
        document.getElementById('manualPrompt').value = '';
        document.getElementById('manualResult').value = '';
        document.getElementById('manualCategory').value = '일반';
        window.lastGeneratedTitle = null;

        // Clear local storage on success
        chrome.storage.local.remove(['manualPrompt', 'manualResult', 'lastSource']);

    } catch (err) {
        statusMsg.textContent = '저장 실패: ' + err.message;
        statusMsg.style.color = '#ef4444';
    }
}
