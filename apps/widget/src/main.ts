import App from './App.svelte'

/**
 * Точка входа виджета.
 *
 * Клиентский сайт подключает скрипт так:
 *   <script src="https://cdn.markquiz.io/widget.js" data-quiz-id="12345" async></script>
 *
 * Скрипт сам находит тег, читает data-quiz-id и монтирует квиз в Shadow DOM.
 * Shadow DOM изолирует стили от родительского сайта.
 */

const ATTR_QUIZ_ID = 'data-quiz-id'
const ATTR_TRIGGER = 'data-trigger'  // 'inline' | 'button' | 'auto' (default)

function mount() {
  // Находим тег скрипта, который вставил этот файл
  const scriptEl = document.currentScript as HTMLScriptElement | null
  const quizId = scriptEl?.getAttribute(ATTR_QUIZ_ID)
  const trigger = scriptEl?.getAttribute(ATTR_TRIGGER) ?? 'auto'

  if (!quizId) {
    console.warn('[MarkQuiz] Не указан data-quiz-id')
    return
  }

  // Создаём хост-элемент и монтируем виджет в Shadow DOM
  function createWidget() {
    const host = document.createElement('div')
    host.id = `markquiz-${quizId}`
    document.body.appendChild(host)

    const shadow = host.attachShadow({ mode: 'open' })
    const container = document.createElement('div')
    shadow.appendChild(container)

    new App({
      target: container,
      props: {
        quizId: quizId!,
        trigger,
        apiBase: scriptEl?.src
          ? new URL(scriptEl.src).origin
          : 'https://api.markquiz.io',
      },
    })
  }

  if (trigger === 'inline') {
    // Встраиваем сразу после тега скрипта
    if (scriptEl?.parentElement) {
      const host = document.createElement('div')
      host.id = `markquiz-${quizId}`
      scriptEl.parentElement.insertBefore(host, scriptEl.nextSibling)
      const shadow = host.attachShadow({ mode: 'open' })
      const container = document.createElement('div')
      shadow.appendChild(container)
      new App({ target: container, props: { quizId: quizId!, trigger, apiBase: '' } })
    }
  } else {
    // Модальное окно / автоматический показ
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget)
    } else {
      createWidget()
    }
  }
}

mount()
