import { NextRequest, NextResponse } from "next/server";

// Eski config formatı kaldırılıyor
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// Yeni Next.js App Router config formatı
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Büyük dosya yüklemeleri için boyut sınırı ayarlaması
export const maxDuration = 300; // 5 dakika süre sınırı (büyük dosyalar için)
export const fetchCache = 'force-no-store';

// Sadece presigned URL isteklerini destekleyen API
export async function POST(req: NextRequest) {
  try {
    console.log("[API] Upload isteği başladı");
    
    // Test route'unda olduğu gibi doğrudan backend-service URL'ini kullanıyoruz
    // NOT: backendUrl değişkenini kullanmıyoruz çünkü test route'da bu kullanılmıyor
    
    // Request türünü kontrol et
    const contentType = req.headers.get('content-type') || '';
    
    // Sadece JSON isteklerini işle (presigned URL için)
    if (contentType.includes('application/json')) {
      // JSON isteği al
      const { fileName, fileType, fileSize } = await req.json();
      console.log(`Dosya bilgileri: ${fileName}, ${fileType}, ${fileSize} byte`);
      
      // Backend'den presigned URL iste
      try {
        console.log("Backend'den presigned URL isteniyor...");
        const presignedUrlResponse = await fetch("http://backend-service:3001/api/upload/presigned", {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName,
            fileType,
            fileSize
          })
        });
        
        if (!presignedUrlResponse.ok) {
          const errorText = await presignedUrlResponse.text();
          console.error(`Backend presigned URL hatası: ${presignedUrlResponse.status}`);
          console.error(`Hata detayları: ${errorText}`);
          throw new Error(`Backend presigned URL hatası: ${presignedUrlResponse.status}`);
        }
        
        const presignedData = await presignedUrlResponse.json();
        console.log("Presigned URL alındı, istemciye gönderiliyor");
        
        // İstemciye presigned URL'i gönder
        return NextResponse.json({
          strategy: 'direct-upload',
          ...presignedData
        });
      } catch (error) {
        console.error("Presigned URL alınırken hata:", error);
        throw error;
      }
    } else {
      // FormData yüklemelerini reddet, sadece presigned URL'e yönlendir
      console.warn(`Bu API endpoint'i artık form data yüklemelerini kabul etmiyor: ${contentType}`);
      return NextResponse.json({ 
        error: "Doğrudan dosya yükleme artık desteklenmiyor", 
        detail: "Lütfen presigned URL ile yükleme stratejisini kullanın",
        strategy: "request-presigned-url" 
      }, { status: 415 });
    }
  } catch (error) {
    console.error("Upload genel hata:", error);
    
    // Hatanın türünü kontrol et
    if ((error as Error).name === 'AbortError') {
      return NextResponse.json(
        { error: "İstek zaman aşımına uğradı", detail: "İşlem çok uzun sürdü." },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: "Upload işlemi başarısız", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
