// popup.js - ViewLoop Modern Controller

document.addEventListener('DOMContentLoaded', async function () {
    // UI Elements
    const els = {
        userCard: document.getElementById('userCard'),
        loginPrompt: document.getElementById('loginPrompt'),
        userName: document.getElementById('userName'),
        userAvatar: document.getElementById('userAvatar'),
        userPoints: document.getElementById('userPoints'),
        userGems: document.getElementById('userGems'),
        statusBadge: document.getElementById('connectionStatus'),
        statusText: document.getElementById('statusText'),
        startWatchBtn: document.getElementById('startWatchBtn'),
        openDashboardBtn: document.getElementById('openDashboardBtn'),
        openLoginBtn: document.getElementById('openLoginBtn')
    };

    // Load State
    try {
        const stored = await chrome.storage.local.get(['viewloop_user_id', 'viewloop_auth_token']);
        const token = stored.viewloop_auth_token;
        const userId = stored.viewloop_user_id;

        if (token && userId) {
            // Logged In
            els.userCard.style.display = 'flex';
            els.loginPrompt.style.display = 'none';
            els.userName.textContent = userId.substring(0, 10) + '...'; // Placeholder until profile fetch?
            els.statusText.textContent = 'متصل';
            els.statusBadge.classList.add('active');

            // Send PING to background to get session status or fetch profile
            // For now, we rely on cached data if we had it, or just show basic info.
            // Ideally we'd fetch user profile from API, but we might not have it in storage.
        } else {
            // Anonymous / Not Logged In
            els.userCard.style.display = 'none';
            els.loginPrompt.style.display = 'flex';
            els.statusText.textContent = 'غير متصل';
        }

    } catch (e) {
        console.error("Popup error:", e);
    }

    // Button Actions
    els.startWatchBtn.addEventListener('click', () => {
        // Direct Professional Redirect
        window.open('https://viewloop.vercel.app/api/direct-watch', '_blank');
    });

    els.openDashboardBtn.addEventListener('click', () => {
        window.open('https://viewloop.vercel.app/dashboard', '_blank');
    });

    els.openLoginBtn.addEventListener('click', () => {
        window.open('https://viewloop.vercel.app/login', '_blank');
    });

    // Manual Token Save
    const manualInput = document.getElementById('manualTokenInput');
    const saveTokenBtn = document.getElementById('saveTokenBtn');

    if (saveTokenBtn && manualInput) {
        saveTokenBtn.addEventListener('click', async () => {
            const token = manualInput.value.trim();
            if (token && token.length > 20) {
                await chrome.storage.local.set({
                    'viewloop_auth_token': token,
                    'viewloop_user_id': 'manual_user', // We don't have the ID, background will fetch profile later or server accepts just token
                    'auth_synced_at': Date.now()
                });
                // Send explicit sync message to background
                chrome.runtime.sendMessage({
                    type: 'AUTH_SYNC',
                    token: token,
                    userId: 'manual_user'
                }, () => {
                    window.location.reload(); // Reload popup to show logged in state
                });
            } else {
                alert('الرمز غير صحيح');
            }
        });
    }
});
