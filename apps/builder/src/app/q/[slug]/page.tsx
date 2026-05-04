import { notFound } from 'next/navigation'
import { getPublicQuiz } from '@/lib/actions/public'
import { QuizPlayer } from './quiz-player'

export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getPublicQuiz(slug)

  if (!data) notFound()

  return <QuizPlayer data={data} />
}
