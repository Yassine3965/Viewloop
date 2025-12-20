
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from '@/lib/firebase/admin';
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
        // Create admin auth if not initialized by firebase-admin globally, but getAuth() should work if initApp was called.
        // Usually verifyIdToken checks signature.
        const decodedToken = await getAuth().verifyIdToken(token);
        const uid = decodedToken.uid;

        const db = getFirestore();
        const userDoc = await db.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            const response = NextResponse.json({ error: 'User not found' }, { status: 404 });
            return addCorsHeaders(response, req);
        }

        const userData = userDoc.data();

        // Return public info
        const response = NextResponse.json({
            name: userData?.name || 'مستخدم',
            points: userData?.points || 0,
            gems: userData?.gems || 0,
            level: userData?.level || 1,
            avatar: userData?.avatar || '',
            role: userData?.role || 'user'
        });
        return addCorsHeaders(response, req);

    } catch (error) {
        console.error('Error fetching user info:', error);
        const response = NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        return addCorsHeaders(response, req);
    }
}
