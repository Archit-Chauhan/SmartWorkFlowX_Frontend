import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface Crumb {
  label: string;
  /** Group labels (no page of their own) have no link. */
  to?: string;
}

// Where each page sits. Pages not listed fall back to their URL segments.
const trail: Record<string, Crumb[]> = {
  '/': [{ label: 'Dashboard' }],
  '/tasks': [{ label: 'Tasks' }, { label: 'My Tasks' }],
  '/all-tasks': [{ label: 'Tasks' }, { label: 'All Tasks' }],
  '/assign': [{ label: 'Tasks' }, { label: 'Assign Task' }],
  '/workflows': [{ label: 'Workflows' }],
  '/users': [{ label: 'Administration' }, { label: 'Manage Users' }],
  '/audit': [{ label: 'Administration' }, { label: 'Audit Logs' }],
};

const titleCase = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function crumbsFor(pathname: string): Crumb[] {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  if (trail[clean]) return trail[clean];
  return clean.split('/').filter(Boolean).map(seg => ({ label: titleCase(seg) }));
}

/** Where the user is, shown in the top bar. On small screens only the current page is shown. */
const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const items = crumbsFor(pathname);
  const atRoot = pathname === '/';

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {!atRoot && (
          <li className="hidden sm:flex items-center gap-1.5">
            <Link to="/" className="flex items-center text-ink-subtle hover:text-ink transition-colors" aria-label="Dashboard">
              <Home size={15} />
            </Link>
            <ChevronRight size={14} className="text-ink-subtle" aria-hidden="true" />
          </li>
        )}
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${item.label}-${i}`}
              className={`items-center gap-1.5 min-w-0 ${last ? 'flex' : 'hidden sm:flex'}`}
            >
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-ink">
                  {item.label}
                </span>
              ) : (
                <>
                  <span className="truncate text-ink-muted">{item.label}</span>
                  <ChevronRight size={14} className="shrink-0 text-ink-subtle" aria-hidden="true" />
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
