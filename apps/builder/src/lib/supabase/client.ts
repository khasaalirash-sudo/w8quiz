import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase клиент для использования в Client Components.
 * Использует анонимный ключ — доступ ограничен RLS-политиками.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
