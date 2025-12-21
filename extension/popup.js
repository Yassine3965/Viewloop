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
        googleLoginBtn: document.getElementById('googleLoginBtn'),
        webLoginBtn: document.getElementById('webLoginBtn'),
        webRegisterBtn: document.getElementById('webRegisterBtn')
    };

    const API_BASE_URL = "https://viewloop.vercel.app";

    // Load State
    async function loadUserState() {
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
                els.statusText.textContent = 'Connection Active';
                els.statusBadge.classList.add('active');

                // Set User Data with Fallback
                els.userName.textContent = userName || (userId ? userId.substring(0, 10) + '...' : 'جاري التحميل...');

                // 🚀 PROACTIVE FETCH: If name or points are old, ask background to refresh
                chrome.runtime.sendMessage({ type: 'FETCH_PROFILE' }, (response) => {
                    if (response && response.success && response.profile) {
                        const p = response.profile;
                        els.userName.textContent = p.name;
                        els.userPoints.textContent = parseFloat(p.points || 0).toFixed(2);
                        els.userGems.textContent = parseFloat(p.gems || 0).toFixed(2);
                        const levelEl = document.getElementById('userLevel');
                        if (levelEl) levelEl.textContent = `المستوى ${p.level}`;
                    }
                });

                // Stats Formatting
                if (stored.viewloop_user_points !== undefined) {
                    els.userPoints.textContent = parseFloat(stored.viewloop_user_points).toFixed(2);
                }
                if (stored.viewloop_user_gems !== undefined) {
                    els.userGems.textContent = parseFloat(stored.viewloop_user_gems).toFixed(2);
                }

                const level = stored.viewloop_user_level || 1;
                const levelEl = document.getElementById('userLevel');
                if (levelEl) levelEl.textContent = `المستوى ${level}`;

            } else {
                // Anonymous / Not Logged In
                els.userCard.style.display = 'none';
                els.loginPrompt.style.display = 'block';
                els.statusText.textContent = 'Connection Idle';
                els.statusBadge.classList.remove('active');
            }

        } catch (e) {
            console.error("Popup error:", e);
        }
    }

    await loadUserState();

    // Button Actions
    if (els.startWatchBtn) {
        els.startWatchBtn.addEventListener('click', () => {
            window.open(`${API_BASE_URL}/api/direct-watch`, '_blank');
        });
    }

    if (els.openDashboardBtn) {
        els.openDashboardBtn.addEventListener('click', () => {
            window.open(`${API_BASE_URL}/dashboard`, '_blank');
        });
    }

    // AUTH ACTIONS
    if (els.googleLoginBtn) {
        els.googleLoginBtn.addEventListener('click', () => {
            // Auto-trigger Google login on the web app side if possible, or just open login
            window.open(`${API_BASE_URL}/login`, '_blank');
        });
    }

    if (els.webLoginBtn) {
        els.webLoginBtn.addEventListener('click', () => {
            window.open(`${API_BASE_URL}/login`, '_blank');
        });
    }

    if (els.webRegisterBtn) {
        els.webRegisterBtn.addEventListener('click', () => {
            window.open(`${API_BASE_URL}/register`, '_blank');
        });
    }

    // Refresh Sync (Hidden but kept for debug if needed via console or long press)
    const refreshSyncBtn = document.getElementById('refreshSyncBtn');
    if (refreshSyncBtn) {
        refreshSyncBtn.addEventListener('click', async () => {
            await chrome.storage.local.remove(['viewloop_auth_token', 'viewloop_user_id', 'auth_synced_at']);
            els.statusText.textContent = 'تم مسح البيانات...';
            setTimeout(() => window.location.reload(), 500);
        });
    }

    // === Monitoring UI Logic ===
    const monitorEls = {
        section: document.getElementById('progressSection'),
        alert: document.getElementById('invalidSessionAlert'), // Add the alert element
        barMain: document.getElementById('barMain'),
        textMain: document.getElementById('progTextMain'),
        barExtra: document.getElementById('barExtra'),
        textExtra: document.getElementById('progTextExtra'),
        durationLabel: document.getElementById('videoDurationLabel')
    };

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async function updateMonitoring() {
        // Find active tab to get its specific status
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab) return;

        chrome.runtime.sendMessage({ type: 'GET_SESSIONS', tabId: tab.id }, (response) => {
            if (chrome.runtime.lastError) return;

            // 1. Handle Invalid State (Unauthorized Video)
            if (response && response.invalid) {
                monitorEls.alert.style.display = 'flex';
                monitorEls.section.style.display = 'none';
                return;
            } else {
                monitorEls.alert.style.display = 'none';
            }

            // 2. Handle Active Sessions
            if (response && response.success && response.sessions && response.sessions.length > 0) {
                // Find session for current tab if possible, otherwise use last
                const session = response.sessions.find(s => s.tabId === tab.id) || response.sessions[response.sessions.length - 1];
                const duration = session.duration || 0;

                if (monitorEls.durationLabel && duration > 0) {
                    monitorEls.durationLabel.textContent = formatTime(duration);
                }

                const watchTime = (session.validHeartbeats || 0) * 5;
                monitorEls.section.style.display = 'block';

                let mainPercent = duration > 0 ? (watchTime / duration) * 100 : 0;
                if (mainPercent > 100) mainPercent = 100;

                monitorEls.barMain.style.width = `${mainPercent}%`;
                monitorEls.textMain.textContent = `${Math.min(Math.floor(mainPercent), 100)}%`;

                if (duration > 0 && watchTime > duration) {
                    const extraTime = watchTime - duration;
                    let extraPercent = (extraTime / duration) * 100;
                    if (extraPercent > 100) extraPercent = 100;

                    monitorEls.barExtra.style.width = `${extraPercent}%`;
                    monitorEls.textExtra.textContent = `+${formatTime(extraTime)}`;
                    monitorEls.barExtra.classList.add('pulse-anim');
                } else {
                    monitorEls.barExtra.style.width = '0%';
                    monitorEls.textExtra.textContent = '0:00';
                    monitorEls.barExtra.classList.remove('pulse-anim');
                }

            } else {
                monitorEls.section.style.display = 'none';
            }
        });
    }

    setInterval(updateMonitoring, 1000);
    updateMonitoring();
});
