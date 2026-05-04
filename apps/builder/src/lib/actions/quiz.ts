'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { nanoid } from 'nanoid'
import type { Quiz, Question, Option, LogicRule, QuizSettings } from '@markquiz/shared'
import { isDevMode, getDevQuizzes, getDevQuizPayload } from '@/lib/dev-mode'

// ─── Quiz CRUD ───────────────────────────────────────

const DEFAULT_SETTINGS: QuizSettings = {
  accentColor: '#d42e5b',
  showProgressBar: true,
  showQuestionCount: true,
  transition: 'slide',
  requireLeadBeforeResult: true,
}

export async function getQuizzes() {
  if (isDevMode()) return getDevQuizzes()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('[getQuizzes]', error)
    return []
  }
  return data as Quiz[]
}

export async function createQuiz() {
  if (isDevMode()) {
    // В dev-режиме создаём квиз с новым id и переходим в редактор
    const fakeId = 'demo-quiz-' + nanoid(6)
    redirect(`/quiz/${fakeId}/editor`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const slug = nanoid(8)

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      user_id: user.id,
      title: 'Новый квиз',
      slug,
      settings: DEFAULT_SETTINGS,
      is_published: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[createQuiz]', error)
    throw new Error(error.message)
  }

  // Создаём первый вопрос и форму лидов
  const q1Id = nanoid()
  const leadId = nanoid()

  await supabase.from('questions').insert([
    {
      id: q1Id,
      quiz_id: data.id,
      type: 'single',
      title: '',
      position: 0,
      settings: {},
      is_required: false,
    },
    {
      id: leadId,
      quiz_id: data.id,
      type: 'lead_form',
      title: 'Оставьте контакты',
      position: 1,
      settings: {
        leadForm: {
          title: 'Получите результат',
          subtitle: 'Оставьте контакты и мы свяжемся с вами',
          buttonText: 'Отправить',
          fields: [
            { id: nanoid(), type: 'name', label: 'Имя', placeholder: 'Как вас зовут?', required: true },
            { id: nanoid(), type: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true },
          ],
        },
      },
      is_required: true,
    },
  ])

  // Дефолтный вариант ответа для первого вопроса
  await supabase.from('options').insert({
    id: nanoid(),
    question_id: q1Id,
    text: 'Вариант 1',
    position: 0,
  })

  redirect(`/quiz/${data.id}/editor`)
}

// ─── Full quiz load for editor ───────────────────────

export async function getQuizPayload(quizId: string) {
  if (isDevMode()) return getDevQuizPayload(quizId)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Параллельные запросы — quiz + questions + logic
  const [quizRes, questionsRes, logicRes] = await Promise.all([
    supabase.from('quizzes').select('*').eq('id', quizId).eq('user_id', user.id).single(),
    supabase.from('questions').select('*').eq('quiz_id', quizId).order('position'),
    supabase.from('logic_rules').select('*').eq('quiz_id', quizId),
  ])

  if (quizRes.error || !quizRes.data) return null

  const quiz = quizRes.data as Quiz
  const questions = (questionsRes.data ?? []) as Question[]

  // Получаем options для всех вопросов (отдельный запрос, т.к. зависит от question ids)
  const questionIds = questions.map((q) => q.id)
  const { data: allOptions } = questionIds.length > 0
    ? await supabase.from('options').select('*').in('question_id', questionIds).order('position')
    : { data: [] }

  const options: Record<string, Option[]> = {}
  for (const opt of (allOptions ?? []) as Option[]) {
    if (!options[opt.question_id]) options[opt.question_id] = []
    options[opt.question_id]!.push(opt)
  }

  const logicRules = (logicRes.data ?? []) as LogicRule[]

  return { quiz, questions, options, logicRules }
}

// ─── Save quiz from editor ───────────────────────────

export async function saveQuiz(payload: {
  quiz: Quiz
  questions: Question[]
  options: Record<string, Option[]>
  logicRules: LogicRule[]
}) {
  if (isDevMode()) {
    console.log('[DEV] saveQuiz called (mock — data not persisted)')
    return { success: true }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { quiz, questions, options, logicRules } = payload

  // 1. Update quiz
  const { error: quizError } = await supabase
    .from('quizzes')
    .update({
      title: quiz.title,
      description: quiz.description,
      slug: quiz.slug,
      settings: quiz.settings,
      is_published: quiz.is_published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quiz.id)
    .eq('user_id', user.id)

  if (quizError) throw new Error(quizError.message)

  // 2. Upsert questions (delete removed, upsert existing)
  const { data: existingQuestions } = await supabase
    .from('questions')
    .select('id')
    .eq('quiz_id', quiz.id)

  const existingQIds = new Set((existingQuestions ?? []).map((q: { id: string }) => q.id))
  const currentQIds = new Set(questions.map((q) => q.id))

  // Delete removed questions
  const toDeleteQ = [...existingQIds].filter((id) => !currentQIds.has(id))
  if (toDeleteQ.length > 0) {
    await supabase.from('questions').delete().in('id', toDeleteQ)
  }

  // Upsert all current questions
  if (questions.length > 0) {
    const { error } = await supabase.from('questions').upsert(
      questions.map((q) => ({
        id: q.id,
        quiz_id: quiz.id,
        type: q.type,
        title: q.title,
        description: q.description,
        image_url: q.image_url,
        position: q.position,
        settings: q.settings,
        is_required: q.is_required,
      })),
      { onConflict: 'id' },
    )
    if (error) {
      console.error('[saveQuiz] questions upsert:', error)
      throw new Error(`questions: ${error.message}`)
    }
  }

  // 3. Upsert options
  const allOptions = Object.values(options).flat()
  const allQIds = questions.map((q) => q.id)

  if (allQIds.length > 0) {
    // Get existing options for these questions
    const { data: existingOpts } = await supabase
      .from('options')
      .select('id')
      .in('question_id', allQIds)

    const existingOptIds = new Set((existingOpts ?? []).map((o: { id: string }) => o.id))
    const currentOptIds = new Set(allOptions.map((o) => o.id))

    const toDeleteOpts = [...existingOptIds].filter((id) => !currentOptIds.has(id))
    if (toDeleteOpts.length > 0) {
      await supabase.from('options').delete().in('id', toDeleteOpts)
    }

    if (allOptions.length > 0) {
      await supabase.from('options').upsert(
        allOptions.map((o) => ({
          id: o.id,
          question_id: o.question_id,
          text: o.text,
          image_url: o.image_url,
          score: o.score,
          position: o.position,
        })),
        { onConflict: 'id' },
      )
    }
  }

  // 4. Replace logic rules (delete all + insert)
  await supabase.from('logic_rules').delete().eq('quiz_id', quiz.id)
  if (logicRules.length > 0) {
    await supabase.from('logic_rules').insert(
      logicRules.map((r) => ({
        id: r.id,
        quiz_id: quiz.id,
        source_question_id: r.source_question_id,
        option_id: r.option_id,
        target_question_id: r.target_question_id,
        condition_type: r.condition_type,
      })),
    )
  }

  return { success: true }
}

// ─── Publish quiz ────────────────────────────────────

export async function publishQuiz(quizId: string) {
  if (isDevMode()) return { slug: 'demo-' + nanoid(6) }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Генерируем новый slug если его нет
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('slug')
    .eq('id', quizId)
    .eq('user_id', user.id)
    .single()

  const slug = quiz?.slug || nanoid(8)

  const { error } = await supabase
    .from('quizzes')
    .update({
      is_published: true,
      slug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quizId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  return { slug }
}

// ─── Delete quiz ─────────────────────────────────────

export async function deleteQuiz(quizId: string) {
  if (isDevMode()) {
    console.log('[DEV] deleteQuiz called for', quizId)
    return
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', quizId)
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
}
