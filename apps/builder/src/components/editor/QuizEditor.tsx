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
          <div className="flex-1 p-4 space-y-4">
            <div>
              <label className="text-xs text-neutral-500 mb-1.5 block">Цвет акцента</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={store.quiz?.settings.accentColor ?? '#6C5CE7'}
                  onChange={(e) => store.updateSettings({ accentColor: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <span className="text-sm text-neutral-600 font-mono">
                  {store.quiz?.settings.accentColor ?? '#6C5CE7'}
                </span>
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
          <div className="flex-1 p-4 space-y-4">
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
      <div className="flex-1 bg-neutral-100 flex items-center justify-center overflow-auto p-8">
        {selectedQuestion ? (
          <QuestionPreview question={selectedQuestion} />
        ) : (
          <div className="text-neutral-400 text-sm">Выберите вопрос для редактирования</div>
        )}
      </div>

      {/* ── Right Panel: Settings ── */}
      <div className="w-80 shrink-0 border-l border-neutral-200 bg-white overflow-auto">
        {selectedQuestion ? (
          <QuestionSettingsPanel question={selectedQuestion} />
        ) : (
          <div className="p-6 text-center text-neutral-400 text-sm">
            <div className="text-3xl mb-3">👈</div>
            Выберите вопрос слева
          </div>
        )}
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
