import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from './UserManagement';
import axiosInstance from '../../api/axiosInstance';
import { toast } from 'react-toastify';

// Mock axiosInstance
vi.mock('../../api/axiosInstance', () => {
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
    
    // Default GET response for users
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: {
        data: mockUsers,
        total: 2,
      },
    });
  });

  it('renders correctly and fetches users on mount', async () => {
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

  it('opens registration form, submits successfully and shows toast success', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValue({});
    
    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });

    // Click Register New User button
    const registerBtn = screen.getByRole('button', { name: /register new user/i });
    fireEvent.click(registerBtn);

    // Form inputs should now be visible
    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/temporary password/i);
    const roleSelect = screen.getByLabelText(/system role/i);

    // Fill the form
    fireEvent.change(nameInput, { target: { value: 'Charlie Brown' } });
    fireEvent.change(emailInput, { target: { value: 'charlie@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(roleSelect, { target: { value: '2' } }); // Manager RoleId = 2

    // Submit form
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
    
    // The form should be closed
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });

  it('asks for confirmation and deletes user successfully', async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValue({});

    render(<UserManagement />);

    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });

    // Click the delete button for Alice Smith
    const deleteButtons = screen.getAllByTitle('Delete User');
    expect(deleteButtons).toHaveLength(2);
    fireEvent.click(deleteButtons[0]);

    // ConfirmationModal should appear with the correct message
    expect(screen.getByText('Are you sure you want to delete Alice Smith? This action cannot be undone.')).toBeInTheDocument();

    // Click the "Delete" confirm button inside the modal
    const modalConfirmBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(axiosInstance.delete).toHaveBeenCalledWith('/Admin/users/1');
    });

    expect(toast.success).toHaveBeenCalledWith('User deleted successfully.');
  });
});
