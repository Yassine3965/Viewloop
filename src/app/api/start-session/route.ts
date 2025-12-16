
// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import admin from 'firebase-admin';
import { randomBytes, createHash } from 'crypto';

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let firestore: admin.firestore.Firestore;

  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  // Verify signature for start-session (videoId + timestamp only)
  const signature = req.headers.get('x-signature');
  if (!signature) {
    return addCorsHeaders(NextResponse.json({ error: "MISSING_SIGNATURE" }, { status: 401 }), req);
  }

  // Sign only videoId + timestamp for start-session
  const signPayload: Record<string, any> = {
    videoId: body.videoId,
    timestamp: body.timestamp
  };

  const sortedKeys = Object.keys(signPayload).sort();
  const sortedPayload: Record<string, any> = {};
  sortedKeys.forEach(key => {
    sortedPayload[key] = signPayload[key];
  });
  const dataString = JSON.stringify(sortedPayload);
  const jwtSecret = process.env.JWT_SECRET || process.env.EXTENSION_SECRET || 'fallback-secret';
  const expectedSignature = createHash('sha256')
    .update(dataString + jwtSecret)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.log('Signature mismatch:', { received: signature, expected: expectedSignature });
    return addCorsHeaders(NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 }), req);
  }

  let auth: admin.auth.Auth;

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
    auth = adminApp.auth();
  } catch (error: any) {
    console.error("Firebase Admin initialization failed.", { message: error.message });
    const response = NextResponse.json({
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  try {
    const { videoID, userAuthToken } = body;

    if (!videoID) {
      const response = NextResponse.json({ error: "MISSING_VIDEO_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    let userId = 'anonymous'; // Default for extension testing
    if (userAuthToken) {
      try {
        const decoded: admin.auth.DecodedIdToken = await auth.verifyIdToken(userAuthToken);
        userId = decoded.uid;
      } catch (err: any) {
        console.log("Invalid user token, proceeding as anonymous:", err.message);
        // Continue with anonymous user for extension testing
      }
    } else {
      console.log("No userAuthToken provided, using anonymous user for extension testing");
    }

    // التحقق من صحة videoID (يجب أن يكون 11 حرفاً)
    if (videoID.length !== 11) {
      const response = NextResponse.json({ error: "INVALID_VIDEO_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // 🔍 البحث عن جلسات نشطة للمستخدم (تخطي للـ anonymous users للاختبار)
    let accepted = true;
    let activeVideoId = null;

    if (userId !== 'anonymous') {
      const activeSessionsQuery = await firestore.collection('sessions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeSessionsQuery.empty) {
        // وجدت جلسة نشطة - اقبل الطلب لكن حدد أنه غير مقبول للمشاهدة
        const activeSession = activeSessionsQuery.docs[0].data();
        activeVideoId = activeSession.videoID;
        accepted = false;

        console.log(`User ${userId} already has active session with video ${activeVideoId}, rejecting new video ${videoID}`);
      }
    } else {
      console.log(`Anonymous user ${userId}, allowing multiple sessions for testing`);
    }

    // استخدام sessionId من الطلب إذا وُجد، وإلا أنشئ جديد
    const requestSessionId = body.sessionId;
    const sessionId = requestSessionId && requestSessionId.startsWith('session_') ? requestSessionId : `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');

    // إنشاء الجلسة في Firebase
    const sessionData = {
      sessionId: sessionId,
      userId: userId,
      videoID: videoID,
      status: accepted ? 'active' : 'rejected', // إذا كان غير مقبول، حدد status كـ rejected
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalWatchedSeconds: 0,
      validSeconds: 0,
      adSeconds: 0,
      points: 0,
      gems: 0,
      accepted: accepted, // حقل جديد لتحديد إذا كانت الجلسة مقبولة
      activeVideoId: activeVideoId, // الفيديو النشط إن وجد
      sessionToken: sessionToken
    };

    await firestore.collection('sessions').doc(sessionId).set(sessionData);

    console.log(`Created session: ${sessionId}, accepted: ${accepted}`);

    // إضافة بيانات الفيديو
    const videoData = {
      id: videoID,
      url: `https://www.youtube.com/watch?v=${videoID}`,
      duration: 300, // افتراضي
      title: `Video ${videoID}`,
      thumbnail: `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`
    };

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionId: sessionId,
      sessionToken: sessionToken,
      video: videoData
    }), req);

  } catch (err: any) {
    console.error(`[SERVER_ERROR] in /api/start-session:`, err.message);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
