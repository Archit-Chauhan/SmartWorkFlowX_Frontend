import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { getPageItems } from './paginationUtils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

const baseButton =
  'inline-flex items-center justify-center h-9 min-w-9 px-2 rounded-control border text-sm transition-colors duration-150 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';
const idleButton = `${baseButton} border-hairline-strong bg-canvas text-ink hover:bg-surface-1 disabled:hover:bg-canvas`;
const activeButton = `${baseButton} border-accent bg-accent text-on-accent font-semibold`;

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;
  const atStart = currentPage === 1;
  const atEnd = currentPage === totalPages;

  const edgeControls = (
    <>
      <button
        type="button"
        onClick={() => onPageChange(1)}
        disabled={atStart}
        className={idleButton}
        aria-label="First page"
      >
        <ChevronsLeft size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={atStart}
        className={idleButton}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
    </>
  );

  const trailingControls = (
    <>
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={atEnd}
        className={idleButton}
        aria-label="Next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onPageChange(totalPages)}
        disabled={atEnd}
        className={idleButton}
        aria-label="Last page"
      >
        <ChevronsRight size={16} aria-hidden="true" />
      </button>
    </>
  );

  return (
    <div className="flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-4 py-3 sm:px-6 mt-4">
      {/* Summary */}
      {totalItems !== undefined && (
        <p className="hidden sm:block text-sm text-ink-muted whitespace-nowrap">
          Showing <span className="font-medium text-ink">{startItem}</span> to{' '}
          <span className="font-medium text-ink">{endItem}</span> of{' '}
          <span className="font-medium text-ink">{totalItems}</span> results
        </p>
      )}

      {/* Desktop: first, previous, windowed pages with ellipses, next, last */}
      <nav className="hidden sm:flex items-center gap-1 ml-auto" aria-label="Pagination">
        {edgeControls}
        {getPageItems(currentPage, totalPages, 1).map(item =>
          typeof item === 'number' ? (
            <button
              type="button"
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === currentPage ? 'page' : undefined}
              aria-label={`Go to page ${item}`}
              className={item === currentPage ? activeButton : idleButton}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="inline-flex items-center justify-center h-9 min-w-9 text-ink-subtle" aria-hidden="true">
              …
            </span>
          )
        )}
        {trailingControls}
      </nav>

      {/* Mobile: compact controls with a page indicator */}
      <nav className="flex sm:hidden w-full items-center justify-between gap-1" aria-label="Pagination">
        <div className="flex items-center gap-1">{edgeControls}</div>
        <span className="text-sm text-ink-muted">
          Page <span className="font-medium text-ink">{currentPage}</span> of {totalPages}
        </span>
        <div className="flex items-center gap-1">{trailingControls}</div>
      </nav>
    </div>
  );
};

export default Pagination;
