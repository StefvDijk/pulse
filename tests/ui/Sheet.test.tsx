import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { Sheet } from '@/components/ui/Sheet'

afterEach(() => {
  cleanup()
})

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <Sheet open={false} onClose={() => {}}>content</Sheet>,
    )
    expect(queryByTestId('sheet-backdrop')).toBeNull()
  })

  it('renders backdrop + content when open', () => {
    const { getByTestId, getByText } = render(
      <Sheet open={true} onClose={() => {}}>content</Sheet>,
    )
    expect(getByTestId('sheet-backdrop')).toBeTruthy()
    expect(getByText('content')).toBeTruthy()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open={true} onClose={onClose}>content</Sheet>,
    )
    fireEvent.click(getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders grabber by default', () => {
    const { getByTestId } = render(
      <Sheet open={true} onClose={() => {}}>content</Sheet>,
    )
    expect(getByTestId('sheet-grabber')).toBeTruthy()
  })

  it('hides grabber when grabber={false}', () => {
    const { queryByTestId } = render(
      <Sheet open={true} onClose={() => {}} grabber={false}>content</Sheet>,
    )
    expect(queryByTestId('sheet-grabber')).toBeNull()
  })

  it('renders optional title', () => {
    const { getByText } = render(
      <Sheet open={true} onClose={() => {}} title="My Sheet">content</Sheet>,
    )
    expect(getByText('My Sheet')).toBeTruthy()
  })
})
