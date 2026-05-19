'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditorStore, selectSelectedQuestion } from '@/store/editorStore'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { saveQuiz } from '@/lib/actions/quiz'
import { uploadQuestionImage } from '@/lib/actions/upload'
import type { Quiz, Question, Option, LogicRule, QuestionType } from '@markquiz/shared'
import { QUESTION_TYPE_ENABLED } from '@markquiz/shared'

interface QuizEditorProps {
  quiz: Quiz
  questions: Question[]
  options: Record<string, Option[]>
  logicRules: LogicRule[]
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: 'Один вариант',
  multiple: 'Несколько',
  text: 'Текст',
  slider: 'Ползунок',
  rating: 'Рейтинг',
  date: 'Дата',
  lead_form: 'Форма',
}

const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  single: '○',
  multiple: '☑',
  text: '✎',
  slider: '⇔',
  rating: '★',
  date: '📅',
  lead_form: '📋',
}

type DesignViewport = 'desktop' | 'tablet' | 'mobile'

const VIEWPORT_FRAME: Record<DesignViewport, { w: number; h: number; label: string }> = {
  desktop: { w: 980, h: 600, label: 'Desktop' },
  tablet: { w: 768, h: 960, label: 'Tablet' },
  mobile: { w: 390, h: 844, label: 'Mobile' },
}

const DEFAULT_INTRO_BG = '/default-intro-bg.svg'
const DEFAULT_INTRO_CAR = '/default-intro-car.svg'

export function QuizEditor({ quiz, questions, options, logicRules }: QuizEditorProps) {
  const store = useEditorStore()
  const selectedQuestion = useEditorStore(selectSelectedQuestion)
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Инициализируем store при монтировании
  useEffect(() => {
    store.setQuiz(quiz)
    store.setQuestions(questions)
    Object.entries(options).forEach(([qId, opts]) => store.setOptions(qId, opts))
    store.setLogicRules(logicRules)
    if (questions.length > 0) {
      store.selectQuestion(questions[0]!.id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Автосохранение — debounce 1.5s → saveQuiz server action
  const handleSave = useCallback(async () => {
    if (!store.isDirty || store.isSaving || !store.quiz) return
    store.setIsSaving(true)
    try {
      await saveQuiz({
        quiz: store.quiz,
        questions: store.questions,
        options: store.options,
        logicRules: store.logicRules,
      })
      store.markSaved()
    } catch (e) {
      console.error('[autosave] Error:', e)
    } finally {
      store.setIsSaving(false)
    }
  }, [store])

  useEffect(() => {
    if (!store.isDirty) return
    const timer = setTimeout(handleSave, 1500)
    return () => clearTimeout(timer)
  }, [store.isDirty, handleSave])

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Left Panel: Question List ── */}
      <div className="w-72 shrink-0 border-r border-neutral-200 bg-white flex flex-col">
        {/* Panel Tabs */}
        <div className="flex border-b border-neutral-200">
          {(['questions', 'logic', 'design', 'settings'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => store.setActivePanel(panel)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${store.activePanel === panel
                ? 'border-b-2 border-accent-500 text-accent-600'
                : 'text-neutral-500 hover:text-neutral-700'
                }`}
            >
              {{
                questions: 'Вопросы',
                logic: 'Логика',
                design: 'Дизайн',
                settings: 'Настройки',
              }[panel]}
            </button>
          ))}
        </div>

        {store.activePanel === 'questions' && (
          <QuestionsList
            questions={store.questions}
            selectedId={store.selectedQuestionId}
            onSelect={store.selectQuestion}
            onReorder={store.reorderQuestions}
            onDelete={store.deleteQuestion}
          />
        )}

        {store.activePanel === 'logic' && (
          <LogicPanel />
        )}

        {store.activePanel === 'design' && (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Цвет акцента</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={store.quiz?.settings.accentColor ?? '#d42e5b'}
                  onChange={(e) => store.updateSettings({ accentColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <span className="text-sm text-neutral-600 font-mono">
                  {store.quiz?.settings.accentColor ?? '#d42e5b'}
                </span>
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Первый слайд квиза (старт)</h4>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Заголовок</label>
                <textarea
                  value={store.quiz?.settings.headerTitle ?? ''}
                  onChange={(e) => store.updateSettings({ headerTitle: e.target.value })}
                  rows={2}
                  placeholder="Покупай авто из США, вместе с W8 Shipping!"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Подзаголовок</label>
                <textarea
                  value={store.quiz?.settings.headerSubtitle ?? ''}
                  onChange={(e) => store.updateSettings({ headerSubtitle: e.target.value })}
                  rows={2}
                  placeholder="Ответьте на 3 вопроса..."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Текст кнопки старта</label>
                <input
                  type="text"
                  value={store.quiz?.settings.startButtonText ?? ''}
                  onChange={(e) => store.updateSettings({ startButtonText: e.target.value })}
                  placeholder="Получить подборку"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Фон стартового экрана</label>
                <BackgroundField
                  type={store.quiz?.settings.startBackgroundType ?? 'image'}
                  imageUrl={store.quiz?.settings.startBackgroundUrl ?? ''}
                  gradient={store.quiz?.settings.startBackgroundGradient ?? GRADIENT_PRESETS[0]!.value}
                  onTypeChange={(t) => store.updateSettings({ startBackgroundType: t })}
                  onImageChange={(url) => store.updateSettings({ startBackgroundUrl: url })}
                  onGradientChange={(g) => store.updateSettings({ startBackgroundGradient: g })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-500 mb-1.5 block">Изображение поверх (например, авто)</label>
                <ImageDropField
                  value={store.quiz?.settings.startCarImageUrl ?? ''}
                  onChange={(url) => store.updateSettings({ startCarImageUrl: url })}
                />
                {(store.quiz?.settings.startCarImageUrl ?? '').trim() && (
                  <ResponsiveWidth
                    desktop={store.quiz?.settings.startCarWidthDesktop}
                    tablet={store.quiz?.settings.startCarWidthTablet}
                    mobile={store.quiz?.settings.startCarWidthMobile}
                    onChange={(n) => store.updateSettings({
                      ...(n.desktop !== undefined && { startCarWidthDesktop: n.desktop }),
                      ...(n.tablet !== undefined && { startCarWidthTablet: n.tablet }),
                      ...(n.mobile !== undefined && { startCarWidthMobile: n.mobile }),
                    })}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Последний слайд квиза (Спасибо)</h4>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Заголовок</label>
                <input
                  type="text"
                  value={store.quiz?.settings.finalTitle ?? ''}
                  onChange={(e) => store.updateSettings({ finalTitle: e.target.value })}
                  placeholder="Спасибо!"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Текст 1</label>
                <textarea
                  value={store.quiz?.settings.finalPrimaryText ?? ''}
                  onChange={(e) => store.updateSettings({ finalPrimaryText: e.target.value })}
                  rows={2}
                  placeholder="На основе ваших ответов..."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Текст 2</label>
                <textarea
                  value={store.quiz?.settings.finalSecondaryText ?? ''}
                  onChange={(e) => store.updateSettings({ finalSecondaryText: e.target.value })}
                  rows={2}
                  placeholder="Наш эксперт свяжется с вами..."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Текст главной кнопки</label>
                <input
                  type="text"
                  value={store.quiz?.settings.resultButtonText ?? ''}
                  onChange={(e) => store.updateSettings({ resultButtonText: e.target.value })}
                  placeholder="Перейти в каталог авто"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Ссылка главной кнопки</label>
                <input
                  type="url"
                  value={store.quiz?.settings.redirectUrl ?? ''}
                  onChange={(e) => store.updateSettings({ redirectUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Ссылка на файл (или Google Drive)</label>
                <input
                  type="url"
                  value={store.quiz?.settings.resultFileUrl ?? ''}
                  onChange={(e) => store.updateSettings({ resultFileUrl: e.target.value })}
                  placeholder="https://drive.google.com/... или прямая ссылка"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Подпись ссылки/кнопки файла</label>
                <input
                  type="text"
                  value={store.quiz?.settings.resultFileLabel ?? ''}
                  onChange={(e) => store.updateSettings({ resultFileLabel: e.target.value })}
                  placeholder="Скачать файл"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                />
              </div>

              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Фон финального экрана</label>
                <BackgroundField
                  type={store.quiz?.settings.finalBackgroundType ?? 'image'}
                  imageUrl={store.quiz?.settings.finalBackgroundUrl ?? ''}
                  gradient={store.quiz?.settings.finalBackgroundGradient ?? GRADIENT_PRESETS[0]!.value}
                  onTypeChange={(t) => store.updateSettings({ finalBackgroundType: t })}
                  onImageChange={(url) => store.updateSettings({ finalBackgroundUrl: url })}
                  onGradientChange={(g) => store.updateSettings({ finalBackgroundGradient: g })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-500 mb-1.5 block">Изображение поверх (например, авто)</label>
                <ImageDropField
                  value={store.quiz?.settings.finalCarImageUrl ?? ''}
                  onChange={(url) => store.updateSettings({ finalCarImageUrl: url })}
                />
                {(store.quiz?.settings.finalCarImageUrl ?? '').trim() && (
                  <ResponsiveWidth
                    desktop={store.quiz?.settings.finalCarWidthDesktop}
                    tablet={store.quiz?.settings.finalCarWidthTablet}
                    mobile={store.quiz?.settings.finalCarWidthMobile}
                    onChange={(n) => store.updateSettings({
                      ...(n.desktop !== undefined && { finalCarWidthDesktop: n.desktop }),
                      ...(n.tablet !== undefined && { finalCarWidthTablet: n.tablet }),
                      ...(n.mobile !== undefined && { finalCarWidthMobile: n.mobile }),
                    })}
                  />
                )}
              </div>

              <div className="border-t border-neutral-100 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Декор поверх всего</h4>

                <ImageDropField
                  value={store.quiz?.settings.designImageUrl ?? ''}
                  onChange={(url) => store.updateSettings({ designImageUrl: url })}
                />

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Desktop (px)</label>
                    <input
                      type="number"
                      min={40}
                      max={1200}
                      value={store.quiz?.settings.designImageWidthDesktop ?? 320}
                      onChange={(e) => store.updateSettings({ designImageWidthDesktop: Number(e.target.value) || 320 })}
                      className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Tablet (px)</label>
                    <input
                      type="number"
                      min={40}
                      max={1000}
                      value={store.quiz?.settings.designImageWidthTablet ?? 240}
                      onChange={(e) => store.updateSettings({ designImageWidthTablet: Number(e.target.value) || 240 })}
                      className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Mobile (px)</label>
                    <input
                      type="number"
                      min={40}
                      max={800}
                      value={store.quiz?.settings.designImageWidthMobile ?? 170}
                      onChange={(e) => store.updateSettings({ designImageWidthMobile: Number(e.target.value) || 170 })}
                      className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-neutral-500 mb-1.5 block">Привязка (как в Figma)</label>
                  <select
                    value={store.quiz?.settings.designImageAnchor ?? 'center'}
                    onChange={(e) => store.updateSettings({ designImageAnchor: e.target.value as NonNullable<Quiz['settings']['designImageAnchor']> })}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="middle-left">Middle Left</option>
                    <option value="center">Center</option>
                    <option value="middle-right">Middle Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">X (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={store.quiz?.settings.designImageX ?? 50}
                      onChange={(e) => store.updateSettings({ designImageX: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 mb-1 block">Y (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={store.quiz?.settings.designImageY ?? 72}
                      onChange={(e) => store.updateSettings({ designImageY: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      className="w-full px-2.5 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400">
                  В центре перетаскивайте изображение мышью — позиция сохранится в X/Y.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Анимация</label>
              <select
                value={store.quiz?.settings.transition ?? 'slide'}
                onChange={(e) => store.updateSettings({ transition: e.target.value as 'slide' | 'fade' })}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
              >
                <option value="slide">Слайд</option>
                <option value="fade">Затухание</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={store.quiz?.settings.showProgressBar ?? true}
                onChange={(e) => store.updateSettings({ showProgressBar: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-neutral-600">Прогресс-бар</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={store.quiz?.settings.showQuestionCount ?? true}
                onChange={(e) => store.updateSettings({ showQuestionCount: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-neutral-600">Номера вопросов</span>
            </label>
          </div>
        )}

        {store.activePanel === 'settings' && (
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Название квиза</label>
              <input
                type="text"
                value={store.quiz?.title ?? ''}
                onChange={(e) => store.updateQuizMeta({ title: e.target.value } as Pick<Quiz, 'title' | 'description'>)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Описание</label>
              <textarea
                value={store.quiz?.description ?? ''}
                onChange={(e) => store.updateQuizMeta({ description: e.target.value } as Pick<Quiz, 'title' | 'description'>)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 transition-all resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={store.quiz?.settings.requireLeadBeforeResult ?? true}
                onChange={(e) => store.updateSettings({ requireLeadBeforeResult: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-neutral-600">Требовать контакты перед результатом</span>
            </label>
          </div>
        )}

        {/* Add question button */}
        <div className="p-3 border-t border-neutral-100 relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="w-full py-2.5 text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-xl hover:border-accent-400 hover:text-accent-600 transition-colors font-medium"
          >
            + Добавить вопрос
          </button>

          {showAddMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-neutral-200 shadow-lg py-1 z-50">
              {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][])
                .filter(([type]) => QUESTION_TYPE_ENABLED[type])
                .map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => {
                      store.addQuestion(type)
                      setShowAddMenu(false)
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-neutral-50 flex items-center gap-2.5 transition-colors"
                  >
                    <span className="text-base w-5 text-center text-neutral-400">{QUESTION_TYPE_ICONS[type]}</span>
                    <span className="text-neutral-700">{label}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Preview ── */}
      <div className="flex-1 min-w-0 bg-neutral-100 flex items-center justify-center overflow-auto p-8">
        {store.activePanel === 'design' ? (
          <DesignPreview />
        ) : selectedQuestion ? (
          <QuestionPreview question={selectedQuestion} />
        ) : (
          <div className="text-neutral-400 text-sm">Выберите вопрос для редактирования</div>
        )}
      </div>

      {/* ── Right Panel: Settings ── */}
      <div
        className={`shrink-0 border-l border-neutral-200 bg-white overflow-auto transition-[width,transform,opacity] duration-300 ease-in-out ${
          store.activePanel === 'questions'
            ? 'w-80 translate-x-0 opacity-100'
            : 'w-0 translate-x-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-80">
          {selectedQuestion ? (
            <QuestionSettingsPanel question={selectedQuestion} />
          ) : (
            <div className="p-6 text-center text-neutral-400 text-sm">
              <div className="text-3xl mb-3">👈</div>
              Выберите вопрос слева
            </div>
          )}
        </div>
      </div>

      {/* ── Save status ── */}
      <div className="fixed bottom-6 right-6 z-50">
        {store.isSaving && (
          <div className="bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse">
            Сохранение...
          </div>
        )}
        {!store.isSaving && !store.isDirty && store.quiz && (
          <div className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full opacity-80 shadow-lg">
            ✓ Сохранено
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Logic Panel ──────────────────────────────────────

function LogicPanel() {
  const { questions, options, logicRules, addLogicRule, updateLogicRule, deleteLogicRule } = useEditorStore()

  if (questions.length < 2) {
    return (
      <div className="flex-1 p-4">
        <div className="text-center py-12">
          <div className="text-3xl mb-3">🔀</div>
          <h3 className="font-medium text-sm mb-1">Логика ветвления</h3>
          <p className="text-xs text-neutral-500">Добавьте минимум 2 вопроса для настройки ветвления</p>
        </div>
      </div>
    )
  }

  // Group rules by source question
  const rulesBySource = new Map<string, typeof logicRules>()
  for (const rule of logicRules) {
    const existing = rulesBySource.get(rule.source_question_id) ?? []
    existing.push(rule)
    rulesBySource.set(rule.source_question_id, existing)
  }

  return (
    <div className="flex-1 overflow-auto p-3 space-y-4">
      <p className="text-xs text-neutral-400 px-1">
        Настройте переходы: при определённых ответах можно перенаправлять на другой вопрос или завершить квиз.
      </p>

      {questions.map((q, qi) => {
        const qOptions = options[q.id] ?? []
        const qRules = rulesBySource.get(q.id) ?? []

        if (q.type === 'lead_form') return null

        return (
          <div key={q.id} className="bg-neutral-50 rounded-xl border border-neutral-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-neutral-400 w-4 text-center">{qi + 1}</span>
              <span className="text-xs font-medium text-neutral-700 truncate flex-1">
                {q.title || 'Без текста'}
              </span>
            </div>

            {qRules.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {qRules.map((rule) => {
                  const optionText = qOptions.find((o) => o.id === rule.option_id)?.text
                  const targetQ = questions.find((tq) => tq.id === rule.target_question_id)

                  return (
                    <div key={rule.id} className="flex items-center gap-1.5 text-xs bg-white rounded-lg border border-neutral-200 p-2">
                      <span className="text-indigo-600 font-medium shrink-0">Если</span>
                      <select
                        value={rule.option_id ?? ''}
                        onChange={(e) =>
                          updateLogicRule(rule.id, { option_id: e.target.value || undefined })
                        }
                        className="flex-1 min-w-0 px-1.5 py-1 border border-neutral-200 rounded text-xs bg-white truncate"
                      >
                        <option value="">Любой ответ</option>
                        {qOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.text || `Вариант ${o.position + 1}`}
                          </option>
                        ))}
                      </select>
                      <span className="text-neutral-400 shrink-0">→</span>
                      <select
                        value={rule.target_question_id ?? '__end__'}
                        onChange={(e) =>
                          updateLogicRule(rule.id, {
                            target_question_id: e.target.value === '__end__' ? null : e.target.value,
                          })
                        }
                        className="flex-1 min-w-0 px-1.5 py-1 border border-neutral-200 rounded text-xs bg-white truncate"
                      >
                        {questions
                          .filter((tq) => tq.id !== q.id)
                          .map((tq, ti) => (
                            <option key={tq.id} value={tq.id}>
                              {tq.position + 1}. {tq.title || 'Без текста'}
                            </option>
                          ))}
                        <option value="__end__">🏁 Завершить квиз</option>
                      </select>
                      <button
                        onClick={() => deleteLogicRule(rule.id)}
                        className="text-neutral-400 hover:text-red-500 transition-colors shrink-0 p-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={() =>
                addLogicRule({
                  source_question_id: q.id,
                  option_id: qOptions[0]?.id,
                  target_question_id:
                    questions[qi + 2]?.id ?? questions[qi + 1]?.id ?? null,
                  condition_type: 'equals',
                })
              }
              className="w-full py-1.5 text-xs text-accent-600 hover:text-accent-700 border border-dashed border-neutral-200 hover:border-accent-300 rounded-lg transition-colors"
            >
              + Добавить правило
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Question List ────────────────────────────────────

function QuestionsList({
  questions, selectedId, onSelect, onReorder, onDelete,
}: {
  questions: Question[]
  selectedId: string | null
  onSelect: (id: string) => void
  onReorder: (from: number, to: number) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-auto p-3">
      <DragDropContext onDragEnd={(r) => {
        if (r.destination) onReorder(r.source.index, r.destination.index)
      }}>
        <Droppable droppableId="questions">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
              {questions.map((q, i) => (
                <Draggable key={q.id} draggableId={q.id} index={i}>
                  {(drag, snapshot) => (
                    <div
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      className={`group flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-sm ${selectedId === q.id
                        ? 'border-accent-300 bg-accent-50 text-accent-700 shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                        } ${snapshot.isDragging ? 'shadow-lg rotate-1' : ''}`}
                      onClick={() => onSelect(q.id)}
                    >
                      <span
                        {...drag.dragHandleProps}
                        className="text-neutral-300 cursor-grab active:cursor-grabbing"
                      >
                        ⋮⋮
                      </span>
                      <span className="text-xs font-mono text-neutral-400 shrink-0 w-4 text-center">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-neutral-700">
                        {q.title || <span className="text-neutral-400 italic">Без текста</span>}
                      </span>
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                        {QUESTION_TYPE_ICONS[q.type]}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(q.id) }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 text-xs transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}

function getAnchorTransform(anchor: NonNullable<Quiz['settings']['designImageAnchor']>) {
  switch (anchor) {
    case 'top-left': return 'translate(0%, 0%)'
    case 'top-center': return 'translate(-50%, 0%)'
    case 'top-right': return 'translate(-100%, 0%)'
    case 'middle-left': return 'translate(0%, -50%)'
    case 'center': return 'translate(-50%, -50%)'
    case 'middle-right': return 'translate(-100%, -50%)'
    case 'bottom-left': return 'translate(0%, -100%)'
    case 'bottom-center': return 'translate(-50%, -100%)'
    case 'bottom-right': return 'translate(-100%, -100%)'
    default: return 'translate(-50%, -50%)'
  }
}

function DesignPreview() {
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const [slide, setSlide] = useState<'start' | 'final'>('start')

  const posBtnBase = 'px-3 py-2 text-xs font-medium rounded-lg border-2 transition-all flex items-center gap-1.5 shadow-sm'

  return (
    <div className="w-full min-w-0 max-w-[1200px] flex flex-col items-center gap-4">
      {/* Slide toggle */}
      <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setSlide('start')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
            slide === 'start' ? 'bg-accent-500 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Первый слайд
        </button>
        <button
          type="button"
          onClick={() => setSlide('final')}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
            slide === 'final' ? 'bg-accent-500 text-white shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Последний слайд
        </button>
      </div>

      <div className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-2 justify-between">
        <div className="text-xs text-neutral-500">
          Позиция декора:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => updateSettings({ designImageAnchor: 'bottom-center', designImageX: 50, designImageY: 92 })}
            className={`${posBtnBase} border-neutral-300 bg-white text-neutral-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700`}
          >
            <span className="text-base">⬇</span> Снизу
          </button>
          <button
            onClick={() => updateSettings({ designImageAnchor: 'center', designImageX: 50, designImageY: 50 })}
            className={`${posBtnBase} border-neutral-300 bg-white text-neutral-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700`}
          >
            <span className="text-base">●</span> Центр
          </button>
          <button
            onClick={() => updateSettings({ designImageAnchor: 'middle-left', designImageX: 4, designImageY: 50 })}
            className={`${posBtnBase} border-neutral-300 bg-white text-neutral-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700`}
          >
            <span className="text-base">⬅</span> Слева
          </button>
          <button
            onClick={() => updateSettings({ designImageAnchor: 'middle-right', designImageX: 96, designImageY: 50 })}
            className={`${posBtnBase} border-neutral-300 bg-white text-neutral-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700`}
          >
            <span className="text-base">➡</span> Справа
          </button>
          <button
            onClick={() => updateSettings({ designImageAnchor: 'top-right', designImageX: 96, designImageY: 6 })}
            className={`${posBtnBase} border-neutral-300 bg-white text-neutral-700 hover:border-accent-400 hover:bg-accent-50 hover:text-accent-700`}
          >
            <span className="text-base">↗</span> Сверху справа
          </button>
        </div>
      </div>

      <div className="w-full min-w-0 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <DesignDevicePreview viewport="desktop" slide={slide} />
        <DesignDevicePreview viewport="tablet" slide={slide} />
        <DesignDevicePreview viewport="mobile" slide={slide} />
      </div>
    </div>
  )
}

function DesignDevicePreview({ viewport, slide = 'start' }: { viewport: DesignViewport; slide?: 'start' | 'final' }) {
  const settings = useEditorStore((s) => s.quiz?.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const frameRef = useRef<HTMLDivElement>(null)

  const frame = VIEWPORT_FRAME[viewport]
  const imageUrl = settings?.designImageUrl
  const anchor = settings?.designImageAnchor ?? 'center'
  const x = settings?.designImageX ?? 50
  const y = settings?.designImageY ?? 72
  const width = viewport === 'desktop'
    ? (settings?.designImageWidthDesktop ?? 320)
    : viewport === 'tablet'
      ? (settings?.designImageWidthTablet ?? 240)
      : (settings?.designImageWidthMobile ?? 170)

  const isFinal = slide === 'final'
  const bgType = (isFinal ? settings?.finalBackgroundType : settings?.startBackgroundType) ?? 'image'
  const bgGradient = ((isFinal ? settings?.finalBackgroundGradient : settings?.startBackgroundGradient) ?? '').trim()
  const bgUrl = ((isFinal ? settings?.finalBackgroundUrl : settings?.startBackgroundUrl) ?? '').trim()
  const defaultBg = isFinal ? '/default-thanks-bg.svg' : DEFAULT_INTRO_BG
  const bgImage = bgUrl || defaultBg
  const carUrl = ((isFinal ? settings?.finalCarImageUrl : settings?.startCarImageUrl) ?? '').trim()
  const defaultCar = isFinal ? '/default-thanks-car.svg' : DEFAULT_INTRO_CAR
  const car = carUrl || defaultCar
  const carWidthPct = viewport === 'desktop'
    ? (isFinal ? settings?.finalCarWidthDesktop : settings?.startCarWidthDesktop) ?? 72
    : viewport === 'tablet'
      ? (isFinal ? settings?.finalCarWidthTablet : settings?.startCarWidthTablet) ?? 72
      : (isFinal ? settings?.finalCarWidthMobile : settings?.startCarWidthMobile) ?? 72

  const title = isFinal
    ? (settings?.finalTitle || 'Спасибо!')
    : (settings?.headerTitle || 'Заголовок стартового экрана')
  const subtitle = isFinal
    ? (settings?.finalPrimaryText || 'На основе ваших ответов…')
    : (settings?.headerSubtitle || 'Подзаголовок')
  const buttonText = isFinal
    ? (settings?.resultButtonText || 'Перейти в каталог')
    : (settings?.startButtonText || 'Получить подборку')

  const box = viewport === 'desktop'
    ? { w: 360, h: 220 }
    : viewport === 'tablet'
      ? { w: 280, h: 360 }
      : { w: 220, h: 420 }

  const scale = Math.min(box.w / frame.w, box.h / frame.h)

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    const rect = frameRef.current?.getBoundingClientRect()
    if (!rect) return

    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const nx = ((ev.clientX - rect.left) / rect.width) * 100
      const ny = ((ev.clientY - rect.top) / rect.height) * 100
      updateSettings({
        designImageX: Math.min(100, Math.max(0, Number(nx.toFixed(2)))),
        designImageY: Math.min(100, Math.max(0, Number(ny.toFixed(2)))),
      })
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-sm min-w-0">
      <div className="text-xs font-medium text-neutral-600 mb-2">{VIEWPORT_FRAME[viewport].label}</div>
      <div className="relative rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden" style={{ width: box.w, height: box.h }}>
        <div
          ref={frameRef}
          className="absolute left-1/2 top-1/2 overflow-hidden rounded-md border border-neutral-300 bg-white"
          style={{
            width: frame.w,
            height: frame.h,
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {bgType === 'gradient' && bgGradient ? (
            <div className="absolute inset-0" style={{ background: bgGradient }} />
          ) : (
            <>
              <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/70" />
            </>
          )}

          <div className="absolute inset-0 z-10 flex flex-col items-center text-center px-6 pt-8">
            <W8LogoPreview />
            <h3 className="mt-6 text-white font-bold text-[34px] leading-[1.1] max-w-[620px]">
              {title}
            </h3>
            <p className="mt-4 text-white/95 text-base max-w-[520px]">
              {subtitle}
            </p>
            <button
              className="mt-6 inline-flex items-center gap-3 px-8 h-[52px] rounded-full text-white text-base font-semibold"
              style={{ backgroundColor: settings?.accentColor ?? '#d42e5b' }}
            >
              {buttonText}
            </button>
          </div>

          <img
            src={car}
            alt=""
            className="absolute bottom-0 left-1/2 -translate-x-1/2 max-w-none -scale-x-100"
            style={{ width: `${carWidthPct}%` }}
          />

          {imageUrl && (
            <img
              src={imageUrl}
              alt="Декор"
              onPointerDown={handlePointerDown}
              className="absolute z-20 cursor-grab active:cursor-grabbing select-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width,
                transform: getAnchorTransform(anchor),
                touchAction: 'none',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function W8LogoPreview() {
  return (
    <img
      src="/w8-logo-wide.svg"
      alt="W8 Shipping"
      width={137}
      height={55}
      className="select-none brightness-0 invert"
    />
  )
}

// ─── Width controls for 3 breakpoints (%) ────────────

function ResponsiveWidth({
  label = 'Ширина (%)',
  desktop, tablet, mobile,
  defDesktop = 72, defTablet = 72, defMobile = 72,
  onChange,
}: {
  label?: string
  desktop?: number; tablet?: number; mobile?: number
  defDesktop?: number; defTablet?: number; defMobile?: number
  onChange: (next: { desktop?: number; tablet?: number; mobile?: number }) => void
}) {
  return (
    <div>
      <label className="text-xs text-neutral-500 mb-1.5 block">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: 'desktop', val: desktop, def: defDesktop, label: 'Desktop' },
          { k: 'tablet', val: tablet, def: defTablet, label: 'Tablet' },
          { k: 'mobile', val: mobile, def: defMobile, label: 'Mobile' },
        ].map(({ k, val, def, label }) => (
          <div key={k}>
            <label className="text-[10px] text-neutral-400 mb-0.5 block">{label}</label>
            <input
              type="number" min={5} max={100}
              value={val ?? def}
              onChange={(e) => onChange({ [k]: Math.min(100, Math.max(5, Number(e.target.value) || def)) })}
              className="w-full px-2 py-1.5 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reusable image drop field ───────────────────────

function ImageDropField({
  value,
  onChange,
  height = 'h-28',
  hint = 'PNG, JPG, WebP · до 5 МБ',
}: {
  value: string
  onChange: (url: string) => void
  height?: string
  hint?: string
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) return setError('Не картинка')
    if (file.size > 5 * 1024 * 1024) return setError('Файл больше 5 МБ')
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await uploadQuestionImage(fd)
      if (r.error) setError(r.error)
      else if (r.url) onChange(r.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setIsUploading(false)
    }
  }, [onChange])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }

  if ((value ?? '').trim()) {
    return (
      <div className={`relative group rounded-xl overflow-hidden border border-neutral-200 ${height}`}>
        <img src={value} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button type="button" onClick={() => inputRef.current?.click()} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm">
            {isUploading ? 'Загрузка…' : 'Заменить'}
          </button>
          <button type="button" onClick={() => onChange('')} className="px-3 py-1.5 bg-red-500 rounded-lg text-xs font-medium text-white hover:bg-red-600 shadow-sm">
            Удалить
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} />
        {error && <p className="absolute bottom-1 left-2 text-[11px] text-red-600 bg-white/90 px-1 rounded">{error}</p>}
      </div>
    )
  }

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
          isDragging ? 'border-accent-400 bg-accent-50' : 'border-neutral-200 hover:border-accent-300 hover:bg-neutral-50'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className="text-xl mb-1">{isUploading ? '⏳' : isDragging ? '📥' : '🖼️'}</div>
        <p className="text-xs text-neutral-500">
          {isUploading ? 'Загружается…' : isDragging ? 'Отпустите для загрузки' : 'Drag & Drop или клик'}
        </p>
        <p className="text-[10px] text-neutral-400 mt-1">{hint}</p>
        {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} />
    </>
  )
}

// ─── Background field (image or gradient) ────────────

const GRADIENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Тёмный', value: 'linear-gradient(135deg, #1a1a1a 0%, #3a1428 100%)' },
  { label: 'Розовый', value: 'linear-gradient(135deg, #d42e5b 0%, #6a1131 100%)' },
  { label: 'Сине-фиолет', value: 'linear-gradient(135deg, #1e3a8a 0%, #6b21a8 100%)' },
  { label: 'Закат', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { label: 'Океан', value: 'linear-gradient(135deg, #0ea5e9 0%, #1e1b4b 100%)' },
  { label: 'Серый', value: 'linear-gradient(135deg, #525252 0%, #171717 100%)' },
]

function BackgroundField({
  type, imageUrl, gradient,
  onTypeChange, onImageChange, onGradientChange,
}: {
  type: 'image' | 'gradient'
  imageUrl: string
  gradient: string
  onTypeChange: (t: 'image' | 'gradient') => void
  onImageChange: (url: string) => void
  onGradientChange: (g: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-50 text-xs">
        <button type="button" onClick={() => onTypeChange('image')}
          className={`px-3 py-1 rounded-md transition-colors ${type === 'image' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          Изображение
        </button>
        <button type="button" onClick={() => onTypeChange('gradient')}
          className={`px-3 py-1 rounded-md transition-colors ${type === 'gradient' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          Градиент
        </button>
      </div>

      {type === 'image' ? (
        <ImageDropField value={imageUrl} onChange={onImageChange} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {GRADIENT_PRESETS.map((g) => (
              <button key={g.value} type="button" onClick={() => onGradientChange(g.value)}
                className={`h-12 rounded-lg border transition-all ${gradient === g.value ? 'border-accent-500 ring-2 ring-accent-200' : 'border-neutral-200 hover:border-neutral-300'}`}
                style={{ background: g.value }} title={g.label} />
            ))}
          </div>
          <input type="text" value={gradient} onChange={(e) => onGradientChange(e.target.value)}
            placeholder="linear-gradient(135deg, #..., #...)"
            className="w-full px-2.5 py-1.5 text-xs font-mono border border-neutral-200 rounded-lg outline-none focus:border-accent-400" />
        </>
      )}
    </div>
  )
}

// ─── Question Preview ─────────────────────────────────

function QuestionPreview({ question }: { question: Question }) {
  const options = useEditorStore((s) => s.options[question.id] ?? [])
  const accentColor = useEditorStore((s) => s.quiz?.settings.accentColor ?? '#6C5CE7')

  return (
    <div className="w-full max-w-lg">
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-neutral-100">
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{ width: '40%', backgroundColor: accentColor }}
          />
        </div>

        <div className="p-8">
          <div className="text-xs text-neutral-400 mb-4 font-mono">
            Вопрос {question.position + 1}
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 mb-2 text-balance">
            {question.title || <span className="text-neutral-300">Введите текст вопроса...</span>}
          </h2>

          {question.description && (
            <p className="text-sm text-neutral-500 mb-6">{question.description}</p>
          )}

          {!question.description && <div className="mb-6" />}

          {(question.type === 'single' || question.type === 'multiple') && (
            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div
                  key={opt.id}
                  className={`flex items-center gap-3 p-3.5 border rounded-xl text-sm cursor-pointer transition-all ${idx === 0
                    ? 'border-accent-300 bg-accent-50 text-accent-700'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                    }`}
                >
                  <div className={`w-4 h-4 shrink-0 border-2 flex items-center justify-center ${question.type === 'multiple' ? 'rounded' : 'rounded-full'
                    } ${idx === 0 ? 'border-accent-500' : 'border-neutral-300'}`}>
                    {idx === 0 && (
                      <div
                        className={`${question.type === 'multiple' ? 'w-2 h-2 rounded-sm' : 'w-2 h-2 rounded-full'}`}
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                  </div>
                  {opt.text || <span className="text-neutral-400 italic">Вариант {opt.position + 1}</span>}
                </div>
              ))}
            </div>
          )}

          {question.type === 'text' && (
            <textarea
              placeholder="Введите ваш ответ..."
              rows={4}
              disabled
              className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 text-sm text-neutral-400 resize-none"
            />
          )}

          {question.type === 'rating' && (
            <div className="flex gap-2 justify-center py-4">
              {Array.from({ length: question.settings.rating?.maxRating ?? 5 }).map((_, i) => (
                <span key={i} className={`text-3xl cursor-pointer transition-transform hover:scale-110 ${i < 3 ? 'text-yellow-400' : 'text-neutral-300'}`}>
                  ★
                </span>
              ))}
            </div>
          )}

          {question.type === 'lead_form' && (
            <div className="space-y-3">
              {question.settings.leadForm?.fields?.map((field) => (
                <div key={field.id}>
                  <label className="text-xs text-neutral-500 mb-1 block">{field.label}</label>
                  <input
                    type="text"
                    placeholder={field.placeholder ?? field.label}
                    disabled
                    className="w-full h-10 bg-neutral-50 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-400"
                  />
                </div>
              )) ?? (
                  <>
                    <div className="h-10 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center px-3 text-sm text-neutral-400">Имя</div>
                    <div className="h-10 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center px-3 text-sm text-neutral-400">Телефон</div>
                  </>
                )}
              <button
                className="w-full py-3 text-white rounded-xl text-sm font-medium mt-2"
                style={{ backgroundColor: accentColor }}
              >
                {question.settings.leadForm?.buttonText ?? 'Отправить'}
              </button>
              {question.settings.leadForm?.privacyText && (
                <p className="text-xs text-neutral-400 text-center">{question.settings.leadForm.privacyText}</p>
              )}
            </div>
          )}

          {question.type !== 'lead_form' && (
            <div className="flex justify-between mt-8 pt-4 border-t border-neutral-100">
              <button className="px-4 py-2 text-sm text-neutral-500 rounded-lg hover:bg-neutral-50 transition-colors">
                ← Назад
              </button>
              <button
                className="px-6 py-2 text-sm text-white rounded-lg font-medium transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                Далее →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Question Settings Panel ──────────────────────────

function QuestionSettingsPanel({ question }: { question: Question }) {
  const { updateQuestion, addOption, updateOption, deleteOption } = useEditorStore()
  const options = useEditorStore((s) => s.options[question.id] ?? [])

  return (
    <div className="p-5 space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-lg">{QUESTION_TYPE_ICONS[question.type]}</span>
        <span className="text-sm font-medium text-neutral-700">{QUESTION_TYPE_LABELS[question.type]}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-500 ml-auto">
          #{question.position + 1}
        </span>
      </div>

      <div className="h-px bg-neutral-100" />

      <div>
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
          Вопрос
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Текст вопроса</label>
            <textarea
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              placeholder="Какой стиль кухни вам ближе?"
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 transition-all resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 mb-1.5 block">Описание (необязательно)</label>
            <input
              type="text"
              value={question.description ?? ''}
              onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
              placeholder="Уточнение к вопросу"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-xl outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={question.is_required}
              onChange={(e) => updateQuestion(question.id, { is_required: e.target.checked })}
              className="w-4 h-4 rounded accent-accent-500"
            />
            <span className="text-sm text-neutral-600">Обязательный вопрос</span>
          </label>
        </div>
      </div>

      {(question.type === 'single' || question.type === 'multiple') && (
        <div>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
            Варианты ответов
          </h3>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-2 group">
                <span className="text-xs text-neutral-400 w-4 shrink-0 text-center">{idx + 1}</span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateOption(question.id, opt.id, { text: e.target.value })}
                  placeholder={`Вариант ${idx + 1}`}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 transition-all"
                />
                <button
                  onClick={() => deleteOption(question.id, opt.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => addOption(question.id)}
              className="w-full py-2 text-sm text-accent-600 hover:text-accent-700 border border-dashed border-neutral-200 hover:border-accent-300 rounded-lg transition-colors"
            >
              + Добавить вариант
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
          Изображение
        </h3>
        <ImageUpload question={question} />
      </div>
    </div>
  )
}

// ─── Image Upload with Drag & Drop ───────────────────

function ImageUpload({ question }: { question: Question }) {
  const updateQuestion = useEditorStore((s) => s.updateQuestion)
  const settings = (question.settings ?? {}) as Record<string, unknown>
  const savedUrl = (settings.imageUrl as string | undefined) ?? null

  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const setImageUrl = (url: string | null) => {
    const newSettings = { ...(question.settings ?? {}) } as Record<string, unknown>
    if (url) newSettings.imageUrl = url
    else delete newSettings.imageUrl
    updateQuestion(question.id, { settings: newSettings as Question['settings'] })
  }

  const processFile = useCallback(async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Не картинка')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл больше 5 МБ')
      return
    }
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadQuestionImage(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.url) {
        setImageUrl(result.url)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setIsUploading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleClick = () => inputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setImageUrl(null)
  }

  if (savedUrl) {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-neutral-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={savedUrl} alt="Изображение вопроса" className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={handleClick} className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm">
            {isUploading ? 'Загрузка…' : 'Заменить'}
          </button>
          <button onClick={handleRemove} className="px-3 py-1.5 bg-red-500 rounded-lg text-xs font-medium text-white hover:bg-red-600 shadow-sm">
            Удалить
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
      </div>
    )
  }

  return (
    <>
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-accent-400 bg-accent-50 scale-[1.02]'
            : 'border-neutral-200 hover:border-accent-300 hover:bg-neutral-50'
        } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <div className={`text-2xl mb-2 transition-transform ${isDragging ? 'scale-125' : ''}`}>
          {isUploading ? '⏳' : isDragging ? '📥' : '🖼️'}
        </div>
        <p className="text-xs text-neutral-500">
          {isUploading
            ? 'Загружается…'
            : isDragging
            ? 'Отпустите для загрузки'
            : 'Перетащите или нажмите для загрузки'}
        </p>
        <p className="text-[10px] text-neutral-400 mt-1">PNG, JPG, WebP · до 5 МБ</p>
        {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
