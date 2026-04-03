import { ChatPage } from '@/components/chat/ChatPage'

interface Props {
  searchParams: Promise<{ context?: string; name?: string; workout?: string }>
}

export default async function ChatRoute({ searchParams }: Props) {
  const params = await searchParams
  let initialMessage: string | undefined

  if (params.context === 'exercise' && params.name) {
    const exercise = decodeURIComponent(params.name)
    const workout = params.workout ? decodeURIComponent(params.workout) : null
    initialMessage = workout
      ? `Ik wil meer weten over ${exercise} (${workout}). Wat zijn de belangrijkste techniektips en hoe bouw ik progressie op?`
      : `Ik wil meer weten over ${exercise}. Wat zijn de belangrijkste techniektips en hoe bouw ik progressie op?`
  }

  return <ChatPage initialMessage={initialMessage} />
}
