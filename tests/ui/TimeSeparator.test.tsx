import { it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TimeSeparator } from '@/components/chat/TimeSeparator'
import { messageDateLabel } from '@/components/chat/ChatInterface'

afterEach(() => { cleanup() })

it('renders the provided date label', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Gisteren" />)
  expect(getByText('Gisteren')).toBeTruthy()
})

it('renders the label for "Vandaag"', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Vandaag" />)
  expect(getByText('Vandaag')).toBeTruthy()
})

it('maps the current instant to "Vandaag" in Amsterdam', () => {
  // "now" is always today in Europe/Amsterdam regardless of the test runner's tz.
  expect(messageDateLabel(new Date().toISOString())).toBe('Vandaag')
})
