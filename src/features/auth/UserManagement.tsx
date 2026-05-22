import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { User, UserRole, PaginatedResponse } from '../../models';
import { UserPlus, User as UserIcon, Trash2, Search, Download, RotateCcw, ShieldOff, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import Pagination from '../../components/Pagination';
import ConfirmationModal from '../../components/ConfirmationModal';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; userId: number | null; userName: string }>({ isOpen: false, userId: null, userName: '' });
  const [restoreModal, setRestoreModal] = useState<{ isOpen: boolean; userId: number | null; userName: string }>({ isOpen: false, userId: null, userName: '' });
  const [isActioning, setIsActioning] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [formData, setFormData] = useState({ name: '', email: '', password: '', roleId: 3 });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      const response = await axiosInstance.get<PaginatedResponse<User>>(`/Admin/users?${params}`);
      setUsers(response.data.data);
      setTotal(response.data.total);
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await axiosInstance.get(`/Admin/users/export?${params}`, { responseType: 'blob' });
      const href = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = href;
      a.download = 'users.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(href);
    } catch {
      toast.error('Failed to export users.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/Admin/users', formData);
      setShowForm(false);
      setFormData({ name: '', email: '', password: '', roleId: 3 });
      await fetchUsers();
      toast.success('User registered successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error registering user.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.userId) return;
    setIsActioning(true);
    try {
      await axiosInstance.delete(`/Admin/users/${deleteModal.userId}`);
      await fetchUsers();
      toast.success('User deactivated successfully.');
      setDeleteModal({ isOpen: false, userId: null, userName: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error deactivating user.');
    } finally {
      setIsActioning(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreModal.userId) return;
    setIsActioning(true);
    try {
      await axiosInstance.put(`/Admin/users/${restoreModal.userId}/restore`);
      await fetchUsers();
      toast.success('User restored successfully.');
      setRestoreModal({ isOpen: false, userId: null, userName: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error restoring user.');
    } finally {
      setIsActioning(false);
    }
  };

  const roles: { id: number; name: UserRole }[] = [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'Manager' },
    { id: 3, name: 'Employee' },
    { id: 4, name: 'Auditor' },
  ];

  const totalPages = Math.ceil(total / limit);
  const activeCount = users.filter(u => !u.isDeleted).length;
  const deactivatedCount = users.filter(u => u.isDeleted).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <p className="text-sm text-gray-500">
            {activeCount} active · <span className="text-red-500">{deactivatedCount} deactivated</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-48"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all shadow-sm text-sm disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
          >
            <UserPlus size={18} />
            {showForm ? 'Close Form' : 'Register New User'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
              <input id="reg-name" type="text" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
              <input id="reg-email" type="email" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs font-bold text-gray-500 uppercase mb-1">Temporary Password</label>
              <input id="reg-password" type="text" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-role" className="block text-xs font-bold text-gray-500 uppercase mb-1">System Role</label>
              <select id="reg-role"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.roleId}
                onChange={e => setFormData({ ...formData, roleId: parseInt(e.target.value) })}
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end">
              <button type="submit" className="w-full sm:w-auto bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-bold transition-colors">
                Confirm Registration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">No users found.</td></tr>
              ) : (
                users.map(u => (
                  <tr
                    key={u.userId}
                    className={`transition-colors group ${u.isDeleted ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 flex items-center gap-3 whitespace-nowrap">
                      <div className={`p-2 rounded-full transition-colors ${u.isDeleted ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200'}`}>
                        <UserIcon size={16} />
                      </div>
                      <span className={`font-medium ${u.isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{u.name}</span>
                    </td>
                    <td className={`px-6 py-4 text-sm whitespace-nowrap ${u.isDeleted ? 'text-gray-400' : 'text-gray-600'}`}>{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase border ${u.isDeleted ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {roles.find(r => r.id === u.roleId)?.name || 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {u.isDeleted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                          <ShieldOff size={12} /> Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          <ShieldCheck size={12} /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {u.isDeleted ? (
                        <button
                          onClick={() => setRestoreModal({ isOpen: true, userId: u.userId, userName: u.name })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-all"
                          title="Restore User"
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, userId: u.userId, userName: u.name })}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Deactivate User"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${deleteModal.userName}? They will not be able to log in until restored.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={isActioning}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, userId: null, userName: '' })}
      />

      <ConfirmationModal
        isOpen={restoreModal.isOpen}
        title="Restore User"
        message={`Restore ${restoreModal.userName}? They will be able to log in again immediately.`}
        confirmText="Restore"
        cancelText="Cancel"
        isDangerous={false}
        isLoading={isActioning}
        onConfirm={confirmRestore}
        onCancel={() => setRestoreModal({ isOpen: false, userId: null, userName: '' })}
      />
    </div>
  );
};

export default UserManagement;
