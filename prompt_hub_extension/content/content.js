if (typeof window.MOTIVERSE_CONTENT_SCRIPT_LOADED === 'undefined') {
window.MOTIVERSE_CONTENT_SCRIPT_LOADED = true;

function getAllElementsDeep(selector, root = document) {
    const elements = Array.from(root.querySelectorAll(selector));
    const allNodes = Array.from(root.querySelectorAll('*'));
    for (const el of allNodes) {
        if (el.shadowRoot) {
            elements.push(...getAllElementsDeep(selector, el.shadowRoot));
        }
    }
    return elements;
}

// Helper function to extract multimodal assets (images, videos, code blocks)
async function extractAssets(aiMsgElements, source, seenUrls = new Set()) {
    let assets = [];
    if (!aiMsgElements) return assets;

    const roots = Array.isArray(aiMsgElements) ? aiMsgElements : [aiMsgElements];
    if (roots.length === 0) return assets;

    const imgs = [];
    const videos = [];
    const codeBlocks = [];

    roots.forEach(root => {
        imgs.push(...getAllElementsDeep('img', root));
        videos.push(...getAllElementsDeep('video', root));
        codeBlocks.push(...getAllElementsDeep('pre code', root));
    });

    for (let img of imgs) {
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
                // Using default fetch to allow cookies if needed
                const res = await fetch(src);
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
    videos.forEach(v => {
        const src = v.src || v.querySelector('source')?.src;
        if (src) assets.push({ type: 'video', url: src });
    });

    // 3. Canvas/Code Blocks
    codeBlocks.forEach(cb => {
        const langHtml = cb.className || 'code';
        const content = cb.innerText.substring(0, 5000); // Limit to 5000 chars to avoid memory issues
        assets.push({ type: 'canvas', language: langHtml, content: content });
    });

    return assets;
}

function getNodesAfter(nodes, refNode) {
    if (!refNode || !nodes) return [];
    return Array.from(nodes).filter(node => 
        !!(refNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
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

                        // The container for the entire user turn and its subsequent AI turns
                        const conversationTurns = document.querySelectorAll('article');
                        if (conversationTurns.length > 0) {
                            let foundUser = false;
                            let combinedAiText = '';

                            // Iterate backwards to find the last user message, then collect all following AI turns
                            const aiTurns = [];
                            for (let i = conversationTurns.length - 1; i >= 0; i--) {
                                const turn = conversationTurns[i];
                                const isUser = turn.querySelector('[data-message-author-role="user"]');

                                if (isUser && !foundUser) {
                                    foundUser = true; // We hit the last user message, so we stop here
                                } else if (!isUser && !foundUser) {
                                    aiTurns.unshift(turn);
                                    // This is an AI turn that came AFTER the last user message
                                    const markdownEl = turn.querySelector('.markdown') || turn.querySelector('[data-message-author-role="assistant"]');
                                    const textContent = markdownEl ? markdownEl.innerText : turn.innerText;

                                    // Prepend text since we are iterating backwards
                                    if (textContent && !textContent.includes('ChatGPT can make mistakes')) {
                                        combinedAiText = textContent + '\n' + combinedAiText;
                                    }
                                }
                            }

                            data.result = combinedAiText.trim().substring(0, 1500);
                            if (combinedAiText.length > 1500) data.result += '...';

                            data.assets = await extractAssets(aiTurns, 'ChatGPT');
                        } else {
                            // Fallback if no <article> tags (e.g., UI changed again)
                            const aiMsgs = document.querySelectorAll('div[data-message-author-role="assistant"], div[data-message-author-role="tool"]');
                            if (aiMsgs.length > 0) {
                                const lastAiMsg = aiMsgs[aiMsgs.length - 1];
                                data.result = lastAiMsg.innerText.substring(0, 1500);
                                const targetMsgs = getNodesAfter(aiMsgs, userMsgs[userMsgs.length - 1]);
                                data.assets = await extractAssets(targetMsgs, 'ChatGPT');
                            }
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
                        }
                        const targetMsgs = getNodesAfter(aiMsgs, msgs[msgs.length - 1]);
                        data.assets = await extractAssets(targetMsgs, 'Claude');
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
                        }
                        const targetMsgs = getNodesAfter(aiMsgs, msgs[msgs.length - 1]);
                        data.assets = await extractAssets(targetMsgs, 'Gemini');
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

} // end of MOTIVERSE_CONTENT_SCRIPT_LOADED check
