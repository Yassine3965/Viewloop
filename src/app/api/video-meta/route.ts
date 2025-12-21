import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { videoId, duration, clientType } = await req.json();

    const db = getFirestore();
    const videoRef = db.collection('videos').doc(videoId);

    // Update video document ONLY with non-sensitive metadata
    // Duration is NOW EXCLUSIVELY managed by the server (trusted source)
    await videoRef.set({
      updatedAt: new Date(),
      lastMetaUpdate: new Date()
    }, { merge: true });

    console.log(`✅ [API] Video metadata updated (Timestamp only): ${videoId}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Error updating video metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
