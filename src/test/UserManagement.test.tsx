import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from '../features/auth/UserManagement';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-toastify';

vi.mock('../api/axiosInstance', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe('UserManagement Component', () => {
  const mockUsers = [
    { userId: 1, name: 'Alice Smith', email: 'alice@example.com', roleId: 1, createdAt: '2026-05-21T10:00:00Z' },
    { userId: 2, name: 'Bob Jones', email: 'bob@example.com', roleId: 3, createdAt: '2026-05-21T10:00:00Z' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        data: mockUsers,
        total: 2,
      },
    });
  });

  it('TC-U01: renders correctly and fetches paginated user list on mount', async () => {
    render(<UserManagement />);

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Loading users...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();

    expect(axiosInstance.get).toHaveBeenCalledWith('/Admin/users?page=1&limit=10');
  });

  it('TC-U03: opens registration form, submits successfully and shows toast success', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValue({});

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });

    const registerBtn = screen.getByRole('button', { name: /register new user/i });
    fireEvent.click(registerBtn);

    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/temporary password/i);
    const roleSelect = screen.getByLabelText(/system role/i);

    fireEvent.change(nameInput, { target: { value: 'Charlie Brown' } });
    fireEvent.change(emailInput, { target: { value: 'charlie@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(roleSelect, { target: { value: '2' } });

    const submitBtn = screen.getByRole('button', { name: /confirm registration/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/Admin/users', {
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        password: 'password123',
        roleId: 2,
      });
    });

    expect(toast.success).toHaveBeenCalledWith('User registered successfully!');
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });

  it('TC-U07: asks for confirmation and soft-deletes user successfully', async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValue({});

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle('Deactivate User');
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText("Are you sure you want to deactivate Alice Smith? They will not be able to log in until restored.")).toBeInTheDocument();

    const modalConfirmBtn = screen.getByRole('button', { name: /^deactivate$/i });
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(axiosInstance.delete).toHaveBeenCalledWith('/Admin/users/1');
    });

    expect(toast.success).toHaveBeenCalledWith('User deactivated successfully.');
  });
});
