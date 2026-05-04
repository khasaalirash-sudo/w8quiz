import { notFound } from 'next/navigation'
import { getQuizPayload } from '@/lib/actions/quiz'
import { EditorClient } from './editor-client'

export default async function QuizEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getQuizPayload(id)

  if (!data) notFound()

  return (
    <EditorClient
      quiz={data.quiz}
      questions={data.questions}
      options={data.options}
      logicRules={data.logicRules}
    />
  )
}

