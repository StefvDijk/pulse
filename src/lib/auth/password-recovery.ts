type AuthError = { message?: string } | null

export interface PasswordRecoveryAuth {
  resetPasswordForEmail(
    email: string,
    options: { redirectTo: string },
  ): Promise<{ error: AuthError }>
}

export interface RecoveredPasswordAuth {
  updateUser(input: { password: string }): Promise<{ error: AuthError }>
}

export type PasswordRecoveryResult = { ok: true } | { ok: false; message: string }

export function getAuthCallbackErrorMessage(error: unknown): string | null {
  if (error !== 'auth_callback_error') return null
  return 'De herstellink is ongeldig of verlopen. Vraag een nieuwe aan.'
}

export async function requestPasswordRecovery(
  auth: PasswordRecoveryAuth,
  input: { email: string; origin: string },
): Promise<PasswordRecoveryResult> {
  const callbackUrl = new URL('/auth/callback', input.origin)
  callbackUrl.searchParams.set('next', '/auth/reset-password')

  try {
    await auth.resetPasswordForEmail(input.email, {
      redirectTo: callbackUrl.toString(),
    })
  } catch {
    // The caller must not expose provider outcomes because they can reveal
    // whether an email address belongs to an account.
  }

  return { ok: true }
}

export async function updateRecoveredPassword(
  auth: RecoveredPasswordAuth,
  input: { password: string; confirmation: string },
): Promise<PasswordRecoveryResult> {
  if (input.password.length < 8) {
    return {
      ok: false,
      message: 'Wachtwoord moet minimaal 8 tekens zijn.',
    }
  }

  if (input.password !== input.confirmation) {
    return {
      ok: false,
      message: 'Wachtwoorden komen niet overeen.',
    }
  }

  try {
    const { error } = await auth.updateUser({ password: input.password })
    if (!error) {
      return { ok: true }
    }
  } catch {
    // Normalize transport and provider failures below.
  }

  return {
    ok: false,
    message:
      'Het wachtwoord kon niet worden bijgewerkt. Vraag zo nodig een nieuwe herstellink aan.',
  }
}
