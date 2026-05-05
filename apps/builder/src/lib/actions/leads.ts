'use server'

import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@markquiz/shared'
import { isDevMode, getDevLeads, getDevAnalytics } from '@/lib/dev-mode'

export interface LeadWithQuiz extends Lead {
  quiz_title: string
  quiz_slug: string
}

export async function getLeads(quizId?: string): Promise<LeadWithQuiz[]> {
  if (isDevMode()) return getDevLeads() as LeadWithQuiz[]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Get all quiz ids for this user
  const { data: userQuizzes } = await supabase
    .from('quizzes')
    .select('id, title, slug')
    .eq('user_id', user.id)

  if (!userQuizzes || userQuizzes.length === 0) return []

  const quizIds = quizId
    ? [quizId].filter((id) => userQuizzes.some((q) => q.id === id))
    : userQuizzes.map((q) => q.id)

  if (quizIds.length === 0) return []

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .in('quiz_id', quizIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[getLeads]', error)
    return []
  }

  const quizMap = new Map(userQuizzes.map((q) => [q.id, q]))

  return (leads ?? []).map((lead) => {
    const quiz = quizMap.get(lead.quiz_id)
    return {
      ...lead,
      quiz_title: quiz?.title ?? 'Удалённый квиз',
      quiz_slug: quiz?.slug ?? '',
    } as LeadWithQuiz
  })
}

// ─── Analytics data ──────────────────────────────────

export interface AnalyticsData {
  stats: {
    views: number
    starts: number
    completions: number
    leads: number
    completionRate: number
    conversionRate: number
  }
  dailySessions: Array<{
    date: string
    starts: number
    completions: number
    leads: number
  }>
  funnel: Array<{
    step: number
    questionTitle: string
    answers: number
  }>
}

export async function getAnalytics(quizId: string): Promise<AnalyticsData> {
  if (isDevMode()) return getDevAnalytics()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const empty: AnalyticsData = {
    stats: { views: 0, starts: 0, completions: 0, leads: 0, completionRate: 0, conversionRate: 0 },
    dailySessions: [],
    funnel: [],
  }

  if (!user) return empty

  // Verify quiz belongs to user
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id')
    .eq('id', quizId)
    .eq('user_id', user.id)
    .single()

  if (!quiz) return empty

  // Get sessions for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: sessions } = await supabase
    .from('quiz_sessions')
    .select('id, started_at, completed_at')
    .eq('quiz_id', quizId)
    .gte('started_at', thirtyDaysAgo.toISOString())
    .order('started_at')

  const { data: leads } = await supabase
    .from('leads')
    .select('id, created_at, session_id')
    .eq('quiz_id', quizId)
    .gte('created_at', thirtyDaysAgo.toISOString())

  const allSessions = sessions ?? []
  const allLeads = leads ?? []

  const starts = allSessions.length
  const completions = allSessions.filter((s) => s.completed_at).length
  const leadsCount = allLeads.length

  // Daily breakdown
  const dailyMap = new Map<string, { starts: number; completions: number; leads: number }>()

  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap.set(key, { starts: 0, completions: 0, leads: 0 })
  }

  for (const s of allSessions) {
    const key = s.started_at.slice(0, 10)
    const entry = dailyMap.get(key)
    if (entry) {
      entry.starts++
      if (s.completed_at) entry.completions++
    }
  }

  for (const l of allLeads) {
    const key = l.created_at.slice(0, 10)
    const entry = dailyMap.get(key)
    if (entry) entry.leads++
  }

  const dailySessions = Array.from(dailyMap.entries()).map(([date, data]) => {
    const d = new Date(date)
    return {
      date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      ...data,
    }
  })

  // Funnel: count answers per question
  const { data: questions } = await supabase
    .from('questions')
    .select('id, title, position, type')
    .eq('quiz_id', quizId)
    .order('position')

  const funnel: AnalyticsData['funnel'] = []

  if (questions && questions.length > 0) {
    const sessionIds = allSessions.map((s) => s.id)

    if (sessionIds.length > 0) {
      const { data: answers } = await supabase
        .from('answers')
        .select('question_id, session_id')
        .in('session_id', sessionIds)

      const answerCounts = new Map<string, number>()
      const answeredPairs = new Set<string>()
      for (const a of (answers ?? [])) {
        const key = `${a.question_id}:${a.session_id}`
        if (answeredPairs.has(key)) continue
        answeredPairs.add(key)
        answerCounts.set(a.question_id, (answerCounts.get(a.question_id) ?? 0) + 1)
      }

      const leadSessionIds = new Set((allLeads ?? []).map((l) => l.session_id).filter(Boolean))

      for (const q of questions) {
        funnel.push({
          step: q.position + 1,
          questionTitle: q.title || `Вопрос ${q.position + 1}`,
          answers: q.type === 'lead_form' ? leadSessionIds.size : (answerCounts.get(q.id) ?? 0),
        })
      }
    } else {
      for (const q of questions) {
        funnel.push({
          step: q.position + 1,
          questionTitle: q.title || `Вопрос ${q.position + 1}`,
          answers: 0,
        })
      }
    }
  }

  return {
    stats: {
      views: starts, // approximate: views ≈ starts for now
      starts,
      completions,
      leads: leadsCount,
      completionRate: starts > 0 ? Math.round((completions / starts) * 100) : 0,
      conversionRate: starts > 0 ? Math.round((leadsCount / starts) * 100) : 0,
    },
    dailySessions,
    funnel,
  }
}
