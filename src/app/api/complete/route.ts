// /app/api/complete/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { firestore } from "@/lib/firebase-admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleOptions();
}

export async function POST(req: Request) {
  // console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  if (req.headers.get("content-type") !== "application/json") {
    // console.log("Invalid content-type:", req.headers.get("content-type"));
    return addCorsHeaders(NextResponse.json({ error: "INVALID_CONTENT_TYPE" }, { status: 400 }));
  }

  try {
    const rawBody = await req.text();
    // console.log("Raw request body:", rawBody);
    
    if (!rawBody || rawBody.trim() === "") {
      return addCorsHeaders(NextResponse.json({ error: "EMPTY_BODY" }, { status: 400 }));
    }
    
    const body = JSON.parse(rawBody);
    // console.log("Parsed body:", body);

    if (body.secret !== process.env.EXTENSION_SECRET) {
      // console.log("Invalid secret. Received:", body.secret);
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SECRET" }, { status: 403 }));
    }

    const { sessionToken, finalWatchedSeconds: finalDelta = 0, adWatched = false } = body;
    
    if (!sessionToken) {
      // console.log("Missing sessionToken in body:", body);
      return addCorsHeaders(NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 }));
    }

    // console.log("Processing session:", sessionToken, "finalDelta:", finalDelta, "adWatched:", adWatched);

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const snap = await sessionRef.get();
    
    if (!snap.exists) {
      // console.log("Session not found:", sessionToken);
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 }));
    }

    const session = snap.data();
    if (!session) {
      // console.log("Session data is null for:", sessionToken);
      return addCorsHeaders(NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 }));
    }

    // اجمع ساعات المشاهدة النهائية
    const totalWatched = (session.totalWatchedSeconds || 0) + Math.max(0, Math.min(finalDelta, 600));
    const now = Date.now();

    // قواعد نقاط بسيطة كمثال
    let points = 0;
    if (totalWatched >= 30) points += 5;
    if (totalWatched >= 60) points += 10;
    if (totalWatched >= 120) points += 15;
    if (adWatched === true) points += 20;

    // console.log("Calculated points:", points, "totalWatched:", totalWatched);

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

    // console.log("Session completed successfully for:", sessionToken);
    return addCorsHeaders(NextResponse.json({ success: true, pointsAdded: points }));
    
  } catch (err: any) {
    if (err.name === 'SyntaxError') {
      return addCorsHeaders(NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }));
    }
    // console.error("complete error:", err);
    return addCorsHeaders(NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 }));
  }
}
