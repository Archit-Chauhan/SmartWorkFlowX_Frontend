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
  X
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
      icon: <LayoutDashboard size={20} />,
      roles: ['Admin', 'Manager', 'Employee', 'Auditor'],
      exact: true,
    },
    {
      to: '/tasks',
      label: 'My Tasks',
      icon: <ClipboardList size={20} />,
      roles: ['Admin', 'Manager', 'Employee'],
    },
    {
      to: '/assign',
      label: 'Assign Task',
      icon: <Send size={20} />,
      roles: ['Admin', 'Manager'],
    },
    {
      to: '/workflows',
      label: 'Workflows',
      icon: <GitBranch size={20} />,
      roles: ['Admin', 'Manager'],
    },
    {
      to: '/users',
      label: 'Manage Users',
      icon: <Users size={20} />,
      roles: ['Admin'],
    },
    {
      to: '/audit',
      label: 'Audit Logs',
      icon: <History size={20} />,
      roles: ['Admin', 'Auditor'],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col shrink-0 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 text-2xl font-bold border-b border-gray-800 flex justify-between items-center">
          <div>SWFX <span className="text-blue-500">Pro</span></div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1 overflow-y-auto">
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
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-gray-800 text-xs text-gray-600 text-center">
          SmartWorkFlowX v2.0
        </div>
      </aside>
    </>
  );
};

export default Sidebar;