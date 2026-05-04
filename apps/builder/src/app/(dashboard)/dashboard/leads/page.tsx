import type { Metadata } from 'next'
import { getLeads } from '@/lib/actions/leads'
import { getQuizzes } from '@/lib/actions/quiz'

export const metadata: Metadata = { title: 'Лиды' }

export default async function LeadsPage() {
  const [leads, quizzes] = await Promise.all([getLeads(), getQuizzes()])

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Лиды</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {leads.length} {leads.length === 1 ? 'контакт' : leads.length < 5 ? 'контакта' : 'контактов'}
          </p>
        </div>
      </div>

      {/* ── Empty State ── */}
      {leads.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-lg font-medium text-neutral-700 mb-2">Пока нет лидов</h2>
          <p className="text-sm text-neutral-400 max-w-sm mx-auto">
            Лиды появятся, когда респонденты начнут заполнять ваши квизы и оставлять контактные данные
          </p>
        </div>
      )}

      {/* ── Leads Table ── */}
      {leads.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-5 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">
                    Имя
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">
                    Телефон
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">
                    Квиз
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wide">
                    Дата
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-semibold shrink-0">
                          {(lead.name ?? lead.email ?? '?')[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-neutral-900">
                          {lead.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="hover:text-accent-600 transition-colors">
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="hover:text-accent-600 transition-colors">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2 py-1 rounded-md bg-neutral-100 text-neutral-600">
                        {lead.quiz_title}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-400 text-xs">
                      {new Date(lead.created_at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
