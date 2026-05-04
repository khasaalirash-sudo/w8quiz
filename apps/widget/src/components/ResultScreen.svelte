<script lang="ts">
  import type { Quiz } from '../types'

  const { quiz }: { quiz: Quiz } = $props()

  const redirectUrl = quiz.settings.redirectUrl
  const btnText     = quiz.settings.resultButtonText ?? 'На сайт'

  function handleRedirect() {
    if (redirectUrl) window.open(redirectUrl, '_blank', 'noopener')
  }
</script>

<style>
  .result {
    text-align: center;
    padding: 16px 0;
    animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.88); }
    to   { opacity: 1; transform: scale(1); }
  }

  .icon { font-size: 52px; margin-bottom: 16px; }
  h2 { font-size: 22px; font-weight: 700; color: #171717; margin: 0 0 8px; }
  p  { font-size: 15px; color: #737373; margin: 0 0 24px; line-height: 1.6; }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    background: var(--a);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.88; }
</style>

<div class="result" style={`--a: ${quiz.settings.accentColor ?? '#6366f1'}`}>
  <div class="icon">🎉</div>
  <h2>Готово!</h2>
  <p>Спасибо за ответы. Мы свяжемся с вами в ближайшее время.</p>

  {#if redirectUrl}
    <button class="btn" onclick={handleRedirect}>
      {btnText} →
    </button>
  {/if}
</div>
