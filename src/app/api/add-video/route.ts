
import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getYoutubeVideoId } from '@/lib/utils'; // We might need to duplicate this util or import it if compatible

// Fallback regex to parse duration from YouTube HTML (ISO 8601 duration logic might be needed if using an API, 
// but scraping often gives "approximate" or meta tags. 
// Duration tag: <meta itemprop="duration" content="PT6M33S">
// We will look for this meta tag. Use simple fetch.
// PT1H2M10S -> Parse to seconds.

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = (parseInt(match[1]) || 0);
    const minutes = (parseInt(match[2]) || 0);
    const seconds = (parseInt(match[3]) || 0);

    return (hours * 3600) + (minutes * 60) + seconds;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { url, userAuthToken } = body;

        if (!url || !userAuthToken) {
            return NextResponse.json({ error: "Missing URL or Token" }, { status: 400 });
        }

        // 1. Verify User
        const adminApp = initializeFirebaseAdmin();
        const auth = getAuth(adminApp);
        const db = getFirestore(adminApp);

        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(userAuthToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 2. Extract Video ID
        // Re-implement simple extraction to avoid import issues with client-side utils if any
        let videoId = null;
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v');
            } else if (urlObj.hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            }
        } catch (e) {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }

        if (!videoId || videoId.length !== 11) {
            return NextResponse.json({ error: "Invalid YouTube Video ID" }, { status: 400 });
        }

        // 3. Check if exists
        const videoRef = db.collection('videos').doc(videoId);
        const videoSnap = await videoRef.get();
        if (videoSnap.exists) {
            return NextResponse.json({ error: "Video already exists" }, { status: 409 });
        }

        // 4. SCRAPE DURATION (Server-Side)
        console.log(`🔍 [ADD-VIDEO] Fetching metadata for ${videoId}...`);
        let duration = 0;
        let title = `Video ${videoId}`;
        let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        try {
            // Fetch the YouTube page HTML
            const ytRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            });
            const html = await ytRes.text();

            // Regex for Title <meta name="title" content="...">
            const titleMatch = html.match(/<meta name="title" content="([^"]+)">/);
            if (titleMatch && titleMatch[1]) title = titleMatch[1];

            // 1. Primary Scrape: approxDurationMs in ytInitialPlayerResponse
            // This is the most reliable source in the page source
            const approxMatch = html.match(/\\"approxDurationMs\\":\\"(\\d+)\\"/);
            if (approxMatch && approxMatch[1]) {
                duration = Math.floor(parseInt(approxMatch[1]) / 1000);
                console.log(`✅ [ADD-VIDEO] Scraped Duration via JSON: ${duration}s`);
            } else {
                // 2. Fallback: meta itemprop="duration"
                const durMatch = html.match(/<meta itemprop="duration" content="([^"]+)">/);
                if (durMatch && durMatch[1]) {
                    duration = parseDuration(durMatch[1]);
                    console.log(`✅ [ADD-VIDEO] Scraped Duration via Meta: ${duration}s (${durMatch[1]})`);
                } else {
                    // 3. Last Resort Fallback: look for "lengthSeconds":"..."
                    const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
                    if (lengthMatch && lengthMatch[1]) {
                        duration = parseInt(lengthMatch[1]);
                        console.log(`✅ [ADD-VIDEO] Scraped Duration via lengthSeconds: ${duration}s`);
                    }
                }
            }

        } catch (e) {
            console.warn("⚠️ [ADD-VIDEO] Scraper failed:", e);
        }

        if (duration === 0) {
            console.warn(`❌ [ADD-VIDEO] Could not find duration for ${videoId}. Setting to 0. Rewards will be blocked.`);
        }

        // 5. Save to Firestore
        const newVideoData = {
            title,
            url,
            thumbnail,
            duration, // TRUSTED DURATION
            videoId,
            submitterId: userId,
            submitterName: userDoc.data()?.name || 'Unknown',
            submitterAvatar: userDoc.data()?.avatar || '',
            submissionDate: FieldValue.serverTimestamp(),
            activeviewers: 0,
            status: 'active'
        };

        await videoRef.set(newVideoData);

        return NextResponse.json({ success: true, message: "Video added securely", duration: duration });

    } catch (error: any) {
        console.error(`ERROR [ADD-VIDEO]:`, error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
