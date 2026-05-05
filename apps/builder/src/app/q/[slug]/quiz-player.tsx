'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createQuizSession, submitAnswer, submitLead } from '@/lib/actions/public'
import type { PublicQuizData } from '@/lib/actions/public'
import type { Question } from '@markquiz/shared'

// W8 Shipping logo — styled text version matching the Figma design
// W8 Shipping logo — exact SVG from brand assets
function W8Logo() {
  return (
    <img
      src="/w8-logo-wide.svg"
      alt="W8 Shipping"
      width={137}
      height={55}
      className="select-none"
    />
  )
}

interface QuizPlayerProps {
  data: PublicQuizData
}

export function QuizPlayer({ data }: QuizPlayerProps) {
  const DEFAULT_INTRO_BG = 'https://www.figma.com/api/mcp/asset/60bfc1ce-85ba-4c3d-bf86-13bd829986fe'
  const DEFAULT_INTRO_CAR = 'https://www.figma.com/api/mcp/asset/55b82c09-de7c-4ea5-85b8-4a3b1ac49eed'
  const DEFAULT_THANKS_BG = 'https://www.figma.com/api/mcp/asset/88184ce4-0f14-4c43-8b94-07b2412fe96e'
  const DEFAULT_THANKS_CAR = 'https://www.figma.com/api/mcp/asset/9d79789a-9d1c-433d-9142-4b878331c104'
  const DEFAULT_WA_ICON = 'https://www.figma.com/api/mcp/asset/da489e22-d3af-40e4-82e8-658e4c4f82ac'
  const DEFAULT_IG_ICON = 'https://www.figma.com/api/mcp/asset/3ef523b3-39fa-4320-ba86-4616de3edd9f'

  const { quiz, questions, options, logicRules } = data
  const accentColor = quiz.settings.accentColor ?? '#d42e5b'

  const introBg = quiz.settings.startBackgroundUrl || DEFAULT_INTRO_BG
  const introCar = quiz.settings.startCarImageUrl || DEFAULT_INTRO_CAR
  const introTitle = quiz.settings.headerTitle || 'Покупай авто из США, вместе с W8 Shipping!'
  const introSubtitle = quiz.settings.headerSubtitle || 'Ответьте на 3 вопроса - и получите подборку эксклюзивных и премиальных авто из США!'
  const introButtonText = quiz.settings.startButtonText || 'Получить подборку'

  const thanksBg = quiz.settings.finalBackgroundUrl || DEFAULT_THANKS_BG
  const thanksCar = quiz.settings.finalCarImageUrl || DEFAULT_THANKS_CAR
  const thanksTitle = quiz.settings.finalTitle || 'Спасибо!'
  const thanksPrimaryText = quiz.settings.finalPrimaryText || 'На основе ваших ответов мы уже подбираем для вас самые лучшие варианты авто из США.'
  const thanksSecondaryText = quiz.settings.finalSecondaryText || 'Наш эксперт свяжется с вами в течение рабочего дня и покажет реальные автомобили с аукционов, соответствующих вашему бюджету.'
  const resultButtonText = quiz.settings.resultButtonText || 'Перейти в каталог авто'
  const resultUrl = quiz.settings.redirectUrl || 'https://w8shipping.kz/'
  const resultFileUrl = quiz.settings.resultFileUrl || ''
  const resultFileLabel = quiz.settings.resultFileLabel || 'Скачать файл'

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStarted, setIsStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [textValue, setTextValue] = useState('')
  const [leadData, setLeadData] = useState<Record<string, string>>({})
  const [consentAccepted, setConsentAccepted] = useState(false)
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
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0

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

      const nextStep = getNextStep(question.id, optionId)
      if (nextStep < totalSteps && nextStep !== currentStep) {
        setCurrentStep(nextStep)
      }
    },
    [question, totalSteps, getNextStep, saveAnswer, currentStep],
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
    if (nextStep < totalSteps && nextStep !== currentStep) {
      setCurrentStep(nextStep)
    }
  }

  const handleBack = () => {
    if (currentStep === 0) {
      setIsStarted(false)
      return
    }
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
      <div className="min-h-screen relative overflow-hidden">
        {/* Background */}
        <img src={thanksBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/80" />

        {/* Logo */}
        <div className="relative z-10 pt-10 flex justify-center">
          <W8Logo />
        </div>

        {/* White card */}
        <div className="relative z-10 mx-auto max-w-[660px] mt-6 px-4">
          <div className="bg-white rounded-[40px] shadow-[0_6px_40px_rgba(0,0,0,0.1)] px-6 md:px-14 pt-10 pb-[220px] md:pb-[260px] relative overflow-hidden text-center">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <span className="text-4xl">✌️</span>
            </div>

            <h1 className="text-[40px] md:text-[48px] font-extrabold text-black leading-[1.1]">
              {thanksTitle}
            </h1>

            <p className="mt-5 text-base md:text-lg leading-[1.55] text-black max-w-[438px] mx-auto">
              {thanksPrimaryText}
            </p>
            <p className="mt-4 text-base md:text-lg leading-[1.55] text-black max-w-[520px] mx-auto">
              {thanksSecondaryText}
            </p>

            {/* Buttons row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={resultUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-3 px-7 h-[55px] rounded-full text-white text-base font-semibold"
                style={{ backgroundColor: accentColor }}
              >
                {resultButtonText}
                <span className="h-7 w-[37px] rounded-full border border-white inline-flex items-center justify-center text-sm">→</span>
              </a>

              {resultFileUrl && (
                <>
                  <a
                    href={resultFileUrl}
                    download
                    className="inline-flex items-center gap-2 px-5 h-[55px] rounded-full border text-sm font-semibold"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    ↓ {resultFileLabel}
                  </a>
                  <a
                    href={resultFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 h-[55px] rounded-full border text-sm font-semibold"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    ↗ Открыть ссылку
                  </a>
                </>
              )}

              <a
                href="https://wa.me/+77072570703"
                target="_blank"
                rel="noreferrer"
                className="h-[46px] w-[46px] rounded-full border-2 bg-white overflow-hidden inline-flex items-center justify-center flex-shrink-0"
                style={{ borderColor: accentColor }}
              >
                <img src={DEFAULT_WA_ICON} alt="WhatsApp" className="w-[33px] h-[33px] object-contain" />
              </a>

              <a
                href="https://instagram.com/w8shipping_kazakhstan"
                target="_blank"
                rel="noreferrer"
                className="h-[46px] w-[46px] rounded-full border-2 bg-white overflow-hidden inline-flex items-center justify-center flex-shrink-0"
                style={{ borderColor: accentColor }}
              >
                <img src={DEFAULT_IG_ICON} alt="Instagram" className="w-[33px] h-[33px] object-contain" />
              </a>
            </div>

            {/* Car image pinned to bottom-left */}
            <img
              src={thanksCar}
              alt=""
              className="absolute bottom-0 left-0 w-[420px] md:w-[734px] max-w-none -scale-x-100"
            />
          </div>
        </div>
      </div>
    )
  }

  if (!isStarted) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background */}
        <img src={introBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/80" />

        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-10 min-h-screen">
          {/* Logo */}
          <W8Logo />

          <h1 className="mt-8 text-white font-extrabold text-[40px] md:text-[48px] leading-[1.1] max-w-[560px]">
            {introTitle}
          </h1>

          <p className="mt-5 text-white text-base md:text-lg leading-[1.55] max-w-[438px]">
            {introSubtitle}
          </p>

          <button
            onClick={() => setIsStarted(true)}
            className="mt-8 inline-flex items-center gap-3 px-8 h-[55px] rounded-full text-white text-base font-semibold"
            style={{ backgroundColor: accentColor }}
          >
            {introButtonText}
            <span className="h-7 w-[37px] rounded-full border border-white inline-flex items-center justify-center text-sm">→</span>
          </button>

          {/* Car image — large, overflows horizontally, pinned to bottom */}
          <div className="mt-auto w-full overflow-hidden">
            <img
              src={introCar}
              alt=""
              className="w-[900px] md:w-[1525px] max-w-none mx-auto -scale-x-100"
            />
          </div>
        </div>
      </div>
    )
  }

  if (!question) return null

  const leadForm = (question.settings as {
    leadForm?: {
      title?: string
      subtitle?: string
      buttonText?: string
      privacyText?: string
      fields: Array<{
        id: string
        type: 'name' | 'email' | 'phone' | 'custom_text'
        label: string
        placeholder?: string
        required: boolean
      }>
    }
  } | null)?.leadForm
  const isLead = question.type === 'lead_form' && !!leadForm

  return (
    <div className="min-h-screen bg-[#d42e5b] px-5 pt-8 md:pt-10 text-center">
      <div className="text-white font-black text-6xl leading-none mb-4">w8</div>

      <div className="mx-auto max-w-[760px] bg-white rounded-t-[40px] shadow-[0_6px_40px_rgba(0,0,0,0.1)] min-h-[740px] md:min-h-[760px] px-5 md:px-10 pt-7 md:pt-10 flex flex-col">
        <h2 className="text-black font-extrabold text-3xl md:text-[40px] leading-[1.15] text-balance">
          {question.title}
        </h2>
        <p className="mt-4 text-black text-base md:text-[28px] md:leading-[1.35]">
          {question.description || 'Выберите наиболее подходящий ответ к вашим пожеланиям:'}
        </p>

        <div className="mt-6 text-left">
          {(question.settings as { imageUrl?: string } | null)?.imageUrl && (
            <img
              src={(question.settings as { imageUrl?: string }).imageUrl!}
              alt=""
              className="w-full h-52 object-cover rounded-2xl mb-4"
            />
          )}

          {question.type === 'single' && (
            <div className="space-y-2.5 md:space-y-3">
              {questionOptions.map((opt) => {
                const selected = answers[question.id] === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSingleSelect(opt.id)}
                    style={selected ? { borderColor: accentColor } : { borderColor: '#efefef' }}
                    className={`w-full text-left px-4 md:px-5 py-3 md:py-4 rounded-[36px] border bg-[#f9f8ff] transition text-black text-base md:text-2xl font-medium flex items-center justify-between ${selected
                      ? 'font-semibold'
                      : ''
                      }`}
                  >
                    <span>{opt.text}</span>
                    <span className="h-6 w-6 md:h-7 md:w-7 rounded-full border inline-flex items-center justify-center" style={{ borderColor: accentColor }}>
                      {selected && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accentColor }} />}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {question.type === 'multiple' && (
            <>
              <div className="space-y-2.5 md:space-y-3">
                {questionOptions.map((opt) => {
                  const selected = ((answers[question.id] as string[]) || []).includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleMultipleToggle(opt.id)}
                      style={selected ? { borderColor: accentColor } : { borderColor: '#efefef' }}
                      className={`w-full text-left px-4 md:px-5 py-3 md:py-4 rounded-[36px] border bg-[#f9f8ff] transition text-black text-base md:text-2xl font-medium flex items-center justify-between ${selected
                        ? 'font-semibold'
                        : ''
                        }`}
                    >
                      <span>{opt.text}</span>
                      <span className="h-6 w-6 md:h-7 md:w-7 rounded-full border inline-flex items-center justify-center" style={{ borderColor: accentColor }}>
                        {selected && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accentColor }} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {question.type === 'text' && (
            <>
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="Введите ваш ответ..."
                rows={4}
                className="w-full border border-[#d5d5d5] bg-[#f9f8ff] rounded-[20px] px-4 py-3 text-base md:text-xl text-black placeholder:text-neutral-500 focus:border-[#bdbdbd] focus:outline-none resize-none transition-colors"
              />
            </>
          )}

          {isLead && (
            <form onSubmit={handleSubmitLead}>
              <div className="text-center mb-5">
                <p className="text-xl md:text-[44px] font-extrabold text-black leading-[1.1]">
                  {leadForm?.title || 'Получите подборку авто под ваш бюджет'}
                </p>
                <p className="text-base md:text-[28px] md:leading-[1.35] text-black mt-3">
                  {leadForm?.subtitle || 'Спасибо за ответы! Теперь просто оставьте контакт - и получите подборку эксклюзивных авто из США с ценой, сроками и условиями:'}
                </p>
              </div>

              <div className="space-y-3 md:space-y-4">
                {leadForm?.fields.map((field) => (
                  <div key={field.id}>
                    {field.type === 'phone' ? (
                      <div className="flex gap-2 md:gap-3">
                        <div className="h-[54px] md:h-[64px] w-[84px] md:w-[108px] rounded-l-[36px] rounded-r-[8px] border border-[#d5d5d5] bg-[#f9f8ff] flex items-center justify-center text-black text-sm md:text-lg">
                          🇰🇿 +7
                        </div>
                        <input
                          type="tel"
                          required={field.required}
                          value={leadData[field.id] || ''}
                          onChange={(e) => setLeadData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.placeholder ?? 'Введите номер телефона'}
                          className="h-[54px] md:h-[64px] flex-1 rounded-l-[8px] rounded-r-[36px] border border-[#d5d5d5] bg-[#f9f8ff] px-4 text-base md:text-xl text-black placeholder:text-neutral-500 focus:border-[#bdbdbd] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : 'text'}
                        placeholder={field.placeholder ?? field.label}
                        required={field.required}
                        value={leadData[field.id] || ''}
                        onChange={(e) => setLeadData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                        className="w-full h-[54px] md:h-[64px] border border-[#d5d5d5] bg-[#f9f8ff] rounded-[36px] px-4 text-base md:text-xl text-black placeholder:text-neutral-500 focus:border-[#bdbdbd] focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || (leadForm?.privacyText ? !consentAccepted : false)}
                className="mt-6 w-full h-[55px] md:h-[64px] rounded-full text-white font-semibold text-base md:text-2xl transition-all disabled:opacity-50"
                style={{ backgroundColor: accentColor }}
              >
                {isSubmitting ? 'Отправка...' : (leadForm?.buttonText || 'Получить варианты!')}
              </button>

              {leadForm?.privacyText && (
                <label className="mt-5 flex items-start gap-3 text-black text-sm md:text-lg leading-[1.4] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded-full border border-[#d42e5b] accent-[#d42e5b]"
                  />
                  <span>{leadForm.privacyText}</span>
                </label>
              )}
            </form>
          )}
        </div>

        {!isLead && question.type !== 'single' && (
          <button
            onClick={handleNext}
            disabled={
              (question.type === 'multiple' && (!answers[question.id] || (answers[question.id] as string[]).length === 0)) ||
              (question.type === 'text' && textValue.trim().length === 0)
            }
            className="mt-6 w-full h-[55px] md:h-[64px] rounded-full text-white font-semibold text-base md:text-2xl transition-all disabled:opacity-50"
            style={{ backgroundColor: accentColor }}
          >
            {currentStep === totalSteps - 1 ? 'Последний шаг' : 'Далее'}
          </button>
        )}

        <div className="mt-auto pt-8 pb-6">
          <div className="h-[2px] bg-[#e7e7e7] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: accentColor }} />
          </div>

          <div className="mt-3 flex items-center justify-between text-black text-sm md:text-lg">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2"
            >
              <span className="h-7 w-7 rounded-full bg-[#f2f3f8] inline-flex items-center justify-center" style={{ color: accentColor }}>‹</span>
              Назад
            </button>
            <span className="font-semibold" style={{ color: accentColor }}>{Math.min(currentStep + 1, totalSteps)}/{totalSteps}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
