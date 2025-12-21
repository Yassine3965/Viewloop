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

            // Set User Data with Fallback
            if (userName) {
                els.userName.textContent = userName;
            } else {
                if (userId && userId !== 'manual_user') {
                    els.userName.textContent = userId.substring(0, 10) + '...';
                } else {
                    els.userName.textContent = 'جاري التحميل...';
                }

                // 🚀 PROACTIVE FETCH: If name is missing, ask background to fetch it now
                chrome.runtime.sendMessage({ type: 'FETCH_PROFILE' }, (response) => {
                    if (response && response.success && response.profile) {
                        const p = response.profile;
                        els.userName.textContent = p.name;
                        els.userPoints.textContent = parseFloat(p.points).toFixed(2);
                        els.userGems.textContent = parseFloat(p.gems).toFixed(2);
                        document.getElementById('userLevel').textContent = `المستوى ${p.level}`;
                    } else {
                        // Fallback if fetch failed
                        els.userName.textContent = userId ? userId.substring(0, 10) + '...' : 'زائر';
                    }
                });
            }

            // Stats Formatting
            if (stored.viewloop_user_points !== undefined) {
                els.userPoints.textContent = parseFloat(stored.viewloop_user_points).toFixed(2);
            }
            if (stored.viewloop_user_gems !== undefined) {
                els.userGems.textContent = parseFloat(stored.viewloop_user_gems).toFixed(2);
            }

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
    if (els.startWatchBtn) {
        els.startWatchBtn.addEventListener('click', () => {
            window.open('https://viewloop.vercel.app/api/direct-watch', '_blank');
        });
    }

    if (els.openDashboardBtn) {
        els.openDashboardBtn.addEventListener('click', () => {
            window.open('https://viewloop.vercel.app/dashboard', '_blank');
        });
    }

    const openDashboardLink = document.getElementById('openDashboardLink');
    if (openDashboardLink) {
        openDashboardLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.open('https://viewloop.vercel.app/dashboard', '_blank');
        });
    }

    // AUTH LOGIC
    const API_KEY = "AIzaSyBDRLk64HrmlsRKn0BqC3kdmvapOoA_u6g";
    const API_BASE_URL = "https://viewloop.vercel.app";

    let currentTab = 'login';
    let selectedGender = 'male';

    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const authName = document.getElementById('authName');
    const genderContainer = document.getElementById('genderContainer');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authSubmitText = authSubmitBtn?.querySelector('span');
    const authLoader = document.getElementById('authLoader');

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener('click', () => {
            currentTab = 'login';
            tabLogin.classList.add('active');
            tabRegister.classList.remove('active');
            authName.style.display = 'none';
            genderContainer.style.display = 'none';
            if (authSubmitText) authSubmitText.textContent = 'دخول';
        });

        tabRegister.addEventListener('click', () => {
            currentTab = 'register';
            tabRegister.classList.add('active');
            tabLogin.classList.remove('active');
            authName.style.display = 'block';
            genderContainer.style.display = 'grid';
            if (authSubmitText) authSubmitText.textContent = 'إنشاء حساب';
        });
    }

    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGender = btn.dataset.gender;
        });
    });

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value.trim();
            const name = authName.value.trim();

            if (!email || !password) return alert('الرجاء تعبئة جميع الحقول');
            if (currentTab === 'register' && !name) return alert('الرجاء إدخال اسمك الكامل');

            authLoader.style.display = 'block';
            if (authSubmitText) authSubmitText.style.opacity = '0.5';
            authSubmitBtn.disabled = true;

            try {
                const url = currentTab === 'login'
                    ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`
                    : `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

                const res = await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify({ email, password, returnSecureToken: true }),
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await res.json();

                if (data.error) throw new Error(data.error.message);

                const token = data.idToken;
                const userId = data.localId;

                if (currentTab === 'register') {
                    await fetch(`${API_BASE_URL}/api/init-profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken: token, name, gender: selectedGender })
                    });
                }

                await chrome.storage.local.set({
                    'viewloop_auth_token': token,
                    'viewloop_user_id': userId,
                    'auth_synced_at': Date.now()
                });

                chrome.runtime.sendMessage({
                    type: 'AUTH_SYNC',
                    token: token,
                    userId: userId
                }, () => window.location.reload());

            } catch (err) {
                let msg = err.message;
                if (msg === 'EMAIL_EXISTS') msg = 'البريد الإلكتروني مسجل مسبقاً';
                else if (msg === 'INVALID_LOGIN_CREDENTIALS' || msg === 'EMAIL_NOT_FOUND' || msg === 'INVALID_PASSWORD') msg = 'خطأ في بيانات الدخول';
                else if (msg === 'WEAK_PASSWORD') msg = 'كلمة المرور ضعيفة جداً';
                alert(`خطأ: ${msg}`);
            } finally {
                authLoader.style.display = 'none';
                if (authSubmitText) authSubmitText.style.opacity = '1';
                authSubmitBtn.disabled = false;
            }
        });
    }

    // Refresh Sync logic
    const refreshSyncBtn = document.getElementById('refreshSyncBtn');
    if (refreshSyncBtn) {
        refreshSyncBtn.addEventListener('click', async () => {
            await chrome.storage.local.remove(['viewloop_auth_token', 'viewloop_user_id', 'auth_synced_at']);
            els.statusText.textContent = 'تم مسح البيانات...';
            setTimeout(() => window.location.reload(), 500);
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
                    'viewloop_user_id': 'manual_user',
                    'auth_synced_at': Date.now()
                });
                chrome.runtime.sendMessage({
                    type: 'AUTH_SYNC',
                    token: token,
                    userId: 'manual_user'
                }, () => window.location.reload());
            } else {
                alert('الرمز غير صحيح');
            }
        });
    }

    // === Monitoring UI Logic ===
    const monitorEls = {
        section: document.getElementById('progressSection'),
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

    function updateMonitoring() {
        chrome.runtime.sendMessage({ type: 'GET_SESSIONS' }, (response) => {
            if (chrome.runtime.lastError) return; // Ignore if background not ready

            if (response && response.success && response.sessions && response.sessions.length > 0) {
                // Use the most recent session
                const session = response.sessions[response.sessions.length - 1];
                const duration = session.duration || 0;

                // Update duration label
                if (monitorEls.durationLabel && duration > 0) {
                    monitorEls.durationLabel.textContent = formatTime(duration);
                }

                // Calculate estimated watch time (Heartbeats * 5s interval)
                const watchTime = (session.validHeartbeats || 0) * 5;

                monitorEls.section.style.display = 'block';

                // 1. Main Progress (0 -> 100%)
                let mainPercent = duration > 0 ? (watchTime / duration) * 100 : 0;
                if (mainPercent > 100) mainPercent = 100;

                monitorEls.barMain.style.width = `${mainPercent}%`;
                monitorEls.textMain.textContent = `${Math.min(Math.floor(mainPercent), 100)}%`;

                // 2. Extra Progress (Starts after duration)
                if (duration > 0 && watchTime > duration) {
                    const extraTime = watchTime - duration;
                    // We assume the second bar fills up over the SAME duration as the first (1x speed)
                    let extraPercent = (extraTime / duration) * 100;

                    if (extraPercent > 100) extraPercent = 100;

                    monitorEls.barExtra.style.width = `${extraPercent}%`;
                    monitorEls.textExtra.textContent = `+${formatTime(extraTime)}`;

                    // Add pulse animation to extra bar when active
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

    // Poll every second
    setInterval(updateMonitoring, 1000);
    updateMonitoring();
});
