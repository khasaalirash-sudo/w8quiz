'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Quiz } from '@markquiz/shared'
import {
  getIntegrations,
  saveIntegration,
  getWebhookLogs,
  type Integration,
  type WebhookLog,
} from '@/lib/actions/integrations'

const CREATIO_FIELDS: Array<{ key: string; label: string; placeholder: string; type: string; hint?: string }> = [
  { key: 'instance_url', label: 'URL инстанса', placeholder: 'https://your-tenant.creatio.com', type: 'url' },
  { key: 'auth_type', label: 'Тип авторизации', placeholder: 'oauth2 | api_key', type: 'text', hint: 'oauth2 для облака, api_key для on-premise' },
  { key: 'client_id', label: 'Client ID / API key', placeholder: '', type: 'text' },
  { key: 'client_secret', label: 'Client Secret (только для OAuth)', placeholder: '', type: 'password' },
  { key: 'collection', label: 'OData коллекция', placeholder: 'Contact', type: 'text', hint: 'Например Contact, Lead, Account' },
  { key: 'map_name', label: 'Имя → поле в Creatio', placeholder: 'Name', type: 'text' },
  { key: 'map_email', label: 'Email → поле в Creatio', placeholder: 'Email', type: 'text' },
  { key: 'map_phone', label: 'Телефон → поле в Creatio', placeholder: 'Phone', type: 'text' },
]

export function IntegrationsClient({ quizzes }: { quizzes: Quiz[] }) {
  const [selectedQuiz, setSelectedQuiz] = useState<string>(quizzes[0]?.id ?? '')
  const [config, setConfig] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (quizId: string) => {
    if (!quizId) return
    setLoading(true)
    try {
      const [integrations, recentLogs] = await Promise.all([
        getIntegrations(quizId),
        getWebhookLogs(quizId, 20),
      ])
      const creatio = integrations.find((i: Integration) => i.type === 'creatio')
      setConfig(creatio?.config ?? {})
      setLogs(recentLogs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload(selectedQuiz)
  }, [selectedQuiz, reload])

  const handleField = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setError(null)
  }

  const handleSave = async () => {
    if (!selectedQuiz) return
    setSaving(true)
    setError(null)
    try {
      await saveIntegration({
        quizId: selectedQuiz,
        type: 'creatio',
        name: 'Creatio CRM',
        config,
        isActive: true,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Интеграции</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Настройте автоматическую отправку лидов в Creatio CRM
        </p>
      </div>

      {quizzes.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500 text-sm">
            Сначала создайте хотя бы один квиз, чтобы настроить интеграцию.
          </p>
        </div>
      )}

      {quizzes.length > 0 && (
        <>
          <div className="mb-6">
            <label className="text-xs text-neutral-500 mb-1.5 block">Квиз</label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border bg-indigo-50 text-indigo-600 border-indigo-200">
                🏢
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900">Creatio CRM</h3>
                <p className="text-sm text-neutral-500 mt-0.5">
                  Лиды отправляются через OData API сразу после заполнения формы
                </p>

                <div className="mt-5 space-y-3">
                  {CREATIO_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="text-xs text-neutral-500 mb-1 block">
                        {field.label}
                        {field.hint && (
                          <span className="text-neutral-300 ml-1">— {field.hint}</span>
                        )}
                      </label>
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={config[field.key] ?? ''}
                        onChange={(e) => handleField(field.key, e.target.value)}
                        disabled={loading}
                        className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-accent-400 transition-all disabled:bg-neutral-50"
                      />
                    </div>
                  ))}
                </div>

                {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

                <button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="mt-5 px-4 py-2 text-sm font-medium bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : saved ? '✓ Сохранено' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">
              История доставки лидов
            </h2>
            {logs.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-6 text-center text-sm text-neutral-400">
                Пока нет ни одной попытки доставки
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-xs text-neutral-500">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Время</th>
                      <th className="text-left px-4 py-2 font-medium">Статус</th>
                      <th className="text-left px-4 py-2 font-medium">Попытка</th>
                      <th className="text-left px-4 py-2 font-medium">Ошибка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-2 text-neutral-600 font-mono text-xs">
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge state={log.delivery_state} status={log.status} />
                        </td>
                        <td className="px-4 py-2 text-neutral-500">{log.attempt}</td>
                        <td className="px-4 py-2 text-red-500 text-xs truncate max-w-[280px]">
                          {log.error ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ state, status }: { state: WebhookLog['delivery_state']; status: number | null }) {
  const styles: Record<WebhookLog['delivery_state'], string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    retrying: 'bg-amber-50 text-amber-700 border-amber-200',
    pending: 'bg-neutral-50 text-neutral-600 border-neutral-200',
  }
  const labels: Record<WebhookLog['delivery_state'], string> = {
    success: 'Успешно',
    failed: 'Ошибка',
    retrying: 'Повтор',
    pending: 'Ожидает',
  }
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded border font-medium ${styles[state]}`}>
      {labels[state]}{status ? ` · ${status}` : ''}
    </span>
  )
}
