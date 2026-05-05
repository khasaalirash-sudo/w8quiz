'use client'

import { QuizEditor } from '@/components/editor/QuizEditor'
import { publishQuiz } from '@/lib/actions/quiz'
import { useState } from 'react'
import type { Quiz, Question, Option, LogicRule } from '@markquiz/shared'
import { useEditorStore } from '@/store/editorStore'

interface EditorClientProps {
  quiz: Quiz
  questions: Question[]
  options: Record<string, Option[]>
  logicRules: LogicRule[]
}

export function EditorClient({ quiz, questions, options, logicRules }: EditorClientProps) {
  const storeQuiz = useEditorStore((s) => s.quiz)
  const updateQuizMeta = useEditorStore((s) => s.updateQuizMeta)

  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    quiz.is_published && quiz.slug
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}/q/${quiz.slug}`
      : null,
  )
  const [showCopied, setShowCopied] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const result = await publishQuiz(quiz.id)
      const url = `${window.location.origin}/q/${result.slug}`
      setPublishedUrl(url)
    } catch (e) {
      console.error('Publish failed:', e)
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopy = async () => {
    if (!publishedUrl) return
    await navigator.clipboard.writeText(publishedUrl)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* ── Editor Topbar ── */}
      <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-6 gap-4 shrink-0">
        <a href="/dashboard" className="text-neutral-400 hover:text-neutral-600 transition-colors text-sm">
          ← Квизы
        </a>
        <div className="h-5 w-px bg-neutral-200" />
        <input
          value={storeQuiz?.title ?? quiz.title}
          onChange={(e) => updateQuizMeta({ title: e.target.value } as Pick<Quiz, 'title' | 'description'>)}
          className="text-sm font-medium text-neutral-900 flex-1 bg-transparent outline-none border border-transparent focus:border-neutral-200 rounded-md px-2 py-1"
          placeholder="Название квиза"
        />
        <div className="flex items-center gap-2">
          {publishedUrl && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-emerald-700 font-mono max-w-[200px] truncate">{publishedUrl}</span>
              <button
                onClick={handleCopy}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
              >
                {showCopied ? '✓' : '📋'}
              </button>
            </div>
          )}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${publishedUrl
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-accent-500 text-white hover:bg-accent-600'
              }`}
          >
            {isPublishing ? 'Публикация...' : publishedUrl ? 'Переопубликовать' : 'Опубликовать'}
          </button>
        </div>
      </header>

      {/* ── Editor Body ── */}
      <QuizEditor
        quiz={quiz}
        questions={questions}
        options={options}
        logicRules={logicRules}
      />
    </div>
  )
}
