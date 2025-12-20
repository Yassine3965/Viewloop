// ViewLoop Auth Sync Script - V3.0 Visual Diagnostics
console.log("🔥 [AUTH-SYNC] Script Loaded");

// Create Diagnostic Banner
const banner = document.createElement('div');
Object.assign(banner.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 16px',
    background: '#0f172a', // Dark blue
    color: '#38bdf8', // Sky blue
    border: '2px solid #38bdf8',
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    fontSize: '14px',
    zIndex: '2147483647', // Max Z-Index
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    transition: 'opacity 0.5s',
    pointerEvents: 'none' // Don't block clicks
});
banner.innerText = 'ViewLoop Sync: Initializing...';

function showBanner() {
    if (document.body) {
        document.body.appendChild(banner);
    } else {
        requestAnimationFrame(showBanner);
    }
}
showBanner();

function updateStatus(msg, type = 'info') {
    banner.innerText = `ViewLoop Sync: ${msg}`;
    console.log(`[AUTH-SYNC UI] ${msg}`);

    if (type === 'success') {
        banner.style.borderColor = '#10b981'; // Green
        banner.style.color = '#10b981';
        // Hide after 5 seconds
        setTimeout(() => banner.style.opacity = '0', 5000);
    } else if (type === 'error') {
        banner.style.borderColor = '#ef4444'; // Red
        banner.style.color = '#ef4444';
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
