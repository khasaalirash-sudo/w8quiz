import Link from 'next/link'
import type { Metadata } from 'next'
import { getQuizzes, createQuiz, deleteQuiz } from '@/lib/actions/quiz'

export const metadata: Metadata = { title: 'Мои квизы' }

export default async function DashboardPage() {
  const quizzes = await getQuizzes()

  return (
    <div className="p-8">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Квизы</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {quizzes.length} {quizzes.length === 1 ? 'квиз' : quizzes.length < 5 ? 'квиза' : 'квизов'}
          </p>
        </div>
        <form action={createQuiz}>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-medium hover:bg-accent-600 transition-colors shadow-sm shadow-accent-500/20"
          >
            <span className="text-lg leading-none">+</span>
            Новый квиз
          </button>
        </form>
      </div>

      {/* ── Empty State ── */}
      {quizzes.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📝</div>
          <h2 className="text-lg font-medium text-neutral-700 mb-2">Пока нет квизов</h2>
          <p className="text-sm text-neutral-400 mb-6">Создайте свой первый квиз для сбора лидов</p>
          <form action={createQuiz}>
            <button
              type="submit"
              className="px-5 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-medium hover:bg-accent-600 transition-colors"
            >
              Создать первый квиз
            </button>
          </form>
        </div>
      )}

      {/* ── Quiz Grid ── */}
      {quizzes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Components ──────────────────────────────────────

function QuizCard({ quiz }: {
  quiz: {
    id: string
    title: string
    slug: string
    is_published: boolean
    created_at: string
    updated_at: string
  }
}) {
  const updatedAt = new Date(quiz.updated_at).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short',
  })

  const deleteWithId = deleteQuiz.bind(null, quiz.id)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 hover:border-neutral-300 transition-all overflow-hidden group">
      {/* Превью (цветная полоска) */}
      <div className="h-1.5 bg-gradient-to-r from-accent-400 to-accent-600" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-medium text-neutral-900 leading-snug line-clamp-2">
            {quiz.title || 'Без названия'}
          </h3>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${quiz.is_published
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-neutral-100 text-neutral-500'
            }`}>
            {quiz.is_published ? 'Опубликован' : 'Черновик'}
          </span>
        </div>

        <p className="text-xs text-neutral-400 mb-4">
          Изменён {updatedAt}
        </p>

        <div className="flex items-center gap-2">
          <Link
            href={`/quiz/${quiz.id}/editor`}
            className="flex-1 text-center text-sm py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors font-medium text-neutral-700"
          >
            Редактировать
          </Link>
          <Link
            href={`/quiz/${quiz.id}/analytics`}
            className="text-sm py-2 px-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors text-neutral-500"
          >
            📊
          </Link>
          <form action={deleteWithId}>
            <button
              type="submit"
              className="text-sm py-2 px-3 rounded-xl border border-neutral-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-neutral-400"
              title="Удалить"
            >
              🗑
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
