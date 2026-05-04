'use server'

import { createClient } from '@/lib/supabase/server'
import { isDevMode } from '@/lib/dev-mode'

export interface Integration {
    id: string
    quiz_id: string
    type: string
    name: string
    config: Record<string, string>
    is_active: boolean
    created_at: string
    updated_at?: string
}

export interface WebhookLog {
    id: string
    integration_id: string | null
    lead_id: string | null
    status: number | null
    attempt: number
    request_body: unknown
    response_body: unknown
    error: string | null
    delivery_state: 'pending' | 'success' | 'failed' | 'retrying'
    created_at: string
}

// ─── Get integrations for quiz ───────────────────────

export async function getIntegrations(quizId: string): Promise<Integration[]> {
    if (isDevMode()) return []

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('quiz_id', quizId)

    if (error) {
        console.error('[getIntegrations]', error)
        return []
    }
    return data as Integration[]
}

// ─── Save integration (upsert by quiz_id + type) ─────

export async function saveIntegration(params: {
    quizId: string
    type: string
    name: string
    config: Record<string, string>
    isActive?: boolean
}) {
    if (isDevMode()) {
        console.log('[DEV] saveIntegration', params.type, params.config)
        return { success: true }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Проверяем владельца квиза
    const { data: quiz } = await supabase
        .from('quizzes')
        .select('id')
        .eq('id', params.quizId)
        .eq('user_id', user.id)
        .single()

    if (!quiz) throw new Error('Quiz not found or access denied')

    // Ищем существующую интеграцию того же типа для этого квиза
    const { data: existing } = await supabase
        .from('integrations')
        .select('id')
        .eq('quiz_id', params.quizId)
        .eq('type', params.type)
        .maybeSingle()

    if (existing) {
        const { error } = await supabase
            .from('integrations')
            .update({
                name: params.name,
                config: params.config,
                is_active: params.isActive ?? true,
            })
            .eq('id', existing.id)

        if (error) throw new Error(error.message)
        return { success: true, id: existing.id }
    }

    const { data, error } = await supabase
        .from('integrations')
        .insert({
            quiz_id: params.quizId,
            type: params.type,
            name: params.name,
            config: params.config,
            is_active: params.isActive ?? true,
        })
        .select('id')
        .single()

    if (error) throw new Error(error.message)
    return { success: true, id: data.id }
}

// ─── Delete integration ──────────────────────────────

export async function deleteIntegration(integrationId: string) {
    if (isDevMode()) return

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // RLS защитит, но для ясности выберем сначала
    const { error } = await supabase
        .from('integrations')
        .delete()
        .eq('id', integrationId)

    if (error) throw new Error(error.message)
}

// ─── Webhook logs (последние N попыток для квиза) ────

export async function getWebhookLogs(quizId: string, limit = 50): Promise<WebhookLog[]> {
    if (isDevMode()) return []

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Получаем integration ids этого квиза
    const { data: integrations } = await supabase
        .from('integrations')
        .select('id')
        .eq('quiz_id', quizId)

    const integrationIds = (integrations ?? []).map((i: { id: string }) => i.id)
    if (integrationIds.length === 0) return []

    const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .in('integration_id', integrationIds)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error('[getWebhookLogs]', error)
        return []
    }
    return data as WebhookLog[]
}
