// src/lib/signature-middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function verifySignatureMiddleware(request: NextRequest) {
    const signature = request.headers.get('x-signature');

    if (!signature) {
        console.warn('🚨 [MIDDLEWARE] Missing signature header');
        return NextResponse.json({ error: 'MISSING_SIGNATURE' }, { status: 401 });
    }

    // ✅ استثناءات آمنة: مسارات لا تحتاج توقيع
    if (request.nextUrl.pathname === '/api/start-session' && signature === 'INIT') {
        console.log('✅ [MIDDLEWARE] Allowing start-session with INIT signature');
        return null; // Continue to next middleware/route
    }

    if (request.nextUrl.pathname === '/api/validate-video') {
        console.log('✅ [MIDDLEWARE] Allowing validate-video without signature');
        return null; // Continue to next middleware/route
    }

    // ❌ أي توقيع آخر غير صالح
    if (signature === 'INIT') {
        console.warn('🚨 [MIDDLEWARE] INIT signature only allowed for start-session');
        return NextResponse.json({ error: 'INVALID_SIGNATURE_FOR_ENDPOINT' }, { status: 401 });
    }

    // ✅ توقيعات أخرى تُراجع في الـ route نفسه
    return null; // Continue to route handler
}
