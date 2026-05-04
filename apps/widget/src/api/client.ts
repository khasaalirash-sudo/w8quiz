import type { QuizPayload } from '../types'

/**
 * Лёгкий HTTP-клиент для виджета.
 * Все запросы идут в Supabase Edge Functions через /api/* прокси.
 *
 * ВАЖНО: клиент использует анонимный fetch, без авторизации.
 * Защита от спама — rate limiting на уровне Edge Function.
 */
export function apiClient(base: string) {
  const API = `${base}/api/widget`

  async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => 'Network error')
      throw new Error(msg)
    }
    return res.json() as Promise<T>
  }

  return {
    /**
     * Загружает полный payload квиза одним запросом (quiz + questions + options + logic).
     * Кэшируется на CDN 60 секунд для снижения нагрузки на БД.
     */
    async getQuiz(quizId: string): Promise<QuizPayload> {
      return request(`/quiz/${quizId}`)
    },

    /**
     * Создаёт сессию и возвращает её ID.
     * UTM-параметры сохраняются для аналитики.
     */
    async startSession(
      quizId: string,
      utm: { utm_source?: string; utm_medium?: string; utm_campaign?: string; referrer?: string },
    ): Promise<string> {
      const { sessionId } = await request<{ sessionId: string }>(`/session`, {
        method: 'POST',
        body: JSON.stringify({ quizId, ...utm, userAgent: navigator.userAgent }),
      })
      return sessionId
    },

    /** Записывает ответ на вопрос (fire-and-forget в виджете) */
    async submitAnswer(
      sessionId: string,
      questionId: string,
      optionIds: string[],
      textValue?: string,
    ): Promise<void> {
      await request(`/answer`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, questionId, optionIds, textValue }),
      })
    },

    /** Отмечает сессию как завершённую */
    async completeSession(sessionId: string): Promise<void> {
      await request(`/session/${sessionId}/complete`, { method: 'PATCH' })
    },

    /** Сохраняет контактные данные лида */
    async submitLead(
      sessionId: string,
      quizId: string,
      lead: { name?: string; email?: string; phone?: string; custom: Record<string, string> },
    ): Promise<void> {
      await request(`/lead`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, quizId, ...lead }),
      })
    },
  }
}
