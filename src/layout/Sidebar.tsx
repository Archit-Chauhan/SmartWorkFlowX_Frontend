import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo, { LogoMark } from '../assets/Logo';
import { useSidebarCollapsed } from '../hooks/useSidebar';
import {
  LayoutDashboard,
  ClipboardList,
  GitBranch,
  Users,
  History,
  Send,
  X,
  ListFilter,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();
  const { collapsed, toggle } = useSidebarCollapsed();

  // Hover/focus label for the icon rail. Rendered fixed so the scrolling nav cannot clip it.
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  const showTip = (label: string, el: HTMLElement) => {
    if (!collapsed) return;
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 8 });
  };
  const hideTip = () => setTip(null);

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: <LayoutDashboard size={18} />,
      roles: ['Admin', 'Manager', 'Employee', 'Auditor'],
      exact: true,
    },
    {
      to: '/tasks',
      label: 'My Tasks',
      icon: <ClipboardList size={18} />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      to: '/all-tasks',
      label: 'All Tasks',
      icon: <ListFilter size={18} />,
      roles: ['Admin', 'Manager'],
    },
    {
      to: '/assign',
      label: 'Assign Task',
      icon: <Send size={18} />,
      roles: ['Admin', 'Manager'],
    },
    {
      to: '/workflows',
      label: 'Workflows',
      icon: <GitBranch size={18} />,
      roles: ['Admin', 'Manager'],
    },
    {
      to: '/users',
      label: 'Manage Users',
      icon: <Users size={18} />,
      roles: ['Admin'],
    },
    {
      to: '/audit',
      label: 'Audit Logs',
      icon: <History size={18} />,
      roles: ['Admin', 'Auditor'],
    },
  ];

  const logoTone = 'text-sidebar-ink-strong [--logo-accent:var(--sidebar-accent)]';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar: drawer on mobile; full width or icon rail on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar text-sidebar-ink-strong border-r border-sidebar-border flex flex-col shrink-0 transition-[transform,width] duration-200 ease-in-out md:static md:translate-x-0 ${
          collapsed ? 'md:w-16' : 'md:w-60'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div
          className={`h-14 px-5 border-b border-sidebar-border flex items-center justify-between ${
            collapsed ? 'md:justify-center md:px-0' : ''
          }`}
        >
          <Logo className={`text-lg ${logoTone} ${collapsed ? 'md:hidden' : ''}`} />
          {collapsed && <LogoMark className={`hidden md:block h-7 w-7 ${logoTone}`} />}
          <button
            className="md:hidden text-sidebar-ink hover:text-sidebar-ink-strong"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 mt-4 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden" aria-label="Main">
          {navItems
            .filter(item => item.roles.includes(role || ''))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                aria-label={item.label}
                onMouseEnter={e => showTip(item.label, e.currentTarget)}
                onMouseLeave={hideTip}
                onFocus={e => showTip(item.label, e.currentTarget)}
                onBlur={hideTip}
                onClick={() => {
                  hideTip();
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 h-10 rounded-control border-l-2 transition-colors ${
                    collapsed ? 'md:justify-center md:px-0' : ''
                  } ${
                    isActive
                      ? 'border-accent bg-sidebar-hover text-sidebar-ink-strong'
                      : 'border-transparent text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-ink-strong'
                  }`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span className={`text-sm font-medium whitespace-nowrap ${collapsed ? 'md:sr-only' : ''}`}>
                  {item.label}
                </span>
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={() => {
              hideTip();
              toggle();
            }}
            onMouseEnter={e => showTip('Expand sidebar', e.currentTarget)}
            onMouseLeave={hideTip}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={`hidden md:flex items-center gap-3 w-full h-10 px-3 rounded-control text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-ink-strong transition-colors ${
              collapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span className="text-sm font-medium whitespace-nowrap">Collapse</span>}
          </button>
          <p className={`mt-2 text-center text-xs text-sidebar-ink ${collapsed ? 'md:hidden' : ''}`}>
            SmartWorkFlowX v2.0
          </p>
        </div>
      </aside>

      {/* Icon-rail tooltip */}
      {collapsed && tip && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="fixed z-[60] hidden md:block -translate-y-1/2 whitespace-nowrap rounded-control bg-ink px-2.5 py-1.5 text-xs font-medium text-canvas shadow-lg pointer-events-none"
        >
          {tip.label}
        </div>
      )}
    </>
  );
};

export default Sidebar;
