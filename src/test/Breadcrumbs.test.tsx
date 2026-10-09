import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Breadcrumbs />
    </MemoryRouter>
  );

describe('Breadcrumbs', () => {
  it('shows only the current page on the dashboard', () => {
    renderAt('/');
    expect(screen.getByText('Dashboard')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('shows group and page for nested sections, with the page marked current', () => {
    renderAt('/tasks');
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/');
  });

  it('groups administration pages', () => {
    renderAt('/audit');
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.getByText('Audit Logs')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to the URL for unknown pages', () => {
    renderAt('/some-new-page');
    expect(screen.getByText('Some New Page')).toHaveAttribute('aria-current', 'page');
  });
});
