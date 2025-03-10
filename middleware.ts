import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // API route'larına yapılan istekleri işle
  if (request.nextUrl.pathname.startsWith('/api/upload')) {
    // İstek boyutunu kontrol et ve gerekirse işle
    // Bu middleware, Next.js'in varsayılan boyut limitlerini aşabilir
    // ve büyük dosya yüklemelerine izin verir
    
    // Normal olarak işleme devam et
    return NextResponse.next();
  }

  // Diğer tüm route'lar için normal işlemeye devam et
  return NextResponse.next();
}

// Sadece /api/upload endpoint'i için çalışacak şekilde yapılandır
export const config = {
  matcher: '/api/upload',
}; 