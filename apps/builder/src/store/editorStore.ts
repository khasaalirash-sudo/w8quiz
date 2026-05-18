import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Quiz, Question, Option, LogicRule, QuestionType, QuizSettings } from '@markquiz/shared'

// ─── State Shape ─────────────────────────────────────

interface EditorState {
  // Данные квиза
  quiz: Quiz | null
  questions: Question[]
  options: Record<string, Option[]>    // question_id → options[]
  logicRules: LogicRule[]

  // UI-состояние
  selectedQuestionId: string | null
  isDirty: boolean          // Есть несохранённые изменения
  isSaving: boolean
  activePanel: 'questions' | 'logic' | 'design' | 'settings'

  // Actions
  setQuiz: (quiz: Quiz) => void
  setQuestions: (questions: Question[]) => void
  setOptions: (questionId: string, options: Option[]) => void
  setLogicRules: (rules: LogicRule[]) => void

  // Вопросы
  addQuestion: (type: QuestionType) => void
  updateQuestion: (id: string, patch: Partial<Question>) => void
  deleteQuestion: (id: string) => void
  reorderQuestions: (fromIndex: number, toIndex: number) => void
  selectQuestion: (id: string | null) => void

  // Варианты ответов
  addOption: (questionId: string) => void
  updateOption: (questionId: string, optionId: string, patch: Partial<Option>) => void
  deleteOption: (questionId: string, optionId: string) => void
  reorderOptions: (questionId: string, fromIndex: number, toIndex: number) => void

  // Логика ветвления
  addLogicRule: (rule: Omit<LogicRule, 'id' | 'quiz_id'>) => void
  updateLogicRule: (id: string, patch: Partial<LogicRule>) => void
  deleteLogicRule: (id: string) => void

  // Настройки квиза
  updateSettings: (patch: Partial<QuizSettings>) => void
  updateQuizMeta: (patch: Pick<Quiz, 'title' | 'description'>) => void

  // Персистентность
  markSaved: () => void
  setIsSaving: (val: boolean) => void
  setActivePanel: (panel: EditorState['activePanel']) => void
}

// ─── Store ───────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    quiz: null,
    questions: [],
    options: {},
    logicRules: [],
    selectedQuestionId: null,
    isDirty: false,
    isSaving: false,
    activePanel: 'questions',

    setQuiz: (quiz) => set((s) => { s.quiz = quiz }),
    setQuestions: (questions) => set((s) => { s.questions = questions }),
    setOptions: (qId, opts) => set((s) => { s.options[qId] = opts }),
    setLogicRules: (rules) => set((s) => { s.logicRules = rules }),

    // ── Вопросы ─────────────────────────────────────

    addQuestion: (type) => set((s) => {
      if (!s.quiz) return
      const id = crypto.randomUUID()
      const defaultSettings: Question['settings'] =
        type === 'lead_form'
          ? {
            leadForm: {
              title: 'Оставьте контакты',
              subtitle: 'Менеджер свяжется с вами',
              buttonText: 'Отправить',
              fields: [
                { id: crypto.randomUUID(), type: 'name', label: 'Имя', placeholder: 'Имя', required: true },
                { id: crypto.randomUUID(), type: 'phone', label: 'Телефон', placeholder: '+7 ...', required: true },
                { id: crypto.randomUUID(), type: 'email', label: 'Email', placeholder: 'you@example.com', required: false },
              ],
              privacyText: 'Нажимая кнопку, вы соглашаетесь с обработкой персональных данных',
            },
          }
          : {}
      const newQ: Question = {
        id,
        quiz_id: s.quiz.id,
        type,
        title: type === 'lead_form' ? 'Контакты' : '',
        position: s.questions.length,
        settings: defaultSettings,
        is_required: type === 'lead_form',
        created_at: new Date().toISOString(),
      }
      s.questions.push(newQ)
      s.options[id] = type === 'single' || type === 'multiple'
        ? [{ id: crypto.randomUUID(), question_id: id, text: '', position: 0 }]
        : []
      s.selectedQuestionId = id
      s.isDirty = true
    }),

    updateQuestion: (id, patch) => set((s) => {
      const idx = s.questions.findIndex((q) => q.id === id)
      if (idx === -1) return
      Object.assign(s.questions[idx]!, patch)
      s.isDirty = true
    }),

    deleteQuestion: (id) => set((s) => {
      s.questions = s.questions.filter((q) => q.id !== id)
      // Перенумеровываем позиции
      s.questions.forEach((q, i) => { q.position = i })
      delete s.options[id]
      s.logicRules = s.logicRules.filter(
        (r) => r.source_question_id !== id && r.target_question_id !== id,
      )
      if (s.selectedQuestionId === id) s.selectedQuestionId = null
      s.isDirty = true
    }),

    reorderQuestions: (from, to) => set((s) => {
      const [moved] = s.questions.splice(from, 1)
      if (!moved) return
      s.questions.splice(to, 0, moved)
      s.questions.forEach((q, i) => { q.position = i })
      s.isDirty = true
    }),

    selectQuestion: (id) => set((s) => { s.selectedQuestionId = id }),

    // ── Варианты ─────────────────────────────────────

    addOption: (questionId) => set((s) => {
      const opts = s.options[questionId] ?? []
      opts.push({
        id: crypto.randomUUID(),
        question_id: questionId,
        text: '',
        position: opts.length,
      })
      s.options[questionId] = opts
      s.isDirty = true
    }),

    updateOption: (qId, optId, patch) => set((s) => {
      const opts = s.options[qId]
      if (!opts) return
      const idx = opts.findIndex((o) => o.id === optId)
      if (idx !== -1) Object.assign(opts[idx]!, patch)
      s.isDirty = true
    }),

    deleteOption: (qId, optId) => set((s) => {
      if (!s.options[qId]) return
      s.options[qId] = s.options[qId]!.filter((o) => o.id !== optId)
      s.options[qId]!.forEach((o, i) => { o.position = i })
      s.logicRules = s.logicRules.filter((r) => r.option_id !== optId)
      s.isDirty = true
    }),

    reorderOptions: (qId, from, to) => set((s) => {
      const opts = s.options[qId]
      if (!opts) return
      const [moved] = opts.splice(from, 1)
      if (!moved) return
      opts.splice(to, 0, moved)
      opts.forEach((o, i) => { o.position = i })
      s.isDirty = true
    }),

    // ── Логика ───────────────────────────────────────

    addLogicRule: (rule) => set((s) => {
      if (!s.quiz) return
      s.logicRules.push({ ...rule, id: crypto.randomUUID(), quiz_id: s.quiz.id })
      s.isDirty = true
    }),

    updateLogicRule: (id, patch) => set((s) => {
      const idx = s.logicRules.findIndex((r) => r.id === id)
      if (idx !== -1) Object.assign(s.logicRules[idx]!, patch)
      s.isDirty = true
    }),

    deleteLogicRule: (id) => set((s) => {
      s.logicRules = s.logicRules.filter((r) => r.id !== id)
      s.isDirty = true
    }),

    // ── Настройки ────────────────────────────────────

    updateSettings: (patch) => set((s) => {
      if (!s.quiz) return
      Object.assign(s.quiz.settings, patch)
      s.isDirty = true
    }),

    updateQuizMeta: (patch) => set((s) => {
      if (!s.quiz) return
      Object.assign(s.quiz, patch)
      s.isDirty = true
    }),

    markSaved: () => set((s) => { s.isDirty = false }),
    setIsSaving: (val) => set((s) => { s.isSaving = val }),
    setActivePanel: (panel) => set((s) => { s.activePanel = panel }),
  })),
)

// ─── Selectors ───────────────────────────────────────

export const selectSelectedQuestion = (s: EditorState) =>
  s.questions.find((q) => q.id === s.selectedQuestionId) ?? null

export const selectOptionsForQuestion = (questionId: string) =>
  (s: EditorState) => s.options[questionId] ?? []

export const selectLogicForQuestion = (questionId: string) =>
  (s: EditorState) => s.logicRules.filter((r) => r.source_question_id === questionId)
