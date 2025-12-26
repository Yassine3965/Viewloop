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

            // Check if context is valid
            if (!chrome || !chrome.runtime || !chrome.runtime.id) {
                updateStatus("Extension context invalidated. Stopping sync.", 'error');
                if (window.retryInterval) clearInterval(window.retryInterval);
                return;
            }

            try {
                chrome.runtime.sendMessage({
                    type: 'AUTH_SYNC',
                    token: token
                }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        const errorMsg = lastError.message;
                        console.warn("[AUTH-SYNC] Connection Error:", errorMsg);

                        if (errorMsg.includes("context invalidated") || errorMsg.includes("connection. Receiving end does not exist")) {
                            updateStatus("Context dead. Stopping sync.", 'error');
                            if (window.retryInterval) clearInterval(window.retryInterval);
                        } else {
                            updateStatus("Extension Error: " + errorMsg, 'error');
                        }
                    } else if (response && response.success) {
                        console.log("[AUTH-SYNC] Success!");
                        updateStatus("SUCCESS! Connected. ✅", 'success');
                        if (window.retryInterval) clearInterval(window.retryInterval);
                        window.retryInterval = null;
                    } else {
                        updateStatus("No response from extension.", 'error');
                    }
                });
            } catch (sendMessageErr) {
                if (sendMessageErr.message.includes("context invalidated")) {
                    updateStatus("Context dead. Stopping sync.", 'error');
                    if (window.retryInterval) clearInterval(window.retryInterval);
                }
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
window.retryInterval = setInterval(syncAuth, 5000); // Relaxed to 5s

// Run immediately
syncAuth();
