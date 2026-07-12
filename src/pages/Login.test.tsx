import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../test/renderWithProviders'
import { Login } from './Login'
import { supabase } from '../lib/supabase'

// Spy on navigation while keeping MemoryRouter / Link real.
const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
  isSupabaseConfigured: true,
}))

const signIn = vi.mocked(supabase.auth.signInWithPassword)

beforeEach(() => {
  vi.clearAllMocks()
})

async function fillCredentials(
  user: ReturnType<typeof userEvent.setup>,
  email = 'you@example.com',
  password = 'secret',
) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
}

describe('Login', () => {
  it('blocks submit and shows a message for an invalid email', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    await fillCredentials(user, 'not-an-email')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('requires a password', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText('Email'), 'you@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Password is required')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signs in and navigates home on success', async () => {
    signIn.mockResolvedValue({ error: null } as never)
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await vi.waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({
        email: 'you@example.com',
        password: 'secret',
      }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows the auth error and does not navigate on failure', async () => {
    signIn.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    } as never)
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    await fillCredentials(user)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(
      await screen.findByText('Invalid login credentials'),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
