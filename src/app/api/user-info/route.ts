
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, initializeFirebaseAdmin } from '@/lib/firebase/admin';
import { handleOptions, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: Request) {
    return handleOptions(request);
}

export async function GET(req: NextRequest) {
    // Get token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return addCorsHeaders(response, req);
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        // CRITICAL: Ensure Admin App is initialized BEFORE calling getAuth()
        initializeFirebaseAdmin();

        // Now it's safe to use getAuth()
        const decodedToken = await getAuth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const db = getFirestore();
        const userDoc = await db.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            const response = NextResponse.json({ error: 'User not found' }, { status: 404 });
            return addCorsHeaders(response, req);
        }

        const userData = userDoc.data();
        const clientType = req.headers.get('x-client-type');
        const isExtension = clientType === 'extension';

        // Return public info - Filter sensitive data for web clients
        const responseData: any = {
            name: userData?.name || 'Client',
            level: userData?.level || 1,
            avatar: userData?.avatar || '',
            role: userData?.role || 'user',
            status: 'Authorized'
        };

        // Only include pulse and capacity for extension
        if (isExtension) {
            responseData.activityPulse = userData?.points || 0;
            responseData.systemCapacity = userData?.gems || 0;
            responseData.qualityStatus = userData?.lastSessionStatus?.qualityMessage || "نشاط مستقر";
        }

        const response = NextResponse.json(responseData);
        return addCorsHeaders(response, req);

    } catch (error) {
        console.error('Error fetching user info:', error);
        const response = NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        return addCorsHeaders(response, req);
    }
}
