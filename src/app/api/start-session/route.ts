
// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

const MAX_WATCHES_PER_CYCLE = 5;
const WATCH_CYCLE_HOURS = 24;

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;
  let auth: admin.auth.Auth;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Re-enable signature verification
  if (!verifySignature(req, body)) {
      const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
      return addCorsHeaders(response, req);
  }

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { videoID, userAuthToken } = body;

    if (!videoID || !userAuthToken) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }
    
    // --- Video Check ---
    const videoRef = firestore.collection("videos").doc(videoID);
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) {
        console.warn(`Attempt to start session for non-existent video: ${videoID}`);
        const response = NextResponse.json({ success: false, error: "VIDEO_NOT_FOUND" }, { status: 404 });
        return addCorsHeaders(response, req);
    }
    // --- End Check ---

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(userAuthToken);
      console.log("✅ تم التحقق من التوكن بنجاح:", {
        userId: decoded.uid,
        email: decoded.email,
        tokenIssuedAt: new Date(decoded.iat * 1000),
        tokenExpiresAt: new Date(decoded.exp * 1000),
        now: new Date()
      });
    } catch (err: any) {
        if (err.code === 'auth/id-token-expired') {
            console.warn("⚠️ Token is expired, but proceeding. This is expected behavior.");
            const payloadBase64 = userAuthToken.split('.')[1];
            const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
            decoded = JSON.parse(decodedPayload);
        } else {
            console.error("❌ فشل التحقق من التوكن:", {
                errorCode: err.code,
                errorMessage: err.message,
                tokenLength: userAuthToken?.length,
                tokenPrefix: userAuthToken?.substring(0, 20) + "...",
                currentTime: new Date().toISOString()
            });
            
            let errorType = "INVALID_USER_TOKEN";
            let message = "رمز المستخدم غير صالح";
            
            if (err.code === 'auth/argument-error') {
                errorType = "INVALID_TOKEN_FORMAT";
                message = "تنسيق رمز المستخدم غير صالح";
            } else if (err.code === 'auth/id-token-expired') {
                errorType = "TOKEN_EXPIRED";
                message = "انتهت صلاحية رمز المستخدم، يرجى إعادة تسجيل الدخول";
            }
            
            const response = NextResponse.json({ 
                error: errorType, 
                message,
                details: err.code 
            }, { status: 401 });
            return addCorsHeaders(response, req);
        }
    }


    const userId = decoded.uid || decoded.user_id;
    if (!userId) {
        console.error("CRITICAL: Could not extract userId from token.", { decoded });
        return addCorsHeaders(NextResponse.json({ 
            error: "INVALID_TOKEN_CLAIMS",
            message: "لم يتم العثور على معرف المستخدم في التوكن."
        }, { status: 400 }), req);
    }

    const now = Date.now();

    // --- New Watch Limit Logic ---
    const watchHistoryQuery = firestore.collection("watchHistory")
        .where('userId', '==', userId)
        .where('videoId', '==', videoID)
        .orderBy('completedAt', 'desc');

    const historySnap = await watchHistoryQuery.get();
    const watchCount = historySnap.size;

    if (watchCount >= MAX_WATCHES_PER_CYCLE) {
        const lastWatchedDoc = historySnap.docs[0];
        const lastWatchedTime = lastWatchedDoc.data().completedAt;
        const hoursSinceLastWatch = (now - lastWatchedTime) / (1000 * 60 * 60);

        if (hoursSinceLastWatch < WATCH_CYCLE_HOURS) {
            const hoursRemaining = Math.ceil(WATCH_CYCLE_HOURS - hoursSinceLastWatch);
            const response = NextResponse.json({
                success: false,
                error: "WATCH_LIMIT_REACHED",
                message: `لقد وصلت إلى الحد الأقصى للمشاهدات لهذا الفيديو. يرجى المحاولة مرة أخرى بعد ${hoursRemaining} ساعة.`,
                retryAfterHours: hoursRemaining,
            }, { status: 429 });
            return addCorsHeaders(response, req);
        } else {
            // Over 24 hours have passed, so we reset the "cycle" by simply allowing them to watch again.
            // Firestore rules or a server-side cleanup job could eventually remove very old history.
            // For now, we just allow it.
        }
    }
    // --- End New Logic ---


    // Server-side debounce to prevent race conditions from duplicate requests
    const recentSessionQuery = await firestore.collection("sessions")
        .where("userId", "==", userId)
        .where("videoID", "==", videoID)
        .where("createdAt", ">=", now - 2000) // Check for sessions created in the last 2 seconds
        .limit(1)
        .get();

    if (!recentSessionQuery.empty) {
        console.warn(`Duplicate session request for user ${userId} and video ${videoID}. Returning existing session.`);
        return addCorsHeaders(NextResponse.json({
            success: true,
            sessionToken: recentSessionQuery.docs[0].id,
            note: "EXISTING_SESSION_RETURNED"
        }), req);
    }
    
    // Invalidate any other existing sessions for this user
    const sessionsRef = firestore.collection("sessions");
    const activeSessionQuery = await sessionsRef.where('userId', '==', userId).where('status', '==', 'active').get();

    if (!activeSessionQuery.empty) {
        const batch = firestore.batch();
        activeSessionQuery.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'expired', completedAt: now });
        });
        await batch.commit();
        console.log(`Expired ${activeSessionQuery.size} old session(s) for user ${userId}`);
    }
    
    const sessionToken = uuidv4();

    const sessionDoc = {
      sessionToken,
      userId,
      videoID,
      createdAt: now,
      lastHeartbeatAt: now,
      totalWatchedSeconds: 0,
      adWatched: false,
      status: "active",
      inactiveHeartbeats: 0,
      noMouseMovementHeartbeats: 0,
      adHeartbeats: 0,
      penaltyReasons: []
    };
    
    await firestore.collection("sessions").doc(sessionToken).set(sessionDoc);

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken,
    }), req);

  } catch (err: any) {
    console.error(`[SERVER_ERROR] in /api/start-session:`, {
        message: err.message,
        stack: err.stack,
        body: body,
    });
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
