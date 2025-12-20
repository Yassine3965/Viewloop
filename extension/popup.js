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
        const stored = await chrome.storage.local.get([
            'viewloop_user_id',
            'viewloop_auth_token',
            'viewloop_user_name',
            'viewloop_user_points',
            'viewloop_user_gems',
            'viewloop_user_level'
        ]);

        const token = stored.viewloop_auth_token;
        const userId = stored.viewloop_user_id;
        const userName = stored.viewloop_user_name;

        if (token) {
            // Logged In
            els.userCard.style.display = 'flex';
            els.loginPrompt.style.display = 'none';
            els.statusText.textContent = 'متصل';
            els.statusBadge.classList.add('active');

            // Set User Data
            els.userName.textContent = userName || (userId ? userId.substring(0, 10) + '...' : 'مستخدم');
            els.userPoints.textContent = stored.viewloop_user_points !== undefined ? stored.viewloop_user_points : '--';
            els.userGems.textContent = stored.viewloop_user_gems !== undefined ? stored.viewloop_user_gems : '--';

            const level = stored.viewloop_user_level || 1;
            document.getElementById('userLevel').textContent = `المستوى ${level}`;

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

    // Refresh Sync logic
    const refreshSyncBtn = document.getElementById('refreshSyncBtn');
    if (refreshSyncBtn) {
        refreshSyncBtn.addEventListener('click', async () => {
            // 1. Clear storage
            await chrome.storage.local.remove(['viewloop_auth_token', 'viewloop_user_id', 'auth_synced_at']);

            // 2. Visual Feedback
            els.statusText.textContent = 'تم مسح البيانات...';
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
    }

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
