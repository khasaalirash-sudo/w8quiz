import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * POST /api/widget/session
 * Создаёт сессию квиза. Вызывается виджетом при открытии.
 *
 * Body: { quizId, utm_source?, utm_medium?, utm_campaign?, referrer?, userAgent? }
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const body = await req.json().catch(() => null)
  if (!body?.quizId) {
    return Response.json({ error: 'quizId required' }, { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({
      quiz_id:      body.quizId,
      utm_source:   body.utm_source,
      utm_medium:   body.utm_medium,
      utm_campaign: body.utm_campaign,
      referrer:     body.referrer,
      user_agent:   body.userAgent,
      // Хэшируем IP для соответствия GDPR
      ip_hash: await hashIp(req.headers.get('x-forwarded-for') ?? ''),
    })
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS })
  }

  return Response.json({ sessionId: data.id }, { headers: CORS })
})

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
