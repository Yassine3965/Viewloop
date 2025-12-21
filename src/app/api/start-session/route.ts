
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

  // 🔒 Start-session signature verification
  console.log('🧪 START-SESSION HEADERS:', {
    signature: req.headers.get('x-signature'),
    all: Object.fromEntries(req.headers.entries())
  });
  const signature = req.headers.get('x-signature');

  if (signature !== 'INIT') {
    return addCorsHeaders(
      NextResponse.json({ error: "INVALID_INIT_SIGNATURE" }, { status: 401 }),
      req
    );
  }

  // Proceed with session initialization
  console.log('✅ [START-SESSION] INIT accepted');

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
    const { videoId, userAuthToken } = body;

    if (!videoId || videoId.length !== 11) {
      return addCorsHeaders(
        NextResponse.json({ error: "INVALID_VIDEO_ID" }, { status: 400 }),
        req
      );
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

    // Search for active sessions (skip for anonymous users for testing)
    let accepted = true;
    let activeVideoId = undefined;

    if (userId !== 'anonymous') {
      const activeSessionsQuery = await firestore.collection('sessions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeSessionsQuery.empty) {
        // وجدت جلسة نشطة - اقبل الطلب لكن حدد أنه غير مقبول للمشاهدة
        const activeSession = activeSessionsQuery.docs[0].data();
        activeVideoId = activeSession.videoId;
        accepted = false;

        console.log(`User ${userId} already has active session with video ${activeVideoId}, rejecting new video ${videoId}`);
      }
    } else {
      console.log(`Anonymous user ${userId}, allowing multiple sessions for testing`);
    }

    // استخدام sessionId من الطلب إذا وُجد، وإلا أنشئ جديد
    const requestSessionId = body.sessionId;
    const sessionId = requestSessionId && requestSessionId.startsWith('session_') ? requestSessionId : `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');



    console.log(`Created session: ${sessionId}, accepted: ${accepted}`);

    // إضافة بيانات الفيديو
    let videoDuration = 0;
    let videoTitle = `Video ${videoId}`;
    let videoThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // 🔒 SECURITY: Fetch duration and verify video exists in DB
    const videoDoc = await firestore.collection('videos').doc(videoId).get();
    if (!videoDoc.exists) {
      console.warn(`[START-SESSION] Video ${videoId} not found in DB. Rejecting session.`);
      return addCorsHeaders(
        NextResponse.json({
          error: "VIDEO_NOT_FOUND",
          message: "This video is not part of an active campaign."
        }, { status: 404 }),
        req
      );
    }

    const vData = videoDoc.data();
    videoDuration = vData?.duration || 0;
    videoTitle = vData?.title || videoTitle;
    videoThumbnail = vData?.thumbnail || videoThumbnail;

    const videoData = {
      id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      duration: videoDuration,
      title: videoTitle,
      thumbnail: videoThumbnail
    };

    // 🚀 LATE-BINDING SESSION CREATION with accurate video metrics
    const sessionData: any = {
      sessionId: sessionId,
      userId: userId,
      videoId: videoId,
      videoDuration: videoDuration,
      status: accepted ? 'active' : 'rejected',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      totalWatchedSeconds: 0,
      validSeconds: 0,
      activityPulse: 0,
      systemCapacity: 0,
      accepted: accepted,
      sessionTokenHash: createHash('sha256').update(sessionToken).digest('hex')
    };

    if (activeVideoId !== undefined) {
      sessionData.activeVideoId = activeVideoId;
    }

    await firestore.collection('sessions').doc(sessionId).set(sessionData);


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
