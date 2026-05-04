import { getAnalytics } from '@/lib/actions/leads'
import { AnalyticsClient } from './analytics-client'

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const analytics = await getAnalytics(id)

  return <AnalyticsClient data={analytics} />
}
