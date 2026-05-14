import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { Alert } from '@/components/ui/Alert'

afterEach(() => {
  cleanup()
})

describe('Alert', () => {
  it('renders title and description when open', () => {
    const { getByText } = render(
      <Alert
        open={true}
        onClose={() => {}}
        title="Verwijderen?"
        description="Dit kan niet ongedaan worden gemaakt."
        primaryAction={{ label: 'Verwijderen', onPress: () => {}, destructive: true }}
      />,
    )
    expect(getByText('Verwijderen?')).toBeTruthy()
    expect(getByText('Dit kan niet ongedaan worden gemaakt.')).toBeTruthy()
  })

  it('calls primaryAction.onPress and onClose when primary button is clicked', () => {
    const onPress = vi.fn()
    const onClose = vi.fn()
    const { getByText } = render(
      <Alert
        open={true}
        onClose={onClose}
        title="Bevestigen"
        primaryAction={{ label: 'OK', onPress }}
      />,
    )
    fireEvent.click(getByText('OK'))
    expect(onPress).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders secondary action button when provided', () => {
    const { getByText } = render(
      <Alert
        open={true}
        onClose={() => {}}
        title="Weet je het zeker?"
        primaryAction={{ label: 'Ja', onPress: () => {} }}
        secondaryAction={{ label: 'Annuleren', onPress: () => {} }}
      />,
    )
    expect(getByText('Annuleren')).toBeTruthy()
  })

  it('closes when ESC is pressed', () => {
    const onClose = vi.fn()
    render(
      <Alert
        open={true}
        onClose={onClose}
        title="Sluiten met ESC"
        primaryAction={{ label: 'OK', onPress: () => {} }}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
