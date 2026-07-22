import React, { useState } from 'react';
import { 
  Building2, CreditCard, FileText, Phone, Mail, User, 
  MapPin, ArrowRight, ArrowLeft, UploadCloud, CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../config';

const ENTITY_TYPES = [
  'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 
  'Public Limited', 'HUF', 'Trust', 'Society'
];

export default function VendorForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submittedVendorId, setSubmittedVendorId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    email: '', // Main email address
    legalName: '', // Company Name
    tradeName: '', // Trade Name / Brand Name
    entityType: 'Proprietorship',
    cin: '', // Business Registration Number
    llpin: '',
    pan: '', // PAN Number
    gstStatus: 'Yes', // Do you have GST Registration? (Yes/No)
    gstin: '', // GST Number
    msmeStatus: 'No',
    udyamNumber: '',
    website: '', // Company Website
    
    // Address Details
    registeredAddress: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    
    // Contact Details
    primaryContact: {
      name: '',
      designation: '',
      email: '',
      mobile: ''
    },
    financeContact: {
      mobile: '' // Alternate Contact Number
    },
    
    // Bank Details
    bankDetails: {
      bankName: '',
      beneficiaryName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: '',
      branchName: ''
    },
    
    // Certifications & Compliance
    isoCertified: 'No', // Do you have ISO Certification? (Yes/No)
    otherCertifications: '',
    
    // Declaration
    agree: false
  });

  // Real Uploaded File Objects
  const [uploadedFiles, setUploadedFiles] = useState({
    panFile: null,
    gstFile: null,
    regFile: null,
    chequeFile: null,
    isoFile: null
  });

  const handleTextChange = (e, path = []) => {
    const { name, value } = e.target;
    if (path.length === 0) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else if (path.length === 1) {
      setFormData(prev => ({
        ...prev,
        [path[0]]: { ...prev[path[0]], [name]: value }
      }));
    }
  };

  const handleFileUpload = (e, fileKey) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFiles(prev => ({ ...prev, [fileKey]: file }));
    }
  };

  // Field validations per step
  const validateStep = () => {
    setError('');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    if (step === 1) {
      if (!formData.email.trim()) return 'Main Email Address is required';
      if (!emailRegex.test(formData.email.trim())) return 'Invalid Main Email Address format';
      if (!formData.legalName.trim()) return 'Company Name is required';
      if (!formData.pan.trim()) return 'PAN Number is required';
      if (!panRegex.test(formData.pan.toUpperCase().trim())) return 'Invalid PAN Card Number format (e.g. ABCDE1234F)';
      
      if (formData.gstStatus === 'Yes') {
        if (!formData.gstin.trim()) return 'GST Number is required';
        if (!gstinRegex.test(formData.gstin.toUpperCase().trim())) return 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)';
      }
    }
    
    if (step === 2) {
      const prim = formData.primaryContact;
      const reg = formData.registeredAddress;
      
      if (!prim.email.trim()) return 'Contact Details Email Address is required';
      if (!emailRegex.test(prim.email.trim())) return 'Invalid Contact Details Email Address format';
      if (!prim.mobile.trim()) return 'Contact Details Mobile Number is required';
      if (prim.mobile.trim().length !== 10) return 'Mobile Number must be exactly 10 digits';
      if (!formData.financeContact.mobile.trim()) return 'Alternate Contact Number is required';
      if (formData.financeContact.mobile.trim().length !== 10) return 'Alternate Contact Number must be exactly 10 digits';
      
      if (!reg.street.trim()) return 'Office Address is required';
      if (!reg.city.trim()) return 'City is required';
      if (!reg.state.trim()) return 'State is required';
      if (!reg.pincode.trim()) return 'Postal Code (Pincode) is required';
      if (!reg.country.trim()) return 'Country is required';
    }

    if (step === 3) {
      const bank = formData.bankDetails;
      // Banking details are optional, but if any are filled, validate the rest
      const hasAnyBankData = bank.bankName.trim() || bank.beneficiaryName.trim() || bank.accountNumber.trim() || bank.ifscCode.trim();
      if (hasAnyBankData) {
        if (!bank.bankName.trim()) return 'Bank Name is required';
        if (!bank.beneficiaryName.trim()) return 'Account Holder Name is required';
        if (!bank.accountNumber.trim()) return 'Account Number is required';
        if (bank.accountNumber !== bank.confirmAccountNumber) return 'Account Numbers do not match';
        if (!bank.ifscCode.trim()) return 'IFSC Code is required';
        if (!ifscRegex.test(bank.ifscCode.toUpperCase().trim())) return 'Invalid IFSC Code format (e.g. BARB0VJBORA)';
      }
    }

    if (step === 4) {
      if (!formData.gstStatus) return 'Please specify if you have GST Registration';
      if (!formData.isoCertified) return 'Please specify if you have ISO Certification';
    }

    if (step === 5) {
      if (!uploadedFiles.panFile) return 'PAN Card document is required';
      if (formData.gstStatus === 'Yes' && !uploadedFiles.gstFile) return 'GST Certificate document is required';
      if (!formData.agree) return 'You must agree to the declaration to submit';
    }

    return null;
  };

  const nextStep = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataPayload = new FormData();
      
      // Append core fields
      dataPayload.append('email', formData.email.trim());
      dataPayload.append('legalName', formData.legalName.trim());
      dataPayload.append('tradeName', formData.tradeName.trim());
      dataPayload.append('entityType', formData.entityType);
      dataPayload.append('cin', formData.cin.trim());
      dataPayload.append('llpin', formData.llpin.trim());
      dataPayload.append('pan', formData.pan.toUpperCase().trim());
      dataPayload.append('gstStatus', formData.gstStatus === 'Yes' ? 'Registered' : 'Unregistered');
      dataPayload.append('gstin', formData.gstin.toUpperCase().trim());
      dataPayload.append('msmeStatus', formData.msmeStatus);
      dataPayload.append('udyamNumber', formData.udyamNumber);
      
      // Mapped address details
      dataPayload.append('registeredAddress', JSON.stringify(formData.registeredAddress));
      dataPayload.append('billingAddress', JSON.stringify(formData.registeredAddress));
      
      // Mapped contacts
      dataPayload.append('primaryContact', JSON.stringify(formData.primaryContact));
      dataPayload.append('financeContact', JSON.stringify({
        name: 'Alternate Contact',
        mobile: formData.financeContact.mobile.trim()
      }));
      
      // Bank details
      dataPayload.append('bankDetails', JSON.stringify(formData.bankDetails));
      
      // Custom compliance inputs
      dataPayload.append('website', formData.website.trim());
      dataPayload.append('isoCertified', formData.isoCertified);
      dataPayload.append('otherCertifications', formData.otherCertifications.trim());

      // Append files
      if (uploadedFiles.panFile) dataPayload.append('panFile', uploadedFiles.panFile);
      if (uploadedFiles.gstFile) dataPayload.append('gstFile', uploadedFiles.gstFile);
      if (uploadedFiles.regFile) dataPayload.append('regFile', uploadedFiles.regFile);
      if (uploadedFiles.chequeFile) dataPayload.append('chequeFile', uploadedFiles.chequeFile);
      if (uploadedFiles.isoFile) dataPayload.append('isoFile', uploadedFiles.isoFile);

      const response = await apiFetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        body: dataPayload
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to submit onboarding form');
      }

      setSubmittedVendorId(resData.id || '');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Server error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4">
      <div className="max-w-4xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">
            Vendor Registration Form - VK18 Pvt Ltd
          </h1>
          <p className="text-slate-400 mt-2">To be filled up by the concerned vendor/department. (* indicates mandatory)</p>
        </div>

        {/* Progress Tracker */}
        {!success && (
          <div className="mb-10">
            <div className="flex justify-between items-center text-xs md:text-sm text-slate-400 font-semibold mb-3">
              <span>Step {step} of 5</span>
              <span>
                {step === 1 && 'General Details'}
                {step === 2 && 'Contact & Address'}
                {step === 3 && 'Banking Details'}
                {step === 4 && 'Certifications & Compliance'}
                {step === 5 && 'Document Uploads'}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-950/50 border border-rose-800/80 rounded-xl flex items-start gap-3 text-rose-300">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Success Screen */}
        {success ? (
          <div className="text-center py-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-950/50 border-2 border-emerald-500 flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Registration Complete!</h2>
            
            {submittedVendorId && (
              <div className="my-6 p-5 bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full text-center">
                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
                  Your Onboarding Form Reference ID
                </span>
                <span className="text-indigo-400 font-mono font-black text-xl select-all tracking-wide">
                  {`VK18-${submittedVendorId.split('-')[0].toUpperCase()}`}
                </span>
                <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
                  Please keep this ID safe. You can reference it in any future communications or inquiries with VK18 Pvt Ltd regarding your application.
                </p>
              </div>
            )}

            <p className="text-slate-400 mt-3 max-w-md mx-auto text-sm">
              Your vendor registration application has been submitted successfully to VK18 Pvt Ltd. Our compliance team will review your details shortly.
            </p>
            <button 
              onClick={() => {
                setSuccess(false);
                setStep(1);
                setFormData({
                  email: '', legalName: '', tradeName: '', entityType: 'Proprietorship',
                  cin: '', llpin: '', pan: '', gstStatus: 'Yes', gstin: '', msmeStatus: 'No', udyamNumber: '',
                  website: '', registeredAddress: { street: '', city: '', state: '', pincode: '', country: 'India' },
                  primaryContact: { name: '', designation: '', email: '', mobile: '' },
                  financeContact: { mobile: '' },
                  bankDetails: { bankName: '', beneficiaryName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '', branchName: '' },
                  isoCertified: 'No', otherCertifications: '', agree: false
                });
                setUploadedFiles({ panFile: null, gstFile: null, regFile: null, chequeFile: null, isoFile: null });
              }}
              className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              Submit Another Response
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            
            {/* STEP 1: General Details */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <Building2 className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">General Details: Company Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address *</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.email}
                      onChange={handleTextChange}
                      placeholder="e.g. vendor@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Company Name *</label>
                    <input 
                      type="text" 
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleTextChange}
                      placeholder="e.g. VK18 Logistical Supplies"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Type of Business *</label>
                    <select 
                      name="entityType"
                      value={formData.entityType}
                      onChange={handleTextChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    >
                      {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Business Registration Number (CIN / LLPIN)</label>
                    <input 
                      type="text" 
                      name="cin"
                      value={formData.cin}
                      onChange={handleTextChange}
                      placeholder="e.g. U72900MH2018PTC310000"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">PAN Number *</label>
                    <input 
                      type="text" 
                      name="pan"
                      value={formData.pan}
                      onChange={(e) => setFormData(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                      placeholder="e.g. ABCDE1234F"
                      maxLength={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Do you have GST Registration? *</label>
                    <select 
                      name="gstStatus"
                      value={formData.gstStatus}
                      onChange={handleTextChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {formData.gstStatus === 'Yes' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">GST Number *</label>
                      <input 
                        type="text" 
                        name="gstin"
                        value={formData.gstin}
                        onChange={(e) => setFormData(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                        maxLength={15}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Company Website</label>
                    <input 
                      type="url" 
                      name="website"
                      value={formData.website}
                      onChange={handleTextChange}
                      placeholder="e.g. https://www.yourcompany.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Contact Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <User className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Contact & Office Address Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Contact Person Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={formData.primaryContact.name}
                      onChange={(e) => handleTextChange(e, ['primaryContact'])}
                      placeholder="e.g. Vikram Singh"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Designation</label>
                    <input 
                      type="text" 
                      name="designation"
                      value={formData.primaryContact.designation}
                      onChange={(e) => handleTextChange(e, ['primaryContact'])}
                      placeholder="e.g. General Manager"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address * (Contact Person)</label>
                    <input 
                      type="email" 
                      name="email"
                      value={formData.primaryContact.email}
                      onChange={(e) => handleTextChange(e, ['primaryContact'])}
                      placeholder="e.g. contact@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Mobile Number *</label>
                    <input 
                      type="tel" 
                      name="mobile"
                      value={formData.primaryContact.mobile}
                      onChange={(e) => handleTextChange(e, ['primaryContact'])}
                      placeholder="e.g. 8928234330"
                      maxLength={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Alternate Contact Number *</label>
                    <input 
                      type="tel" 
                      name="mobile"
                      value={formData.financeContact.mobile}
                      onChange={(e) => handleTextChange(e, ['financeContact'])}
                      placeholder="e.g. 9898989898"
                      maxLength={10}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Office Address *</label>
                    <input 
                      type="text" 
                      name="street"
                      value={formData.registeredAddress.street}
                      onChange={(e) => handleTextChange(e, ['registeredAddress'])}
                      placeholder="e.g. 77 Business Centre, MI Road"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">City *</label>
                    <input 
                      type="text" 
                      name="city"
                      value={formData.registeredAddress.city}
                      onChange={(e) => handleTextChange(e, ['registeredAddress'])}
                      placeholder="e.g. Jaipur"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">State *</label>
                    <input 
                      type="text" 
                      name="state"
                      value={formData.registeredAddress.state}
                      onChange={(e) => handleTextChange(e, ['registeredAddress'])}
                      placeholder="e.g. Rajasthan"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Postal Code *</label>
                    <input 
                      type="text" 
                      name="pincode"
                      value={formData.registeredAddress.pincode}
                      onChange={(e) => handleTextChange(e, ['registeredAddress'])}
                      placeholder="e.g. 302001"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Country *</label>
                    <input 
                      type="text" 
                      name="country"
                      value={formData.registeredAddress.country}
                      onChange={(e) => handleTextChange(e, ['registeredAddress'])}
                      placeholder="e.g. India"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Banking Details */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <CreditCard className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Banking Details</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Bank Name</label>
                    <input 
                      type="text" 
                      name="bankName"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. Bank of Baroda"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Account Holder Name</label>
                    <input 
                      type="text" 
                      name="beneficiaryName"
                      value={formData.bankDetails.beneficiaryName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. Alpha Manufacturing Co."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Account Number</label>
                    <input 
                      type="password" 
                      name="accountNumber"
                      value={formData.bankDetails.accountNumber}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="Enter account number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm Account Number</label>
                    <input 
                      type="text" 
                      name="confirmAccountNumber"
                      value={formData.bankDetails.confirmAccountNumber}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="Re-enter account number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">IFSC Code</label>
                    <input 
                      type="text" 
                      name="ifscCode"
                      value={formData.bankDetails.ifscCode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        bankDetails: { ...prev.bankDetails, ifscCode: e.target.value.toUpperCase() }
                      }))}
                      placeholder="e.g. BARB0VJBORA"
                      maxLength={11}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Branch Name</label>
                    <input 
                      type="text" 
                      name="branchName"
                      value={formData.bankDetails.branchName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. Vashi, Navi Mumbai"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Compliance */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <FileText className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Certifications & Compliance</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Do you have GST Registration? *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="gstStatus" 
                          value="Yes"
                          checked={formData.gstStatus === 'Yes'}
                          onChange={() => setFormData(prev => ({ ...prev, gstStatus: 'Yes' }))}
                          className="w-4.5 h-4.5 text-indigo-600"
                        />
                        <span className="text-slate-300 text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="gstStatus" 
                          value="No"
                          checked={formData.gstStatus === 'No'}
                          onChange={() => setFormData(prev => ({ ...prev, gstStatus: 'No', gstin: '' }))}
                          className="w-4.5 h-4.5 text-indigo-600"
                        />
                        <span className="text-slate-300 text-sm">No</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Do you have ISO Certification? *</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="isoCertified" 
                          value="Yes"
                          checked={formData.isoCertified === 'Yes'}
                          onChange={() => setFormData(prev => ({ ...prev, isoCertified: 'Yes' }))}
                          className="w-4.5 h-4.5 text-indigo-600"
                        />
                        <span className="text-slate-300 text-sm">Yes</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="isoCertified" 
                          value="No"
                          checked={formData.isoCertified === 'No'}
                          onChange={() => setFormData(prev => ({ ...prev, isoCertified: 'No' }))}
                          className="w-4.5 h-4.5 text-indigo-600"
                        />
                        <span className="text-slate-300 text-sm">No</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Other Certifications</label>
                    <input 
                      type="text" 
                      name="otherCertifications"
                      value={formData.otherCertifications}
                      onChange={handleTextChange}
                      placeholder="e.g. MSME, NSIC, Startup India (if any)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Document Uploads & Declaration */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <UploadCloud className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Document Uploads & Verification</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PAN Card File */}
                  <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/20">
                    <label className="block text-sm font-bold text-slate-300 mb-3">PAN Card Document *</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'panFile')}
                      className="hidden" 
                      id="pan-file-input" 
                    />
                    <label htmlFor="pan-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadedFiles.panFile ? 'Change File' : 'Select Document'}</span>
                    </label>
                    {uploadedFiles.panFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.panFile.name}
                      </div>
                    )}
                  </div>

                  {/* GST Certificate File */}
                  {formData.gstStatus === 'Yes' && (
                    <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/20">
                      <label className="block text-sm font-bold text-slate-300 mb-3">GST Certificate Document *</label>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload(e, 'gstFile')}
                        className="hidden" 
                        id="gst-file-input" 
                      />
                      <label htmlFor="gst-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                        <UploadCloud className="w-4 h-4" />
                        <span>{uploadedFiles.gstFile ? 'Change File' : 'Select Document'}</span>
                      </label>
                      {uploadedFiles.gstFile && (
                        <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                          ✓ {uploadedFiles.gstFile.name}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Company Registration Certificate */}
                  <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/20">
                    <label className="block text-sm font-bold text-slate-300 mb-3">Company Registration Certificate</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'regFile')}
                      className="hidden" 
                      id="reg-file-input" 
                    />
                    <label htmlFor="reg-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadedFiles.regFile ? 'Change File' : 'Select Document'}</span>
                    </label>
                    {uploadedFiles.regFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.regFile.name}
                      </div>
                    )}
                  </div>

                  {/* Cancelled Cheque */}
                  <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/20">
                    <label className="block text-sm font-bold text-slate-300 mb-3">Cancelled Cheque Document</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'chequeFile')}
                      className="hidden" 
                      id="cheque-file-input" 
                    />
                    <label htmlFor="cheque-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadedFiles.chequeFile ? 'Change File' : 'Select Document'}</span>
                    </label>
                    {uploadedFiles.chequeFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.chequeFile.name}
                      </div>
                    )}
                  </div>

                  {/* ISO/Other Certifications */}
                  <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center bg-slate-950/20 md:col-span-2">
                    <label className="block text-sm font-bold text-slate-300 mb-3">ISO / Other Certifications</label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileUpload(e, 'isoFile')}
                      className="hidden" 
                      id="iso-file-input" 
                    />
                    <label htmlFor="iso-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                      <UploadCloud className="w-4 h-4" />
                      <span>{uploadedFiles.isoFile ? 'Change File' : 'Select Document'}</span>
                    </label>
                    {uploadedFiles.isoFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.isoFile.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Review & Declaration Section */}
                <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0" />
                    <h4 className="font-bold text-slate-200">Review & Declaration</h4>
                  </div>
                  <label className="flex items-start gap-3 p-4 bg-slate-950/40 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                    <input 
                      type="checkbox"
                      checked={formData.agree}
                      onChange={(e) => setFormData(prev => ({ ...prev, agree: e.target.checked }))}
                      className="w-4.5 h-4.5 text-indigo-600 rounded border-slate-750 focus:ring-indigo-500 focus:ring-opacity-25 mt-0.5 shrink-0"
                    />
                    <span className="text-slate-300 text-xs font-medium leading-relaxed">
                      I declare that all the information provided above is true and accurate to the best of my knowledge. I Agree. *
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Form Footer Action Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-slate-800">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs md:text-sm font-semibold transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs md:text-sm font-semibold transition-all shadow-lg hover:shadow-indigo-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
