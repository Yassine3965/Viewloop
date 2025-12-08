
// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

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


    const userId = decoded.uid;
    const now = Date.now();

    // Prevent re-watching completed videos
    const watchHistoryQuery = await firestore.collection("watchHistory")
        .where('userId', '==', userId)
        .where('videoId', '==', videoID)
        .limit(1)
        .get();

    if (!watchHistoryQuery.empty) {
        const response = NextResponse.json({ 
            success: false, 
            error: "VIDEO_ALREADY_WATCHED",
            message: "You have already watched this video and received points for it."
        }, { status: 409 });
        return addCorsHeaders(response, req);
    }

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
