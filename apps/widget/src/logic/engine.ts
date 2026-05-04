import type { QuizPayload, Question, LogicRule } from '../types'

/**
 * Движок логики ветвления квиза.
 *
 * Принцип работы:
 * 1. Для текущего вопроса ищем LogicRule, где source_question_id совпадает
 *    и option_id совпадает с выбранным вариантом.
 * 2. Если правило найдено → переходим на target_question_id.
 * 3. Если target_question_id === null → квиз завершён.
 * 4. Если правила нет → следующий вопрос по порядку (position + 1).
 */
export function createEngine(payload: QuizPayload) {
  const questions = [...payload.questions].sort((a, b) => a.position - b.position)
  const logicMap = buildLogicMap(payload.logic)

  let currentIndex = $state(0)

  function currentQuestion(): Question | null {
    return questions[currentIndex] ?? null
  }

  function progress(): number {
    return Math.round((currentIndex / Math.max(questions.length, 1)) * 100)
  }

  /**
   * Определяет следующий шаг после ответа на вопрос.
   * @returns id следующего вопроса | 'lead_form' | 'result'
   */
  function next(questionId: string, selectedOptionIds: string[]): string | 'lead_form' | 'result' {
    // Проверяем правила ветвления
    for (const optionId of selectedOptionIds) {
      const key = `${questionId}:${optionId}`
      const rule = logicMap.get(key) ?? logicMap.get(`${questionId}:*`)

      if (rule) {
        if (rule.target_question_id === null) return 'result'
        const targetQ = questions.find((q) => q.id === rule.target_question_id)
        if (targetQ?.type === 'lead_form') return 'lead_form'
        return rule.target_question_id
      }
    }

    // Нет правил → следующий по порядку
    const nextQ = questions[currentIndex + 1]
    if (!nextQ) return 'result'
    if (nextQ.type === 'lead_form') return 'lead_form'
    return nextQ.id
  }

  function goTo(questionId: string) {
    const idx = questions.findIndex((q) => q.id === questionId)
    if (idx !== -1) currentIndex = idx
  }

  return {
    currentQuestion,
    currentIndex: () => currentIndex,
    progress,
    next,
    goTo,
  }
}

/**
 * Строим Map для O(1) поиска правил по ключу "questionId:optionId".
 * Для wildcard-правил (option_id === null) используем ключ "questionId:*".
 */
function buildLogicMap(rules: LogicRule[]): Map<string, LogicRule> {
  const map = new Map<string, LogicRule>()
  for (const rule of rules) {
    const key = rule.option_id
      ? `${rule.source_question_id}:${rule.option_id}`
      : `${rule.source_question_id}:*`
    map.set(key, rule)
  }
  return map
}
