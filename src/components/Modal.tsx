import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay p-4">
      <div className="bg-canvas border border-hairline w-full max-w-lg rounded-card shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <h3 className="section-title">{title}</h3>
          <button onClick={onClose} className="btn btn-ghost !px-2" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
