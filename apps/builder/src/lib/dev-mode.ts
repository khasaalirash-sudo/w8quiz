import { nanoid } from 'nanoid'
import type { Quiz, Question, Option, LogicRule, QuizSettings } from '@markquiz/shared'

// ─── Dev Mode Detection ──────────────────────────────

/**
 * Dev-режим активируется когда Supabase не настроен (заглушки в .env.local).
 * Позволяет пользоваться всем интерфейсом без реальной базы данных.
 */
export function isDevMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return (
    !url ||
    url === 'https://your-project.supabase.co' ||
    url.includes('your-project')
  )
}

// ─── Mock User ───────────────────────────────────────

export const DEV_USER = {
  id: 'dev-user-00000000-0000-0000-0000-000000000001',
  email: 'dev@w8quiz.io',
  created_at: '2025-01-15T10:00:00Z',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
} as const

// ─── Mock Quiz Data ──────────────────────────────────

const DEMO_QUIZ_ID = 'demo-quiz-001'
const DEMO_Q1_ID = 'demo-q-001'
const DEMO_Q2_ID = 'demo-q-002'
const DEMO_Q3_ID = 'demo-q-003'
const DEMO_LEAD_ID = 'demo-q-lead'

const DEFAULT_SETTINGS: QuizSettings = {
  accentColor: '#6C5CE7',
  showProgressBar: true,
  showQuestionCount: true,
  transition: 'slide',
  requireLeadBeforeResult: true,
}

const DEMO_QUIZ: Quiz = {
  id: DEMO_QUIZ_ID,
  user_id: DEV_USER.id,
  title: 'Какой тип бизнеса вам подходит?',
  description: 'Узнайте, какой формат бизнеса идеально соответствует вашим навыкам',
  slug: 'demo-biznes',
  settings: DEFAULT_SETTINGS,
  is_published: true,
  created_at: '2025-03-10T12:00:00Z',
  updated_at: '2025-03-15T18:30:00Z',
}

const DEMO_QUIZ_2: Quiz = {
  id: 'demo-quiz-002',
  user_id: DEV_USER.id,
  title: 'Рассчитайте стоимость ремонта',
  description: 'Калькулятор ремонта квартиры за 2 минуты',
  slug: 'remont-calc',
  settings: { ...DEFAULT_SETTINGS, accentColor: '#E17055' },
  is_published: false,
  created_at: '2025-04-01T09:00:00Z',
  updated_at: '2025-04-05T14:20:00Z',
}

const DEMO_QUESTIONS: Question[] = [
  {
    id: DEMO_Q1_ID,
    quiz_id: DEMO_QUIZ_ID,
    type: 'single',
    title: 'Какой у вас опыт в бизнесе?',
    description: 'Выберите наиболее подходящий вариант',
    position: 0,
    settings: {},
    is_required: true,
  },
  {
    id: DEMO_Q2_ID,
    quiz_id: DEMO_QUIZ_ID,
    type: 'multiple',
    title: 'Какие навыки у вас есть?',
    description: 'Можно выбрать несколько',
    position: 1,
    settings: {},
    is_required: false,
  },
  {
    id: DEMO_Q3_ID,
    quiz_id: DEMO_QUIZ_ID,
    type: 'text',
    title: 'Какой у вас бюджет для старта?',
    description: '',
    position: 2,
    settings: {},
    is_required: true,
  },
  {
    id: DEMO_LEAD_ID,
    quiz_id: DEMO_QUIZ_ID,
    type: 'lead_form',
    title: 'Получите персональный отчёт',
    position: 3,
    settings: {
      leadForm: {
        title: 'Получите персональный отчёт',
        subtitle: 'Оставьте контакты — мы пришлём результат на email',
        buttonText: 'Получить отчёт',
        fields: [
          { id: 'f-name', type: 'name', label: 'Имя', placeholder: 'Как вас зовут?', required: true },
          { id: 'f-email', type: 'email', label: 'Email', placeholder: 'your@email.com', required: true },
          { id: 'f-phone', type: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: false },
        ],
      },
    },
    is_required: true,
  },
]

const DEMO_OPTIONS: Record<string, Option[]> = {
  [DEMO_Q1_ID]: [
    { id: 'opt-1a', question_id: DEMO_Q1_ID, text: 'Нет опыта, хочу начать', position: 0 },
    { id: 'opt-1b', question_id: DEMO_Q1_ID, text: '1-3 года опыта', position: 1 },
    { id: 'opt-1c', question_id: DEMO_Q1_ID, text: 'Более 3 лет', position: 2 },
    { id: 'opt-1d', question_id: DEMO_Q1_ID, text: 'У меня уже есть бизнес', position: 3 },
  ],
  [DEMO_Q2_ID]: [
    { id: 'opt-2a', question_id: DEMO_Q2_ID, text: 'Маркетинг и продажи', position: 0 },
    { id: 'opt-2b', question_id: DEMO_Q2_ID, text: 'Программирование', position: 1 },
    { id: 'opt-2c', question_id: DEMO_Q2_ID, text: 'Дизайн', position: 2 },
    { id: 'opt-2d', question_id: DEMO_Q2_ID, text: 'Управление командой', position: 3 },
    { id: 'opt-2e', question_id: DEMO_Q2_ID, text: 'Финансы и бухгалтерия', position: 4 },
  ],
  [DEMO_Q3_ID]: [],
  [DEMO_LEAD_ID]: [],
}

const DEMO_LOGIC_RULES: LogicRule[] = [
  {
    id: 'lr-1',
    quiz_id: DEMO_QUIZ_ID,
    source_question_id: DEMO_Q1_ID,
    option_id: 'opt-1d',
    target_question_id: DEMO_Q3_ID, // Если уже есть бизнес — пропустить навыки
    condition_type: 'equals',
  },
]

// ─── Mock Data Getters ───────────────────────────────

export function getDevQuizzes(): Quiz[] {
  return [DEMO_QUIZ, DEMO_QUIZ_2]
}

export function getDevQuizPayload(quizId: string) {
  if (quizId === DEMO_QUIZ_ID || quizId === 'demo-quiz-001') {
    return {
      quiz: DEMO_QUIZ,
      questions: DEMO_QUESTIONS,
      options: DEMO_OPTIONS,
      logicRules: DEMO_LOGIC_RULES,
    }
  }
  if (quizId === 'demo-quiz-002') {
    const q1Id = 'q2-001'
    return {
      quiz: DEMO_QUIZ_2,
      questions: [
        {
          id: q1Id,
          quiz_id: 'demo-quiz-002',
          type: 'single' as const,
          title: 'Какой тип помещения?',
          position: 0,
          settings: {},
          is_required: true,
        },
      ] as Question[],
      options: {
        [q1Id]: [
          { id: 'q2-opt1', question_id: q1Id, text: 'Квартира', position: 0 },
          { id: 'q2-opt2', question_id: q1Id, text: 'Дом', position: 1 },
          { id: 'q2-opt3', question_id: q1Id, text: 'Офис', position: 2 },
        ] as Option[],
      },
      logicRules: [] as LogicRule[],
    }
  }

  // Для любого другого id (напр. созданного через createQuiz) — возвращаем пустой квиз
  const newQId = nanoid()
  const newLeadId = nanoid()
  return {
    quiz: {
      id: quizId,
      user_id: DEV_USER.id,
      title: 'Новый квиз',
      description: '',
      slug: nanoid(8),
      settings: DEFAULT_SETTINGS,
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Quiz,
    questions: [
      {
        id: newQId,
        quiz_id: quizId,
        type: 'single' as const,
        title: '',
        position: 0,
        settings: {},
        is_required: false,
      },
      {
        id: newLeadId,
        quiz_id: quizId,
        type: 'lead_form' as const,
        title: 'Оставьте контакты',
        position: 1,
        settings: {
          leadForm: {
            title: 'Получите результат',
            subtitle: 'Оставьте контакты и мы свяжемся с вами',
            buttonText: 'Отправить',
            fields: [
              { id: 'f1', type: 'name', label: 'Имя', placeholder: 'Как вас зовут?', required: true },
              { id: 'f2', type: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true },
            ],
          },
        },
        is_required: true,
      },
    ] as Question[],
    options: {
      [newQId]: [
        { id: nanoid(), question_id: newQId, text: 'Вариант 1', position: 0 },
      ] as Option[],
      [newLeadId]: [] as Option[],
    },
    logicRules: [] as LogicRule[],
  }
}

export function getDevLeads() {
  return [
    {
      id: 'lead-1',
      quiz_id: DEMO_QUIZ_ID,
      session_id: 'sess-1',
      name: 'Алексей Петров',
      email: 'alex@example.com',
      phone: '+7 (999) 123-45-67',
      custom_fields: {},
      created_at: '2025-04-08T15:30:00Z',
      quiz_title: DEMO_QUIZ.title,
      quiz_slug: DEMO_QUIZ.slug,
    },
    {
      id: 'lead-2',
      quiz_id: DEMO_QUIZ_ID,
      session_id: 'sess-2',
      name: 'Мария Иванова',
      email: 'maria@example.com',
      phone: '+7 (916) 555-88-99',
      custom_fields: {},
      created_at: '2025-04-07T11:20:00Z',
      quiz_title: DEMO_QUIZ.title,
      quiz_slug: DEMO_QUIZ.slug,
    },
    {
      id: 'lead-3',
      quiz_id: DEMO_QUIZ_ID,
      session_id: 'sess-3',
      name: 'Дмитрий Козлов',
      email: 'dmitry.k@example.com',
      phone: '',
      custom_fields: { company: 'ООО Рога и копыта' },
      created_at: '2025-04-06T09:45:00Z',
      quiz_title: DEMO_QUIZ.title,
      quiz_slug: DEMO_QUIZ.slug,
    },
    {
      id: 'lead-4',
      quiz_id: 'demo-quiz-002',
      session_id: 'sess-4',
      name: 'Ольга Смирнова',
      email: 'olga.s@gmail.com',
      phone: '+7 (903) 777-11-22',
      custom_fields: {},
      created_at: '2025-04-05T16:10:00Z',
      quiz_title: DEMO_QUIZ_2.title,
      quiz_slug: DEMO_QUIZ_2.slug ?? '',
    },
  ]
}

export function getDevAnalytics() {
  const dailySessions = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const starts = Math.floor(Math.random() * 20) + 5
    const completions = Math.floor(starts * (0.4 + Math.random() * 0.3))
    const leads = Math.floor(completions * (0.5 + Math.random() * 0.3))
    dailySessions.push({
      date: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      starts,
      completions,
      leads,
    })
  }

  const totalStarts = dailySessions.reduce((s, d) => s + d.starts, 0)
  const totalCompletions = dailySessions.reduce((s, d) => s + d.completions, 0)
  const totalLeads = dailySessions.reduce((s, d) => s + d.leads, 0)

  return {
    stats: {
      views: totalStarts + Math.floor(totalStarts * 0.2),
      starts: totalStarts,
      completions: totalCompletions,
      leads: totalLeads,
      completionRate: totalStarts > 0 ? Math.round((totalCompletions / totalStarts) * 100) : 0,
      conversionRate: totalStarts > 0 ? Math.round((totalLeads / totalStarts) * 100) : 0,
    },
    dailySessions,
    funnel: DEMO_QUESTIONS.filter((q) => q.type !== 'lead_form').map((q, i) => ({
      step: i + 1,
      questionTitle: q.title,
      answers: Math.max(1, totalStarts - i * Math.floor(totalStarts * 0.15)),
    })),
  }
}
