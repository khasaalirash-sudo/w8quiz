import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LogoutButton } from '@/components/LogoutButton'
import { isDevMode, DEV_USER } from '@/lib/dev-mode'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let email: string = DEV_USER.email
  if (!isDevMode()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    email = user?.email ?? 'user@w8quiz.io'
  }

  const initial = email.charAt(0).toUpperCase()

  const devMode = isDevMode()

  return (
    <div className="min-h-screen flex">
      {/* ── Dev Mode Banner ── */}
      {devMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-center text-xs font-medium py-1">
          🛠 Dev-режим — Supabase не подключен, данные демонстрационные
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`w-60 shrink-0 border-r border-neutral-200 bg-white flex flex-col ${devMode ? 'mt-7' : ''}`}>
        <div className="h-16 px-5 flex items-center border-b border-neutral-100">
          <Link href="/dashboard" className="font-semibold tracking-tight text-lg">
            w8Quiz
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <SidebarLink href="/dashboard" icon="📋" label="Квизы" />
          <SidebarLink href="/dashboard/leads" icon="👤" label="Лиды" />
          <SidebarLink href="/dashboard/integrations" icon="🔗" label="Интеграции" />
          <SidebarLink href="/dashboard/settings" icon="⚙️" label="Настройки" />
        </nav>
        <div className="p-3 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center text-xs font-semibold text-accent-700">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-neutral-700">{email}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={`flex-1 overflow-auto bg-neutral-50 ${devMode ? 'mt-7' : ''}`}>
        {children}
      </main>
    </div>
  )
}

function SidebarLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
