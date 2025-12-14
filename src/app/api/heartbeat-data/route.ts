// /app/api/heartbeat-data/route.ts - النسخة المبسطة والمصححة
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getFirestore } from "@/lib/firebase/admin";
import { FieldValue } from 'firebase-admin/firestore';
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import { createHmac } from 'crypto';

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

    const expectedSignature = createHmac('sha256', EXTENSION_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature) {
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

    const verifiedUserId = userId || 'anonymous';

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
      sessionId || `session_${Date.now()}_${verifiedUserId}`
    );

    const sessionSnap = await sessionRef.get();
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

    // 7. التحقق من ملكية الجلسة
    if (sessionData.userId !== verifiedUserId) {
      return addCorsHeaders(NextResponse.json({
        error: "SESSION_OWNERSHIP_MISMATCH",
        message: "Session ownership mismatch"
      }, { status: 403 }), req);
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

// 🕵️ كشف تلاعب جديد حسب قواعدك
function detectFraudNew({ sessionData, currentHeartbeat, now }: any) {
  const signals = [];
  const heartbeats = sessionData.heartbeats || [];

  // 1. ⭐ قاعدة: إذا pause أكثر من 10 مرات
  const recentPauses = heartbeats.filter((h: any) => !h.isPlaying).length;
  if (recentPauses > 10) {
    signals.push({
      type: 'TOO_MANY_PAUSES',
      severity: 'medium',
      description: 'Too many pauses detected (your rule)',
      timestamp: now
    });
  }

  // 2. ⭐ قاعدة: تبويب غير نشط أثناء التشغيل
  if (!currentHeartbeat.tabActive && currentHeartbeat.isPlaying) {
    signals.push({
      type: 'INACTIVE_TAB',
      severity: 'high',
      description: 'Tab inactive while video playing (your rule)',
      timestamp: now
    });
  }

  // 3. ⭐ قاعدة: عدم نشاط الفأرة أثناء التشغيل
  if (!currentHeartbeat.mouseActive && currentHeartbeat.isPlaying) {
    signals.push({
      type: 'NO_MOUSE_ACTIVITY',
      severity: 'high',
      description: 'No mouse activity in last 30 seconds (your rule)',
      timestamp: now
    });
  }

  // 4. ⭐ قاعدة: نبضات غير صالحة كثيرة
  const invalidCount = heartbeats.filter((h: any) => !h.isValid).length;
  const validCount = heartbeats.filter((h: any) => h.isValid).length;

  if (invalidCount > validCount * 0.3 && validCount > 0) { // ⭐ إذا 30% من النبضات غير صالحة
    signals.push({
      type: 'TOO_MANY_INVALID',
      severity: 'medium',
      description: 'Too many invalid heartbeats',
      timestamp: now
    });
  }

  // 5. ⭐ قاعدة: تلاعب في الوقت
  if (heartbeats.length > 1) {
    const lastValid = heartbeats.filter((h: any) => h.isValid).pop();
    if (lastValid) {
      const expectedTime = lastValid.videoTime + (HEARTBEAT_INTERVAL_SEC * 2); // ⭐ توقع زيادة 10 ثواني كحد أقصى
      if (currentHeartbeat.videoTime > expectedTime + 10) {
        signals.push({
          type: 'TIME_MANIPULATION',
          severity: 'high',
          description: 'Time jump detected (possible seeking)',
          timestamp: now
        });
      }
    }
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


