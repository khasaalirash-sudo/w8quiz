import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `
Ты — эксперт по созданию квизов для лидогенерации.
Создай структуру квиза для бизнеса пользователя.

Правила:
- 3-5 вопросов типа single (один вариант из 2-4)
- Последний вопрос ВСЕГДА типа lead_form
- Вопросы должны квалифицировать клиента и выявлять потребность
- Тон дружелюбный, вопросы конкретные
- Финальный оффер (lead_form.title) — конкретная выгода для клиента

Ответь ТОЛЬКО валидным JSON следующей структуры (без markdown):
{
  "title": "Название квиза",
  "questions": [
    {
      "type": "single",
      "title": "Текст вопроса",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3"]
    },
    {
      "type": "lead_form",
      "title": "Заголовок финального экрана",
      "lead_title": "Заголовок формы",
      "lead_subtitle": "Подзаголовок формы",
      "lead_button": "Текст кнопки"
    }
  ]
}
`

/**
 * POST /functions/v1/ai-generate
 * Генерирует структуру квиза через OpenAI GPT-4o-mini.
 *
 * Body: { prompt: string, userId: string }
 * Auth: Bearer token (Supabase JWT)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  // Проверяем авторизацию
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.prompt?.trim()) {
    return Response.json({ error: 'prompt required' }, { status: 400, headers: CORS })
  }

  // AI генерация
  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: body.prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    })

    const generated = JSON.parse(completion.choices[0]!.message.content!)

    // Сохраняем квиз в БД через service role (обходим RLS)
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const slug = `quiz-${Date.now()}`
    const { data: quiz, error: quizError } = await serviceSupabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title: generated.title,
        slug,
        settings: { accentColor: '#6366f1', showProgressBar: true, showQuestionCount: true, transition: 'slide', requireLeadBeforeResult: false },
      })
      .select()
      .single()

    if (quizError || !quiz) throw quizError

    // Вставляем вопросы и варианты
    for (let i = 0; i < generated.questions.length; i++) {
      const q = generated.questions[i]
      const settings = q.type === 'lead_form'
        ? {
          leadForm: {
            title: q.lead_title,
            subtitle: q.lead_subtitle,
            buttonText: q.lead_button,
            fields: [
              { id: 'name', type: 'name', label: 'Имя', required: true },
              { id: 'phone', type: 'phone', label: 'Телефон', required: true },
            ],
          },
        }
        : {}

      const { data: question } = await serviceSupabase
        .from('questions')
        .insert({
          quiz_id: quiz.id,
          type: q.type,
          title: q.title,
          position: i,
          settings,
          is_required: true,
        })
        .select()
        .single()

      if (question && q.options) {
        await serviceSupabase.from('options').insert(
          q.options.map((text: string, pos: number) => ({
            question_id: question.id,
            text,
            position: pos,
          }))
        )
      }
    }

    return Response.json({ quizId: quiz.id, slug }, { headers: CORS })
  } catch (err) {
    console.error(err)
    return Response.json({ error: 'Generation failed' }, { status: 500, headers: CORS })
  }
})
