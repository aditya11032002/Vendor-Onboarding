import React, { useState } from 'react';
import { 
  Building2, CreditCard, FileText, Phone, Mail, User, 
  MapPin, ArrowRight, ArrowLeft, UploadCloud, CheckCircle2, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';

const ENTITY_TYPES = [
  'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 
  'Public Limited', 'HUF', 'Trust', 'Society'
];

const STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '19', name: 'West Bengal' }, { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' }, { code: '36', name: 'Telangana' }
];

export default function VendorForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    legalName: '',
    tradeName: '',
    entityType: 'Proprietorship',
    dateOfIncorporation: '',
    cin: '',
    llpin: '',
    pan: '',
    gstStatus: 'Unregistered',
    gstin: '',
    msmeStatus: 'No',
    udyamNumber: '',
    registeredAddress: { street: '', city: '', state: '', pincode: '', stateCode: '' },
    billingAddress: { street: '', city: '', state: '', pincode: '', stateCode: '' },
    billingSameAsRegistered: true,
    primaryContact: { name: '', designation: '', mobile: '', email: '' },
    financeContact: { name: '', designation: '', mobile: '', email: '' },
    financeSameAsPrimary: true,
    bankDetails: {
      beneficiaryName: '',
      bankName: '',
      branchName: '',
      accountNumber: '',
      confirmAccountNumber: '',
      ifscCode: '',
      accountType: 'Current Account'
    },
    declarations: {
      gstCompliant: false,
      codeOfConduct: false
    }
  });

  // Mock File Upload Names (since actual files require cloud storage/multipart)
  const [uploadedFiles, setUploadedFiles] = useState({
    panFile: null,
    gstFile: null,
    chequeFile: null,
    udyamFile: null
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
      setUploadedFiles(prev => ({ ...prev, [fileKey]: file.name }));
    }
  };

  // Field validations per step
  const validateStep = () => {
    setError('');
    
    if (step === 1) {
      if (!formData.legalName.trim()) return 'Legal Name is required';
      if (!formData.dateOfIncorporation) return 'Date of Incorporation is required';
      if (formData.entityType === 'Private Limited' || formData.entityType === 'Public Limited') {
        if (!formData.cin.trim()) return 'CIN is required for Corporate entities';
      }
      if (formData.entityType === 'LLP') {
        if (!formData.llpin.trim()) return 'LLPIN is required for LLPs';
      }
    }
    
    if (step === 2) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(formData.pan.toUpperCase())) {
        return 'Invalid PAN Card Number format (e.g. ABCDE1234F)';
      }
      if (formData.gstStatus === 'Registered') {
        if (!formData.gstin.trim()) return 'GSTIN is required';
        const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstinRegex.test(formData.gstin.toUpperCase())) {
          return 'Invalid GSTIN format (e.g. 27ABCDE1234F1Z5)';
        }
      }
      if (formData.msmeStatus === 'Yes' && !formData.udyamNumber.trim()) {
        return 'Udyam Registration Number is required for MSME';
      }
    }

    if (step === 3) {
      const reg = formData.registeredAddress;
      if (!reg.street.trim() || !reg.city.trim() || !reg.state || !reg.pincode.trim()) {
        return 'All registered address fields are required';
      }
      if (!formData.billingSameAsRegistered) {
        const bill = formData.billingAddress;
        if (!bill.street.trim() || !bill.city.trim() || !bill.state || !bill.pincode.trim()) {
          return 'All billing address fields are required';
        }
      }
      const prim = formData.primaryContact;
      if (!prim.name.trim() || !prim.designation.trim() || !prim.mobile.trim() || !prim.email.trim()) {
        return 'Primary contact details are required';
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(prim.email)) return 'Invalid primary email format';
      if (prim.mobile.length !== 10) return 'Mobile number must be 10 digits';
    }

    if (step === 4) {
      const bank = formData.bankDetails;
      if (!bank.beneficiaryName.trim()) return 'Beneficiary name is required';
      if (!bank.bankName.trim() || !bank.branchName.trim()) return 'Bank & branch name are required';
      if (!bank.accountNumber || !bank.confirmAccountNumber) return 'Account number is required';
      if (bank.accountNumber !== bank.confirmAccountNumber) return 'Account numbers do not match';
      
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(bank.ifscCode.toUpperCase())) {
        return 'Invalid IFSC Code (e.g. HDFC0000040)';
      }
    }

    if (step === 5) {
      if (!uploadedFiles.panFile) return 'PAN Card upload is required';
      if (formData.gstStatus === 'Registered' && !uploadedFiles.gstFile) {
        return 'GST Registration Certificate upload is required';
      }
      if (!uploadedFiles.chequeFile) return 'Cancelled Cheque upload is required';
      if (formData.msmeStatus === 'Yes' && !uploadedFiles.udyamFile) {
        return 'Udyam Certificate upload is required';
      }
      if (!formData.declarations.gstCompliant || !formData.declarations.codeOfConduct) {
        return 'Please accept all legal declarations to submit';
      }
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

    // Prepare billing address & finance contact if marked "same as"
    const finalBillingAddress = formData.billingSameAsRegistered 
      ? formData.registeredAddress 
      : formData.billingAddress;

    const finalFinanceContact = formData.financeSameAsPrimary 
      ? formData.primaryContact 
      : formData.financeContact;

    const payload = {
      ...formData,
      billingAddress: finalBillingAddress,
      financeContact: finalFinanceContact,
      pan: formData.pan.toUpperCase(),
      gstin: formData.gstin.toUpperCase()
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to submit onboarding form');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Server error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4">
      {/* Container */}
      <div className="max-w-4xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Vendor Onboarding Portal
          </h1>
          <p className="text-slate-400 mt-2">Submit your details to start doing business with us.</p>
        </div>

        {/* Progress Tracker */}
        {!success && (
          <div className="mb-10">
            <div className="flex justify-between items-center text-xs md:text-sm text-slate-400 font-semibold mb-3">
              <span>Step {step} of 5</span>
              <span>
                {step === 1 && 'General Profile'}
                {step === 2 && 'Tax & Statutory'}
                {step === 3 && 'Contact & Address'}
                {step === 4 && 'Bank & Payouts'}
                {step === 5 && 'Verify & Upload'}
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

        {/* Form Body */}
        {success ? (
          /* SUCCESS SCREEN */
          <div className="text-center py-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Application Submitted!</h2>
            <p className="text-slate-400 mt-3 max-w-md mx-auto">
              Thank you for completing the onboarding form. Our finance and compliance team will review your PAN, GSTIN, and Bank details shortly.
            </p>
            <button 
              onClick={() => {
                setSuccess(false);
                setStep(1);
                setFormData({
                  legalName: '',
                  tradeName: '',
                  entityType: 'Proprietorship',
                  dateOfIncorporation: '',
                  cin: '',
                  llpin: '',
                  pan: '',
                  gstStatus: 'Unregistered',
                  gstin: '',
                  msmeStatus: 'No',
                  udyamNumber: '',
                  registeredAddress: { street: '', city: '', state: '', pincode: '', stateCode: '' },
                  billingAddress: { street: '', city: '', state: '', pincode: '', stateCode: '' },
                  billingSameAsRegistered: true,
                  primaryContact: { name: '', designation: '', mobile: '', email: '' },
                  financeContact: { name: '', designation: '', mobile: '', email: '' },
                  financeSameAsPrimary: true,
                  bankDetails: {
                    beneficiaryName: '',
                    bankName: '',
                    branchName: '',
                    accountNumber: '',
                    confirmAccountNumber: '',
                    ifscCode: '',
                    accountType: 'Current Account'
                  },
                  declarations: {
                    gstCompliant: false,
                    codeOfConduct: false
                  }
                });
                setUploadedFiles({ panFile: null, gstFile: null, chequeFile: null, udyamFile: null });
              }}
              className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
            >
              Onboard Another Vendor
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* STEP 1: General Business Profile */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <Building2 className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">General Business Profile</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Legal Entity Name (as per PAN)*</label>
                    <input 
                      type="text" 
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleTextChange}
                      placeholder="e.g. Acme Tech Solutions Private Limited"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Trade Name / Brand Name</label>
                    <input 
                      type="text" 
                      name="tradeName"
                      value={formData.tradeName}
                      onChange={handleTextChange}
                      placeholder="e.g. Acme Tech"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Constitution of Business / Entity Type*</label>
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
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Date of Incorporation*</label>
                    <input 
                      type="date" 
                      name="dateOfIncorporation"
                      value={formData.dateOfIncorporation}
                      onChange={handleTextChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Conditional Fields based on Entity Type */}
                  {(formData.entityType === 'Private Limited' || formData.entityType === 'Public Limited') && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Corporate Identification Number (CIN)*</label>
                      <input 
                        type="text" 
                        name="cin"
                        value={formData.cin}
                        onChange={handleTextChange}
                        placeholder="e.g. U72900MH2018PTC310000"
                        maxLength={21}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  )}

                  {formData.entityType === 'LLP' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">LLP Identification Number (LLPIN)*</label>
                      <input 
                        type="text" 
                        name="llpin"
                        value={formData.llpin}
                        onChange={handleTextChange}
                        placeholder="e.g. AAA-1234"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Tax & Statutory Identification */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <FileText className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Tax & Statutory Compliance (India)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Permanent Account Number (PAN)*</label>
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
                    <label className="block text-sm font-semibold text-slate-300 mb-2">GST Registration Status*</label>
                    <select 
                      name="gstStatus"
                      value={formData.gstStatus}
                      onChange={handleTextChange}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="Registered">Registered (Regular)</option>
                      <option value="Composition">Registered (Composition Scheme)</option>
                      <option value="Unregistered">Unregistered / Exempt</option>
                    </select>
                  </div>

                  {formData.gstStatus !== 'Unregistered' && (
                    <div className="md:col-span-2 animate-fadeIn">
                      <label className="block text-sm font-semibold text-slate-300 mb-2">GST Identification Number (GSTIN)*</label>
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

                  <div className="border-t border-slate-800 pt-6 md:col-span-2 flex flex-col md:flex-row md:items-center gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-300 mb-2">Are you registered under MSME (Udyam)?*</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input 
                            type="radio" 
                            name="msmeStatus" 
                            value="Yes" 
                            checked={formData.msmeStatus === 'Yes'}
                            onChange={handleTextChange}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                          <input 
                            type="radio" 
                            name="msmeStatus" 
                            value="No" 
                            checked={formData.msmeStatus === 'No'}
                            onChange={handleTextChange}
                            className="text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                          />
                          No
                        </label>
                      </div>
                    </div>

                    {formData.msmeStatus === 'Yes' && (
                      <div className="flex-1 animate-fadeIn">
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Udyam Registration Number*</label>
                        <input 
                          type="text" 
                          name="udyamNumber"
                          value={formData.udyamNumber}
                          onChange={handleTextChange}
                          placeholder="e.g. UDYAM-MH-19-0012345"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Contact & Address Details */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <MapPin className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Address & Contact Information</h3>
                </div>

                {/* Registered Address */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <h4 className="text-md font-bold text-slate-200">Registered Office Address</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Street Address*</label>
                      <input 
                        type="text" 
                        name="street" 
                        value={formData.registeredAddress.street}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          registeredAddress: { ...prev.registeredAddress, street: e.target.value }
                        }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">City*</label>
                      <input 
                        type="text" 
                        name="city" 
                        value={formData.registeredAddress.city}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          registeredAddress: { ...prev.registeredAddress, city: e.target.value }
                        }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">State*</label>
                      <select 
                        name="state" 
                        value={formData.registeredAddress.state}
                        onChange={(e) => {
                          const stateObj = STATES.find(s => s.name === e.target.value);
                          setFormData(prev => ({
                            ...prev,
                            registeredAddress: { 
                              ...prev.registeredAddress, 
                              state: e.target.value,
                              stateCode: stateObj ? stateObj.code : ''
                            }
                          }));
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Select State</option>
                        {STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">PIN Code*</label>
                      <input 
                        type="text" 
                        name="pincode" 
                        value={formData.registeredAddress.pincode}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          registeredAddress: { ...prev.registeredAddress, pincode: e.target.value }
                        }))}
                        maxLength={6}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Billing Address Toggle */}
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="billingSameAsRegistered"
                    checked={formData.billingSameAsRegistered}
                    onChange={(e) => setFormData(prev => ({ ...prev, billingSameAsRegistered: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="billingSameAsRegistered" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Billing address is same as Registered address
                  </label>
                </div>

                {/* Billing Address (Conditional) */}
                {!formData.billingSameAsRegistered && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn">
                    <h4 className="text-md font-bold text-slate-200">Billing / Dispatch Address</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Street Address*</label>
                        <input 
                          type="text" 
                          name="street" 
                          value={formData.billingAddress.street}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            billingAddress: { ...prev.billingAddress, street: e.target.value }
                          }))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">City*</label>
                        <input 
                          type="text" 
                          name="city" 
                          value={formData.billingAddress.city}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            billingAddress: { ...prev.billingAddress, city: e.target.value }
                          }))}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">State*</label>
                        <select 
                          name="state" 
                          value={formData.billingAddress.state}
                          onChange={(e) => {
                            const stateObj = STATES.find(s => s.name === e.target.value);
                            setFormData(prev => ({
                              ...prev,
                              billingAddress: { 
                                ...prev.billingAddress, 
                                state: e.target.value,
                                stateCode: stateObj ? stateObj.code : ''
                              }
                            }));
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">Select State</option>
                          {STATES.map(s => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">PIN Code*</label>
                        <input 
                          type="text" 
                          name="pincode" 
                          value={formData.billingAddress.pincode}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            billingAddress: { ...prev.billingAddress, pincode: e.target.value }
                          }))}
                          maxLength={6}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Contact Details */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <User className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-md font-bold">Primary Contact Person</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Name*</label>
                      <input 
                        type="text" 
                        name="name" 
                        value={formData.primaryContact.name}
                        onChange={(e) => handleTextChange(e, ['primaryContact'])}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Designation*</label>
                      <input 
                        type="text" 
                        name="designation" 
                        value={formData.primaryContact.designation}
                        onChange={(e) => handleTextChange(e, ['primaryContact'])}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Mobile Number (10 digit)*</label>
                      <input 
                        type="text" 
                        name="mobile" 
                        value={formData.primaryContact.mobile}
                        onChange={(e) => handleTextChange(e, ['primaryContact'])}
                        maxLength={10}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address*</label>
                      <input 
                        type="email" 
                        name="email" 
                        value={formData.primaryContact.email}
                        onChange={(e) => handleTextChange(e, ['primaryContact'])}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Finance Contact Toggle */}
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="financeSameAsPrimary"
                    checked={formData.financeSameAsPrimary}
                    onChange={(e) => setFormData(prev => ({ ...prev, financeSameAsPrimary: e.target.checked }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="financeSameAsPrimary" className="text-sm font-medium text-slate-300 cursor-pointer">
                    Finance / Accounts contact is same as Primary contact
                  </label>
                </div>

                {/* Finance Contact Details (Conditional) */}
                {!formData.financeSameAsPrimary && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-2 text-slate-200">
                      <User className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-md font-bold">Finance / Accounts Contact</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Name*</label>
                        <input 
                          type="text" 
                          name="name" 
                          value={formData.financeContact.name}
                          onChange={(e) => handleTextChange(e, ['financeContact'])}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Designation*</label>
                        <input 
                          type="text" 
                          name="designation" 
                          value={formData.financeContact.designation}
                          onChange={(e) => handleTextChange(e, ['financeContact'])}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Mobile Number*</label>
                        <input 
                          type="text" 
                          name="mobile" 
                          value={formData.financeContact.mobile}
                          onChange={(e) => handleTextChange(e, ['financeContact'])}
                          maxLength={10}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address*</label>
                        <input 
                          type="email" 
                          name="email" 
                          value={formData.financeContact.email}
                          onChange={(e) => handleTextChange(e, ['financeContact'])}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Bank Details */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <CreditCard className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Financial & Bank Details</h3>
                </div>

                <div className="p-4 bg-indigo-950/30 border border-indigo-900/50 rounded-xl text-indigo-300 text-xs md:text-sm">
                  <strong>Important:</strong> The Beneficiary Name below must match your Legal Entity Name exactly to ensure payout verification succeeds via Bank systems (NEFT/RTGS).
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Account Beneficiary Name*</label>
                    <input 
                      type="text" 
                      name="beneficiaryName"
                      value={formData.bankDetails.beneficiaryName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. Acme Tech Solutions Private Limited"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Bank Name*</label>
                    <input 
                      type="text" 
                      name="bankName"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. HDFC Bank"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Branch Name*</label>
                    <input 
                      type="text" 
                      name="branchName"
                      value={formData.bankDetails.branchName}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="e.g. Andheri East"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Bank Account Number*</label>
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
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm Account Number*</label>
                    <input 
                      type="text" 
                      name="confirmAccountNumber"
                      value={formData.bankDetails.confirmAccountNumber}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      placeholder="Confirm account number"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">IFSC Code*</label>
                    <input 
                      type="text" 
                      name="ifscCode"
                      value={formData.bankDetails.ifscCode}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        bankDetails: { ...prev.bankDetails, ifscCode: e.target.value.toUpperCase() }
                      }))}
                      placeholder="e.g. HDFC0000040"
                      maxLength={11}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Account Type*</label>
                    <select 
                      name="accountType"
                      value={formData.bankDetails.accountType}
                      onChange={(e) => handleTextChange(e, ['bankDetails'])}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="Current Account">Current Account</option>
                      <option value="Savings Account">Savings Account</option>
                      <option value="Cash Credit">Cash Credit / Overdraft</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Document Uploads & Verification */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-4">
                  <UploadCloud className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-xl font-semibold">Supporting Documents & Declarations</h3>
                </div>

                {/* Files Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PAN File */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-200">Copy of PAN Card*</span>
                      <p className="text-xs text-slate-500 mt-1">Upload scanned copy of Company/Individual PAN card (PDF, PNG, JPG)</p>
                    </div>
                    <label className="mt-4 flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl py-3 cursor-pointer transition text-xs font-semibold bg-slate-900/50 hover:bg-slate-905">
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>{uploadedFiles.panFile ? uploadedFiles.panFile : 'Choose File'}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, 'panFile')} className="hidden" />
                    </label>
                  </div>

                  {/* GST File */}
                  {formData.gstStatus === 'Registered' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-sm font-semibold text-slate-200">GST Registration Certificate*</span>
                        <p className="text-xs text-slate-500 mt-1">Upload Form GST REG-06 showing address and annexures (PDF)</p>
                      </div>
                      <label className="mt-4 flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl py-3 cursor-pointer transition text-xs font-semibold bg-slate-900/50">
                        <UploadCloud className="w-4 h-4 text-slate-400" />
                        <span>{uploadedFiles.gstFile ? uploadedFiles.gstFile : 'Choose File'}</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'gstFile')} className="hidden" />
                      </label>
                    </div>
                  )}

                  {/* Bank File */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-200">Cancelled Cheque / Bank Statement*</span>
                      <p className="text-xs text-slate-500 mt-1">Must clearly show Beneficiary Name, Account Number, and IFSC Code</p>
                    </div>
                    <label className="mt-4 flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl py-3 cursor-pointer transition text-xs font-semibold bg-slate-900/50">
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      <span>{uploadedFiles.chequeFile ? uploadedFiles.chequeFile : 'Choose File'}</span>
                      <input type="file" onChange={(e) => handleFileUpload(e, 'chequeFile')} className="hidden" />
                    </label>
                  </div>

                  {/* MSME File */}
                  {formData.msmeStatus === 'Yes' && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-sm font-semibold text-slate-200">Udyam Registration Certificate*</span>
                        <p className="text-xs text-slate-500 mt-1">Upload complete MSME Udyam Certificate showing registration details</p>
                      </div>
                      <label className="mt-4 flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-indigo-500 rounded-xl py-3 cursor-pointer transition text-xs font-semibold bg-slate-900/50">
                        <UploadCloud className="w-4 h-4 text-slate-400" />
                        <span>{uploadedFiles.udyamFile ? uploadedFiles.udyamFile : 'Choose File'}</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'udyamFile')} className="hidden" />
                      </label>
                    </div>
                  )}
                </div>

                {/* Declarations Checklist */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 mt-6 space-y-4">
                  <span className="text-md font-bold text-slate-200">Legal Compliance Declarations</span>
                  
                  <div className="flex gap-3">
                    <input 
                      type="checkbox" 
                      id="gstCompliant"
                      checked={formData.declarations.gstCompliant}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        declarations: { ...prev.declarations, gstCompliant: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-800 mt-1 shrink-0"
                    />
                    <label htmlFor="gstCompliant" className="text-xs md:text-sm text-slate-400 cursor-pointer">
                      I declare that our business will regularly upload all outward invoices on the GST Portal (GSTR-1) in a timely manner, so that Input Tax Credit (ITC) correctly reflects in the buyer's GSTR-2B. In case of any default or non-compliance causing loss of credit, we agree to indemnify and pay the loss amount with interest.
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <input 
                      type="checkbox" 
                      id="codeOfConduct"
                      checked={formData.declarations.codeOfConduct}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        declarations: { ...prev.declarations, codeOfConduct: e.target.checked }
                      }))}
                      className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-800 mt-1 shrink-0"
                    />
                    <label htmlFor="codeOfConduct" className="text-xs md:text-sm text-slate-400 cursor-pointer">
                      I certify that all details submitted are accurate and match official records. We agree to adhere to the code of conduct, anti-bribery policies, and standard credit terms.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-6 mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 transition text-sm font-semibold text-slate-300"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <div /> // Placeholder to keep Next button aligned to the right
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold transition shadow-lg shadow-indigo-600/15 text-white"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-bold transition shadow-md text-white disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>

          </form>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 mt-8">
        Secure Vendor Portal &bull; Compliance Verified for India (GST & MSME Guidelines)
      </footer>
    </div>
  );
}
