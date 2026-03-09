chrome.runtime.onInstalled.addListener(() => {
    console.log("Motiverse Prompt Hub Extension Installed");

    // 익스텐션 아이콘 클릭 시 사이드 패널이 열리도록 설정
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error("Side panel error:", error));
});

// For cross-origin authentication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTH_SYNC') {
        // If the web app sends a token to sync, store it
        chrome.storage.local.set({ sb_session: message.session }, () => {
            sendResponse({ status: 'Session synced' });
        });
    }
    return true;
});
