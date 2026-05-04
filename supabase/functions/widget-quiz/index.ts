import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * GET /api/widget/quiz/:id
 *
 * Возвращает полный QuizPayload для виджета одним запросом.
 * Кэшируется на CDN 60 секунд через Cache-Control.
 *
 * Не требует авторизации — квиз должен быть опубликован (is_published=true).
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url = new URL(req.url)
  const quizId = url.pathname.split('/').at(-1)

  if (!quizId) {
    return Response.json({ error: 'quiz_id required' }, { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Параллельные запросы
  const [quizRes, questionsRes, logicRes] = await Promise.all([
    supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('is_published', true)
      .single(),
    supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('position'),
    supabase
      .from('logic_rules')
      .select('*')
      .eq('quiz_id', quizId),
  ])

  if (quizRes.error || !quizRes.data) {
    return Response.json({ error: 'Quiz not found' }, { status: 404, headers: CORS })
  }

  const questionIds = questionsRes.data?.map((q: { id: string }) => q.id) ?? []
  const { data: options } = questionIds.length > 0
    ? await supabase.from('options').select('*').in('question_id', questionIds).order('position')
    : { data: [] }

  const payload = {
    quiz: quizRes.data,
    questions: questionsRes.data ?? [],
    options: options ?? [],
    logic: logicRes.data ?? [],
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      // Кэш на CDN: 60 сек свежий, 300 сек stale-while-revalidate
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
})
