// Supabase JS will be loaded before this from lib/supabase-js.js

const SUPABASE_URL = 'https://gnpeluvwykdiadwniled.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_w7r4IY60O392RTqPmUGRhg_rs_pJKuF';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    const contentLoading = document.getElementById('contentLoading');
    const contentAuth = document.getElementById('contentAuth');
    const contentMain = document.getElementById('contentMain');
    const userGreeting = document.getElementById('userGreeting');

    // 1. Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();

    contentLoading.classList.add('hidden');

    if (!session) {
        contentAuth.classList.remove('hidden');
        return;
    }

    // 2. User is logged in
    currentUser = session.user;
    contentMain.classList.remove('hidden');
    userGreeting.textContent = `안녕하세요, ${currentUser.user_metadata.full_name || '마케터'}님!`;

    // Listeners
    document.getElementById('btnOpenWeb').addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:5000' }); // TODO: Change to prod URL later
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

        try {
            const { data: userData } = await supabase.from('users').select('*').eq('id', currentUser.id).single();

            // Save to Supabase
            const { data, error } = await supabase.from('prompts').insert({
                title: response.data.title || '새 캡처된 프롬프트',
                prompt_text: response.data.prompt,
                source: response.data.source,
                author_id: currentUser.id,
                category: '일반', // default
                tags: [response.data.source.toLowerCase()],
                example_result: response.data.result || null,
                company_id: userData ? userData.company_id : null,
                department: userData ? userData.department : null
            });

            if (error) throw error;

            statusMsg.textContent = '✨ 성공적으로 캡처되어 허브에 저장되었습니다!';
            statusMsg.style.color = '#10b981';

        } catch (err) {
            console.error(err);
            statusMsg.textContent = '저장 실패: ' + err.message;
            statusMsg.style.color = '#ef4444';
        }
    });
}

async function handleManualSave() {
    const title = document.getElementById('manualTitle').value.trim();
    const prompt = document.getElementById('manualPrompt').value.trim();
    const result = document.getElementById('manualResult').value.trim();
    const statusMsg = document.getElementById('statusMessage');

    if (!title || !prompt) {
        statusMsg.textContent = '제목과 내용을 모두 입력해주세요.';
        statusMsg.style.color = '#ef4444';
        return;
    }

    statusMsg.textContent = '저장 중...';
    statusMsg.style.color = '#3b82f6';

    try {
        const { data: userData } = await supabase.from('users').select('*').eq('id', currentUser.id).single();

        const { error } = await supabase.from('prompts').insert({
            title: title,
            prompt_text: prompt,
            source: '웹/수동입력',
            author_id: currentUser.id,
            category: '일반',
            example_result: result || null,
            company_id: userData ? userData.company_id : null,
            department: userData ? userData.department : null
        });

        if (error) throw error;

        statusMsg.textContent = '✨ 수동 등록이 완료되었습니다!';
        statusMsg.style.color = '#10b981';
        document.getElementById('manualTitle').value = '';
        document.getElementById('manualPrompt').value = '';
        document.getElementById('manualResult').value = '';

    } catch (err) {
        statusMsg.textContent = '저장 실패: ' + err.message;
        statusMsg.style.color = '#ef4444';
    }
}
