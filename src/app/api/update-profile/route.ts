import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, getStorage, initializeFirebaseAdmin } from '@/lib/firebase/admin';
import { handleOptions, addCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: Request) {
    return handleOptions(request);
}

export async function POST(req: NextRequest) {
    // Get token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        return addCorsHeaders(response, req);
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        // Ensure Admin App is initialized
        initializeFirebaseAdmin();

        // Verify token
        const decodedToken = await getAuth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // Parse form data
        const formData = await req.formData();
        const file = formData.get('avatar') as File;

        if (!file) {
            const response = NextResponse.json({ error: 'No file provided' }, { status: 400 });
            return addCorsHeaders(response, req);
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            const response = NextResponse.json({ error: 'File must be an image' }, { status: 400 });
            return addCorsHeaders(response, req);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            const response = NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
            return addCorsHeaders(response, req);
        }

        // Get storage bucket
        const bucket = getStorage().bucket();
        const fileName = `avatars/${uid}/${Date.now()}_${file.name}`;
        const fileRef = bucket.file(fileName);

        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to Firebase Storage
        await fileRef.save(buffer, {
            metadata: {
                contentType: file.type,
            },
        });

        // Make file public and get URL
        await fileRef.makePublic();
        const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // Update user profile in Firestore
        const db = getFirestore();
        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            avatar: avatarUrl,
            lastUpdated: Date.now(),
        });

        const response = NextResponse.json({
            success: true,
            message: 'Profile updated successfully',
            avatar: avatarUrl
        });
        return addCorsHeaders(response, req);

    } catch (error) {
        console.error('Error updating profile:', error);
        const response = NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        return addCorsHeaders(response, req);
    }
}
