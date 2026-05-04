'use client'

import dynamic from 'next/dynamic'
import type { AnalyticsData } from '@/lib/actions/leads'

/* eslint-disable @typescript-eslint/no-explicit-any */
const AreaChart = dynamic(() => import('recharts').then((m) => m.AreaChart) as any, { ssr: false }) as any
const Area = dynamic(() => import('recharts').then((m) => m.Area) as any, { ssr: false }) as any
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis) as any, { ssr: false }) as any
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis) as any, { ssr: false }) as any
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid) as any, { ssr: false }) as any
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip) as any, { ssr: false }) as any
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer) as any, { ssr: false }) as any

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']

export function AnalyticsClient({ data }: { data: AnalyticsData }) {
  const { stats, dailySessions, funnel } = data
  const maxAnswers = funnel.length > 0 ? Math.max(funnel[0].answers, 1) : 1

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Аналитика</h1>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Просмотры', value: stats.views, hint: 'Открытий виджета', icon: '👁', color: 'bg-blue-50 text-blue-600' },
          { label: 'Старты', value: stats.starts, hint: 'Ответили ≥ 1 вопросу', icon: '▶', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Завершения', value: stats.completions, hint: `${stats.completionRate}% дошли до конца`, icon: '✓', color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Лиды', value: stats.leads, hint: `${stats.conversionRate}% конверсия`, icon: '★', color: 'bg-amber-50 text-amber-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-neutral-200 p-5 relative overflow-hidden">
            <div className={`absolute top-4 right-4 w-8 h-8 rounded-lg ${kpi.color} flex items-center justify-center text-sm`}>
              {kpi.icon}
            </div>
            <p className="text-2xl font-bold text-neutral-900">{kpi.value.toLocaleString('ru')}</p>
            <p className="text-sm font-medium text-neutral-700 mt-1">{kpi.label}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{kpi.hint}</p>
          </div>
        ))}
      </div>

      {/* ── Chart: Динамика ── */}
      {dailySessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Динамика за 30 дней</h2>
            <div className="flex gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Старты</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Завершения</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Лиды</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailySessions}>
              <defs>
                <linearGradient id="gradStarts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCompletions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }} />
              <Area type="monotone" dataKey="starts" name="Старты" stroke="#6366f1" fill="url(#gradStarts)" strokeWidth={2} />
              <Area type="monotone" dataKey="completions" name="Завершения" stroke="#10b981" fill="url(#gradCompletions)" strokeWidth={2} />
              <Area type="monotone" dataKey="leads" name="Лиды" stroke="#f59e0b" fill="url(#gradLeads)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Funnel: Воронка по шагам ── */}
      {funnel.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6">
          <h2 className="font-semibold mb-6">Воронка по шагам</h2>
          <div className="space-y-1">
            {funnel.map((step, i) => {
              const widthPct = maxAnswers > 0 ? (step.answers / maxAnswers) * 100 : 0
              const prevAnswers = i > 0 ? funnel[i - 1].answers : null
              const dropoff = prevAnswers ? prevAnswers - step.answers : 0
              const dropoffPct = prevAnswers ? Math.round((dropoff / prevAnswers) * 100) : 0

              return (
                <div key={step.step}>
                  {i > 0 && dropoff > 0 && (
                    <div className="flex items-center gap-2 py-1.5 pl-4">
                      <svg width="16" height="16" viewBox="0 0 16 16" className="text-red-400 shrink-0">
                        <path d="M8 3v7M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs text-red-500 font-medium">
                        −{dropoff} чел. ({dropoffPct}% отсев)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="w-5 text-xs text-neutral-400 text-right shrink-0 font-medium">{step.step}</div>
                    <div className="flex-1 relative">
                      <div className="h-10 rounded-lg bg-neutral-50 w-full" />
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg flex items-center px-3 transition-all duration-500"
                        style={{
                          width: `${Math.max(widthPct, 2)}%`,
                          backgroundColor: COLORS[i % COLORS.length],
                          minWidth: 'fit-content',
                        }}
                      >
                        <span className="text-xs font-semibold text-white truncate">{step.questionTitle}</span>
                      </div>
                    </div>
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-bold text-neutral-900">{step.answers}</span>
                      {maxAnswers > 0 && (
                        <span className="text-xs text-neutral-400 ml-1">
                          ({Math.round((step.answers / maxAnswers) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {funnel.length > 1 && (
            <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-sm text-neutral-600">
                  Общий отсев: <strong className="text-neutral-900">{maxAnswers - funnel[funnel.length - 1].answers}</strong> чел.
                  {maxAnswers > 0 && ` (${Math.round(((maxAnswers - funnel[funnel.length - 1].answers) / maxAnswers) * 100)}%)`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-neutral-600">
                  Дошли до конца: <strong className="text-neutral-900">{funnel[funnel.length - 1].answers}</strong> чел.
                  {maxAnswers > 0 && ` (${Math.round((funnel[funnel.length - 1].answers / maxAnswers) * 100)}%)`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Drop-off: Где уходят клиенты ── */}
      {funnel.length > 1 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h2 className="font-semibold mb-2">Где уходят клиенты</h2>
          <p className="text-sm text-neutral-400 mb-5">Потери между этапами квиза</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {funnel.slice(1).map((step, i) => {
              const prev = funnel[i]
              const dropoff = prev.answers - step.answers
              const dropoffPct = prev.answers > 0 ? Math.round((dropoff / prev.answers) * 100) : 0
              const severity =
                dropoffPct >= 20 ? 'bg-red-50 border-red-200 text-red-700' :
                  dropoffPct >= 10 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-emerald-50 border-emerald-200 text-emerald-700'
              const severityDot =
                dropoffPct >= 20 ? 'bg-red-500' :
                  dropoffPct >= 10 ? 'bg-amber-500' :
                    'bg-emerald-500'

              return (
                <div key={step.step} className={`rounded-xl border p-4 ${severity}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${severityDot}`} />
                    <span className="text-xs font-medium opacity-70">
                      Шаг {prev.step} → {step.step}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">−{dropoffPct}%</p>
                  <p className="text-xs mt-1 opacity-70">
                    {prev.questionTitle} → {step.questionTitle}
                  </p>
                  <p className="text-xs mt-0.5 font-medium">{dropoff} чел. ушли</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.starts === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-lg font-medium text-neutral-700 mb-2">Пока нет данных</h2>
          <p className="text-sm text-neutral-400 max-w-sm mx-auto">
            Опубликуйте квиз и поделитесь ссылкой — аналитика начнёт заполняться автоматически
          </p>
        </div>
      )}
    </div>
  )
}
