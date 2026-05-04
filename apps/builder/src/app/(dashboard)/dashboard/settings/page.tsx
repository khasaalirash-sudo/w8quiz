import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { isDevMode, DEV_USER } from '@/lib/dev-mode'
import { SettingsClient } from './settings-client'

export const metadata: Metadata = { title: 'Настройки' }

export default async function SettingsPage() {
  let email: string = DEV_USER.email
  let createdAt: string = DEV_USER.created_at

  if (!isDevMode()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    email = user?.email ?? ''
    createdAt = user?.created_at ?? ''
  }

  return (
    <SettingsClient
      email={email}
      createdAt={createdAt}
    />
  )
}
