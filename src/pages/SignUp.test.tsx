import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../test/resetStores'
import { renderWithProviders } from '../test/renderWithProviders'
import { SignUp } from './SignUp'
import { Toaster } from '../components/Toaster'
import { supabase } from '../lib/supabase'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp: vi.fn() } },
  isSupabaseConfigured: true,
}))

const signUp = vi.mocked(supabase.auth.signUp)

function renderSignUp() {
  return renderWithProviders(
    <>
      <SignUp />
      <Toaster />
    </>,
  )
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  { password = 'secret1', confirm = 'secret1' } = {},
) {
  await user.type(screen.getByLabelText('Email'), 'you@example.com')
  await user.type(screen.getByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirm)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SignUp — validation', () => {
  it('blocks submit when passwords do not match', async () => {
    const user = userEvent.setup()
    renderSignUp()

    await fill(user, { password: 'secret1', confirm: 'secret2' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText('Passwords do not match'),
    ).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })

  it('blocks submit for a password under 6 characters', async () => {
    const user = userEvent.setup()
    renderSignUp()

    await fill(user, { password: 'abc', confirm: 'abc' })
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('At least 6 characters')).toBeInTheDocument()
    expect(signUp).not.toHaveBeenCalled()
  })
})

describe('SignUp — submission', () => {
  it('navigates home when sign-up returns an active session', async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: 'x' } },
      error: null,
    } as never)
    const user = userEvent.setup()
    renderSignUp()

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await vi.waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'you@example.com',
        password: 'secret1',
        options: { emailRedirectTo: `${window.location.origin}/` },
      }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
  })

  it('toasts and redirects to /login when email confirmation is pending', async () => {
    signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    } as never)
    const user = userEvent.setup()
    renderSignUp()

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText(/check your email to confirm/i),
    ).toBeInTheDocument()
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('shows the auth error and does not navigate on failure', async () => {
    signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'User already registered' },
    } as never)
    const user = userEvent.setup()
    renderSignUp()

    await fill(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(
      await screen.findByText('User already registered'),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
