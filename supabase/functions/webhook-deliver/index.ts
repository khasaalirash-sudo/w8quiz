import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * webhook-deliver — фоновая Edge Function
 *
 * Вызывается через pg_net (Database Webhook) при INSERT в таблицу leads.
 * Доставляет лид во все активные интеграции квиза.
 *
 * Порядок обработки:
 * 1. Читаем интеграции квиза (тип + конфиг)
 * 2. Для каждой интеграции вызываем соответствующий handler
 * 3. Ошибки отдельных интеграций не останавливают остальные
 */
Deno.serve(async (req: Request) => {
  const { record } = await req.json()
  const lead = record as {
    id: string; quiz_id: string; session_id: string;
    name?: string; email?: string; phone?: string;
    custom_fields: Record<string, string>; created_at: string
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Загружаем ответы пользователя для обогащения webhook-payload
  const { data: answers } = await supabase
    .from('answers')
    .select('question_id, option_ids, text_value, questions(title)')
    .eq('session_id', lead.session_id)

  // Загружаем активные интеграции
  const { data: integrations } = await supabase
    .from('integrations')
    .select('*')
    .eq('quiz_id', lead.quiz_id)
    .eq('is_active', true)

  if (!integrations?.length) return new Response('ok')

  const payload = { lead, answers: answers ?? [] }

  await Promise.allSettled(
    integrations.map((integration) => deliverTo(integration, payload))
  )

  return new Response('ok')
})

// ─── Delivery handlers ────────────────────────────────

async function deliverTo(
  integration: { type: string; config: Record<string, unknown> },
  payload: unknown,
) {
  switch (integration.type) {
    case 'webhook':
      return deliverWebhook(integration.config, payload)
    case 'telegram_bot':
      return deliverTelegram(integration.config, payload)
    default:
      console.log(`Integration type ${integration.type} not yet implemented`)
  }
}

async function deliverWebhook(
  config: Record<string, unknown>,
  payload: unknown,
) {
  const url = config.url as string
  if (!url) throw new Error('webhook.url not configured')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.headers as Record<string, string> ?? {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`Webhook delivery failed: ${res.status}`)
}

async function deliverTelegram(
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
) {
  const botToken = config.bot_token as string
  const chatId = config.chat_id as string
  if (!botToken || !chatId) throw new Error('telegram config incomplete')

  const lead = (payload as { lead: Record<string, unknown> }).lead
  const text = [
    '🔔 *Новый лид*',
    lead.name ? `👤 ${lead.name}` : '',
    lead.phone ? `📱 ${lead.phone}` : '',
    lead.email ? `📧 ${lead.email}` : '',
  ].filter(Boolean).join('\n')

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}
