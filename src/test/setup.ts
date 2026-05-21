import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock react-toastify globally
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
