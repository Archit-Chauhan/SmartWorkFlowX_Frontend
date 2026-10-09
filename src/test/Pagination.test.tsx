import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Pagination from '../components/Pagination';
import { getPageItems } from '../components/paginationUtils';

describe('getPageItems', () => {
  it('lists every page when there are few', () => {
    expect(getPageItems(1, 1)).toEqual([1]);
    expect(getPageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the right side near the start', () => {
    expect(getPageItems(1, 29)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 29]);
    expect(getPageItems(3, 29)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 29]);
  });

  it('collapses both sides in the middle', () => {
    expect(getPageItems(15, 29)).toEqual([1, 'ellipsis-left', 14, 15, 16, 'ellipsis-right', 29]);
    expect(getPageItems(6, 29)).toEqual([1, 'ellipsis-left', 5, 6, 7, 'ellipsis-right', 29]);
  });

  it('collapses the left side near the end', () => {
    expect(getPageItems(29, 29)).toEqual([1, 'ellipsis-left', 25, 26, 27, 28, 29]);
    expect(getPageItems(27, 29)).toEqual([1, 'ellipsis-left', 25, 26, 27, 28, 29]);
  });

  it('keeps a constant length regardless of page count', () => {
    for (const total of [8, 29, 500]) {
      for (const current of [1, Math.ceil(total / 2), total]) {
        expect(getPageItems(current, total)).toHaveLength(7);
      }
    }
  });

  it('clamps an out-of-range current page', () => {
    expect(getPageItems(99, 29)).toEqual(getPageItems(29, 29));
    expect(getPageItems(0, 29)).toEqual(getPageItems(1, 29));
  });
});

describe('Pagination', () => {
  const desktopNav = () => screen.getAllByRole('navigation', { name: 'Pagination' })[0];

  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a bounded set of buttons for many pages', () => {
    render(<Pagination currentPage={6} totalPages={29} totalItems={290} onPageChange={() => {}} />);
    const nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Go to page 29' })).toBeInTheDocument();
    expect(nav.getByRole('button', { name: 'Go to page 6' })).toHaveAttribute('aria-current', 'page');
    expect(nav.queryByRole('button', { name: 'Go to page 15' })).not.toBeInTheDocument();
    expect(screen.getByText('290')).toBeInTheDocument();
  });

  it('disables first/previous on the first page and next/last on the last', () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />);
    let nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'First page' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Next page' })).toBeEnabled();

    rerender(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />);
    nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Last page' })).toBeDisabled();
  });

  it('calls onPageChange for page, previous, next, first and last', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={6} totalPages={29} onPageChange={onPageChange} />);
    const nav = within(desktopNav());

    fireEvent.click(nav.getByRole('button', { name: 'Go to page 7' }));
    fireEvent.click(nav.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(nav.getByRole('button', { name: 'Next page' }));
    fireEvent.click(nav.getByRole('button', { name: 'First page' }));
    fireEvent.click(nav.getByRole('button', { name: 'Last page' }));

    expect(onPageChange.mock.calls.map(c => c[0])).toEqual([7, 5, 7, 1, 29]);
  });
});
