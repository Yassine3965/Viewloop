// ViewLoop Auth Sync Script
// Runs on viewloop.vercel.app to sync auth token to extension

console.log("🔐 [AUTH-SYNC] Checking for auth token...");

function syncAuth() {
    try {
        const token = localStorage.getItem('userAuthToken');
        // We can also try to get userId from storage if available, 
        // or let the background verify the token.
        // The background script expects { type: 'AUTH_SYNC', token, userId? }

        if (token) {
            console.log("🔐 [AUTH-SYNC] Found token, syncing to extension...");
            chrome.runtime.sendMessage({
                type: 'AUTH_SYNC',
                token: token
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ [AUTH-SYNC] Failed to sync:", chrome.runtime.lastError);
                } else {
                    console.log("✅ [AUTH-SYNC] Sync response:", response);
                }
            });
        } else {
            console.log("⚠️ [AUTH-SYNC] No token found in localStorage");
        }
    } catch (e) {
        console.error("❌ [AUTH-SYNC] Error:", e);
    }
}

// Run immediately
syncAuth();

// And listen for storage changes (login/logout)
window.addEventListener('storage', (e) => {
    if (e.key === 'userAuthToken') {
        syncAuth();
    }
});
