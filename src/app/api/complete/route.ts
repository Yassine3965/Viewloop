// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase-admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleOptions();
}

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    return addCorsHeaders(NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 400 }));
  }

  try {
    const body = await req.json();

    if (body.secret !== process.env.EXTENSION_SECRET) {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }));
    }

    const { sessionToken, finalWatchedSeconds: finalDelta = 0, adWatched = false } = body;
    if (!sessionToken) return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 }));

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    if (!snap.exists) return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }));

    const session = snap.data();
    if (!session) return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }));

    // اجمع ساعات المشاهدة النهائية
    const totalWatched = (session.totalWatchedSeconds || 0) + Math.max(0, Math.min(finalDelta, 600)); // لا تزيد بـ 10 دقائق إضافية
    const now = Date.now();

    // قواعد نقاط بسيطة كمثال (يمكن تعديلها حسب رغبتك)
    let points = 0;
    if (totalWatched >= 30) points += 5;
    if (totalWatched >= 60) points += 10;
    if (totalWatched >= 120) points += 15;
    if (adWatched === true) points += 20;

    // تحديث watchHistory
    await firestore.collection("watchHistory").add({
      userId: session.userId,
      videoId: session.videoID,
      totalWatchedSeconds: totalWatched,
      adWatched,
      pointsEarned: points,
      completedAt: now,
      sessionToken
    });

    // تحديث المستخدم وإضافة النقاط
    const userRef = firestore.collection("users").doc(session.userId);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      if(userData){
        await userRef.update({
            points: (userData.points || 0) + points,
            lastUpdated: now
        });
      }
    } else {
      // إذا لم يوجد المستخدم، أنشئ وثيقة بسيطة
      await userRef.set({
        points,
        createdAt: now,
        lastUpdated: now
      });
    }

    // إغلاق الجلسة
    await sessionRef.update({
      status: "completed",
      totalWatchedSeconds: totalWatched,
      adWatched,
      completedAt: now,
      points
    });

    return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: points }));
  } catch (err: any) {
    if (err.name === 'SyntaxError') {
        return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }));
    }
    console.error("complete error:", err);
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 }));
  }
}
