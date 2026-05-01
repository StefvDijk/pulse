import { Suspense } from 'react'
import { EditReviewForm } from '@/components/check-in/EditReviewForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditCheckInPage({ params }: PageProps) {
  const { id } = await params
  return (
    <Suspense fallback={null}>
      <EditReviewForm reviewId={id} />
    </Suspense>
  )
}
