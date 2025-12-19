// /app/api/improve-reputation/route.ts
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { initializeFirebaseAdmin } from "@/lib/firebase/admin";
import { handleOptions, addCorsHeaders } from "@/lib/cors";
import admin from 'firebase-admin';

const REPUTATION_IMPROVEMENT_COST = 50; // Cost in gems
const REPUTATION_IMPROVEMENT_AMOUNT = 0.5; // Amount to increase reputation by

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
      message: "Firebase Admin initialization failed. Check server logs for details."
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
    const response = NextResponse.json({ error: "INVALID_USER_TOKEN", message: "رمز المستخدم غير صالح" }, { status: 401 });
    return addCorsHeaders(response, req);
  }
  
  const userId = decoded.uid;
  
  try {
    let success = false;
    let message = '';

    await firestore.runTransaction(async (transaction) => {
      const userRef = firestore.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists) {
        throw new Error("User not found");
      }

      const userData = userSnap.data()!;
      const currentGems = userData.gems || 0;
      const currentReputation = userData.reputation || 0;

      if (currentReputation >= 5) {
        success = false;
        message = "سمعتك بالفعل في أقصى درجة.";
        return;
      }

      if (currentGems < REPUTATION_IMPROVEMENT_COST) {
        success = false;
        message = `ليس لديك ما يكفي من المجوهرات. التكلفة هي ${REPUTATION_IMPROVEMENT_COST} مجوهرة.`;
        return;
      }
      
      const newGems = currentGems - REPUTATION_IMPROVEMENT_COST;
      const newReputation = Math.min(5, currentReputation + REPUTATION_IMPROVEMENT_AMOUNT);

      transaction.update(userRef, {
        gems: newGems,
        reputation: newReputation,
      });

      success = true;
      message = `تم تحسين سمعتك بنجاح! سمعتك الجديدة هي ${newReputation.toFixed(1)}.`;
    });

    const response = NextResponse.json({ success, message });
    return addCorsHeaders(response, req);

  } catch (err: any) {
    const response = NextResponse.json({ error: "SERVER_ERROR", details: err.message, message: "حدث خطأ أثناء محاولة تحسين السمعة." }, { status: 500 });
    return addCorsHeaders(response, req);
  }
}
