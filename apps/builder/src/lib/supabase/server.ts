import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase клиент для Server Components, Server Actions и Route Handlers.
 * Управляет сессией через cookie-store Next.js.
 *
 * ВАЖНО: каждый запрос создаёт новый экземпляр клиента, не переиспользовать.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component не может устанавливать cookies.
            // Это нормально — middleware обновит сессию.
          }
        },
      },
    },
  )
}

/**
 * Service-role клиент — обходит RLS.
 * Использовать ТОЛЬКО в серверном коде (Route Handlers, Server Actions).
 * НИКОГДА не передавать service_role ключ клиентскому коду.
 */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch { /* ignore in Server Components */ }
        },
      },
    },
  )
}
