// Helper function to extract multimodal assets (images, videos, code blocks)
async function extractAssets(aiMsgElement, source, seenUrls = new Set()) {
    let assets = [];
    if (!aiMsgElement) return assets;

    // 1. Images
    const imgs = aiMsgElement.querySelectorAll('img');
    for (let img of Array.from(imgs)) {
        const src = img.src || img.getAttribute('data-src');

        if (!src || seenUrls.has(src)) continue;

        // Filter out small UI icons, avatar profile pictures, or invalid URLs.
        // Also skip very small icons if they are naturally small (less than 50px).
        // (Blob images from DALL-E are usually large, so we keep them).
        const isLikelyIcon = img.naturalWidth > 0 && img.naturalWidth < 50 && img.naturalHeight > 0 && img.naturalHeight < 50;

        if (!src.includes('avatar') && !src.includes('profile') && !src.startsWith('data:image/svg') && !isLikelyIcon) {
            seenUrls.add(src);
            try {
                // Fetch image (works for blob:, same-origin, or CORS-enabled images)
                // Using credentials 'same-origin' to ensure cookies are sent if it's a same-origin Google image
                const res = await fetch(src, { credentials: 'omit' });
                const blob = await res.blob();
                const base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                assets.push({ type: 'image', url: base64 });
            } catch (e) {
                console.warn("Base64 capture failed for", src, e);
                // Fallback: If fetch fails (CORS etc), try drawing it to a canvas
                try {
                    const canvasBase64 = await new Promise((resolve, reject) => {
                        const imgElem = new Image();
                        imgElem.crossOrigin = 'anonymous'; // might fail if server doesn't support CORS
                        imgElem.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = imgElem.width;
                            canvas.height = imgElem.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(imgElem, 0, 0);
                            resolve(canvas.toDataURL('image/jpeg', 0.9));
                        };
                        imgElem.onerror = () => reject('Canvas load error');
                        imgElem.src = src;
                    });
                    assets.push({ type: 'image', url: canvasBase64 });
                } catch (err) {
                    // Ultimate fallback: Just send the URL
                    assets.push({ type: 'image', url: src });
                }
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
                    // Find the last user message
                    const userMsgs = document.querySelectorAll('article[data-testid^="conversation-turn-user"], div[data-message-author-role="user"]');
                    if (userMsgs.length > 0) {
                        const lastUserMsg = userMsgs[userMsgs.length - 1];
                        const userTextEl = lastUserMsg.querySelector('.whitespace-pre-wrap') || lastUserMsg;
                        data.prompt = userTextEl.innerText.trim();

                        // To get the AI response (which could be an assistant message, or a tool/DALL-E message),
                        // we find the parent container of the user message, and look at all its succeeding siblings.
                        // In modern ChatGPT, conversation turns are sibling `article` elements.
                        const userTurnContainer = lastUserMsg.closest('article') || lastUserMsg.parentElement;
                        let nextSibling = userTurnContainer.nextElementSibling;

                        let combinedAiText = '';
                        let combinedAiAssets = [];
                        let seenUrls = new Set(); // track URLs across siblings

                        while (nextSibling) {
                            // Only process it if it's NOT another user message. If it's a user message, we stop.
                            if (nextSibling.getAttribute('data-testid')?.startsWith('conversation-turn-user') ||
                                nextSibling.querySelector('div[data-message-author-role="user"]')) {
                                break;
                            }

                            const markdownEl = nextSibling.querySelector('.markdown');
                            const textContent = markdownEl ? markdownEl.innerText : nextSibling.innerText;
                            if (textContent) {
                                combinedAiText += textContent + '\n';
                            }

                            // Extract assets from this sibling
                            const siblingAssets = await extractAssets(nextSibling, 'ChatGPT', seenUrls);
                            combinedAiAssets = combinedAiAssets.concat(siblingAssets);

                            nextSibling = nextSibling.nextElementSibling;
                        }

                        // If no siblings but there is a globally found last AI message logically after our text (fallback)
                        if (!combinedAiText && combinedAiAssets.length === 0) {
                            const aiMsgs = document.querySelectorAll('article[data-testid^="conversation-turn-"], div[data-message-author-role="assistant"], div[data-message-author-role="tool"]');
                            if (aiMsgs.length > 0) {
                                const lastAiMsg = aiMsgs[aiMsgs.length - 1];
                                const markdownEl = lastAiMsg.querySelector('.markdown');
                                const textContent = markdownEl ? markdownEl.innerText : lastAiMsg.innerText;
                                combinedAiText = textContent;
                                combinedAiAssets = await extractAssets(lastAiMsg, 'ChatGPT', seenUrls);
                            }
                        }

                        data.result = combinedAiText.trim().substring(0, 1500);
                        if (combinedAiText.length > 1500) data.result += '...';
                        data.assets = combinedAiAssets;
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
                    sendResponse({ success: false, message: '프롬프트 텍스트를 페이지에서 찾지 못했습니다.', data: data, url: url });
                }

            } catch (err) {
                sendResponse({ success: false, message: err.message, stack: err.stack, data: data, url: url });
            }
        })();

        return true; // async marker
    }
});
