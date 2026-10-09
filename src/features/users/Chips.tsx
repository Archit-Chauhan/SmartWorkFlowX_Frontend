import React from 'react';
import { Check, X } from 'lucide-react';

export const RoleChip: React.FC<{ roleName: string }> = ({ roleName }) => (
  <span className={`chip ${roleName === 'Admin' ? 'bg-accent-soft text-accent' : roleName === 'Manager' ? 'chip-progress' : 'chip-neutral'}`}>{roleName}</span>
);

export const StatusChip: React.FC<{ deactivated: boolean }> = ({ deactivated }) =>
  deactivated ? (
    <span className="chip chip-rejected"><X size={12} aria-hidden="true" /> Deactivated</span>
  ) : (
    <span className="chip chip-completed"><Check size={12} aria-hidden="true" /> Active</span>
  );
