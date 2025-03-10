/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  
  // Body parser ayarları
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
    largePageDataBytes: 128 * 1000 * 1000, // 128MB - iç haberleşme için
  },
  
  // Maksimum dosya boyutunu artır
  async headers() {
    return [
      {
        source: '/api/upload',
        headers: [
          {
            key: 'Content-Length',
            value: '100mb', // Çok büyük dosyalara izin ver
          },
        ],
      },
    ];
  },
  
  // Node.js sunucu ayarları
  serverRuntimeConfig: {
    // Sunucu tarafı yapılandırma
    bodyParserLimit: '100mb',
  },
  
  // Hem istemci hem de sunucu tarafı için yapılandırma
  publicRuntimeConfig: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
  },
};

module.exports = nextConfig;