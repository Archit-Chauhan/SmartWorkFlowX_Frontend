import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from '../features/auth/Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC-A01: Login with valid credentials — login() called and navigates to /', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'admin@smartwfx.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Admin@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'admin@smartwfx.com',
        password: 'Admin@123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('TC-A02: Login with wrong password — error message displayed', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: 'Invalid credentials.' },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'admin@smartwfx.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'WrongPassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('TC-A03: Login with nonexistent email — error message displayed', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: 'Invalid credentials.' },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'nobody@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
    });
  });

  it('TC-A04: Login with soft-deleted account — deactivated error message displayed', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: 'Your account has been deactivated.' },
    });

    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Email address'), {
      target: { value: 'deleted@smartwfx.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Your account has been deactivated.')
      ).toBeInTheDocument();
    });
  });

  it('TC-A14: Empty email field — validation error shown before submission', async () => {
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'Password@123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('TC-A18: Page renders login form for unauthenticated users', () => {
    renderLogin();

    expect(screen.getByText(/SmartWorkFlow/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
