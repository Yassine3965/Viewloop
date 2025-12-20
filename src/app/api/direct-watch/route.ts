export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";

export async function GET(req: Request) {
    try {
        const adminApp = initializeFirebaseAdmin();
        const firestore = adminApp.firestore();

        // Get a batch of videos to pick from
        // Optimization: In a real app with millions of videos, this needs a better random algo.
        // For now, getting the last 20 videos and picking one is sufficient.
        const videosSnapshot = await firestore
            .collection("videos")
            .orderBy("submissionDate", "desc")
            .limit(20)
            .get();

        if (videosSnapshot.empty) {
            return NextResponse.redirect(new URL('/watch', req.url));
        }

        const videos = videosSnapshot.docs.map(doc => doc.data());
        const randomVideo = videos[Math.floor(Math.random() * videos.length)];

        if (randomVideo && randomVideo.url) {
            return NextResponse.redirect(randomVideo.url);
        }

        return NextResponse.redirect(new URL('/watch', req.url));

    } catch (error) {
        console.error('Error in direct-watch:', error);
        return NextResponse.redirect(new URL('/watch', req.url));
    }
}
