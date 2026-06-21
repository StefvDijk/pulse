import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StepShell } from '@/components/block-review/StepShell'

afterEach(() => cleanup())

describe('block-review StepShell identity (issue #37)', () => {
  it('carries the sportcoach identity so the wizard reads as the sport coach tool', () => {
    const { getByText } = render(
      <StepShell title="Hoe ging je blok?" stepIndex={0} stepTotal={6}>
        <div>content</div>
      </StepShell>,
    )
    expect(getByText('Sportcoach')).toBeTruthy()
  })
})
