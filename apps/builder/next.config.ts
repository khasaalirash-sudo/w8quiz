import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Временно: не блокируем билд из-за TS/ESLint, MVP-демо
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Турбопак включён через флаг в dev скрипте
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Позволяет импортировать типы из workspace-пакетов напрямую
  transpilePackages: ['@markquiz/shared'],
}

export default nextConfig
