import { RunDetailPage } from '@/components/run/RunDetailPage'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <RunDetailPage runId={id} />
}
