// /app/api/check-video/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

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

  // Use the existing signature verification from the project
  // This is more secure than a simple bearer token for extension communication
  if (!verifySignature(req, body)) {
    const response = NextResponse.json({ error: "INVALID_SIGNATURE", exists: false, authorized: false }, { status: 403 });
    return addCorsHeaders(response, req);
  }

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
  } catch (error: any) {
    const response = NextResponse.json({ 
      error: "SERVER_NOT_READY",
      message: "Firebase Admin initialization failed. Check server logs for details.",
      exists: false,
      authorized: false
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }
  
  try {
    const { videoId } = body;
    
    if (!videoId) {
      const response = NextResponse.json({ error: 'Video ID required', exists: false, authorized: false }, { status: 400 });
      return addCorsHeaders(response, req);
    }
    
    // The document ID in the 'videos' collection is the YouTube video ID
    const videoRef = firestore.collection("videos").doc(videoId);
    const videoSnap = await videoRef.get();
    
    const exists = videoSnap.exists;
    
    if (exists) {
      const videoData = videoSnap.data();
      const response = NextResponse.json({
        exists: true,
        authorized: true, // Assuming if it exists, it's authorized for viewing
        video: {
          id: videoSnap.id,
          title: videoData?.title,
          url: videoData?.url,
          duration: videoData?.duration,
          submitterId: videoData?.submitterId,
          submissionDate: videoData?.submissionDate,
        },
        message: 'Video found in ViewLoop database and is authorized.'
      });
      return addCorsHeaders(response, req);
    } else {
      const response = NextResponse.json({
        exists: false,
        authorized: false,
        message: 'Video not found in ViewLoop database'
      });
      return addCorsHeaders(response, req);
    }
      
  } catch (error: any) {
    console.error('Error checking video:', error);
    const response = NextResponse.json(
      { error: 'Internal server error', details: error.message, exists: false, authorized: false },
      { status: 500 }
    );
    return addCorsHeaders(response, req);
  }
}
