'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createQuizSession, submitAnswer, submitLead } from '@/lib/actions/public'
import type { PublicQuizData } from '@/lib/actions/public'
import type { Question, Option } from '@markquiz/shared'

interface QuizPlayerProps {
  data: PublicQuizData
}

export function QuizPlayer({ data }: QuizPlayerProps) {
  const { quiz, questions, options, logicRules } = data
  const accentColor = quiz.settings.accentColor ?? '#d42e5b'

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [textValue, setTextValue] = useState('')
  const [leadData, setLeadData] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sessionCreated = useRef(false)

  // Create session on mount
  useEffect(() => {
    if (sessionCreated.current) return
    sessionCreated.current = true
    createQuizSession(quiz.id).then((id) => {
      if (id) setSessionId(id)
    })
  }, [quiz.id])

  const totalSteps = questions.length
  const question = questions[currentStep]
  const questionOptions = question ? (options[question.id] ?? []) : []
  const progress = (currentStep / totalSteps) * 100

  // Logic branching: find next question based on selected option
  const getNextStep = useCallback(
    (questionId: string, selectedOptionId?: string) => {
      // Check for specific option rule first
      if (selectedOptionId) {
        const specificRule = logicRules.find(
          (r) => r.source_question_id === questionId && r.option_id === selectedOptionId,
        )
        if (specificRule) {
          if (!specificRule.target_question_id) return totalSteps // End quiz
          const targetIdx = questions.findIndex((q) => q.id === specificRule.target_question_id)
          if (targetIdx !== -1) return targetIdx
        }
      }

      // Check for wildcard rule (any answer)
      const wildcardRule = logicRules.find(
        (r) => r.source_question_id === questionId && !r.option_id,
      )
      if (wildcardRule) {
        if (!wildcardRule.target_question_id) return totalSteps
        const targetIdx = questions.findIndex((q) => q.id === wildcardRule.target_question_id)
        if (targetIdx !== -1) return targetIdx
      }

      // Default: next sequential step
      return currentStep + 1
    },
    [logicRules, questions, currentStep, totalSteps],
  )

  const saveAnswer = useCallback(
    (questionId: string, optionIds?: string[], textVal?: string) => {
      if (!sessionId) return
      submitAnswer({ sessionId, questionId, optionIds, textValue: textVal })
    },
    [sessionId],
  )

  const handleSingleSelect = useCallback(
    (optionId: string) => {
      if (!question) return
      setAnswers((prev) => ({ ...prev, [question.id]: optionId }))
      saveAnswer(question.id, [optionId])

      setTimeout(() => {
        const nextStep = getNextStep(question.id, optionId)
        setCurrentStep((s) => Math.min(nextStep, totalSteps - 1))
      }, 300)
    },
    [question, totalSteps, getNextStep, saveAnswer],
  )

  const handleMultipleToggle = useCallback(
    (optionId: string) => {
      if (!question) return
      setAnswers((prev) => {
        const current = (prev[question.id] as string[]) || []
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
        return { ...prev, [question.id]: next }
      })
    },
    [question],
  )

  const handleNext = () => {
    if (!question) return

    if (question.type === 'text') {
      setAnswers((prev) => ({ ...prev, [question.id]: textValue }))
      saveAnswer(question.id, undefined, textValue)
      setTextValue('')
    } else if (question.type === 'multiple') {
      const selected = (answers[question.id] as string[]) || []
      saveAnswer(question.id, selected)
    }

    const nextStep = getNextStep(question.id)
    if (nextStep < totalSteps) {
      setCurrentStep(nextStep)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionId || isSubmitting) return
    setIsSubmitting(true)

    // Extract lead fields by type
    const leadFields = question?.settings?.leadForm?.fields ?? []
    const name = leadFields.find((f) => f.type === 'name')?.id
    const email = leadFields.find((f) => f.type === 'email')?.id
    const phone = leadFields.find((f) => f.type === 'phone')?.id
    const customFields: Record<string, string> = {}

    for (const [fieldId, value] of Object.entries(leadData)) {
      const field = leadFields.find((f) => f.id === fieldId)
      if (field && !['name', 'email', 'phone'].includes(field.type)) {
        customFields[field.label] = value
      }
    }

    await submitLead({
      sessionId,
      quizId: quiz.id,
      name: name ? leadData[name] : undefined,
      email: email ? leadData[email] : undefined,
      phone: phone ? leadData[phone] : undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    })

    setFinished(true)
    setIsSubmitting(false)
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl shadow-neutral-200/60 p-10 max-w-md w-full text-center border border-neutral-100">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">Спасибо!</h1>
          <p className="text-neutral-500">
            Ваши ответы приняты. Менеджер свяжется с вами в ближайшее время.
          </p>
        </div>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* ── Header ── */}
      <header className="pt-8 pb-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-neutral-900">{quiz.title}</h1>
        {quiz.description && (
          <p className="text-sm text-neutral-500 mt-1">{quiz.description}</p>
        )}
      </header>

      {/* ── Progress bar ── */}
      {quiz.settings.showProgressBar && (
        <div className="px-4 max-w-lg mx-auto w-full">
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: accentColor }}
            />
          </div>
          {quiz.settings.showQuestionCount && (
            <p className="text-xs text-neutral-400 mt-2 text-right">
              {currentStep + 1} из {totalSteps}
            </p>
          )}
        </div>
      )}

      {/* ── Question Card ── */}
      <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-8">
        <div className="bg-white rounded-2xl shadow-xl shadow-neutral-200/60 p-8 max-w-lg w-full border border-neutral-100">
          {(question.settings as { imageUrl?: string } | null)?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(question.settings as { imageUrl?: string }).imageUrl!}
              alt=""
              className="w-full h-48 object-cover rounded-2xl mb-5"
            />
          )}
          <h2 className="text-xl font-bold text-neutral-900 mb-1">{question.title}</h2>
          {question.description && (
            <p className="text-sm text-neutral-400 mb-6">{question.description}</p>
          )}
          {!question.description && <div className="mb-6" />}

          {/* ── Single Choice ── */}
          {question.type === 'single' && (
            <div className="space-y-2.5">
              {questionOptions.map((opt) => {
                const selected = answers[question.id] === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSingleSelect(opt.id)}
                    style={selected ? { borderColor: accentColor, backgroundColor: `${accentColor}10`, color: accentColor } : undefined}
                    className={`w-full text-left px-5 py-3.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${selected
                        ? ''
                        : 'border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        style={selected ? { borderColor: accentColor } : undefined}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? '' : 'border-neutral-300'
                          }`}
                      >
                        {selected && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />}
                      </span>
                      {opt.text}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Multiple Choice ── */}
          {question.type === 'multiple' && (
            <>
              <div className="space-y-2.5">
                {questionOptions.map((opt) => {
                  const selected = ((answers[question.id] as string[]) || []).includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleMultipleToggle(opt.id)}
                      style={selected ? { borderColor: accentColor, backgroundColor: `${accentColor}10`, color: accentColor } : undefined}
                      className={`w-full text-left px-5 py-3.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${selected
                          ? ''
                          : 'border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50 text-neutral-700'
                        }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          style={selected ? { borderColor: accentColor, backgroundColor: accentColor } : undefined}
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${selected ? '' : 'border-neutral-300'
                            }`}
                        >
                          {selected && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {opt.text}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={handleNext}
                disabled={!answers[question.id] || (answers[question.id] as string[]).length === 0}
                className="mt-6 w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: accentColor }}
              >
                Далее
              </button>
            </>
          )}

          {/* ── Text Input ── */}
          {question.type === 'text' && (
            <>
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="Введите ваш ответ..."
                rows={4}
                className="w-full border-2 border-neutral-100 rounded-xl px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-300 focus:border-neutral-400 focus:outline-none resize-none transition-colors"
              />
              <button
                onClick={handleNext}
                className="mt-4 w-full py-3 rounded-xl text-white font-semibold text-sm transition-all"
                style={{ backgroundColor: accentColor }}
              >
                Далее
              </button>
            </>
          )}

          {/* ── Lead Form ── */}
          {question.type === 'lead_form' && question.settings?.leadForm && (
            <form onSubmit={handleSubmitLead}>
              <div className="text-center mb-6">
                <p className="text-lg font-bold text-neutral-900">{question.settings.leadForm.title}</p>
                <p className="text-sm text-neutral-400 mt-1">{question.settings.leadForm.subtitle}</p>
              </div>
              <div className="space-y-3">
                {question.settings.leadForm.fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">
                      {field.label} {field.required && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                      placeholder={field.placeholder ?? field.label}
                      required={field.required}
                      value={leadData[field.id] || ''}
                      onChange={(e) => setLeadData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border-2 border-neutral-100 rounded-xl px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-300 focus:border-neutral-400 focus:outline-none transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-5 w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? 'Отправка...' : question.settings.leadForm.buttonText}
              </button>
              {question.settings.leadForm.privacyText && (
                <p className="text-[11px] text-neutral-300 text-center mt-3">
                  {question.settings.leadForm.privacyText}
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-neutral-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
          >
            ← Назад
          </button>
          <span className="text-xs text-neutral-300">
            Создано в w8Quiz
          </span>
          {question.type === 'single' && (
            <button
              onClick={handleNext}
              disabled={!answers[question.id]}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed text-white"
              style={{ backgroundColor: accentColor }}
            >
              Далее →
            </button>
          )}
          {question.type !== 'single' && question.type !== 'lead_form' && (
            <div className="w-20" />
          )}
          {question.type === 'lead_form' && <div className="w-20" />}
        </div>
      </div>
    </div>
  )
}
