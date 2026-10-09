import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  GitBranch,
  Users,
  History,
  Send,
  X,
  ListFilter
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuth();

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

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-overlay md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-sidebar text-sidebar-ink-strong flex flex-col shrink-0 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 px-5 text-lg font-semibold tracking-tight border-b border-sidebar-border flex justify-between items-center">
          <div>SWFX <span className="text-sidebar-ink font-normal">Pro</span></div>
          <button className="md:hidden text-sidebar-ink hover:text-sidebar-ink-strong" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 mt-4 px-2 space-y-0.5 overflow-y-auto">
          {navItems
            .filter(item => item.roles.includes(role || ''))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 h-10 rounded-control border-l-2 transition-colors ${
                    isActive
                      ? 'border-accent bg-sidebar-hover text-sidebar-ink-strong'
                      : 'border-transparent text-sidebar-ink hover:bg-sidebar-hover hover:text-sidebar-ink-strong'
                  }`
                }
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-ink text-center">
          SmartWorkFlowX v2.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;