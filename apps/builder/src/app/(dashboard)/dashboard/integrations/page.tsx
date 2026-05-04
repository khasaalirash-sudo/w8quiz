import type { Metadata } from 'next'
import { getQuizzes } from '@/lib/actions/quiz'
import { IntegrationsClient } from './integrations-client'

export const metadata: Metadata = { title: 'Интеграции' }

export default async function IntegrationsPage() {
  const quizzes = await getQuizzes()

  return <IntegrationsClient quizzes={quizzes} />
}
