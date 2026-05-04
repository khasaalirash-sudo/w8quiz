<script lang="ts">
  import { onMount } from 'svelte'
  import type { QuizPayload } from './types'
  import { createEngine } from './logic/engine'
  import QuestionStep from './components/QuestionStep.svelte'
  import LeadForm from './components/LeadForm.svelte'
  import ResultScreen from './components/ResultScreen.svelte'
  import { apiClient } from './api/client'

  // ── Props ────────────────────────────────────────────
  const {
    quizId,
    trigger = 'auto',
    apiBase = 'https://api.markquiz.io',
  }: { quizId: string; trigger: string; apiBase: string } = $props()

  // ── State ────────────────────────────────────────────
  let payload    = $state<QuizPayload | null>(null)
  let sessionId  = $state<string | null>(null)
  let isOpen     = $state(trigger === 'inline')
  let isLoading  = $state(true)
  let error      = $state<string | null>(null)
  let screen     = $state<'quiz' | 'lead' | 'result'>('quiz')

  // Текущий вопрос — определяется движком логики
  let engine     = $state<ReturnType<typeof createEngine> | null>(null)
  let currentQ   = $derived(engine?.currentQuestion() ?? null)
  let progress   = $derived(engine?.progress() ?? 0)
  let answers    = $state<Record<string, string[]>>({})

  const api = apiClient(apiBase)

  // ── Lifecycle ────────────────────────────────────────

  onMount(async () => {
    try {
      payload = await api.getQuiz(quizId)
      engine = createEngine(payload)

      // Запускаем сессию
      sessionId = await api.startSession(quizId, getUtmParams())

      // Автоматический показ через 3 сек если trigger='auto'
      if (trigger === 'auto') {
        setTimeout(() => { isOpen = true }, 3000)
      }
    } catch (e) {
      error = 'Не удалось загрузить квиз'
    } finally {
      isLoading = false
    }
  })

  // ── Handlers ─────────────────────────────────────────

  async function handleAnswer(optionIds: string[], textValue?: string) {
    if (!engine || !currentQ || !sessionId) return

    answers[currentQ.id] = optionIds

    // Отправляем ответ на бекенд (fire-and-forget)
    api.submitAnswer(sessionId, currentQ.id, optionIds, textValue)
      .catch(console.error)

    const next = engine.next(currentQ.id, optionIds)

    if (next === 'lead_form') {
      screen = 'lead'
    } else if (next === 'result') {
      await api.completeSession(sessionId)
      screen = payload?.quiz.settings.requireLeadBeforeResult ? 'lead' : 'result'
    } else {
      engine.goTo(next)
    }
  }

  async function handleLeadSubmit(lead: { name?: string; email?: string; phone?: string; custom: Record<string, string> }) {
    if (!sessionId) return
    await api.submitLead(sessionId, quizId, lead)
    screen = 'result'
  }

  function close() { isOpen = false }

  function getUtmParams() {
    const u = new URLSearchParams(window.location.search)
    return {
      utm_source:   u.get('utm_source')   ?? undefined,
      utm_medium:   u.get('utm_medium')   ?? undefined,
      utm_campaign: u.get('utm_campaign') ?? undefined,
      referrer:     document.referrer     || undefined,
    }
  }
</script>

<!-- Styles: будут инлайнены в widget.js через Vite -->
<style>
  :host { all: initial; }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    padding: 16px;
    backdrop-filter: blur(2px);
  }

  .modal {
    background: #fff;
    border-radius: 20px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 64px rgba(0,0,0,0.18);
    position: relative;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 32px;
    height: 32px;
    border: none;
    background: #f5f5f5;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #737373;
    transition: background 0.15s;
  }
  .close-btn:hover { background: #e5e5e5; }

  .progress-bar {
    height: 3px;
    background: #f0f0f0;
    border-radius: 3px 3px 0 0;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent, #6366f1);
    transition: width 0.3s ease;
  }

  .content {
    padding: 28px 28px 24px;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #a3a3a3;
    font-size: 14px;
  }

  .error {
    padding: 24px;
    text-align: center;
    color: #ef4444;
    font-size: 14px;
  }
</style>

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="overlay"
    style={`--accent: ${payload?.quiz.settings.accentColor ?? '#6366f1'}`}
    onclick={(e) => { if (e.target === e.currentTarget) close() }}
  >
    <div class="modal" role="dialog" aria-modal="true">
      <!-- Прогресс-бар -->
      {#if payload?.quiz.settings.showProgressBar}
        <div class="progress-bar">
          <div class="progress-fill" style={`width: ${progress}%`}></div>
        </div>
      {/if}

      <!-- Кнопка закрытия -->
      <button class="close-btn" onclick={close} aria-label="Закрыть">✕</button>

      <div class="content">
        {#if isLoading}
          <div class="loading">Загружаем квиз...</div>

        {:else if error}
          <div class="error">{error}</div>

        {:else if screen === 'quiz' && currentQ}
          <QuestionStep
            question={currentQ}
            options={payload?.options.filter(o => o.question_id === currentQ!.id) ?? []}
            accentColor={payload?.quiz.settings.accentColor ?? '#6366f1'}
            showCount={payload?.quiz.settings.showQuestionCount ?? true}
            questionNumber={engine?.currentIndex() ?? 0}
            totalQuestions={payload?.questions.length ?? 0}
            onAnswer={handleAnswer}
          />

        {:else if screen === 'lead'}
          <LeadForm
            settings={currentQ?.settings.leadForm ?? payload?.questions.find(q => q.type === 'lead_form')?.settings.leadForm}
            accentColor={payload?.quiz.settings.accentColor ?? '#6366f1'}
            onSubmit={handleLeadSubmit}
          />

        {:else if screen === 'result'}
          <ResultScreen
            quiz={payload!.quiz}
          />
        {/if}
      </div>
    </div>
  </div>
{/if}
