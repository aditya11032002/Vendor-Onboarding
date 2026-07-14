import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, UserX, AlertCircle, CheckCircle2, User, Key, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function UsersSettings({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Approver');
  const [formLoading, setFormLoading] = useState(false);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to fetch users list');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Error loading users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Handle Create User Submit
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !role) {
      setError('Please fill in all user registration fields.');
      return;
    }

    setFormLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          role: role
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create user account');
      }

      setSuccess(`User "${username}" was created successfully.`);
      setUsername('');
      setPassword('');
      setRole('Approver');
      fetchUsers(); // Refresh list
    } catch (err) {
      setError(err.message || 'Failed to create user.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId, targetUsername) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user account "${targetUsername}"?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }

      setSuccess(`User "${targetUsername}" deleted successfully.`);
      fetchUsers(); // Refresh list
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 animate-fadeIn">

      {/* Title Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-300 tracking-tight">System Settings</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">Manage user accounts and allocate system authorization roles.</p>
      </div>

      {/* Message Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs md:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs md:text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="font-semibold">{success}</div>
        </div>
      )}

      {/* Main Settings Panel: Create + List split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Create User Form */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-300">Add New Account</h3>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorization Role</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Shield className="w-4 h-4" />
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="Approver">Approver</option>
                  <option value="Admin">Admin (Full Access)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 px-4 font-bold text-xs shadow-sm hover:shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {formLoading ? 'Creating User...' : 'Register User'}
            </button>
          </form>
        </div>

        {/* Right Column: Registered Users Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 mb-5">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-400">Authorized Accounts ({users.length})</h3>
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400 font-semibold text-xs">
              Loading users database...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-semibold text-xs">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-400 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-3 pl-4">Username</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Created On</th>
                    <th className="p-3 text-right pr-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 pl-4 font-bold text-slate-400">{user.username}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'Admin'
                          ? 'bg-purple-50 text-purple-600 border border-purple-100'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg transition"
                          title="Delete user account"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
