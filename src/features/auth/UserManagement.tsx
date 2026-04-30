import React, { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import type { User, UserRole, PaginatedResponse } from '../../models';
import { UserPlus, User as UserIcon, CheckCircle, Trash2 } from 'lucide-react';
import Pagination from '../../components/Pagination';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: 3 // Default to Employee
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get<PaginatedResponse<User>>(`/Admin/users?page=${page}&limit=${limit}`);
      setUsers(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axiosInstance.post('/Admin/users', formData);
      setShowForm(false);
      setFormData({ name: '', email: '', password: '', roleId: 3 });
      fetchUsers(); // Refresh the list
      alert("User registered successfully!");
    } catch (err) {
      alert("Error registering user. Ensure email is unique.");
    }
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      try {
        await axiosInstance.delete(`/Admin/users/${userId}`);
        fetchUsers(); // Fetch fresh paginated data
        alert("User deleted successfully.");
      } catch (err: any) {
        const message = err.response?.data?.message || "Error deleting user.";
        alert(message);
      }
    }
  };

  const roles: { id: number; name: UserRole }[] = [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'Manager' },
    { id: 3, name: 'Employee' },
    { id: 4, name: 'Auditor' },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <p className="text-sm text-gray-500">Create and manage system stakeholders</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
        >
          <UserPlus size={18} />
          {showForm ? 'Close Form' : 'Register New User'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
              <input 
                type="text" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
              <input 
                type="email" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Temporary Password</label>
              <input 
                type="text" required
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">System Role</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.roleId}
                onChange={(e) => setFormData({...formData, roleId: parseInt(e.target.value)})}
              >
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-bold transition-colors">
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
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">Loading users...</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.userId} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-full text-blue-600 group-hover:bg-blue-200 transition-colors">
                        <UserIcon size={16} />
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold rounded-full uppercase border border-gray-200">
                        {roles.find(r => r.id === u.roleId)?.name || 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CheckCircle size={18} className="text-green-500 inline" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(u.userId, u.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={5} className="p-10 text-center text-gray-400">No users found.</td></tr>
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
    </div>
  );
};

export default UserManagement;