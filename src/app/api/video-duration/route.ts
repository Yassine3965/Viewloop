export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;

function parseISODuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

export async function POST(req: Request) {
  try {
    const { videoId } = await req.json();

    if (!videoId || !isValidVideoId(videoId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_VIDEO_ID" },
        { status: 400 }
      );
    }

    // Init Firebase Admin once
    initializeFirebaseAdmin();
    const db = admin.firestore();

    const docRef = db.collection("video_meta").doc(videoId);
    const cached = await docRef.get();

    if (cached.exists) {
      const data = cached.data();
      return NextResponse.json({
        success: true,
        videoId,
        durationSeconds: data?.durationSeconds,
        source: "cache"
      });
    }

    // Fetch from YouTube API
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );

    if (!ytRes.ok) {
      return NextResponse.json(
        { success: false, error: "YOUTUBE_API_ERROR" },
        { status: 502 }
      );
    }

    const ytData = await ytRes.json();

    if (!ytData.items || ytData.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "VIDEO_NOT_FOUND" },
        { status: 404 }
      );
    }

    const durationISO = ytData.items[0].contentDetails.duration;
    const durationSeconds = parseISODuration(durationISO);

    // Store in cache
    await docRef.set({
      durationSeconds,
      fetchedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      videoId,
      durationSeconds,
      source: "youtube"
    });

  } catch (err) {
    console.error("❌ video-duration error:", err);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
