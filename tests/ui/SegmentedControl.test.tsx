import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

afterEach(() => {
  cleanup()
})

const weekOptions = [
  { value: 'week' as const, label: 'Week' },
  { value: 'month' as const, label: 'Maand' },
  { value: 'year' as const, label: 'Jaar' },
]

describe('SegmentedControl', () => {
  it('renders all option labels', () => {
    const { getByText } = render(
      <SegmentedControl
        options={weekOptions}
        value="week"
        onChange={() => {}}
      />,
    )
    expect(getByText('Week')).toBeTruthy()
    expect(getByText('Maand')).toBeTruthy()
    expect(getByText('Jaar')).toBeTruthy()
  })

  it('clicking an option calls onChange with the correct value', () => {
    const onChange = vi.fn()
    const { getByText } = render(
      <SegmentedControl
        options={weekOptions}
        value="week"
        onChange={onChange}
      />,
    )
    fireEvent.click(getByText('Maand'))
    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('active option has aria-pressed=true, others have aria-pressed=false', () => {
    const { getByRole, getAllByRole } = render(
      <SegmentedControl
        options={weekOptions}
        value="month"
        onChange={() => {}}
      />,
    )
    const tabs = getAllByRole('tab')
    // 'month' is at index 1
    expect(tabs[1].getAttribute('aria-pressed')).toBe('true')
    expect(tabs[0].getAttribute('aria-pressed')).toBe('false')
    expect(tabs[2].getAttribute('aria-pressed')).toBe('false')
    // also verify by label
    const monthTab = getByRole('tab', { name: 'Maand' })
    expect(monthTab.getAttribute('aria-pressed')).toBe('true')
  })

  it('supports a generic string value type', () => {
    type Period = 'today' | 'yesterday'
    const opts: { value: Period; label: string }[] = [
      { value: 'today', label: 'Vandaag' },
      { value: 'yesterday', label: 'Gisteren' },
    ]
    const onChange = vi.fn<(v: Period) => void>()
    const { getByText } = render(
      <SegmentedControl<Period> options={opts} value="today" onChange={onChange} />,
    )
    fireEvent.click(getByText('Gisteren'))
    expect(onChange).toHaveBeenCalledWith('yesterday')
  })
})
