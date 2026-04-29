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
  Radio
} from 'lucide-react';

const Sidebar: React.FC = () => {
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
    {
      to: '/broadcast',
      label: 'Broadcast',
      icon: <Radio size={20} />,
      roles: ['Admin'],
    },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="p-6 text-2xl font-bold border-b border-gray-800">
        SWFX <span className="text-blue-500">Pro</span>
      </div>

      <nav className="flex-1 mt-6 px-3 space-y-1">
        {navItems
          .filter(item => item.roles.includes(role || ''))
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
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
  );
};

export default Sidebar;