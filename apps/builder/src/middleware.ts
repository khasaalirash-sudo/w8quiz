import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

interface CookieToSet {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Проверяем, настроен ли Supabase (не заглушки ли в .env.local).
 */
function isDevMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !url || url === 'https://your-project.supabase.co' || url.includes('your-project')
}

/**
 * Middleware — обновляет сессию Supabase и защищает приватные роуты.
 * В dev-режиме (Supabase не настроен) — пропускает все запросы.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Dev Mode: пропускаем авторизацию ──
  if (isDevMode()) {
    // В dev-режиме на /login и /register → сразу на /dashboard
    if (pathname === '/login' || pathname === '/register') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // Создаём response, который будем модифицировать
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // ВАЖНО: getUser() обновляет session token через cookies
  const { data: { user } } = await supabase.auth.getUser()

  // Публичные роуты — не требуют авторизации
  const publicPaths = ['/login', '/register', '/auth/callback']
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  // Если нет пользователя и роут приватный → redirect на /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Если есть пользователь и он на /login или /register → redirect на /dashboard
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Все роуты кроме:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, robots.txt, sitemap.xml
     * - /q/* (публичные квизы)
     * - /api/widget/* (API для виджета)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|api/widget|q/).*)',
  ],
}
