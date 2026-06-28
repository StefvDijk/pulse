import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TimeSeparator } from '@/components/chat/TimeSeparator'

afterEach(() => { cleanup() })

it('renders the provided date label', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Gisteren" />)
  expect(getByText('Gisteren')).toBeTruthy()
})

it('renders the label for "Vandaag"', () => {
  const { getByText } = render(<TimeSeparator dateLabel="Vandaag" />)
  expect(getByText('Vandaag')).toBeTruthy()
})
