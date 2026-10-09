import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
      <div className="bg-canvas border border-hairline rounded-card shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-hairline">
          {isDangerous && <AlertTriangle className="text-error shrink-0" size={20} />}
          <h2 className="section-title">{title}</h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-ghost !px-2 ml-auto"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-ink-muted text-sm">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-1 border-t border-hairline flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="btn btn-secondary"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}`}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
