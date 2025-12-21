
import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { idToken, name, gender } = body;

        if (!idToken || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Initialize Firebase Admin
        const adminApp = initializeFirebaseAdmin();
        const auth = getAuth(adminApp);
        const db = getFirestore(adminApp);

        // 2. Verify Token
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const email = decodedToken.email;

        // 3. Check if profile already exists
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();

        if (userSnap.exists) {
            return NextResponse.json({ success: true, message: "Profile already exists", newUser: false });
        }

        // 4. Determine Location Metadata
        let locationData = { country: 'Unknown', country_code: '', city: '' };
        try {
            const headersList = headers();
            const forwardedFor = headersList.get('x-forwarded-for');
            const realIp = headersList.get('x-real-ip');
            let clientIp = null;

            if (forwardedFor) {
                clientIp = forwardedFor.split(',')[0].trim();
            } else if (realIp) {
                clientIp = realIp;
            }

            if (!clientIp || clientIp === '::1' || clientIp.startsWith('127.')) {
                clientIp = '8.8.8.8';
            }

            const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city&lang=ar`);
            if (geoRes.ok) {
                const geo = await geoRes.json();
                if (geo.status === 'success') {
                    locationData = {
                        country: geo.country || 'Unknown',
                        country_code: geo.countryCode || '',
                        city: geo.city || ''
                    };
                }
            }
        } catch (e) {
            console.error("⚠️ [INIT-PROFILE] Geolocation failed:", e);
        }

        // 5. Create New Profile
        const trimmedName = name.trim();
        const newUserProfile = {
            name: trimmedName,
            email: email,
            avatar: `https://source.boringavatars.com/beam/120/${encodeURIComponent(trimmedName)}?colors=264653,2a9d8f,e9c46a,f4a261,e76f51`,
            role: 'user',
            gender: gender || 'male',
            country: locationData.country,
            country_code: locationData.country_code,
            city: locationData.city,
            createdAt: FieldValue.serverTimestamp(),
            lastLogin: FieldValue.serverTimestamp(),
            points: 100, // Welcome gift
            gems: 0,
            level: 1,
            reputation: 4.5,
            lastUpdated: Date.now(),
        };

        await userRef.set(newUserProfile);

        console.log(`✅ [INIT-PROFILE] Created new user: ${userId} (${email})`);

        return NextResponse.json({
            success: true,
            message: "Profile initialized successfully",
            newUser: true,
            user: {
                name: trimmedName,
                points: 100
            }
        });

    } catch (error: any) {
        console.error("❌ [INIT-PROFILE] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
