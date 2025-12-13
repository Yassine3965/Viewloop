
// /app/api/start-session/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { handleOptions, addCorsHeaders } from "@/lib/cors";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  try {
    const { videoID, userAuthToken } = body;

    if (!videoID) {
      const response = NextResponse.json({ error: "MISSING_VIDEO_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // التحقق من صحة videoID (يجب أن يكون 11 حرفاً)
    if (videoID.length !== 11) {
      const response = NextResponse.json({ error: "INVALID_VIDEO_ID" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    // إرسال الطلب إلى الخادم الجديد
    const serverResponse = await fetch(`${SERVER_URL}/start-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoID: videoID,
        userID: userAuthToken || 'anonymous'
      })
    });

    const serverData = await serverResponse.json();

    if (!serverResponse.ok) {
      const response = NextResponse.json({
        error: serverData.error || "SERVER_ERROR",
        message: serverData.message
      }, { status: serverResponse.status });
      return addCorsHeaders(response, req);
    }

    // إضافة بيانات الفيديو (في الإنتاج، يمكن الحصول عليها من Firebase)
    const videoData = {
      id: videoID,
      duration: 300, // افتراضي، يمكن تحسينه لاحقاً
      title: `Video ${videoID}`,
      thumbnail: `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`
    };

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken: serverData.sessionToken,
      video: videoData
    }), req);

  } catch (err: any) {
    console.error(`[SERVER_ERROR] in /api/start-session:`, err.message);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
