// ─────────────────────────────────────────────
// Core domain types for MarkQuiz
// These are shared between builder app and widget
// ─────────────────────────────────────────────

export type QuestionType =
  | 'single'     // Radio buttons — один вариант
  | 'multiple'   // Checkboxes — несколько вариантов
  | 'text'       // Свободный ввод текста
  | 'slider'     // Ползунок с числовым диапазоном
  | 'rating'     // Звезды / шкала оценки
  | 'date'       // Выбор даты
  | 'lead_form'  // Форма сбора контактов (финальный шаг)

/**
 * Какие типы вопросов доступны в продакшене.
 * Disabled — типы, для которых ещё нет полного рендеринга в плеере.
 * Скрываются из меню добавления в редакторе.
 */
export const QUESTION_TYPE_ENABLED: Record<QuestionType, boolean> = {
  single: true,
  multiple: true,
  text: true,
  lead_form: true,
  slider: false,
  rating: false,
  date: false,
}

export const ENABLED_QUESTION_TYPES: QuestionType[] = (
  Object.keys(QUESTION_TYPE_ENABLED) as QuestionType[]
).filter((t) => QUESTION_TYPE_ENABLED[t])

// ─── Quiz ────────────────────────────────────

export interface QuizSettings {
  /** Цвет акцента кнопок и выборов */
  accentColor: string
  /** Заголовок стартового экрана */
  headerTitle?: string
  /** Подзаголовок стартового экрана */
  headerSubtitle?: string
  /** Текст CTA на стартовом экране */
  startButtonText?: string
  /** Фон стартового экрана */
  startBackgroundUrl?: string
  /** Изображение авто на стартовом экране */
  startCarImageUrl?: string

  /** Заголовок финального экрана */
  finalTitle?: string
  /** Основной текст финального экрана */
  finalPrimaryText?: string
  /** Дополнительный текст финального экрана */
  finalSecondaryText?: string
  /** Фон финального экрана */
  finalBackgroundUrl?: string
  /** Изображение авто на финальном экране */
  finalCarImageUrl?: string

  /** Дополнительное изображение #1 (декор/бренд-элемент) */
  designImageUrl?: string
  /** Привязка как в Figma constraints */
  designImageAnchor?:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
  /** X-координата в % контейнера (0-100) */
  designImageX?: number
  /** Y-координата в % контейнера (0-100) */
  designImageY?: number
  /** Ширина изображения для разных брейкпоинтов (px) */
  designImageWidthDesktop?: number
  designImageWidthTablet?: number
  designImageWidthMobile?: number

  /** URL логотипа для брендирования */
  logoUrl?: string
  /** Текст кнопки на финальном экране */
  resultButtonText?: string
  /** URL редиректа после отправки формы */
  redirectUrl?: string
  /** Прямая ссылка на файл/Google Drive (показать рядом кнопку открытия/скачивания) */
  resultFileUrl?: string
  /** Подпись кнопки файла */
  resultFileLabel?: string
  /** Показывать прогресс-бар */
  showProgressBar: boolean
  /** Показывать номер вопроса */
  showQuestionCount: boolean
  /** Анимация перехода: slide | fade */
  transition: 'slide' | 'fade'
  /** Запрет на просмотр без заполнения формы */
  requireLeadBeforeResult: boolean
}

export interface Quiz {
  id: string
  user_id: string
  title: string
  description?: string
  /** Уникальный slug для URL вида /q/{slug} */
  slug: string
  settings: QuizSettings
  is_published: boolean
  created_at: string
  updated_at: string
}

// ─── Question ────────────────────────────────

export interface SliderSettings {
  min: number
  max: number
  step: number
  unit?: string      // "руб.", "м²", "лет"
  showValue: boolean
}

export interface RatingSettings {
  maxRating: number
  icon: 'star' | 'heart' | 'thumb'
}

export interface LeadFormField {
  id: string
  type: 'name' | 'email' | 'phone' | 'custom_text'
  label: string
  placeholder?: string
  required: boolean
}

export interface LeadFormSettings {
  title?: string
  subtitle?: string
  buttonText: string
  fields: LeadFormField[]
  /** Текст политики конфиденциальности */
  privacyText?: string
  privacyUrl?: string
}

export interface QuestionSettings {
  slider?: SliderSettings
  rating?: RatingSettings
  leadForm?: LeadFormSettings
  /** Максимум выборов для multiple */
  maxChoices?: number
}

export interface Question {
  id: string
  quiz_id: string
  type: QuestionType
  title: string
  description?: string
  /** Ключ изображения в Supabase Storage */
  image_url?: string
  /** Порядок отображения (0-based) */
  position: number
  settings: QuestionSettings
  is_required: boolean
  created_at?: string
}

// ─── Option ──────────────────────────────────

export interface Option {
  id: string
  question_id: string
  text: string
  /** Ключ изображения в Supabase Storage */
  image_url?: string
  /** Условная точка начисления баллов (для квизов-тестов) */
  score?: number
  position: number
}

// ─── Logic Branching ─────────────────────────

/**
 * Правило ветвления логики квиза.
 * Если на question с id=source_question_id выбран option с id=option_id,
 * то следующий вопрос — target_question_id.
 * Если target_question_id === null — показываем результат.
 */
export interface LogicRule {
  id: string
  quiz_id: string
  source_question_id: string
  option_id: string | null   // null = правило применяется ко всем вариантам
  target_question_id: string | null  // null = завершить квиз
  condition_type: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
}

// ─── Full Quiz Payload (for widget rendering) ─

/**
 * Полный объект квиза, загружаемый виджетом одним запросом.
 * Оптимизирован для минимального количества round-trips.
 */
export interface QuizPayload {
  quiz: Quiz
  questions: Question[]
  options: Option[]       // все варианты для всех вопросов
  logic: LogicRule[]
}

// ─── Session & Analytics ─────────────────────

export interface QuizSession {
  id: string
  quiz_id: string
  started_at: string
  completed_at?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer?: string
  user_agent?: string
}

export interface Answer {
  id: string
  session_id: string
  question_id: string
  /** Для single/multiple — массив выбранных option_id */
  option_ids: string[]
  /** Для text/slider/rating — строковое значение */
  text_value?: string
  created_at: string
}

// ─── Lead ────────────────────────────────────

export interface Lead {
  id: string
  session_id: string
  quiz_id: string
  name?: string
  email?: string
  phone?: string
  /** Данные из кастомных полей lead_form */
  custom_fields: Record<string, string>
  created_at: string
}

/**
 * Полный лид с историей ответов для отображения в CRM/дашборде.
 */
export interface LeadWithAnswers extends Lead {
  answers: Answer[]
  session: QuizSession
}

// ─── Analytics ───────────────────────────────

export interface QuizStats {
  quiz_id: string
  views: number
  starts: number
  completions: number
  leads: number
  /** Процент дошедших до конца */
  completion_rate: number
  /** Процент оставивших контакты */
  conversion_rate: number
  /** Средняя глубина просмотра (кол-во вопросов) */
  avg_depth: number
}

export interface StepFunnelItem {
  question_id: string
  question_title: string
  position: number
  views: number
  answers: number
  drops: number
  drop_rate: number
}

// ─── Integrations ────────────────────────────

export type IntegrationType =
  | 'webhook'
  | 'email_notify'
  | 'amocrm'
  | 'bitrix24'
  | 'telegram_bot'
  | 'google_sheets'

export interface Integration {
  id: string
  quiz_id: string
  type: IntegrationType
  name: string
  config: Record<string, unknown>
  is_active: boolean
  created_at: string
}

// ─── API responses ───────────────────────────

export interface ApiSuccess<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: { message: string; code?: string }
}

export type ApiResult<T> = ApiSuccess<T> | ApiError
