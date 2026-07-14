import React, { useState, useEffect } from 'react';
import {
  Search, Filter, CheckCircle2, XCircle, AlertCircle, Eye,
  Building2, CreditCard, X, MapPin, User, FileText, ArrowUpDown, ShieldCheck
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Dashboard({ token, userRole, onLogout }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');

  // Detail Drawer State
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Admin Editing State
  const isAdmin = userRole === 'Admin';
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editData, setEditData] = useState(null);

  const startEditing = () => {
    setEditData({
      legalName: selectedVendor.legalName || '',
      tradeName: selectedVendor.tradeName || '',
      entityType: selectedVendor.entityType || 'Proprietorship',
      dateOfIncorporation: selectedVendor.dateOfIncorporation || '',
      cin: selectedVendor.cin || '',
      llpin: selectedVendor.llpin || '',
      pan: selectedVendor.pan || '',
      gstin: selectedVendor.gstin || '',
      msmeStatus: selectedVendor.msmeStatus || 'No',
      udyamNumber: selectedVendor.udyamNumber || '',
      registeredAddress: {
        street: selectedVendor.registeredAddress?.street || '',
        city: selectedVendor.registeredAddress?.city || '',
        state: selectedVendor.registeredAddress?.state || '',
        pincode: selectedVendor.registeredAddress?.pincode || '',
        country: selectedVendor.registeredAddress?.country || '',
        stateCode: selectedVendor.registeredAddress?.stateCode || ''
      },
      billingAddress: {
        street: selectedVendor.billingAddress?.street || '',
        city: selectedVendor.billingAddress?.city || '',
        state: selectedVendor.billingAddress?.state || '',
        pincode: selectedVendor.billingAddress?.pincode || '',
        country: selectedVendor.billingAddress?.country || '',
        stateCode: selectedVendor.billingAddress?.stateCode || ''
      },
      primaryContact: {
        name: selectedVendor.primaryContact?.name || '',
        designation: selectedVendor.primaryContact?.designation || '',
        mobile: selectedVendor.primaryContact?.mobile || '',
        email: selectedVendor.primaryContact?.email || ''
      },
      financeContact: {
        name: selectedVendor.financeContact?.name || '',
        designation: selectedVendor.financeContact?.designation || '',
        mobile: selectedVendor.financeContact?.mobile || '',
        email: selectedVendor.financeContact?.email || ''
      },
      bankDetails: {
        beneficiaryName: selectedVendor.bankDetails?.beneficiaryName || '',
        bankName: selectedVendor.bankDetails?.bankName || '',
        branchName: selectedVendor.bankDetails?.branchName || '',
        accountNumber: selectedVendor.bankDetails?.accountNumber || '',
        ifscCode: selectedVendor.bankDetails?.ifscCode || '',
        accountType: selectedVendor.bankDetails?.accountType || 'Current Account'
      },
      verificationLogs: selectedVendor.verificationLogs || {},
      googleFormResponseId: selectedVendor.googleFormResponseId || '',
      panFileUrl: selectedVendor.panFileUrl || '',
      gstFileUrl: selectedVendor.gstFileUrl || ''
    });
    setIsEditing(true);
  };

  const saveVendorEdits = async () => {
    if (!editData.legalName.trim() || !editData.pan.trim()) {
      alert('Legal Name and PAN Card fields are required.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${selectedVendor.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editData)
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) {
        const errorMsg = await res.json();
        throw new Error(errorMsg.message || 'Failed to save changes.');
      }
      const updated = await res.json();

      // Update lists and close editor
      setVendors(prev => prev.map(v => v.id === selectedVendor.id ? updated : v));
      setSelectedVendor(updated);
      setIsEditing(false);
      alert('Vendor details successfully updated in database!');
    } catch (err) {
      alert(`Error saving edits: ${err.message}`);
    } finally {
      setEditLoading(false);
    }
  };

  // Fetch all vendors from API
  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/vendors`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        onLogout();
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch vendors list');
      const data = await res.json();
      setVendors(data);
    } catch (err) {
      setError(err.message || 'Error loading vendor data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Handle Approve / Reject action
  const handleStatusUpdate = async (vendorId, newStatus) => {
    if (!commentInput.trim() && newStatus === 'Rejected') {
      alert('Please specify a rejection reason in the comments section.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vendors/${vendorId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          comments: commentInput.trim() || `Vendor status changed to ${newStatus}.`
        })
      });

      if (res.status === 401) {
        onLogout();
        return;
      }

      if (!res.ok) throw new Error('Failed to update status');

      const updatedVendor = await res.json();

      // Update local state
      setVendors(prev => prev.map(v => v.id === vendorId ? updatedVendor : v));
      setSelectedVendor(updatedVendor);
      setCommentInput('');
      alert(`Vendor status successfully updated to ${newStatus}.`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter vendors based on selections
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch =
      vendor.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.pan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (vendor.gstin && vendor.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (vendor.tradeName && vendor.tradeName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || vendor.status === statusFilter;
    const matchesEntity = entityFilter === 'All' || vendor.entityType === entityFilter;

    return matchesSearch && matchesStatus && matchesEntity;
  });

  // Calculate statistics
  const stats = {
    total: vendors.length,
    pending: vendors.filter(v => v.status === 'Pending').length,
    approved: vendors.filter(v => v.status === 'Approved').length,
    rejected: vendors.filter(v => v.status === 'Rejected').length
  };

  // Unique entity types in database for filter list
  const entityTypes = ['All', ...new Set(vendors.map(v => v.entityType))];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Dashboard Container */}
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
              Onboarding Control Panel
            </h1>
            <p className="text-slate-400 mt-1">Review, verify, and manage vendor compliance profiles.</p>
          </div>
          <button
            onClick={fetchVendors}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl transition text-sm font-semibold self-start md:self-center"
          >
            Refresh Database
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform">
              <Building2 className="w-32 h-32 text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Applications</span>
            <h2 className="text-3xl font-black text-slate-100 mt-2">{stats.total}</h2>
            <div className="w-12 h-1 bg-indigo-500 rounded-full mt-4" />
          </div>

          {/* Pending */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-32 h-32 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Awaiting Review</span>
            <h2 className="text-3xl font-black text-amber-400 mt-2">{stats.pending}</h2>
            <div className="w-12 h-1 bg-amber-500 rounded-full mt-4" />
          </div>

          {/* Approved */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-32 h-32 text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved Vendors</span>
            <h2 className="text-3xl font-black text-emerald-400 mt-2">{stats.approved}</h2>
            <div className="w-12 h-1 bg-emerald-500 rounded-full mt-4" />
          </div>

          {/* Rejected */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5 group-hover:scale-110 transition-transform">
              <XCircle className="w-32 h-32 text-rose-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected Profiles</span>
            <h2 className="text-3xl font-black text-rose-400 mt-2">{stats.rejected}</h2>
            <div className="w-12 h-1 bg-rose-500 rounded-full mt-4" />
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Name, PAN, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Status & Entity Filter Dropdowns */}
          <div className="flex flex-wrap w-full md:w-auto gap-4 items-center justify-end">
            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400">
              <Filter className="w-4 h-4 text-slate-500" />
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-400">
              <span>Entity:</span>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {entityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Vendors Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="text-center py-20 text-slate-400 font-semibold">
              Loading vendor databases...
            </div>
          ) : error ? (
            <div className="text-center py-20 text-rose-400 font-semibold flex flex-col items-center gap-3">
              <AlertCircle className="w-10 h-10" />
              <span>{error}</span>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-20 text-slate-500 font-semibold">
              No matching vendor profiles found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-xs text-slate-400 font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">Vendor Name</th>
                    <th className="p-4">Entity Type</th>
                    <th className="p-4">PAN</th>
                    <th className="p-4">GSTIN</th>
                    <th className="p-4">MSME</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right pr-6">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-sm">
                  {filteredVendors.map(vendor => (
                    <tr key={vendor.id} className="hover:bg-slate-850/30 transition-colors">
                      <td className="p-4 pl-6 font-semibold">
                        <div>{vendor.legalName}</div>
                        {vendor.tradeName && <div className="text-xs text-slate-500 font-normal">{vendor.tradeName}</div>}
                      </td>
                      <td className="p-4 text-slate-300">{vendor.entityType}</td>
                      <td className="p-4">
                        <div className="font-mono text-xs font-semibold text-slate-300">{vendor.pan}</div>
                        <div className="mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${vendor.panVerificationStatus === 'Verified'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                            : vendor.panVerificationStatus === 'Verification Failed'
                              ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                              : 'bg-slate-950 text-slate-500 border border-slate-850'
                            }`}>
                            {vendor.panVerificationStatus || 'Unverified'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {vendor.gstin ? (
                          <>
                            <div className="font-mono text-xs font-semibold text-slate-300">{vendor.gstin}</div>
                            <div className="mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${vendor.gstVerificationStatus === 'Verified'
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                                : vendor.gstVerificationStatus === 'Verification Failed'
                                  ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                                  : 'bg-slate-950 text-slate-500 border border-slate-850'
                                }`}>
                                {vendor.gstVerificationStatus || 'Unverified'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-600">Unregistered</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${vendor.msmeStatus === 'Yes'
                          ? 'bg-purple-950/40 text-purple-400 border border-purple-800/50'
                          : 'bg-slate-950 text-slate-500 border border-slate-850'
                          }`}>
                          {vendor.msmeStatus === 'Yes' ? 'MSME' : 'No'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${vendor.status === 'Approved' && 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
                          } ${vendor.status === 'Pending' && 'bg-amber-950/40 text-amber-400 border border-amber-800/50'
                          } ${vendor.status === 'Rejected' && 'bg-rose-950/40 text-rose-400 border border-rose-800/50'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${vendor.status === 'Approved' ? 'bg-emerald-400' :
                            vendor.status === 'Pending' ? 'bg-amber-400' : 'bg-rose-400'
                            }`} />
                          {vendor.status}
                        </span>
                      </td>
                      <td className="p-4 text-right pr-6">
                        <button
                          onClick={() => {
                            setSelectedVendor(vendor);
                            setCommentInput('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/50 hover:bg-indigo-900 border border-indigo-900 hover:border-indigo-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold rounded-lg transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review
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

      {/* Detail Drawer (Overlay Modal Centered) */}
      {selectedVendor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-fadeIn">
          {/* Centered Modal Panel */}
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl max-h-[90vh] overflow-y-auto flex flex-col justify-between shadow-2xl relative">

            {/* Close button */}
            <button
              onClick={() => {
                setSelectedVendor(null);
                setIsEditing(false);
              }}
              className="absolute top-4 right-4 p-2 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Content Body */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Header Title */}
              <div className="flex justify-between items-start">
                <div className="flex-1 mr-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block border ${selectedVendor.status === 'Approved' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/50' :
                    selectedVendor.status === 'Pending' ? 'bg-amber-950/40 text-amber-400 border-amber-800/50' :
                      'bg-rose-950/40 text-rose-400 border-rose-800/50'
                    }`}>
                    {selectedVendor.status}
                  </span>

                  {!isEditing ? (
                    <>
                      <h2 className="text-2xl font-black text-slate-100 mt-2">{selectedVendor.legalName}</h2>
                      {selectedVendor.tradeName && <p className="text-slate-400 text-sm font-medium mt-1">DBA: {selectedVendor.tradeName}</p>}
                      {selectedVendor.googleFormResponseId && (
                        <p className="text-slate-500 text-[11px] font-semibold mt-1 bg-slate-950 px-2 py-1.5 rounded-lg border border-slate-800/40 w-fit">
                          Google Form ID: <span className="font-mono text-slate-300 select-all">{selectedVendor.googleFormResponseId}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Legal Name</label>
                        <input
                          type="text"
                          value={editData.legalName}
                          onChange={e => setEditData({ ...editData, legalName: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Trade Name (DBA)</label>
                        <input
                          type="text"
                          value={editData.tradeName}
                          onChange={e => setEditData({ ...editData, tradeName: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Google Form Response ID</label>
                        <input
                          type="text"
                          value={editData.googleFormResponseId}
                          onChange={e => setEditData({ ...editData, googleFormResponseId: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {!isEditing && selectedVendor.verificationLogs?.metadata?.website && (
                    <p className="text-slate-500 text-xs mt-1.5 font-medium">
                      Website: <a href={selectedVendor.verificationLogs.metadata.website.startsWith('http') ? selectedVendor.verificationLogs.metadata.website : `https://${selectedVendor.verificationLogs.metadata.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">{selectedVendor.verificationLogs.metadata.website}</a>
                    </p>
                  )}
                </div>

                {isAdmin && !isEditing && (
                  <button
                    onClick={startEditing}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap shadow-sm hover:shadow"
                  >
                    Edit Details
                  </button>
                )}
              </div>

              {/* SECTION 1: Tax & Identity Verification */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Tax & Statutory Profiles
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs md:text-sm">
                  <div>
                    <span className="text-slate-500 font-semibold">Constitution Type:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 font-bold mt-0.5">{selectedVendor.entityType}</p>
                    ) : (
                      <select
                        value={editData.entityType}
                        onChange={e => setEditData({ ...editData, entityType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Proprietorship">Proprietorship</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Private Limited">Private Limited</option>
                        <option value="Public Limited">Public Limited</option>
                        <option value="Trust">Trust</option>
                        <option value="LLP">LLP</option>
                        <option value="Service Provider">Service Provider</option>
                        <option value="Consultant">Consultant</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Commencement Date:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 font-bold mt-0.5">{selectedVendor.dateOfIncorporation || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.dateOfIncorporation}
                        onChange={e => setEditData({ ...editData, dateOfIncorporation: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">PAN Card (India):</span>
                    {!isEditing ? (
                      <p className="text-indigo-400 font-mono font-bold mt-0.5">{selectedVendor.pan}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.pan}
                        onChange={e => setEditData({ ...editData, pan: e.target.value.toUpperCase().trim() })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">GSTIN (India):</span>
                    {!isEditing ? (
                      <p className="text-indigo-400 font-mono font-bold mt-0.5">{selectedVendor.gstin || 'Unregistered'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.gstin}
                        onChange={e => setEditData({ ...editData, gstin: e.target.value.toUpperCase().trim() })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono font-bold"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">CIN (Corporate ID):</span>
                    {!isEditing ? (
                      <p className="text-slate-200 font-mono mt-0.5">{selectedVendor.cin || 'N/A'}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.cin}
                        onChange={e => setEditData({ ...editData, cin: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">MSME Status:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 mt-0.5">{selectedVendor.msmeStatus || 'No'}</p>
                    ) : (
                      <select
                        value={editData.msmeStatus}
                        onChange={e => setEditData({ ...editData, msmeStatus: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    )}
                  </div>
                  {(!isEditing && selectedVendor.udyamNumber || isEditing) && (
                    <div className="col-span-2">
                      <span className="text-slate-500 font-semibold">MSME Udyam Number:</span>
                      {!isEditing ? (
                        <p className="text-purple-400 font-mono font-bold mt-0.5">{selectedVendor.udyamNumber}</p>
                      ) : (
                        <input
                          type="text"
                          value={editData.udyamNumber}
                          onChange={e => setEditData({ ...editData, udyamNumber: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 1.5: Verification Logs */}
              {!isEditing && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Tax Identifier Verification Status (MOCK APIs)
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                        <div className="text-slate-500 font-semibold text-xs">PAN Verification</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedVendor.panVerificationStatus === 'Verified'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                            : selectedVendor.panVerificationStatus === 'Verification Failed'
                              ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                              : 'bg-slate-950 text-slate-500 border border-slate-850'
                            }`}>
                            {selectedVendor.panVerificationStatus || 'Unverified'}
                          </span>
                        </div>
                        {selectedVendor.verificationLogs?.panError && (
                          <p className="text-rose-400 text-xs mt-1 font-medium">{selectedVendor.verificationLogs.panError}</p>
                        )}
                        {selectedVendor.verificationLogs?.panDetails?.remarks && (
                          <p className="text-slate-400 text-[11px] mt-1">{selectedVendor.verificationLogs.panDetails.remarks}</p>
                        )}
                      </div>

                      <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                        <div className="text-slate-500 font-semibold text-xs">GSTIN Verification</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedVendor.gstVerificationStatus === 'Verified'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                            : selectedVendor.gstVerificationStatus === 'Verification Failed'
                              ? 'bg-rose-950/40 text-rose-400 border border-rose-800/30'
                              : 'bg-slate-950 text-slate-500 border border-slate-850'
                            }`}>
                            {selectedVendor.gstVerificationStatus || 'Unverified'}
                          </span>
                        </div>
                        {selectedVendor.verificationLogs?.gstinError && (
                          <p className="text-rose-400 text-xs mt-1 font-medium">{selectedVendor.verificationLogs.gstinError}</p>
                        )}
                        {selectedVendor.verificationLogs?.gstinDetails?.remarks && (
                          <p className="text-slate-400 text-[11px] mt-1">{selectedVendor.verificationLogs.gstinDetails.remarks}</p>
                        )}
                      </div>
                    </div>

                    {(selectedVendor.verificationLogs?.panVerifiedAt || selectedVendor.verificationLogs?.gstinVerifiedAt) && (
                      <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-900/60">
                        <span>PAN checked: {selectedVendor.verificationLogs.panVerifiedAt ? new Date(selectedVendor.verificationLogs.panVerifiedAt).toLocaleString() : 'N/A'}</span>
                        {selectedVendor.verificationLogs.gstinVerifiedAt && (
                          <span>GSTIN checked: {new Date(selectedVendor.verificationLogs.gstinVerifiedAt).toLocaleString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2: Address & Contact */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 text-xs md:text-sm">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address & Contact Person
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-500 font-semibold">Registered Office Address:</span>
                    {!isEditing ? (
                      <p className="text-slate-300 mt-0.5 leading-relaxed">
                        {selectedVendor.registeredAddress.street}, {selectedVendor.registeredAddress.city}, {selectedVendor.registeredAddress.state} - {selectedVendor.registeredAddress.pincode}
                        {selectedVendor.registeredAddress.country ? `, ${selectedVendor.registeredAddress.country}` : ''}
                        {selectedVendor.registeredAddress.stateCode ? ` (State Code: ${selectedVendor.registeredAddress.stateCode})` : ''}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <input
                          type="text"
                          placeholder="Street Address"
                          value={editData.registeredAddress.street}
                          onChange={e => setEditData({ ...editData, registeredAddress: { ...editData.registeredAddress, street: e.target.value } })}
                          className="col-span-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="City"
                          value={editData.registeredAddress.city}
                          onChange={e => setEditData({ ...editData, registeredAddress: { ...editData.registeredAddress, city: e.target.value } })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={editData.registeredAddress.state}
                          onChange={e => setEditData({ ...editData, registeredAddress: { ...editData.registeredAddress, state: e.target.value } })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Postal Code"
                          value={editData.registeredAddress.pincode}
                          onChange={e => setEditData({ ...editData, registeredAddress: { ...editData.registeredAddress, pincode: e.target.value } })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="Country"
                          value={editData.registeredAddress.country}
                          onChange={e => setEditData({ ...editData, registeredAddress: { ...editData.registeredAddress, country: e.target.value } })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-900 pt-3">
                    <div>
                      <span className="text-slate-500 font-semibold">Primary Contact:</span>
                      {!isEditing ? (
                        <>
                          <p className="text-slate-200 font-bold mt-0.5">{selectedVendor.primaryContact.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{selectedVendor.primaryContact.designation}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{selectedVendor.primaryContact.mobile} | {selectedVendor.primaryContact.email}</p>
                        </>
                      ) : (
                        <div className="space-y-1.5 mt-1.5">
                          <input
                            type="text"
                            placeholder="Name"
                            value={editData.primaryContact.name}
                            onChange={e => setEditData({ ...editData, primaryContact: { ...editData.primaryContact, name: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Designation"
                            value={editData.primaryContact.designation}
                            onChange={e => setEditData({ ...editData, primaryContact: { ...editData.primaryContact, designation: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Mobile"
                            value={editData.primaryContact.mobile}
                            onChange={e => setEditData({ ...editData, primaryContact: { ...editData.primaryContact, mobile: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Email"
                            value={editData.primaryContact.email}
                            onChange={e => setEditData({ ...editData, primaryContact: { ...editData.primaryContact, email: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">Finance/Tax Contact:</span>
                      {!isEditing ? (
                        <>
                          <p className="text-slate-200 font-bold mt-0.5">{selectedVendor.financeContact.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{selectedVendor.financeContact.designation}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{selectedVendor.financeContact.mobile} | {selectedVendor.financeContact.email}</p>
                        </>
                      ) : (
                        <div className="space-y-1.5 mt-1.5">
                          <input
                            type="text"
                            placeholder="Name"
                            value={editData.financeContact.name}
                            onChange={e => setEditData({ ...editData, financeContact: { ...editData.financeContact, name: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Mobile"
                            value={editData.financeContact.mobile}
                            onChange={e => setEditData({ ...editData, financeContact: { ...editData.financeContact, mobile: e.target.value } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Bank Details */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 text-xs md:text-sm">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Bank Account Payout Profile
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <span className="text-slate-500 font-semibold">Account Beneficiary Name:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 font-bold mt-0.5">{selectedVendor.bankDetails.beneficiaryName}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.bankDetails.beneficiaryName}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, beneficiaryName: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Bank Name:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 mt-0.5">{selectedVendor.bankDetails.bankName}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.bankDetails.bankName}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, bankName: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Branch Name:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 mt-0.5">{selectedVendor.bankDetails.branchName}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.bankDetails.branchName}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, branchName: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Account Number:</span>
                    {!isEditing ? (
                      <p className="text-indigo-400 font-mono font-bold mt-0.5">{selectedVendor.bankDetails.accountNumber}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.bankDetails.accountNumber}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, accountNumber: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none font-mono"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">IFSC Code:</span>
                    {!isEditing ? (
                      <p className="text-indigo-400 font-mono font-bold mt-0.5">{selectedVendor.bankDetails.ifscCode}</p>
                    ) : (
                      <input
                        type="text"
                        value={editData.bankDetails.ifscCode}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, ifscCode: e.target.value.toUpperCase().trim() } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none font-mono font-bold"
                      />
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Account Type:</span>
                    {!isEditing ? (
                      <p className="text-slate-200 mt-0.5">{selectedVendor.bankDetails.accountType}</p>
                    ) : (
                      <select
                        value={editData.bankDetails.accountType}
                        onChange={e => setEditData({ ...editData, bankDetails: { ...editData.bankDetails, accountType: e.target.value } })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 mt-1 text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="Savings Account">Savings Account</option>
                        <option value="Current Account">Current Account</option>
                        <option value="CC Account">CC Account</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
              {/* SECTION 3.8: Attached Documents (Google Drive Links) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 text-xs md:text-sm">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Google Drive Document Links
                </h3>

                {!isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">PAN Card Link:</span>
                      {selectedVendor.panFileUrl ? (
                        <a
                          href={selectedVendor.panFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-900 text-indigo-400 font-semibold rounded-lg text-xs transition"
                        >
                          View PAN Card
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No PAN Card uploaded</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-500 font-semibold block mb-1">GST Certificate Link:</span>
                      {selectedVendor.gstFileUrl ? (
                        <a
                          href={selectedVendor.gstFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-900 text-indigo-400 font-semibold rounded-lg text-xs transition"
                        >
                          View GST Certificate
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No GST Certificate uploaded</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PAN Card URL (Google Drive)</label>
                      <input
                        type="text"
                        value={editData.panFileUrl}
                        onChange={e => setEditData({ ...editData, panFileUrl: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GST Certificate URL (Google Drive)</label>
                      <input
                        type="text"
                        value={editData.gstFileUrl}
                        onChange={e => setEditData({ ...editData, gstFileUrl: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3.5: Certifications & Compliance */}
              {!isEditing && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 text-xs md:text-sm">
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    Certifications & Compliance
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-500 font-semibold">ISO Certified:</span>
                      <p className="text-slate-200 mt-0.5">{selectedVendor.verificationLogs?.metadata?.isoCertified || 'No'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">Other Certifications:</span>
                      <p className="text-slate-200 mt-0.5">{selectedVendor.verificationLogs?.metadata?.otherCertifications || 'None'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4: Audit Trails / Comments */}
              {!isEditing && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Audit Trail / Comments</span>
                  <p className="text-slate-300 text-xs leading-relaxed italic bg-slate-900 p-2.5 rounded-lg border border-slate-900">
                    {selectedVendor.comments || 'No audit history available.'}
                  </p>
                  <div className="text-[10px] text-slate-600 mt-1">
                    Last Updated: {new Date(selectedVendor.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}

            </div>

            {/* Action Bar */}
            <div className="p-6 bg-slate-950 border-t border-slate-800 space-y-4">
              {/* Comment text area */}
              {!isEditing && selectedVendor.status === 'Pending' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-2">Review Comments / Rejection Reasons</label>
                  <textarea
                    rows={2}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    placeholder="Provide context for approval/rejection decision (e.g. Bank name mismatch, valid MSME...)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={editLoading}
                      className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 disabled:opacity-50 text-slate-300 rounded-xl text-sm font-bold transition-all border border-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveVendorEdits}
                      disabled={editLoading}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow flex items-center gap-1.5"
                    >
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : selectedVendor.status === 'Pending' ? (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(selectedVendor.id, 'Rejected')}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/10 flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject Application
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(selectedVendor.id, 'Approved')}
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/10 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Onboard
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleStatusUpdate(selectedVendor.id, 'Pending')}
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-sm font-bold transition-all border border-slate-700"
                  >
                    Reset to Pending
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
