import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ChatMessage } from '@/components/chat/ChatMessage'
import type { AnyCard } from '@/lib/ai/chat/cards'

afterEach(() => { cleanup() })

const workoutCard: AnyCard = {
  type: 'workout',
  title: 'Upper A',
  date: '2026-06-28',
  sport: 'gym',
  exercises: [{ name: 'Bench Press', sets: 4, reps: '6', weight_kg: 90 }],
}

describe('ChatMessage cards', () => {
  it('renders an attached card below the assistant prose', () => {
    const { getByText } = render(
      <ChatMessage role="assistant" content="Sterke sessie vandaag." cards={[workoutCard]} />,
    )
    const prose = getByText('Sterke sessie vandaag.')
    const cardTitle = getByText('Upper A')
    // card must appear AFTER the prose in document order
    expect(
      prose.compareDocumentPosition(cardTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders the exercise row from the attached card', () => {
    const { getByText } = render(
      <ChatMessage role="assistant" content="Hier je workout." cards={[workoutCard]} />,
    )
    expect(getByText('Bench Press')).toBeTruthy()
    expect(getByText('4 × 6')).toBeTruthy()
    expect(getByText('@ 90kg')).toBeTruthy()
  })

  it('renders no card when the cards prop is omitted', () => {
    const { getByText, queryByText } = render(
      <ChatMessage role="assistant" content="Gewoon tekst." />,
    )
    expect(getByText('Gewoon tekst.')).toBeTruthy()
    expect(queryByText('Upper A')).toBeNull()
  })

  it('does not render cards on a user message', () => {
    const { getByText, queryByText } = render(
      <ChatMessage role="user" content="Mijn vraag" cards={[workoutCard]} />,
    )
    expect(getByText('Mijn vraag')).toBeTruthy()
    expect(queryByText('Upper A')).toBeNull()
  })
})
