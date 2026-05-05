'use client'

import { useState, useRef, useEffect } from 'react'
import type { LeadWithQuiz } from '@/lib/actions/leads'

interface Props {
  leads: LeadWithQuiz[]
}

function buildRows(leads: LeadWithQuiz[]) {
  return leads.map((l) => ({
    Имя: l.name ?? '',
    Телефон: l.phone ?? '',
    Email: l.email ?? '',
    Квиз: l.quiz_title,
    Дата: new Date(l.created_at).toLocaleString('ru-RU'),
    // spread custom_fields if present
    ...(l.custom_fields && typeof l.custom_fields === 'object'
      ? Object.fromEntries(
          Object.entries(l.custom_fields as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')])
        )
      : {}),
  }))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportCsv(leads: LeadWithQuiz[]) {
  const rows = buildRows(leads)
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) => headers.map((h) => escape(String(r[h as keyof typeof r] ?? ''))).join(',')),
  ].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `leads-${new Date().toISOString().slice(0, 10)}.csv`)
}

async function exportXlsx(leads: LeadWithQuiz[]) {
  const XLSX = await import('xlsx')
  const rows = buildRows(leads)
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Лиды')

  // column widths
  const cols = Object.keys(rows[0] ?? {})
  ws['!cols'] = cols.map((key) => {
    const maxLen = Math.max(key.length, ...rows.map((r) => String(r[key as keyof typeof r] ?? '').length))
    return { wch: Math.min(maxLen + 2, 50) }
  })

  XLSX.writeFile(wb, `leads-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function LeadsExportButton({ leads }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'csv' | 'xlsx' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handle = async (format: 'csv' | 'xlsx') => {
    setOpen(false)
    setLoading(format)
    try {
      if (format === 'csv') exportCsv(leads)
      else await exportXlsx(leads)
    } finally {
      setLoading(null)
    }
  }

  if (leads.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin text-neutral-400" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3v10m0 0-3-3m3 3 3-3M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        Выгрузить
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl border border-neutral-200 shadow-lg overflow-hidden z-10">
          {(['csv', 'xlsx'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handle(fmt)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="text-base">{fmt === 'csv' ? '📄' : '📊'}</span>
              <span>
                Скачать <span className="font-semibold uppercase">{fmt}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
