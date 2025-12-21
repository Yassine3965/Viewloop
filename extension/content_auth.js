// ViewLoop Auth Sync Script - Production
console.log("🔥 [AUTH-SYNC] Script Loaded");

function updateStatus(msg, type = 'info') {
    // Console only for production
    if (type === 'error') {
        console.error(`[AUTH-SYNC] ${msg}`);
    } else {
        console.log(`[AUTH-SYNC] ${msg}`);
    }
}

function syncAuth() {
    try {
        const token = localStorage.getItem('userAuthToken');
        if (token) {
            updateStatus("Found token! Sending to extension...");

            // Try internal message
            if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
                chrome.runtime.sendMessage({
                    type: 'AUTH_SYNC',
                    token: token,
                    userId: 'user_sync_' + Date.now()
                }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        console.warn("[AUTH-SYNC] Error:", lastError.message);
                        updateStatus("Extension Error: " + lastError.message, 'error');
                    } else if (response && response.success) {
                        console.log("[AUTH-SYNC] Success!");
                        updateStatus("SUCCESS! Connected. ✅", 'success');
                        clearInterval(retryInterval); // Stop retrying
                    } else {
                        updateStatus("No response from extension.", 'error');
                    }
                });
            } else {
                updateStatus("Chrome API not found!", 'error');
            }
        } else {
            updateStatus("Waiting for login (No Token)...", 'info');
        }
    } catch (e) {
        console.error("[AUTH-SYNC] Fatal:", e);
        updateStatus("Script Fatal Error: " + e.message, 'error');
    }
}

// Retry mechanism
const retryInterval = setInterval(syncAuth, 2000);

// Listen for storage changes
window.addEventListener('storage', (e) => {
    if (e.key === 'userAuthToken') {
        syncAuth();
    }
});

// Run immediately
syncAuth();
