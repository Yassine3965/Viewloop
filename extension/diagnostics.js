// ==========================
// DIAGNOSTIC & DEBUG TOOLS
// ==========================

// التحقق من البيئة - يعمل فقط داخل الإضافة
const isExtensionEnv =
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  chrome.runtime.id;

// مستوى التشخيص - يتحكم في كمية المعلومات المسجلة
const DIAGNOSTIC_LEVEL = 'FULL'; // 'BASIC' | 'FULL'

// Safe Wrapper لتجنب الأخطاء
function safe(fn, label = 'عملية') {
  try {
    return fn();
  } catch (e) {
    console.error(`❌ ${label}:`, e.message);
    return null;
  }
}

// Safe Logger حسب المستوى
function safeLog(level, ...args) {
  if (DIAGNOSTIC_LEVEL === 'FULL' || level === 'error') {
    console.log(...args);
  }
}
class ViewLoopDiagnostics {
    static checkServiceWorkerStatus() {
        console.group("🔍 تشخيص حالة Service Worker");
        safeLog('info', "📍 API_BASE_URL:", globalThis.ViewLoopConfig?.API_BASE_URL);
        safeLog('info', "📍 الجلسات النشطة:", safe(() => globalThis.SecureSessionManager?.activeSessions?.size, "Session Manager") ?? 'N/A');
        safeLog('info', "📍 تبويبات متصلة:", safe(() => globalThis.SecureSessionManager?.tabSessions?.size, "Tab Sessions") ?? 'N/A');
        safeLog('info', "📍 pendingHeartbeats:", safe(() => globalThis.SecureHeartbeatSystem?.pendingHeartbeats?.size, "Pending Heartbeats") ?? 'N/A');

        // التحقق من وجود API_BASE_URL قبل fetch
        if (!globalThis.ViewLoopConfig?.API_BASE_URL) {
            console.error("❌ API_BASE_URL غير معرف - لا يمكن اختبار الاتصال بالخادم");
            console.groupEnd();
            return;
        }

        // اختبار الاتصال بالخادم
        fetch(`${globalThis.ViewLoopConfig.API_BASE_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(r => {
            console.log("🌐 حالة الخادم:", r.status, r.statusText);
            return r.text().catch(() => '');
        })
        .then(text => {
            console.log("🌐 استجابة الخادم:", text.substring(0, 100));
        })
        .catch(error => {
            console.error("🌐 خطأ الاتصال بالخادم:", error.message);
        });

        console.groupEnd();
    }

    static getSessions() {
        if (globalThis.SecureSessionManager?.activeSessions) {
            return Array.from(globalThis.SecureSessionManager.activeSessions.entries());
        }
        console.warn("⚠️ SecureSessionManager.activeSessions غير متوفر");
        return [];
    }

    static getTabSessions() {
        if (globalThis.SecureSessionManager?.tabSessions) {
            return Array.from(globalThis.SecureSessionManager.tabSessions.entries());
        }
        console.warn("⚠️ SecureSessionManager.tabSessions غير متوفر");
        return [];
    }

    static async testDirectFetch() {
        console.log("🌐 اختبار fetch مباشر...");

        // التحقق من وجود API_BASE_URL قبل fetch
        if (!globalThis.ViewLoopConfig?.API_BASE_URL) {
            console.error("❌ API_BASE_URL غير معرف - لا يمكن اختبار fetch مباشر");
            return { error: 'API_BASE_URL not defined' };
        }

        return fetch(`${globalThis.ViewLoopConfig.API_BASE_URL}/api/heartbeat-data`, { method: "GET" })
            .then(r => {
                console.log("📡 استجابة GET:", r.status, r.statusText);
                return r.json().catch(() => ({ error: "غير JSON" }));
            })
            .then(data => {
                console.log("📦 بيانات الاستجابة:", data);
                return data;
            })
            .catch(error => {
                console.error("❌ خطأ في fetch:", error.message);
                return { error: error.message };
            });
    }

    static async testAPI() {
        if (!globalThis.ViewLoopConfig?.API_BASE_URL) {
            console.error("❌ API_BASE_URL غير معرف - لا يمكن اختبار API");
            return { error: 'API_BASE_URL not defined' };
        }

        return fetch(`${globalThis.ViewLoopConfig.API_BASE_URL}/api/heartbeat-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true, timestamp: Date.now() })
        }).then(r => r.json()).catch(e => ({ error: e.message }));
    }

    static async sendTestHeartbeat(videoTime = 60) {
        console.log("🧪 إرسال نبضة اختبارية عبر النظام الحقيقي...");

        const testData = {
            type: 'HEARTBEAT',
            sessionId: 'manual-test-' + Date.now(),
            videoId: 'dQw4w9WgXcQ',
            timestamp: Date.now(),
            videoTime: videoTime,
            isPlaying: true,
            tabActive: true,
            windowFocused: true,
            mouseActive: true,
            lastMouseMove: Date.now(),
            sessionDuration: videoTime,
            totalHeartbeats: 1
        };

        // استخدام النظام الحقيقي بدلاً من الاختصار
        if (globalThis.SecureAPIClient?.sendHeartbeat) {
            try {
                const result = await globalThis.SecureAPIClient.sendHeartbeat(testData.sessionId, testData);
                console.log("✅ نتيجة النبضة الاختبارية:", result);
                if (result.success) {
                    console.log("🎉 النبضة أرسلت بنجاح عبر النظام الحقيقي!");
                } else {
                    console.log("❌ فشل في إرسال النبضة:", result.error);
                }
                return result;
            } catch (error) {
                console.error("💥 خطأ في إرسال النبضة الاختبارية:", error);
                return { success: false, error: error.message };
            }
        } else {
            console.warn("⚠️ SecureAPIClient.sendHeartbeat غير متوفر - لا يمكن إرسال نبضة اختبارية عبر النظام الحقيقي");
            return { success: false, error: 'SecureAPIClient not available' };
        }
    }

    static async getEmergencyStats() {
        if (globalThis.EmergencyHeartbeatStorage?.getStats) {
            return await globalThis.EmergencyHeartbeatStorage.getStats();
        } else {
            console.warn("⚠️ EmergencyHeartbeatStorage.getStats غير متوفر");
            return { success: false, error: 'EmergencyHeartbeatStorage not available' };
        }
    }

    // ⚠️ READ-WRITE: تغيّر حالة النظام - إعادة إرسال النبضات الطارئة
    static async forceRetryEmergency() {
        console.log("🔄 [DIAGNOSTIC] إعادة محاولة إرسال النبضات الطارئة...");
        if (globalThis.EmergencyHeartbeatStorage?.retryStoredHeartbeats) {
            await globalThis.EmergencyHeartbeatStorage.retryStoredHeartbeats();
            return await this.getEmergencyStats();
        } else {
            console.warn("⚠️ EmergencyHeartbeatStorage.retryStoredHeartbeats غير متوفر");
            return { success: false, error: 'EmergencyHeartbeatStorage not available' };
        }
    }

    static showAllSessions() {
        console.group("📊 جميع الجلسات النشطة");
        if (globalThis.SecureSessionManager?.activeSessions) {
            const sessions = Array.from(globalThis.SecureSessionManager.activeSessions.entries());
            if (sessions.length === 0) {
                console.log("❌ لا توجد جلسات نشطة");
            } else {
                sessions.forEach(([sessionId, session]) => {
                    console.log(`🎬 الجلسة ${sessionId}:`, {
                        videoId: session.videoId,
                        tabId: session.tabId,
                        startTime: new Date(session.startTime).toLocaleString(),
                        lastHeartbeat: new Date(session.lastHeartbeat).toLocaleString(),
                        validHeartbeats: session.validHeartbeats,
                        invalidHeartbeats: session.invalidHeartbeats,
                        status: session.status
                    });
                });
            }
        } else {
            console.warn("⚠️ SecureSessionManager.activeSessions غير متوفر");
        }
        console.groupEnd();
    }

    static showPendingHeartbeats() {
        console.group("💓 النبضات المعلقة");
        if (globalThis.SecureHeartbeatSystem?.pendingHeartbeats) {
            const pending = Array.from(globalThis.SecureHeartbeatSystem.pendingHeartbeats.entries());
            if (pending.length === 0) {
                console.log("❌ لا توجد نبضات معلقة");
            } else {
                pending.forEach(([sessionId, heartbeats]) => {
                    console.log(`📦 الجلسة ${sessionId}: ${heartbeats.length} نبضة معلقة`);
                    heartbeats.slice(-3).forEach((hb, i) => {
                        console.log(`   ${i + 1}. وقت الفيديو: ${hb.videoTime}s، النشاط: ${hb.isPlaying ? 'نعم' : 'لا'}`);
                    });
                });
            }
        } else {
            console.warn("⚠️ SecureHeartbeatSystem.pendingHeartbeats غير متوفر");
        }
        console.groupEnd();
    }

    static showRecentHeartbeats(sessionId = null, limit = 5) {
        console.group(`🕐 النبضات الأخيرة ${sessionId ? `للجلسة ${sessionId}` : 'لجميع الجلسات'}`);

        let sessions = [];
        if (globalThis.SecureSessionManager?.activeSessions) {
            sessions = sessionId
                ? [[sessionId, globalThis.SecureSessionManager.getSession?.(sessionId)]]
                : Array.from(globalThis.SecureSessionManager.activeSessions.entries());
        } else {
            console.warn("⚠️ SecureSessionManager غير متوفر");
            console.groupEnd();
            return;
        }

        sessions.forEach(([sid, session]) => {
            if (!session || !session.heartbeats || session.heartbeats.length === 0) {
                console.log(`❌ الجلسة ${sid}: لا توجد نبضات`);
                return;
            }

            console.log(`📊 الجلسة ${sid}: ${session.heartbeats.length} نبضة إجمالية`);
            const recent = session.heartbeats.slice(-limit);
            recent.forEach((hb, i) => {
                const time = new Date(hb.receivedAt || hb.timestamp).toLocaleTimeString();
                console.log(`   ${recent.length - limit + i + 1}. ${time} - ${hb.videoTime}s - ${hb.isPlaying ? '▶️' : '⏸️'} - ${hb.tabActive ? 'نشط' : 'غير نشط'}`);
            });
        });

        console.groupEnd();
    }

    static showHeartbeatLogs(limit = 10) {
        console.group(`📋 سجل النبضات الأخير (${limit} إدخال)`);

        // محاولة الحصول على السجلات من localStorage إذا كانت متوفرة
        try {
            // هذا سيعمل في سياق المتصفح
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['heartbeat_logs'], (result) => {
                    const logs = result.heartbeat_logs || [];
                    if (logs.length === 0) {
                        console.log("❌ لا توجد سجلات نبضات محفوظة");
                    } else {
                        logs.slice(-limit).forEach((log, i) => {
                            console.log(`${logs.length - limit + i + 1}. ${log.timestamp} - ${log.message}`);
                        });
                    }
                });
            }
        } catch (error) {
            console.log("⚠️ لا يمكن الوصول لسجلات التخزين:", error.message);
        }

        console.groupEnd();
    }

    static testHeartbeatSending() {
        console.group("🧪 اختبار إرسال النبضات");

        // إنشاء نبضة اختبار
        const testHeartbeat = {
            sessionId: 'test-' + Date.now(),
            videoId: 'test123',
            timestamp: Date.now(),
            videoTime: 30,
            isPlaying: true,
            tabActive: true,
            windowFocused: true,
            mouseActive: true,
            lastMouseMove: Date.now(),
            sessionDuration: 30,
            totalHeartbeats: 1
        };

        console.log("📤 إرسال نبضة اختبار...", testHeartbeat);

        // محاولة إرسال النبضة
        if (globalThis.SecureAPIClient?.sendHeartbeat) {
            globalThis.SecureAPIClient.sendHeartbeat(testHeartbeat.sessionId, testHeartbeat)
                .then(result => {
                    console.log("✅ نتيجة إرسال النبضة:", result);
                    if (result.success) {
                        console.log("🎉 النبضة أرسلت بنجاح!");
                    } else {
                        console.log("❌ فشل في إرسال النبضة:", result.error);
                    }
                })
                .catch(error => {
                    console.error("💥 خطأ في إرسال النبضة:", error);
                });
        } else {
            console.warn("⚠️ SecureAPIClient.sendHeartbeat غير متوفر");
        }

        console.groupEnd();
    }

    static checkAPISendStatus() {
        console.group("🌐 حالة إرسال API");

        const pendingCount = globalThis.SecureHeartbeatSystem?.pendingHeartbeats?.size ?? 'N/A';
        console.log(`📦 النبضات المعلقة: ${pendingCount}`);

        // التحقق من وجود API_BASE_URL قبل fetch
        if (!globalThis.ViewLoopConfig?.API_BASE_URL) {
            console.error("❌ API_BASE_URL غير معرف - لا يمكن اختبار الاتصال بالخادم");
            console.groupEnd();
            return;
        }

        // اختبار اتصال API
        fetch(`${globalThis.ViewLoopConfig.API_BASE_URL}/health`)
            .then(response => {
                console.log(`🌐 حالة الخادم: ${response.status} ${response.statusText}`);
                return response.json().catch(() => ({ status: 'unknown' }));
            })
            .then(data => {
                console.log("🌐 استجابة الخادم:", data);
            })
            .catch(error => {
                console.error("🌐 خطأ في الاتصال بالخادم:", error.message);
            });

        console.groupEnd();
    }
}

// وظائف تشخيص متقدمة
function runEnhancedDiagnostics() {
    if (!isExtensionEnv) {
        console.warn("⚠️ EnhancedDiagnostics يعمل فقط داخل الإضافة");
        return;
    }

    console.group(" تشخيص متقدم للإضافة");

    // أ. تحقق من الأذونات
    chrome.permissions.getAll(permissions => {
        console.log("🔑 الأذونات الممنوحة:", {
            permissions: permissions.permissions,
            origins: permissions.origins
        });
    });

    // ب. تحقق من Content Scripts المسجلة
    chrome.scripting.getRegisteredContentScripts?.().then(scripts => {
        console.log(" Content Scripts المسجلة:", scripts?.length || 0);
        if (scripts?.length > 0) {
            scripts.forEach(s => console.log("   -", s.id, s.matches));
        } else {
            console.error("❌ لا توجد Content Scripts مسجلة!");
        }
    }).catch(err => {
        console.log("⚠️ scripting API غير متاح:", err.message);
    });

    // ج. تحقق من جميع التبويبات
    chrome.tabs.query({}, tabs => {
        const youtubeTabs = tabs.filter(t => t.url?.includes('youtube'));
        console.log("📊 حالة التبويبات:", {
            total: tabs.length,
            youtube: youtubeTabs.length,
            sample: youtubeTabs.slice(0, 2).map(t => ({ id: t.id, url: t.url?.substring(0, 60) }))
        });
    });

    console.groupEnd();
}

// ⚠️ READ-WRITE: تغيّر حالة النظام - حقن Content Scripts يدوياً
async function forceInjectContentScripts() {
    if (!isExtensionEnv) {
        console.warn("⚠️ forceInjectContentScripts يعمل فقط داخل الإضافة");
        return;
    }

    const tabs = await chrome.tabs.query({});
    const youtubeTabs = tabs.filter(t => t.url?.includes('youtube.com'));

    console.log(`🔄 [FORCE-INJECT] محاولة حقن ${youtubeTabs.length} تبويب YouTube`);

    for (const tab of youtubeTabs) {
        console.log(`🧩 محاولة حقن في تبويب ${tab.id}: ${tab.url?.substring(0, 60)}...`);

        try {
            // حاول التواصل أولاً
            await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
            console.log(`✅ تبويب ${tab.id}: content script نشط بالفعل`);
        } catch (error) {
            console.log(`🔄 تبويب ${tab.id}: محاولة حقن يدوي content_youtube.js`);

            // حقن يدوياً
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content_youtube.js']
                });
                console.log(`✅ تبويب ${tab.id}: content script محقون يدوياً بنجاح`);
            } catch (injectError) {
                console.error(`❌ تبويب ${tab.id}: فشل الحقن - ${injectError.message}`);
                console.error("💡 تحقق من manifest.json → web_accessible_resources أو content_scripts");
                console.error("💡 تأكد من أن content_youtube.js موجود في المجلد الصحيح");
            }
        }
    }
}

// وظيفة تشخيص يمكن استدعاؤها يدوياً
const EnhancedDiagnostics = {
    runEnhancedDiagnostics,
    forceInjectContentScripts,
    testTabCommunication: (tabId) => {
        if (!isExtensionEnv) {
            console.warn("⚠️ testTabCommunication يعمل فقط داخل الإضافة");
            return;
        }
        chrome.tabs.sendMessage(tabId, { type: 'PING' }, (response) => {
            console.log(`📡 اختبار التواصل مع tab ${tabId}:`, response || chrome.runtime.lastError);
        });
    },
    listAllTabs: () => {
        if (!isExtensionEnv) {
            console.warn("⚠️ listAllTabs يعمل فقط داخل الإضافة");
            return;
        }
        chrome.tabs.query({}, tabs => {
            console.log("📋 جميع التبويبات:");
            tabs.forEach(t => {
                console.log(`   ${t.id}: ${t.url || 'no-url'} ${t.active ? '(نشط)' : ''}`);
            });
        });
    }
};

// تصدير للاستخدام في الوحدات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ViewLoopDiagnostics, EnhancedDiagnostics };
} else {
    globalThis.ViewLoopDiagnostics = ViewLoopDiagnostics;
    globalThis.EnhancedDiagnostics = EnhancedDiagnostics;
}
