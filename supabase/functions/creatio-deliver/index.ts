// ════════════════════════════════════════════════════
// Edge Function: creatio-deliver
// Принимает { lead_id }, забирает лид + интеграцию,
// формирует payload по mapping-правилам и POST'ит в Creatio OData API.
// До 3 retry с экспоненциальной задержкой при 5xx.
// Каждая попытка пишется в webhook_logs.
// ════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface CreatioConfig {
    instance_url?: string
    auth_type?: 'oauth2' | 'api_key' | string
    client_id?: string
    client_secret?: string
    collection?: string
    map_name?: string
    map_email?: string
    map_phone?: string
    [k: string]: string | undefined
}

interface DeliverRequest {
    lead_id: string
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const RETRY_DELAYS_MS = [0, 1000, 4000] // 3 попытки

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    let body: DeliverRequest
    try {
        body = await req.json()
    } catch {
        return jsonError(400, 'Invalid JSON')
    }

    if (!body.lead_id) return jsonError(400, 'lead_id required')

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // 1. Загружаем лид
    const { data: lead, error: leadErr } = await supabase
        .from('leads')
        .select('*')
        .eq('id', body.lead_id)
        .single()

    if (leadErr || !lead) return jsonError(404, 'Lead not found')

    // 2. Находим активную Creatio интеграцию для этого квиза
    const { data: integration } = await supabase
        .from('integrations')
        .select('*')
        .eq('quiz_id', lead.quiz_id)
        .eq('type', 'creatio')
        .eq('is_active', true)
        .maybeSingle()

    if (!integration) {
        // Нет интеграции — это норма, выходим тихо
        return jsonOk({ skipped: true, reason: 'no creatio integration' })
    }

    const config = integration.config as CreatioConfig
    if (!config.instance_url || !config.collection) {
        await logAttempt(supabase, integration.id, lead.id, 1, null, null, null, 'Missing instance_url or collection', 'failed')
        return jsonError(400, 'Integration misconfigured')
    }

    // 3. Формируем payload по mapping
    const payload: Record<string, unknown> = {}
    if (config.map_name && lead.name) payload[config.map_name] = lead.name
    if (config.map_email && lead.email) payload[config.map_email] = lead.email
    if (config.map_phone && lead.phone) payload[config.map_phone] = lead.phone

    // Кастомные поля как они есть
    if (lead.custom_fields && typeof lead.custom_fields === 'object') {
        for (const [k, v] of Object.entries(lead.custom_fields)) {
            payload[k] = v
        }
    }

    // 4. Получаем токен (для OAuth) или используем API key
    let authHeader: string | null = null
    try {
        authHeader = await buildAuthHeader(config)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'auth failed'
        await logAttempt(supabase, integration.id, lead.id, 1, null, payload, null, msg, 'failed')
        return jsonError(401, msg)
    }

    // 5. Retry-цикл
    const url = `${config.instance_url.replace(/\/$/, '')}/0/odata/${config.collection}`
    let lastStatus: number | null = null
    let lastResponseText: string | null = null
    let lastError: string | null = null

    for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (RETRY_DELAYS_MS[attempt - 1] > 0) {
            await sleep(RETRY_DELAYS_MS[attempt - 1]!)
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;odata=verbose',
                    'Accept': 'application/json',
                    ...(authHeader ? { Authorization: authHeader } : {}),
                },
                body: JSON.stringify(payload),
            })

            lastStatus = res.status
            lastResponseText = await res.text()

            // 2xx — успех
            if (res.status >= 200 && res.status < 300) {
                await logAttempt(supabase, integration.id, lead.id, attempt, res.status, payload, safeJson(lastResponseText), null, 'success')
                return jsonOk({ ok: true, status: res.status })
            }

            // 4xx — нет смысла ретраить
            if (res.status >= 400 && res.status < 500) {
                await logAttempt(supabase, integration.id, lead.id, attempt, res.status, payload, safeJson(lastResponseText), `HTTP ${res.status}`, 'failed')
                return jsonError(res.status, `Creatio rejected: ${lastResponseText}`)
            }

            // 5xx — ретраим
            await logAttempt(supabase, integration.id, lead.id, attempt, res.status, payload, safeJson(lastResponseText), `HTTP ${res.status}`, attempt === RETRY_DELAYS_MS.length ? 'failed' : 'retrying')
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e)
            await logAttempt(supabase, integration.id, lead.id, attempt, null, payload, null, lastError, attempt === RETRY_DELAYS_MS.length ? 'failed' : 'retrying')
        }
    }

    return jsonError(502, `Failed after ${RETRY_DELAYS_MS.length} attempts: ${lastError ?? `HTTP ${lastStatus}`}`)
})

// ─── helpers ─────────────────────────────────────────

async function buildAuthHeader(config: CreatioConfig): Promise<string | null> {
    if (config.auth_type === 'api_key') {
        if (!config.client_id) throw new Error('client_id (API key) required')
        return `Bearer ${config.client_id}`
    }

    if (config.auth_type === 'oauth2') {
        if (!config.client_id || !config.client_secret) {
            throw new Error('client_id and client_secret required for oauth2')
        }
        // Creatio OAuth2: POST {instance}/connect/token
        const tokenUrl = `${config.instance_url!.replace(/\/$/, '')}/connect/token`
        const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: config.client_id,
                client_secret: config.client_secret,
            }),
        })
        if (!res.ok) throw new Error(`OAuth2 token request failed: ${res.status}`)
        const data = await res.json()
        if (!data.access_token) throw new Error('No access_token in OAuth response')
        return `Bearer ${data.access_token}`
    }

    return null
}

async function logAttempt(
    supabase: ReturnType<typeof createClient>,
    integrationId: string,
    leadId: string,
    attempt: number,
    status: number | null,
    requestBody: unknown,
    responseBody: unknown,
    error: string | null,
    state: 'pending' | 'success' | 'failed' | 'retrying',
) {
    await supabase.from('webhook_logs').insert({
        integration_id: integrationId,
        lead_id: leadId,
        attempt,
        status,
        request_body: requestBody,
        response_body: responseBody,
        error,
        delivery_state: state,
    })
}

function jsonOk(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
function jsonError(status: number, message: string) {
    return new Response(JSON.stringify({ error: message }), { status, headers: { 'Content-Type': 'application/json' } })
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }
function safeJson(s: string | null) {
    if (!s) return null
    try { return JSON.parse(s) } catch { return { raw: s } }
}
