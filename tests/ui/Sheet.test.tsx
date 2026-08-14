import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { Sheet } from '@/components/ui/Sheet'

afterEach(() => {
  cleanup()
})

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <Sheet open={false} onClose={() => {}} title="Test sheet">content</Sheet>,
    )
    expect(queryByTestId('sheet-backdrop')).toBeNull()
  })

  it('renders backdrop + content when open', () => {
    const { getByTestId, getByText } = render(
      <Sheet open={true} onClose={() => {}} title="Test sheet">content</Sheet>,
    )
    expect(getByTestId('sheet-backdrop')).toBeTruthy()
    expect(getByText('content')).toBeTruthy()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { getByTestId } = render(
      <Sheet open={true} onClose={onClose} title="Test sheet">content</Sheet>,
    )
    fireEvent.click(getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders grabber by default', () => {
    const { getByTestId } = render(
      <Sheet open={true} onClose={() => {}} title="Test sheet">content</Sheet>,
    )
    expect(getByTestId('sheet-grabber')).toBeTruthy()
  })

  it('hides grabber when grabber={false}', () => {
    const { queryByTestId } = render(
      <Sheet open={true} onClose={() => {}} title="Test sheet" grabber={false}>content</Sheet>,
    )
    expect(queryByTestId('sheet-grabber')).toBeNull()
  })

  it('renders optional title', () => {
    const { getByText } = render(
      <Sheet open={true} onClose={() => {}} title="My Sheet">content</Sheet>,
    )
    expect(getByText('My Sheet')).toBeTruthy()
  })

  it('gives the dialog its required accessible name', () => {
    const { getByRole } = render(
      <Sheet open={true} onClose={() => {}} title="Trainingsdetails">content</Sheet>,
    )
    expect(getByRole('dialog', { name: 'Trainingsdetails' })).toBeTruthy()
  })

  it('keeps keyboard focus inside the sheet', () => {
    const { getByRole } = render(
      <Sheet open={true} onClose={() => {}} title="Focus test">
        <button>First</button>
        <button>Last</button>
      </Sheet>,
    )
    const dialog = getByRole('dialog')
    const first = getByRole('button', { name: 'First' })
    const last = getByRole('button', { name: 'Last' })

    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
