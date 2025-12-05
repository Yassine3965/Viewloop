
export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: Request) {
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
    
    const unknownResponse = {
      ip: clientIp || 'غير معروف',
      country: 'غير معروف',
      country_code: '',
      city: '',
    };

    if (!clientIp || clientIp === '::1') {
      return NextResponse.json(unknownResponse);
    }

    // Using a different service that reliably supports Arabic
    const res = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,message,country,countryCode,city&lang=ar`, {
      headers: {
        'User-Agent': 'Next.js App'
      }
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch IP info: ${res.status} ${res.statusText}`);
      return NextResponse.json(unknownResponse);
    }

    const data = await res.json();

    if (!data || data.status === 'fail') {
      console.warn(`Geolocation failed for IP ${clientIp}: ${data?.message}`);
      return NextResponse.json(unknownResponse);
    }

    return NextResponse.json({
      ip: clientIp,
      country: data.country || 'غير معروف',
      country_code: data.countryCode || '',
      city: data.city || '',
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        ip: 'غير معروف',
        country: 'غير معروف',
        country_code: '',
        city: '',
        error: 'Internal Server Error' 
      }, 
      { status: 500 }
    );
  }
}
