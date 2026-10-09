import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import axiosInstance from '../api/axiosInstance';
import { toast } from 'react-toastify';

interface Props {
  onClose: () => void;
}

const ChangePasswordModal: React.FC<Props> = ({ onClose }) => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post('/Auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully.');
      onClose();
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to change password.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="bg-canvas border border-hairline rounded-card shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-accent" />
            <h2 className="section-title">Change Password</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost !px-2" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="label">Current Password</label>
            <input
              id="current-password"
              type="password"
              required
              className="input"
              value={form.currentPassword}
              onChange={e => setForm({ ...form, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="label">New Password</label>
            <input
              id="new-password"
              type="password"
              required
              minLength={6}
              className="input"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="label">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              required
              className="input"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
