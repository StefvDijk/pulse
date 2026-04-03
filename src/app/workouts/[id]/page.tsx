import { WorkoutDetailPage } from '@/components/workout/WorkoutDetailPage'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <WorkoutDetailPage workoutId={id} />
}
