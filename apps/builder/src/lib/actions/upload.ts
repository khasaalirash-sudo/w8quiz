'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'

const BUCKET = 'quiz-images'

/**
 * Загрузка картинки вопроса в Supabase Storage.
 * Возвращает публичный URL.
 */
export async function uploadQuestionImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get('file') as File | null
  if (!file) return { error: 'Файл не передан' }

  // Авторизация: только владелец может загружать
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return { error: 'Нужна авторизация' }

  if (file.size > 5 * 1024 * 1024) return { error: 'Файл больше 5 МБ' }
  if (!file.type.startsWith('image/')) return { error: 'Не картинка' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${user.id}/${nanoid()}.${ext}`

  const supabase = await createServiceClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error('[uploadQuestionImage]', error)
    return { error: error.message }
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: publicUrl }
}
