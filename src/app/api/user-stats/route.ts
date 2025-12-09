
// /app/api/user-stats/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const DAILY_WATCH_LIMIT = 100;
const DAILY_LIMIT_HOURS = 24;

export async function OPTIONS(req: Request) {
  return handleOptions(req);
}

export async function POST(req: Request) {
    let firestore: admin.firestore.Firestore;
    let auth: admin.auth.Auth;

    try {
        const adminApp = initializeFirebaseAdmin();
        firestore = adminApp.firestore();
        auth = adminApp.auth();
    } catch (error: any) {
        const response = NextResponse.json({ 
            error: "SERVER_NOT_READY",
            message: "Firebase Admin initialization failed."
        }, { status: 503 });
        return addCorsHeaders(response, req);
    }
  
    let body;
    try {
        body = await req.json();
    } catch (e) {
        const response = NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
        return addCorsHeaders(response, req);
    }
    
    const { userAuthToken } = body;
    if (!userAuthToken) {
        const response = NextResponse.json({ error: "MISSING_AUTH_TOKEN" }, { status: 400 });
        return addCorsHeaders(response, req);
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
        decoded = await auth.verifyIdToken(userAuthToken);
    } catch (err) {
        const response = NextResponse.json({ error: "INVALID_USER_TOKEN" }, { status: 401 });
        return addCorsHeaders(response, req);
    }
    
    const userId = decoded.uid;
    const now = Date.now();
    const dailyLimitCutoff = now - (1000 * 60 * 60 * DAILY_LIMIT_HOURS);

    try {
        const dailyWatchQuery = firestore.collection("watchHistory")
            .where('userId', '==', userId)
            .where('completedAt', '>=', dailyLimitCutoff);

        const dailyHistorySnap = await dailyWatchQuery.get();
        const dailyWatchCount = dailyHistorySnap.size;
        const remainingWatches = Math.max(0, DAILY_WATCH_LIMIT - dailyWatchCount);

        const response = NextResponse.json({
            success: true,
            dailyWatchCount,
            dailyWatchLimit: DAILY_WATCH_LIMIT,
            remainingWatches,
        });
        return addCorsHeaders(response, req);

    } catch (err: any) {
        const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message }, { status: 500 });
        return addCorsHeaders(response, req);
    }
}
