<script lang="ts">
  import type { Question, Option } from '../types'

  interface Props {
    question: Question
    options: Option[]
    accentColor: string
    showCount: boolean
    questionNumber: number
    totalQuestions: number
    onAnswer: (optionIds: string[], textValue?: string) => void
  }

  const { question, options, accentColor, showCount, questionNumber, totalQuestions, onAnswer }: Props = $props()

  let selectedIds = $state<string[]>([])
  let textValue   = $state('')
  let sliderValue = $state(question.settings.slider?.min ?? 0)

  function toggleOption(id: string) {
    if (question.type === 'single') {
      selectedIds = [id]
      // Для single — автопереход без кнопки
      setTimeout(() => onAnswer([id]), 280)
    } else {
      selectedIds = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    }
  }

  function submit() {
    if (question.type === 'text') {
      onAnswer([], textValue)
    } else if (question.type === 'slider') {
      onAnswer([], String(sliderValue))
    } else if (question.type === 'rating') {
      onAnswer([], String(selectedIds[0] ?? ''))
    } else {
      onAnswer(selectedIds)
    }
  }

  const canSubmit = $derived(
    question.type === 'text'   ? textValue.trim().length > 0 :
    question.type === 'slider' ? true :
    question.type === 'rating' ? selectedIds.length > 0 :
    question.type === 'multiple' ? selectedIds.length > 0 :
    false  // single — автопереход
  )
</script>

<style>
  .step { animation: fadeSlide 0.25s ease; }
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .counter { font-size: 12px; color: #a3a3a3; margin-bottom: 12px; }

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: #171717;
    line-height: 1.35;
    margin: 0 0 8px;
  }

  .desc { font-size: 14px; color: #737373; margin: 0 0 20px; }

  .opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 2px solid #e5e5e5;
    border-radius: 14px;
    cursor: pointer;
    font-size: 15px;
    color: #262626;
    transition: border-color 0.15s, background 0.15s;
    margin-bottom: 8px;
    width: 100%;
    text-align: left;
    background: white;
  }
  .opt:hover  { border-color: var(--a); background: color-mix(in srgb, var(--a) 6%, white); }
  .opt.active { border-color: var(--a); background: color-mix(in srgb, var(--a) 10%, white); }

  .radio-dot, .check-box {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 2px solid #d4d4d4;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .check-box { border-radius: 6px; }
  .opt.active .radio-dot,
  .opt.active .check-box { border-color: var(--a); background: var(--a); }
  .opt.active .radio-dot::after,
  .opt.active .check-box::after {
    content: '';
    width: 6px; height: 6px;
    background: white;
    border-radius: 50%;
  }
  .opt.active .check-box::after {
    width: 10px; height: 8px;
    background: none;
    border-radius: 0;
    border-bottom: 2px solid white;
    border-right: 2px solid white;
    transform: rotate(45deg) translate(-1px, -2px);
  }

  textarea, input[type=text] {
    width: 100%; padding: 12px 14px;
    border: 2px solid #e5e5e5;
    border-radius: 14px;
    font-size: 15px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  textarea:focus, input[type=text]:focus { border-color: var(--a); }

  .slider-wrap { padding: 8px 0 4px; }
  input[type=range] { width: 100%; accent-color: var(--a); cursor: pointer; }
  .slider-val { text-align: center; font-size: 22px; font-weight: 700; color: var(--a); margin-top: 8px; }

  .stars { display: flex; gap: 8px; }
  .star {
    font-size: 32px; cursor: pointer;
    transition: transform 0.1s;
    filter: grayscale(1) opacity(0.4);
  }
  .star.active { filter: none; }
  .star:hover  { transform: scale(1.15); }

  .btn-submit {
    width: 100%; padding: 14px;
    background: var(--a);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 16px;
    transition: opacity 0.15s;
  }
  .btn-submit:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-submit:not(:disabled):hover { opacity: 0.88; }
</style>

<div class="step" style={`--a: ${accentColor}`}>
  {#if showCount}
    <p class="counter">{questionNumber + 1} / {totalQuestions}</p>
  {/if}

  <h2>{question.title}</h2>
  {#if question.description}
    <p class="desc">{question.description}</p>
  {/if}

  <!-- Single / Multiple -->
  {#if question.type === 'single' || question.type === 'multiple'}
    {#each options as opt (opt.id)}
      <button
        class="opt"
        class:active={selectedIds.includes(opt.id)}
        onclick={() => toggleOption(opt.id)}
      >
        {#if question.type === 'single'}
          <span class="radio-dot"></span>
        {:else}
          <span class="check-box"></span>
        {/if}
        {opt.text}
      </button>
    {/each}
    {#if question.type === 'multiple' && selectedIds.length > 0}
      <button class="btn-submit" onclick={submit}>Далее →</button>
    {/if}

  <!-- Text -->
  {:else if question.type === 'text'}
    <textarea
      rows="3"
      placeholder="Ваш ответ..."
      bind:value={textValue}
    ></textarea>
    <button class="btn-submit" disabled={!canSubmit} onclick={submit}>Далее →</button>

  <!-- Slider -->
  {:else if question.type === 'slider'}
    <div class="slider-wrap">
      <input
        type="range"
        min={question.settings.slider?.min ?? 0}
        max={question.settings.slider?.max ?? 100}
        step={question.settings.slider?.step ?? 1}
        bind:value={sliderValue}
      />
      <p class="slider-val">
        {sliderValue.toLocaleString('ru')}{question.settings.slider?.unit ? ` ${question.settings.slider.unit}` : ''}
      </p>
    </div>
    <button class="btn-submit" onclick={submit}>Далее →</button>

  <!-- Rating -->
  {:else if question.type === 'rating'}
    <div class="stars">
      {#each Array.from({ length: question.settings.rating?.maxRating ?? 5 }, (_, i) => i + 1) as n}
        <button
          class="star"
          class:active={selectedIds[0] !== undefined && n <= Number(selectedIds[0])}
          onclick={() => { selectedIds = [String(n)]; setTimeout(submit, 200) }}
        >★</button>
      {/each}
    </div>
  {/if}
</div>
