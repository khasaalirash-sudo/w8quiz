'use server'

import { createClient } from '@supabase/supabase-js'
import type { Quiz, Question, Option, LogicRule } from '@markquiz/shared'

async function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

// ─── Public quiz fetch by slug ───────────────────────

export interface PublicQuizData {
  quiz: Quiz
  questions: Question[]
  options: Record<string, Option[]>
  logicRules: LogicRule[]
}

export async function getPublicQuiz(slug: string): Promise<PublicQuizData | null> {
  const supabase = await createServiceClient()

  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (error || !quiz) return null

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quiz.id)
    .order('position')

  const questionIds = (questions ?? []).map((q: Question) => q.id)

  const { data: allOptions } = questionIds.length > 0
    ? await supabase.from('options').select('*').in('question_id', questionIds).order('position')
    : { data: [] }

  const { data: logicRules } = await supabase
    .from('logic_rules')
    .select('*')
    .eq('quiz_id', quiz.id)

  const options: Record<string, Option[]> = {}
  for (const opt of (allOptions ?? []) as Option[]) {
    if (!options[opt.question_id]) options[opt.question_id] = []
    options[opt.question_id]!.push(opt)
  }

  return {
    quiz: quiz as Quiz,
    questions: (questions ?? []) as Question[],
    options,
    logicRules: (logicRules ?? []) as LogicRule[],
  }
}

// ─── Create quiz session ─────────────────────────────

export async function createQuizSession(quizId: string) {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({
      quiz_id: quizId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createQuizSession]', error)
    return null
  }
  return data.id as string
}

// ─── Submit answer ───────────────────────────────────

export async function submitAnswer(params: {
  sessionId: string
  questionId: string
  optionIds?: string[]
  textValue?: string
}) {
  const supabase = await createServiceClient()

  const { error } = await supabase.from('answers').insert({
    session_id: params.sessionId,
    question_id: params.questionId,
    option_ids: params.optionIds ?? [],
    text_value: params.textValue ?? null,
  })

  if (error) console.error('[submitAnswer]', error)
}

// ─── Submit lead ─────────────────────────────────────

export async function submitLead(params: {
  sessionId: string
  quizId: string
  name?: string
  email?: string
  phone?: string
  customFields?: Record<string, string>
}) {
  const supabase = await createServiceClient()

  // Mark session as completed
  await supabase
    .from('quiz_sessions')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', params.sessionId)

  // Insert lead
  const { error } = await supabase.from('leads').insert({
    quiz_id: params.quizId,
    session_id: params.sessionId,
    name: params.name ?? null,
    email: params.email ?? null,
    phone: params.phone ?? null,
    custom_fields: params.customFields ?? {},
  })

  if (error) {
    console.error('[submitLead]', error)
    return { success: false }
  }
  return { success: true }
}
