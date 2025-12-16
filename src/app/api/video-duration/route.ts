export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

/* ===================== CORS ===================== */
function corsJson(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/* ===================== Utils ===================== */
function parseISODuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || "0") * 3600 +
    parseInt(match[2] || "0") * 60 +
    parseInt(match[3] || "0")
  );
}

function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const { videoId } = await req.json();

    if (!videoId || !isValidVideoId(videoId)) {
      return corsJson({ success: false, error: "INVALID_VIDEO_ID" }, 400);
    }

    initializeFirebaseAdmin();
    const db = admin.firestore();
    const docRef = db.collection("video_meta").doc(videoId);

    const cached = await docRef.get();
    if (cached.exists) {
      return corsJson({
        success: true,
        videoId,
        durationSeconds: cached.data()?.durationSeconds,
        source: "cache",
      });
    }

    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!ytRes.ok) {
      return corsJson({ success: false, error: "YOUTUBE_API_ERROR" }, 502);
    }

    const ytData = await ytRes.json();
    if (!ytData.items?.length) {
      return corsJson({ success: false, error: "VIDEO_NOT_FOUND" }, 404);
    }

    const durationSeconds = parseISODuration(
      ytData.items[0].contentDetails.duration
    );

    await docRef.set({
      durationSeconds,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return corsJson({
      success: true,
      videoId,
      durationSeconds,
      source: "youtube",
    });

  } catch (err) {
    console.error("❌ video-duration error:", err);
    return corsJson({ success: false, error: "INTERNAL_ERROR" }, 500);
  }
}
