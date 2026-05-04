<script lang="ts">
  import type { LeadFormSettings } from '../types'

  interface Props {
    settings?: LeadFormSettings
    accentColor: string
    onSubmit: (lead: { name?: string; email?: string; phone?: string; custom: Record<string, string> }) => void
  }

  const { settings, accentColor, onSubmit }: Props = $props()

  const fields = settings?.fields ?? [
    { id: 'name',  type: 'name',  label: 'Имя',    placeholder: 'Алим',          required: true },
    { id: 'phone', type: 'phone', label: 'Телефон', placeholder: '+7 (___) ___-__-__', required: true },
  ]

  let values = $state<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.id, '']))
  )
  let submitting = $state(false)
  let submitted  = $state(false)

  const isValid = $derived(
    fields.every((f) => !f.required || (values[f.id]?.trim().length ?? 0) > 0)
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!isValid || submitting) return
    submitting = true

    const name  = values['name']
    const email = values['email']
    const phone = values['phone']
    const custom = Object.fromEntries(
      fields
        .filter((f) => !['name', 'email', 'phone'].includes(f.type))
        .map((f) => [f.id, values[f.id] ?? ''])
    )

    await onSubmit({ name, email, phone, custom })
    submitted = true
  }
</script>

<style>
  .lead { animation: fadeSlide 0.25s ease; }
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  h2 { font-size: 20px; font-weight: 700; color: #171717; margin: 0 0 6px; }
  p  { font-size: 14px; color: #737373; margin: 0 0 20px; }

  .field { margin-bottom: 14px; }
  label { display: block; font-size: 13px; font-weight: 500; color: #525252; margin-bottom: 6px; }

  input {
    width: 100%;
    padding: 11px 14px;
    border: 2px solid #e5e5e5;
    border-radius: 12px;
    font-size: 15px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    font-family: inherit;
  }
  input:focus { border-color: var(--a); }

  .submit {
    width: 100%;
    padding: 14px;
    background: var(--a);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    margin-top: 6px;
  }
  .submit:disabled { opacity: 0.45; cursor: not-allowed; }
  .submit:not(:disabled):hover { opacity: 0.88; }

  .privacy {
    font-size: 11px;
    color: #a3a3a3;
    text-align: center;
    margin-top: 12px;
    line-height: 1.5;
  }
  .privacy a { color: inherit; }
</style>

<div class="lead" style={`--a: ${accentColor}`}>
  {#if settings?.title}
    <h2>{settings.title}</h2>
  {/if}
  {#if settings?.subtitle}
    <p>{settings.subtitle}</p>
  {/if}

  <form onsubmit={handleSubmit}>
    {#each fields as field (field.id)}
      <div class="field">
        <label for={`mq-${field.id}`}>{field.label}</label>
        <input
          id={`mq-${field.id}`}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
          placeholder={field.placeholder ?? ''}
          required={field.required}
          bind:value={values[field.id]}
        />
      </div>
    {/each}

    <button class="submit" type="submit" disabled={!isValid || submitting}>
      {submitting ? 'Отправка...' : (settings?.buttonText ?? 'Получить результат')}
    </button>

    {#if settings?.privacyText}
      <p class="privacy">
        {settings.privacyText}
        {#if settings.privacyUrl}
          <a href={settings.privacyUrl} target="_blank" rel="noopener">Подробнее</a>
        {/if}
      </p>
    {/if}
  </form>
</div>
