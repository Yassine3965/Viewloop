
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

    // إنشاء sessionToken محلياً للاختبار (بدلاً من الخادم)
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // إضافة بيانات الفيديو (في الإنتاج، يمكن الحصول عليها من Firebase)
    const videoData = {
      id: videoID,
      url: `https://www.youtube.com/watch?v=${videoID}`,
      duration: 300, // افتراضي، يمكن تحسينه لاحقاً
      title: `Video ${videoID}`,
      thumbnail: `https://img.youtube.com/vi/${videoID}/maxresdefault.jpg`
    };

    return addCorsHeaders(NextResponse.json({
      success: true,
      sessionToken: sessionToken,
      video: videoData
    }), req);

  } catch (err: any) {
    console.error(`[SERVER_ERROR] in /api/start-session:`, err.message);
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
