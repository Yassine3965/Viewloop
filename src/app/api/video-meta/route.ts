import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { videoId, duration, clientType } = await req.json();

    // Validation
    if (!videoId || !duration || duration < 10) {
      console.warn('[API] Invalid video-meta data:', { videoId, duration });
      return NextResponse.json({ success: false, error: 'Invalid data' });
    }

    // Validate client type
    if (clientType !== 'extension') {
      console.warn('[API] Unauthorized client type:', clientType);
      return NextResponse.json({ success: false, error: 'Unauthorized' });
    }

    console.log(`[API] Updating video metadata: ${videoId} (${duration}s)`);

    const db = getFirestore();
    const videoRef = db.collection('videos').doc(videoId);

    // Update video document with duration
    await videoRef.set({
      duration: duration,
      updatedAt: new Date(),
      lastMetaUpdate: new Date()
    }, { merge: true });

    console.log(`✅ [API] Video metadata updated: ${videoId}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[API] Error updating video metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
