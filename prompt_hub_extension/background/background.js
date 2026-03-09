chrome.runtime.onInstalled.addListener(() => {
    console.log("Motiverse Prompt Hub Extension Installed");
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
