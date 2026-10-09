import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`alert fixed bottom-5 right-5 flex items-center gap-3 !px-4 !py-3 shadow-lg ${
      type === 'success' ? 'alert-success' : 'alert-error'
    }`}>
      {type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="hover:opacity-70" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
