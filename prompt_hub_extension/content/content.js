chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PROMPT') {
        const url = window.location.href;
        let data = { source: 'Unknown', prompt: '', title: '', result: '' };

        try {
            if (url.includes('chatgpt.com')) {
                data.source = 'ChatGPT';
                // ChatGPT 구조: .whitespace-pre-wrap 요소를 찾아서 추론 (아주 기본적인 예제)
                const msgs = document.querySelectorAll('div[data-message-author-role="user"]');
                if (msgs.length > 0) {
                    data.prompt = msgs[msgs.length - 1].innerText;
                    const aiMsgs = document.querySelectorAll('div[data-message-author-role="assistant"]');
                    if (aiMsgs.length > 0) {
                        data.result = aiMsgs[aiMsgs.length - 1].innerText.substring(0, 500) + '...';
                    }
                }
                data.title = document.title || 'ChatGPT Session';
            }
            else if (url.includes('claude.ai')) {
                data.source = 'Claude';
                // Claude 구조 분해 로직
                const msgs = document.querySelectorAll('.font-user-message');
                if (msgs.length > 0) {
                    data.prompt = msgs[msgs.length - 1].innerText;
                }
                data.title = document.title || 'Claude Session';
            }
            else if (url.includes('gemini.google.com')) {
                data.source = 'Gemini';
                const msgs = document.querySelectorAll('message-content[data-author-role="user"]');
                if (msgs.length > 0) {
                    data.prompt = msgs[msgs.length - 1].innerText;
                }
                data.title = document.title || 'Gemini Session';
            }

            if (data.prompt) {
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, message: '프롬프트 텍스트를 페이지에서 찾지 못했습니다.' });
            }

        } catch (err) {
            sendResponse({ success: false, message: err.message });
        }
    }
    return true; // async
});

// Optional: Add a floating button to save current prompt directly from the page
function injectFloatingButton() {
    const btn = document.createElement('button');
    btn.className = 'motiverse-capture-btn';
    btn.innerText = '✨ Motiverse에 저장';
    btn.onclick = () => {
        // Alerting or sending message to background
        alert('Motiverse 확장의 팝업(우상단)을 열어서 저장하세요!');
    };
    document.body.appendChild(btn);
}

// Only inject in specific domains for safety
if (window.location.href.match(/chatgpt\.com|claude\.ai|gemini\.google\.com/i)) {
    injectFloatingButton();
}
