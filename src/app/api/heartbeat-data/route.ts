// /app/api/heartbeat-data/route.ts - النسخة المبسطة والمصححة
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase/admin";
import { FieldValue } from 'firebase-admin/firestore';
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import { createHmac, createHash } from 'crypto';

const HEARTBEAT_INTERVAL_SEC = 5;
const EXTENSION_SECRET = "6B65FDC657B5D8CF4D5AB28C92CF2";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verify signature
    const signature = req.headers.get('x-signature');
    if (!signature) {
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 }), req);
    }

    // استخدام خوارزمية التوقيع المقننة لضمان ترتيب المفاتيح المتسق
    const sortedKeys = Object.keys(body).sort();
    const sortedBody: Record<string, any> = {};
    sortedKeys.forEach(key => {
      sortedBody[key] = body[key];
    });
    const dataString = JSON.stringify(sortedBody);
    const combined = dataString + EXTENSION_SECRET;
    const expectedSignature = createHash('sha256')
      .update(combined)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.log('Signature mismatch:', { received: signature, expected: expectedSignature });
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 }), req);
    }

    const {
      sessionId,
      videoId,
      timestamp,
      videoTime,
      isPlaying,
      tabActive,
      windowFocused,
      mouseActive,
      lastMouseMove,
      sessionDuration,
      totalHeartbeats,
      userId
    } = body;

    // 3. التحقق من videoId
    if (!videoId || videoId.length !== 11) {
      return addCorsHeaders(NextResponse.json({
        error: "INVALID_VIDEO_ID",
        message: "Invalid YouTube video ID"
      }, { status: 400 }), req);
    }

    // 4. الحصول على Firestore
    const firestore = getFirestore();

    // 5. إنشاء أو تحديث الجلسة
    const sessionRef = firestore.collection("sessions").doc(
      sessionId || `session_${Date.now()}_${userId || 'anonymous'}`
    );

    const sessionSnap = await sessionRef.get();

    // Determine verifiedUserId: use stored userId for existing sessions, or provided userId for new ones
    let verifiedUserId;
    if (sessionSnap.exists) {
      const existingData = sessionSnap.data();
      verifiedUserId = existingData?.userId || userId || 'anonymous';
    } else {
      verifiedUserId = userId || 'anonymous';
    }
    const now = Date.now();

    let sessionData: any = sessionSnap.exists ? sessionSnap.data() : {
      userId: verifiedUserId,
      videoId,
      startTime: timestamp || now,
      status: "active",
      heartbeats: [],
      validHeartbeats: 0,
      fraudSignals: [],
      totalPoints: 0,
      videoPoints: 0,
      adPoints: 0,
      validSeconds: 0,
      adSeconds: 0,
      lastActivity: now,
      createdAt: FieldValue.serverTimestamp()
    };

    if (!sessionSnap.exists) {
      await sessionRef.set(sessionData);
    }

    // 6. التحقق من صحة الجلسة
    if (sessionData.status === "fraud_detected" || sessionData.status === "completed") {
      return addCorsHeaders(NextResponse.json({
        error: "SESSION_INVALID",
        message: "Session is no longer active"
      }, { status: 400 }), req);
    }

    // 7. التحقق من ملكية الجلسة (تخفيف التحقق - sessionId كافي للأمان)
    // فقط تحقق إذا تم إرسال userId في الطلب
    if (userId && sessionData.userId !== verifiedUserId) {
      return addCorsHeaders(NextResponse.json({
        error: "SESSION_OWNERSHIP_MISMATCH",
        message: "Session ownership mismatch"
      }, { status: 403 }), req);
    }

    // 7.5. التحقق من أن هذا هو الفيديو الأساسي في الجلسة (منع تعدد الفيديوهات)
    if (sessionData.videoId !== videoId) {
      return addCorsHeaders(NextResponse.json({
        success: true,
        sessionId: sessionRef.id,
        userId: verifiedUserId,
        heartbeatReceived: true,
        isValid: false,
        reason: "NOT_PRIMARY_VIDEO",
        primaryVideoId: sessionData.videoId,
        points: {
          videoPoints: 0,
          adPoints: 0,
          totalPoints: 0,
          validSeconds: 0,
          adSeconds: 0
        },
        fraudSignals: 0,
        sessionStatus: sessionData.status || 'active',
        nextHeartbeatIn: 5000
      }), req);
    }

    // 8. كشف التلاعب
    const fraudSignals = detectFraudNew({
      sessionData,
      currentHeartbeat: {
        timestamp: timestamp || now,
        videoTime: videoTime || 0,
        isPlaying: isPlaying || false,
        tabActive: tabActive || false,
        windowFocused: windowFocused || false,
        mouseActive: mouseActive || false,
        lastMouseMove: lastMouseMove || now
      },
      now
    });

    // 9. التحقق من صحة النبضة
    const isValidHeartbeat = (
      isPlaying &&
      tabActive &&
      windowFocused &&
      mouseActive &&
      (now - (lastMouseMove || now)) < 30000
    );

    // 10. تحديث الجلسة
    const updates: any = {
      lastHeartbeatAt: now,
      lastActivity: now
    };

    // إضافة النبضة
    const newHeartbeat = {
      timestamp: timestamp || now,
      videoTime: videoTime || 0,
      isPlaying: isPlaying || false,
      tabActive: tabActive || false,
      windowFocused: windowFocused || false,
      mouseActive: mouseActive || false,
      lastMouseMove: lastMouseMove || now,
      sessionDuration: sessionDuration || 0,
      totalHeartbeats: totalHeartbeats || 0,
      isValid: isValidHeartbeat,
      receivedAt: now
    };

    updates.heartbeats = FieldValue.arrayUnion(newHeartbeat);

    if (isValidHeartbeat) {
      updates.validHeartbeats = FieldValue.increment(1);
      updates.validSeconds = FieldValue.increment(HEARTBEAT_INTERVAL_SEC);
    }

    // كشف الإعلانات
    if (sessionData.heartbeats?.length > 0 && isValidHeartbeat) {
      const lastValidHb = sessionData.heartbeats
        .filter((h: any) => h.isValid)
        .pop();

      if (lastValidHb) {
        const timeGap = (timestamp || now) - lastValidHb.timestamp;

        if (timeGap > 15000 && timeGap <= 90000) {
          const adSeconds = Math.floor(timeGap / 1000);
          const extraAdSeconds = Math.max(0, adSeconds - 5);

          if (extraAdSeconds > 0) {
            updates.adSeconds = FieldValue.increment(extraAdSeconds);
            const adPoints = Math.floor(extraAdSeconds / 15) * 15;
            updates.adPoints = FieldValue.increment(adPoints);
          }
        }
      }
    }

    // إضافة إشارات التلاعب
    if (fraudSignals.length > 0) {
      updates.fraudSignals = FieldValue.arrayUnion(...fraudSignals);

      const highRiskFraud = fraudSignals.some((signal: any) =>
        ['INACTIVE_TAB', 'TIME_MANIPULATION', 'TOO_MANY_INVALID'].includes(signal.type)
      );

      if (highRiskFraud) {
        updates.status = 'fraud_detected';
        updates.fraudDetectedAt = now;
      }
    }

    await sessionRef.update(updates);

    // حساب النقاط (للعرض فقط، لا تحديث المستخدم هنا)
    const updatedSession = await sessionRef.get();
    const updatedData = updatedSession.data();
    const points = calculatePointsNew(updatedData);

    // 13. إرجاع الرد
    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionId: sessionRef.id,
      userId: verifiedUserId,
      heartbeatReceived: true,
      isValid: isValidHeartbeat,
      points: {
        videoPoints: points.videoPoints,
        adPoints: points.adPoints,
        totalPoints: points.totalPoints,
        validSeconds: points.validSeconds,
        adSeconds: points.adSeconds
      },
      fraudSignals: fraudSignals.length,
      sessionStatus: updatedData?.status || 'active',
      nextHeartbeatIn: 5000
    }), req);

  } catch (error: any) {
    console.error('Heartbeat processing error:', error);

    return addCorsHeaders(NextResponse.json({
      error: "SERVER_ERROR",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 }), req);
  }
}

// 🕵️ كشف تلاعب شامل - الخادم هو العقل
function detectFraudNew({ sessionData, currentHeartbeat, now }: any) {
  const signals = [];
  const heartbeats = sessionData.heartbeats || [];
  const security = {
    MAX_HEARTBEAT_RATE_MS: 3000,
    TAB_INACTIVE_TIMEOUT_MS: 30000,
    MAX_TIME_DIFF_PER_HEARTBEAT: 7,
    MIN_TIME_DIFF_PER_HEARTBEAT: 3,
    MAX_AD_GAP_MS: 60000
  };

  // 1. التحقق من النشاط الأساسي
  if (!currentHeartbeat.tabActive && currentHeartbeat.isPlaying) {
    signals.push({
      type: 'INACTIVE_TAB',
      severity: 'high',
      description: 'Tab inactive while video playing',
      timestamp: now
    });
  }

  if (!currentHeartbeat.mouseActive && currentHeartbeat.isPlaying) {
    signals.push({
      type: 'MOUSE_INACTIVE_WHILE_PLAYING',
      severity: 'high',
      description: 'Mouse inactive while video playing',
      timestamp: now
    });
  }

  // 2. التحقق من الوقت
  if (currentHeartbeat.videoTime < 0 || currentHeartbeat.videoTime > 36000) {
    signals.push({
      type: 'INVALID_VIDEO_TIME',
      severity: 'high',
      description: 'Invalid video time bounds',
      timestamp: now
    });
  }

  // 3. كشف التلاعب في الوقت
  if (heartbeats.length > 0) {
    const lastHeartbeat = heartbeats[heartbeats.length - 1];
    const timeDiff = currentHeartbeat.videoTime - lastHeartbeat.videoTime;

    if (currentHeartbeat.isPlaying && lastHeartbeat.isPlaying) {
      // الوقت الطبيعي: 3-7 ثواني (نبضة كل 5 ثواني ±2)
      if (timeDiff < security.MIN_TIME_DIFF_PER_HEARTBEAT || timeDiff > security.MAX_TIME_DIFF_PER_HEARTBEAT) {
        signals.push({
          type: 'TIME_MANIPULATION',
          severity: 'high',
          description: 'Time jump detected (possible seeking)',
          timestamp: now,
          details: { timeDiff, expectedMin: security.MIN_TIME_DIFF_PER_HEARTBEAT, expectedMax: security.MAX_TIME_DIFF_PER_HEARTBEAT }
        });
      }
    }
  }

  // 4. Rate limiting
  if (heartbeats.length > 0) {
    const lastHeartbeat = heartbeats[heartbeats.length - 1];
    if ((now - lastHeartbeat.receivedAt) < security.MAX_HEARTBEAT_RATE_MS) {
      signals.push({
        type: 'RATE_LIMIT_EXCEEDED',
        severity: 'medium',
        description: 'Heartbeat rate limit exceeded',
        timestamp: now,
        details: { timeSinceLast: now - lastHeartbeat.receivedAt, limit: security.MAX_HEARTBEAT_RATE_MS }
      });
    }
  }

  // 5. التحقق من فجوات كبيرة
  if (heartbeats.length > 1) {
    const recentHeartbeats = heartbeats.slice(-3);
    const gaps = recentHeartbeats.map((hb: any, i: number) => {
      if (i === 0) return 0;
      return hb.receivedAt - recentHeartbeats[i-1].receivedAt;
    });

    const maxGap = Math.max(...gaps);
    if (maxGap > security.MAX_AD_GAP_MS) {
      signals.push({
        type: 'SUSPICIOUS_ACTIVITY_GAP',
        severity: 'medium',
        description: 'Suspicious time gap detected',
        timestamp: now,
        details: { maxGap, limit: security.MAX_AD_GAP_MS }
      });
    }
  }

  // 6. قاعدة إضافية: نبضات غير صالحة كثيرة
  const invalidCount = heartbeats.filter((h: any) => !h.isValid).length;
  const validCount = heartbeats.filter((h: any) => h.isValid).length;

  if (invalidCount > validCount * 0.3 && validCount > 0) {
    signals.push({
      type: 'TOO_MANY_INVALID',
      severity: 'medium',
      description: 'Too many invalid heartbeats',
      timestamp: now,
      details: { invalidCount, validCount, ratio: invalidCount / validCount }
    });
  }

  return signals;
}

// 🧮 حساب نقاط جديد حسب قواعدك
function calculatePointsNew(sessionData: any) {
  if (!sessionData) return { videoPoints: 0, adPoints: 0, totalPoints: 0, validSeconds: 0, adSeconds: 0 };

  const validSeconds = sessionData.validSeconds || 0;
  const adSeconds = sessionData.adSeconds || 0;

  // ⭐⭐ قاعدة الفيديو: 0.05 نقطة لكل ثانية بعد أول 5 ثواني
  const videoWatchSeconds = Math.max(0, validSeconds - 5);
  const videoPoints = videoWatchSeconds * 0.05;

  // ⭐⭐ قاعدة الإعلان: محسوبة مسبقاً في adPoints
  const adPoints = sessionData.adPoints || 0;

  return {
    videoPoints: Math.round(videoPoints * 100) / 100, // ⭐ تقريب لمكانين عشريين
    adPoints: Math.round(adPoints * 100) / 100,
    totalPoints: Math.round((videoPoints + adPoints) * 100) / 100,
    validSeconds: validSeconds,
    adSeconds: adSeconds
  };
}
