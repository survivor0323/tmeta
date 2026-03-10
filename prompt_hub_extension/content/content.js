// Helper function to extract multimodal assets (images, videos, code blocks)
async function extractAssets(aiMsgElement, source) {
    let assets = [];
    if (!aiMsgElement) return assets;

    // 1. Images
    const imgs = aiMsgElement.querySelectorAll('img');
    for (let img of Array.from(imgs)) {
        const src = img.src || img.getAttribute('data-src');
        // Filter out small UI icons, avatar profile pictures, or invalid URLs
        if (src && !src.includes('avatar') && !src.includes('profile') && !src.startsWith('data:image/svg')) {
            if (src.startsWith('blob:')) {
                // Blob URLs cross-origin cannot be fetched by popup. Must convert to base64 here.
                try {
                    const res = await fetch(src);
                    const blob = await res.blob();
                    const base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                    assets.push({ type: 'image', url: base64 });
                } catch (e) {
                    console.error("Blob capture failed", e);
                    assets.push({ type: 'image', url: src });
                }
            } else {
                assets.push({ type: 'image', url: src });
            }
        }
    }

    // 2. Videos
    const videos = aiMsgElement.querySelectorAll('video');
    videos.forEach(v => {
        const src = v.src || v.querySelector('source')?.src;
        if (src) assets.push({ type: 'video', url: src });
    });

    // 3. Canvas/Code Blocks
    const codeBlocks = aiMsgElement.querySelectorAll('pre code');
    codeBlocks.forEach(cb => {
        const langHtml = cb.className || 'code';
        const content = cb.innerText.substring(0, 5000); // Limit to 5000 chars to avoid memory issues
        assets.push({ type: 'canvas', language: langHtml, content: content });
    });

    return assets;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_PROMPT') {
        const url = window.location.href;

        (async () => {
            let data = { source: 'Unknown', prompt: '', title: '', result: '', assets: [] };

            try {
                if (url.includes('chatgpt.com')) {
                    data.source = 'ChatGPT';
                    // ChatGPT 구조: .whitespace-pre-wrap 요소를 찾아서 추론
                    const msgs = document.querySelectorAll('div[data-message-author-role="user"] .whitespace-pre-wrap, article[data-testid^="conversation-turn-user"] .whitespace-pre-wrap, div[data-message-author-role="user"]');
                    if (msgs.length > 0) {
                        data.prompt = msgs[msgs.length - 1].innerText;
                        const aiMsgs = document.querySelectorAll('div[data-message-author-role="assistant"] .markdown, article[data-testid^="conversation-turn-assistant"] .markdown, div[data-message-author-role="assistant"]');
                        if (aiMsgs.length > 0) {
                            const lastAiMsg = aiMsgs[aiMsgs.length - 1];
                            data.result = lastAiMsg.innerText.substring(0, 1500);
                            if (lastAiMsg.innerText.length > 1500) data.result += '...';
                            data.assets = await extractAssets(lastAiMsg, 'ChatGPT');
                        }
                    }
                    data.title = document.title || 'ChatGPT Session';
                }
                else if (url.includes('claude.ai')) {
                    data.source = 'Claude';
                    // Claude 구조 분해 로직 - 최대한 다양한 셀렉터 결합 (DOM 변경 대응)
                    const claudeUserSelectors = [
                        '.font-user-message',
                        '[data-is-user="true"]',
                        '[data-testid="user-message"]',
                        '.user-message',
                        '.message.user',
                        // 최신 Claude UI에서 텍스트가 담긴 가장 안쪽 요소를 잡기 위한 범용 클래스 조합 (말풍선)
                        'div.whitespace-pre-wrap.text-left:not(.font-claude-message)'
                    ].join(', ');

                    const msgs = document.querySelectorAll(claudeUserSelectors);

                    if (msgs.length > 0) {
                        data.prompt = msgs[msgs.length - 1].innerText;

                        const claudeAiSelectors = [
                            '.font-claude-message',
                            '[data-is-user="false"]',
                            '[data-testid="assistant-message"]',
                            '.assistant-message',
                            '.message.assistant',
                            '.message.claude'
                        ].join(', ');

                        const aiMsgs = document.querySelectorAll(claudeAiSelectors);
                        if (aiMsgs.length > 0) {
                            const lastAiMsg = aiMsgs[aiMsgs.length - 1];
                            data.result = lastAiMsg.innerText.substring(0, 1500);
                            if (lastAiMsg.innerText.length > 1500) data.result += '...';
                            data.assets = await extractAssets(lastAiMsg, 'Claude');
                        }
                    }
                    data.title = document.title || 'Claude Session';
                }
                else if (url.includes('gemini.google.com')) {
                    data.source = 'Gemini';
                    const geminiUserSelectors = [
                        'message-content[data-message-author-role="user"]',
                        'message-content[data-author-role="user"]',
                        '[data-message-author-role="user"]',
                        '[data-author-role="user"]',
                        '.user-query-bubble-with-background',
                        '.user-query',
                        'user-query',
                        '.query-text'
                    ].join(', ');

                    const msgs = document.querySelectorAll(geminiUserSelectors);
                    if (msgs.length > 0) {
                        data.prompt = msgs[msgs.length - 1].innerText;

                        // 제미나이 UI상 읽어주기 등 접근성 텍스트로 보이지 않게 삽입된 "말씀하신 내용" 접두어 제거
                        data.prompt = data.prompt.replace(/^말씀하신\s*내용\s*/, '');

                        const geminiAiSelectors = [
                            'message-content[data-message-author-role="model"]',
                            'message-content[data-author-role="model"]',
                            '[data-message-author-role="model"]',
                            '[data-author-role="model"]',
                            '.model-response-text',
                            '.model-response',
                            'model-response',
                            '.response-text'
                        ].join(', ');

                        const aiMsgs = document.querySelectorAll(geminiAiSelectors);
                        if (aiMsgs.length > 0) {
                            const lastAiMsg = aiMsgs[aiMsgs.length - 1];
                            data.result = lastAiMsg.innerText.substring(0, 1500);
                            if (lastAiMsg.innerText.length > 1500) data.result += '...';
                            // Gemini often places images outside the text box, search from parent
                            // Search a broader container to capture multiple images in grid
                            const parentContainer = lastAiMsg.closest('chat-item, conversation-item, .conversation-turn, .model-response') || lastAiMsg.parentElement.parentElement;
                            data.assets = await extractAssets(parentContainer, 'Gemini');
                        }
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
        })();

        return true; // async marker
    }
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
