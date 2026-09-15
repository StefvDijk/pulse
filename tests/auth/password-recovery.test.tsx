import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { LoginForm } from '@/app/(auth)/auth/login/LoginForm'
import ForgotPasswordPage from '@/app/(auth)/auth/forgot-password/page'
import ResetPasswordPage from '@/app/(auth)/auth/reset-password/page'
import {
  getAuthCallbackErrorMessage,
  requestPasswordRecovery,
  updateRecoveredPassword,
} from '@/lib/auth/password-recovery'

const authMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: authMocks }),
}))

beforeEach(() => {
  authMocks.resetPasswordForEmail.mockReset()
  authMocks.updateUser.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('password recovery', () => {
  it('maps only the known callback failure to a safe user message', () => {
    expect(getAuthCallbackErrorMessage('auth_callback_error')).toBe(
      'De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.',
    )
    expect(getAuthCallbackErrorMessage('provider details')).toBeNull()
    expect(getAuthCallbackErrorMessage(undefined)).toBeNull()
  })

  it('offers account recovery from the login page', () => {
    const { getByRole } = render(<LoginForm />)

    expect(getByRole('link', { name: 'Wachtwoord vergeten?' })).toHaveAttribute(
      'href',
      '/auth/forgot-password',
    )
  })

  it('shows a safe message for an invalid or expired recovery callback', () => {
    const { getByRole } = render(
      <LoginForm initialError={getAuthCallbackErrorMessage('auth_callback_error')} />,
    )

    expect(getByRole('alert')).toHaveTextContent(
      'De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.',
    )
  })

  it('requests a recovery link that returns to the password reset page', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null })

    const result = await requestPasswordRecovery(
      { resetPasswordForEmail },
      {
        email: 'stef@example.com',
        origin: 'https://preview.pulse.example',
      },
    )

    expect(result).toEqual({ ok: true })
    expect(resetPasswordForEmail).toHaveBeenCalledWith('stef@example.com', {
      redirectTo: 'https://preview.pulse.example/auth/callback?next=%2Fauth%2Freset-password',
    })
  })

  it('keeps the recovery response account-neutral when the provider fails', async () => {
    const resetPasswordForEmail = vi.fn().mockRejectedValue(new Error('upstream details'))

    await expect(
      requestPasswordRecovery(
        { resetPasswordForEmail },
        {
          email: 'stef@example.com',
          origin: 'https://preview.pulse.example',
        },
      ),
    ).resolves.toEqual({ ok: true })
  })

  it('shows an account-neutral confirmation after requesting a reset email', async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: null })
    const { getByLabelText, getByRole, getByText } = render(<ForgotPasswordPage />)

    fireEvent.change(getByLabelText('E-mailadres'), {
      target: { value: 'stef@example.com' },
    })
    fireEvent.click(getByRole('button', { name: 'Herstellink versturen' }))

    await waitFor(() => {
      expect(
        getByText(
          'Als er een Pulse-account voor dit e-mailadres bestaat, ontvang je een herstellink.',
        ),
      ).toBeTruthy()
    })
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledOnce()
  })

  it('shows the same confirmation when the recovery provider fails', async () => {
    authMocks.resetPasswordForEmail.mockRejectedValue(new Error('provider-specific details'))
    const { getByLabelText, getByRole, getByText, queryByRole } = render(<ForgotPasswordPage />)

    fireEvent.change(getByLabelText('E-mailadres'), {
      target: { value: 'unknown@example.com' },
    })
    fireEvent.click(getByRole('button', { name: 'Herstellink versturen' }))

    await waitFor(() => {
      expect(
        getByText(
          'Als er een Pulse-account voor dit e-mailadres bestaat, ontvang je een herstellink.',
        ),
      ).toBeTruthy()
    })
    expect(queryByRole('alert')).toBeNull()
  })

  it('rejects a recovered password shorter than eight characters', async () => {
    const updateUser = vi.fn()

    const result = await updateRecoveredPassword(
      { updateUser },
      { password: 'kort', confirmation: 'kort' },
    )

    expect(result).toEqual({
      ok: false,
      message: 'Wachtwoord moet minimaal 8 tekens zijn.',
    })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('rejects recovered passwords that do not match', async () => {
    const updateUser = vi.fn()

    const result = await updateRecoveredPassword(
      { updateUser },
      { password: 'nieuw-wachtwoord', confirmation: 'ander-wachtwoord' },
    )

    expect(result).toEqual({
      ok: false,
      message: 'Wachtwoorden komen niet overeen.',
    })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updates a valid recovered password', async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null })

    const result = await updateRecoveredPassword(
      { updateUser },
      { password: 'nieuw-wachtwoord', confirmation: 'nieuw-wachtwoord' },
    )

    expect(result).toEqual({ ok: true })
    expect(updateUser).toHaveBeenCalledWith({ password: 'nieuw-wachtwoord' })
  })

  it('returns a safe message when the recovered session cannot update', async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error('session details'))

    await expect(
      updateRecoveredPassword(
        { updateUser },
        { password: 'nieuw-wachtwoord', confirmation: 'nieuw-wachtwoord' },
      ),
    ).resolves.toEqual({
      ok: false,
      message:
        'Het wachtwoord kon niet worden bijgewerkt. Vraag zo nodig een nieuwe herstellink aan.',
    })
  })

  it('lets a user complete recovery with a new password', async () => {
    authMocks.updateUser.mockResolvedValue({ error: null })
    const { getByLabelText, getByRole, getByText } = render(<ResetPasswordPage />)

    fireEvent.change(getByLabelText('Nieuw wachtwoord'), {
      target: { value: 'nieuw-wachtwoord' },
    })
    fireEvent.change(getByLabelText('Herhaal nieuw wachtwoord'), {
      target: { value: 'nieuw-wachtwoord' },
    })
    fireEvent.click(getByRole('button', { name: 'Wachtwoord opslaan' }))

    await waitFor(() => {
      expect(getByText('Je wachtwoord is bijgewerkt.')).toBeTruthy()
    })
    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: 'nieuw-wachtwoord',
    })
    expect(getByRole('link', { name: 'Naar Pulse' })).toHaveAttribute('href', '/')
  })
})
