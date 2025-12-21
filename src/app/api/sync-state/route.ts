// /app/api/sync-state/route.ts - Activity State Synchronization
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin, verifySignature } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const SYNC_OFFSET_RATE = 0.5;
const CAPACITY_OFFSET = 1;

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

  if (!body || typeof body !== 'object') {
    const response = NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    return addCorsHeaders(response, req);
  }

  if (!verifySignature(req, body)) {
    const response = NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 403 });
    return addCorsHeaders(response, req);
  }

  try {
    const adminApp = initializeFirebaseAdmin();
    firestore = adminApp.firestore();
  } catch (error: any) {
    const response = NextResponse.json({
      error: "SERVER_NOT_READY",
      message: "Processing system initialization failed."
    }, { status: 503 });
    return addCorsHeaders(response, req);
  }

  try {
    const { sessionToken, syncDuration } = body;
    if (!sessionToken || typeof syncDuration !== 'number' || syncDuration <= 0) {
      const response = NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
      return addCorsHeaders(response, req);
    }

    const sessionRef = firestore.collection("sessions").doc(sessionToken);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      const response = NextResponse.json({ error: "INVALID_SESSION" }, { status: 404 });
      return addCorsHeaders(response, req);
    }

    const sessionData = sessionSnap.data();
    if (!sessionData) {
      const response = NextResponse.json({ error: "INVALID_SESSION_DATA" }, { status: 500 });
      return addCorsHeaders(response, req);
    }

    if (sessionData.stateSynced === true) {
      return addCorsHeaders(NextResponse.json({
        success: false,
        error: "STATE_ALREADY_SYNCED",
        message: "State synchronization has already been processed."
      }, { status: 200 }), req);
    }

    const pulseAdjustment = syncDuration * SYNC_OFFSET_RATE;

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(sessionData.userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("Target identity not found");
      }

      transaction.update(userRef, {
        activityPulse: admin.firestore.FieldValue.increment(pulseAdjustment),
        systemCapacity: admin.firestore.FieldValue.increment(CAPACITY_OFFSET)
      });
      transaction.update(sessionRef, {
        stateSynced: true,
        activityHeartbeats: admin.firestore.FieldValue.increment(Math.ceil(syncDuration / 15))
      });
    });

    return addCorsHeaders(NextResponse.json({
      success: true,
      message: "State synchronization complete.",
      pulseAdded: pulseAdjustment,
      capacityAdded: CAPACITY_OFFSET
    }), req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SYNC_ERROR", details: err.message }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
