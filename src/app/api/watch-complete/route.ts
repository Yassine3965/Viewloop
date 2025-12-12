// /app/api/watch-complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
  } catch (error: any) {
    console.error("API Error: Firebase Admin initialization failed.", { message: error.message, timestamp: new Date().toISOString() });
    const response = NextResponse.json({
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionToken } = body;

    if (!sessionToken) {
      const response = NextResponse.json({ error: "MISSING_SESSION_TOKEN" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // تحديث النقاط في Firebase (للتوافق مع النظام الحالي)
    // في الإنتاج، يمكن إزالة هذا الجزء إذا انتقلنا بالكامل للخادم الجديد

    // البحث عن الجلسة في Firebase للحصول على userId وبيانات المشاهدة
    const sessionsRef = firestore.collection("sessions");
    const sessionQuery = await sessionsRef.where('sessionToken', '==', sessionToken).limit(1).get();

    let pointsAdded = 0;
    let totalWatchedSeconds = 0;

    if (!sessionQuery.empty) {
      const sessionDoc = sessionQuery.docs[0];
      const sessionData = sessionDoc.data();

      if (sessionData) {
        totalWatchedSeconds = sessionData.totalWatchedSeconds || 0;

        // حساب النقاط محلياً (مؤقتاً - سيتم ربطها بالخادم الجديد لاحقاً)
        // حساب النقاط بنفس المعادلة: 0.05 نقطة لكل ثانية بعد أول 5 ثواني
        const effectiveSeconds = Math.max(0, totalWatchedSeconds - 5);
        pointsAdded = Math.floor(effectiveSeconds * 0.05);

        // الحد الأقصى 50 نقطة للفيديو الواحد
        pointsAdded = Math.min(pointsAdded, 50);

        console.log(`Calculated points: ${pointsAdded} for ${totalWatchedSeconds}s watched`);

        if (sessionData.userId) {
          // تحديث النقاط في Firebase
          const userRef = firestore.collection("users").doc(sessionData.userId);
          const userSnap = await userRef.get();

          if (userSnap.exists) {
            const currentPoints = userSnap.data()?.points || 0;
            const newTotalPoints = currentPoints + pointsAdded;

            await userRef.update({
              points: newTotalPoints,
              lastUpdated: Date.now()
            });

            // تحديث الجلسة
            await sessionDoc.ref.update({
              status: "completed",
              points: pointsAdded,
              completedAt: Date.now()
            });

            // إضافة إلى تاريخ المشاهدة
            await firestore.collection("watchHistory").add({
              userId: sessionData.userId,
              videoId: sessionData.videoID,
              totalWatchedSeconds: sessionData.totalWatchedSeconds || 0,
              adWatched: false,
              pointsEarned: pointsAdded,
              completedAt: Date.now(),
              sessionToken
            });
          }
        }
      }
    }

    return addCorsHeaders(NextResponse.json({
      success: true,
      pointsAdded: pointsAdded
    }), req);

  } catch (err: any) {
    console.error("API Error: /api/watch-complete failed.", { error: err.message, body, timestamp: new Date().toISOString() });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
