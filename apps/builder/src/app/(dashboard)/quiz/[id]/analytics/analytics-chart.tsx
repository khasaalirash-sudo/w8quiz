'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DayData {
  date: string
  starts: number
  completions: number
  leads: number
}

export function AnalyticsChart({ data }: { data: DayData[] }) {
  const hasData = data.some((d) => d.starts > 0 || d.completions > 0 || d.leads > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[240px] text-sm text-neutral-400">
        Данных пока нет — запустите квиз, чтобы увидеть статистику
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
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
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, 'auto']} width={30} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 13 }}
        />
        <Area
          type="monotone"
          dataKey="starts"
          name="Старты"
          stroke="#6366f1"
          fill="url(#gradStarts)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="completions"
          name="Завершения"
          stroke="#10b981"
          fill="url(#gradCompletions)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="leads"
          name="Лиды"
          stroke="#f59e0b"
          fill="url(#gradLeads)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
