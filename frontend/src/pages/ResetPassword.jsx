import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Key } from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../config';

export default function ResetPassword({ token, username, onSuccess, onLogout }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: newPassword.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update password');
      }

      onSuccess(data.token);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-8 relative animate-fadeIn">
      
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 bg-indigo-950/80 border border-indigo-850 rounded-xl flex items-center justify-center text-indigo-400 mb-4">
          <Key className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-100 text-center">
          Reset Your Password
        </h2>
        <p className="text-slate-400 text-xs mt-1 text-center font-medium leading-relaxed">
          Hello <strong>{username}</strong>. For security, please choose a password of your choice before proceeding to the onboarding form.
        </p>
      </div>

      {/* Error Alert Block */}
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-955 border border-rose-800 text-rose-400 text-xs flex items-start gap-2.5 animate-shake">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block" htmlFor="new-pass">
            New Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
              <Lock className="w-4 h-4" />
            </span>
            <input
              id="new-pass"
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full bg-slate-955 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-10 pr-10 text-xs placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block" htmlFor="confirm-pass">
            Confirm New Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
              <Lock className="w-4 h-4" />
            </span>
            <input
              id="confirm-pass"
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full bg-slate-955 border border-slate-800 text-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 px-4 font-bold text-xs shadow-md hover:shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loading ? 'Updating Password...' : 'Save Password & Continue'}
        </button>

        {/* Cancel / Logout */}
        <button
          type="button"
          onClick={onLogout}
          className="w-full bg-transparent hover:bg-slate-850/40 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-750 rounded-xl py-2.5 px-4 font-bold text-xs transition"
        >
          Cancel & Logout
        </button>
      </form>
    </div>
  );
}
