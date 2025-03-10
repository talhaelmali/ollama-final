import { NextRequest, NextResponse } from "next/server";

// Yeni Next.js App Router config formatı
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Büyük dosya yüklemeleri için boyut sınırı ayarlaması
export const maxDuration = 60; // 60 saniye süre sınırı
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
  try {
    console.log("[API] Upload finalize isteği başladı");
    
    // Test route'unda olduğu gibi doğrudan backend-service URL'ini kullanıyoruz
    
    // Request body'yi al
    const body = await req.json();
    const { key, fileName, fileSize, fileType } = body;
    
    if (!key) {
      return NextResponse.json(
        { error: "Storage key bilgisi eksik" },
        { status: 400 }
      );
    }
    
    console.log(`Finalize isteği: ${fileName}, Boyut: ${fileSize}, Key: ${key}`);
    
    // Backend'e yükleme işleminin tamamlandığını bildir
    try {
      const backendResponse = await fetch("http://backend-service:3001/api/upload/finalize", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          fileName,
          fileSize,
          fileType
        }),
      });
      
      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error(`Backend finalize hatası: ${backendResponse.status}`);
        console.error(`Hata detayları: ${errorText}`);
        throw new Error(`Backend hatası: ${backendResponse.status}`);
      }
      
      const data = await backendResponse.json();
      console.log("Backend finalize işlemi başarılı");
      return NextResponse.json(data);
    } catch (error) {
      console.error("Backend finalize hatası:", error);
      throw error;
    }
  } catch (error) {
    console.error("Upload finalize genel hata:", error);
    return NextResponse.json(
      { error: "Upload finalize işlemi başarısız", detail: (error as Error).message },
      { status: 500 }
    );
  }
} 