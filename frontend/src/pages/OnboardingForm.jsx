import React, { useState, useEffect } from 'react';
import { 
  Building2, CreditCard, FileText, Phone, Mail, User, 
  MapPin, ArrowRight, ArrowLeft, UploadCloud, CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL, apiFetch } from '../config';

const ENTITY_TYPES = [
  'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 
  'Public Limited', 'HUF', 'Trust', 'Society'
];

export default function OnboardingForm({ type = 'vendor', currentUser, userRole, initialProfileStatus, forceFormView, forceUpdateView, forceStatusView, navigateTo }) {
  const isCustomer = type === 'customer';
  const entityName = isCustomer ? 'Customer' : 'Vendor';
  const entityNameLower = isCustomer ? 'customer' : 'vendor';
  const apiEndpoint = isCustomer ? '/api/customers' : '/api/vendors';

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

  const [profileStatus, setProfileStatus] = useState(initialProfileStatus || null);
  const [profileComments, setProfileComments] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const isReadOnly = (userRole === 'Vendor' && profileStatus && profileStatus !== 'Sent' && profileStatus !== 'Rejected');

  useEffect(() => {
    if (initialProfileStatus) {
      setProfileStatus(initialProfileStatus);
    }
  }, [initialProfileStatus]);

  useEffect(() => {
    if (userRole === 'Vendor' && currentUser) {
      setFormData(prev => ({
        ...prev,
        email: currentUser,
        primaryContact: {
          ...prev.primaryContact,
          email: currentUser
        }
      }));
    }
  }, [currentUser, userRole]);

  useEffect(() => {
    const fetchProfileStatus = async () => {
      if (userRole !== 'Vendor' || !currentUser) return;
      try {
        setStatusLoading(true);
        const token = localStorage.getItem('admin_token');
        const res = await apiFetch(`${API_BASE_URL}/api/vendors/my-profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setProfileStatus(data.status);
          setProfileComments(data.comments || '');
          if (data.id) {
            setSubmittedVendorId(data.id);
          }
          if (data.status !== 'Sent') {
            setFormData({
              email: data.primaryContact?.email || data.email || '',
              legalName: data.legalName || '',
              tradeName: data.tradeName || '',
              entityType: data.entityType || 'Proprietorship',
              cin: data.cin || '',
              llpin: data.llpin || '',
              pan: data.pan || '',
              gstStatus: data.gstStatus || 'Yes',
              gstin: data.gstin || '',
              msmeStatus: data.msmeStatus || 'No',
              udyamNumber: data.udyamNumber || '',
              website: data.verificationLogs?.metadata?.website || '',
              registeredAddress: {
                street: data.registeredAddress?.street || '',
                city: data.registeredAddress?.city || '',
                state: data.registeredAddress?.state || '',
                pincode: data.registeredAddress?.pincode || '',
                country: data.registeredAddress?.country || 'India'
              },
              primaryContact: {
                name: data.primaryContact?.name || '',
                designation: data.primaryContact?.designation || '',
                email: data.primaryContact?.email || '',
                mobile: data.primaryContact?.mobile || ''
              },
              financeContact: {
                mobile: data.financeContact?.mobile || ''
              },
              bankDetails: {
                bankName: data.bankDetails?.bankName || '',
                beneficiaryName: data.bankDetails?.beneficiaryName || '',
                accountNumber: data.bankDetails?.accountNumber || '',
                confirmAccountNumber: data.bankDetails?.accountNumber || '',
                ifscCode: data.bankDetails?.ifscCode || '',
                branchName: data.bankDetails?.branchName || ''
              },
              isoCertified: data.verificationLogs?.metadata?.isoCertified || 'No',
              otherCertifications: data.verificationLogs?.metadata?.otherCertifications || '',
              agree: true,
              panFileUrl: data.panFileUrl,
              gstFileUrl: data.gstFileUrl,
              regFileUrl: data.verificationLogs?.uploadedDocuments?.regFileUrl,
              chequeFileUrl: data.verificationLogs?.uploadedDocuments?.chequeFileUrl,
              isoFileUrl: data.verificationLogs?.uploadedDocuments?.isoFileUrl
            });
          }
        }
      } catch (err) {
        console.error('Error fetching vendor profile status:', err);
      } finally {
        setStatusLoading(false);
      }
    };
    fetchProfileStatus();
  }, [currentUser, userRole]);

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

      const response = await apiFetch(`${API_BASE_URL}${apiEndpoint}`, {
        method: 'POST',
        body: dataPayload
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || `Failed to submit ${entityNameLower} onboarding form`);
      }

      setSubmittedVendorId(resData.id || '');
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Server error occurred during submission.');
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-semibold text-slate-400">Loading Application Status...</span>
        </div>
      </div>
    );
  }

  // 1. Tab-based Rendering for Vendor Form view restriction
  if (forceFormView && profileStatus && profileStatus !== 'Sent') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4 animate-fadeIn">
          <CheckCircle2 className="w-16 h-16 text-indigo-400 mx-auto animate-bounce" />
          <h2 className="text-xl font-bold text-slate-100">Application Already Submitted</h2>
          <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
            You have already submitted your onboarding form. You can track the progress in the <strong>Form Status</strong> tab or view your details under the <strong>Update Form</strong> tab.
          </p>
          <div className="pt-4 flex gap-4 justify-center">
            <button
              onClick={() => navigateTo('vendorStatus')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
            >
              Track Status
            </button>
            <button
              onClick={() => navigateTo('vendorUpdate')}
              className="px-4 py-2.5 bg-slate-850 hover:bg-slate-805 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-800"
            >
              View Submission
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Tab-based Rendering for Vendor Update view restriction
  if (forceUpdateView && (!profileStatus || profileStatus === 'Sent')) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4 animate-fadeIn">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-slate-100">No Submitted Form Found</h2>
          <p className="text-slate-400 text-xs md:text-sm max-w-md mx-auto leading-relaxed">
            Please fill and submit your onboarding application first in the <strong>Vendor Form</strong> tab.
          </p>
          <button
            onClick={() => navigateTo('vendorForm')}
            className="mt-4 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            Open Registration Form
          </button>
        </div>
      </div>
    );
  }

  // 3. Tab-based Rendering for Vendor Status Stepper tracker
  if (forceStatusView) {
    const isRejected = profileStatus === 'Rejected';
    const isApproved = profileStatus === 'Approved' || profileStatus === 'Vendor Created';
    
    let activeIndex = 0;
    if (profileStatus === 'Pending') activeIndex = 1;
    if (profileStatus === 'L2_Approved') activeIndex = 2;
    if (isApproved) activeIndex = 3;

    const stepsList = [
      { label: 'Invitation Sent', description: 'Portal login details dispatched' },
      { label: 'Application Submitted', description: 'Onboarding form filled & locked' },
      { label: 'Compliance Audit', description: 'Maker-Checker verification pipeline' },
      { label: 'Final Onboarding', description: 'Vendor created & integrated' }
    ];

    // Status mapping values
    let statusHeader = 'Invitation Dispatched';
    let statusDesc = 'Your onboarding invitation has been generated. Please navigate to the Vendor Form tab to get started.';
    let statusThemeClass = 'from-indigo-500/20 to-indigo-950/40 border-indigo-500/30 text-indigo-400';
    let StatusIcon = AlertCircle;

    if (profileStatus === 'Pending') {
      statusHeader = 'Application Received';
      statusDesc = 'Your application has been received and is queued for verification. Currently awaiting compliance audit (Level 2 Approver).';
      statusThemeClass = 'from-blue-500/20 to-blue-950/40 border-blue-500/30 text-blue-400';
      StatusIcon = Building2;
    } else if (profileStatus === 'L2_Approved') {
      statusHeader = 'Compliance Verified';
      statusDesc = 'Your application has successfully passed Maker-level compliance check. Currently awaiting checker approval (Level 1 Approver).';
      statusThemeClass = 'from-amber-500/20 to-amber-955/40 border-amber-500/30 text-amber-400';
      StatusIcon = ShieldAlert;
    } else if (isApproved) {
      statusHeader = 'Onboarding Complete';
      statusDesc = 'Congratulations! Your vendor profile has been approved and onboarded. Your credentials for SAP system will be dispatched shortly.';
      statusThemeClass = 'from-emerald-500/20 to-emerald-950/40 border-emerald-500/30 text-emerald-400';
      StatusIcon = CheckCircle2;
    } else if (isRejected) {
      statusHeader = 'Revision Requested';
      statusDesc = 'Our compliance audit has requested modifications to your onboarding form. Please review the details below, correct the fields, and resubmit.';
      statusThemeClass = 'from-rose-500/20 to-rose-955/40 border-rose-500/30 text-rose-400';
      StatusIcon = ShieldAlert;
    }

    return (
      <div className="max-w-4xl w-full mx-auto space-y-8 animate-fadeIn py-6 px-2 md:px-6">
        
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 bg-indigo-650 rounded-full inline-block" />
              Onboarding Progress Portal
            </h2>
            <p className="text-xs text-slate-400">Real-time tracker for your vendor validation and onboarding status</p>
          </div>
          {profileStatus && profileStatus !== 'Sent' && (
            <div className="text-xs text-slate-500 font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg self-start">
              ID: {submittedVendorId || 'N/A'}
            </div>
          )}
        </div>

        {/* Main Status Showcase Card (Glassmorphism) */}
        <div className={`p-6 md:p-8 rounded-2xl border bg-gradient-to-br ${statusThemeClass} shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center gap-6`}>
          {/* Animated Background Pulse */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-current opacity-5 rounded-full blur-3xl" />
          
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner shrink-0">
            <StatusIcon className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-wider uppercase font-black px-2 py-0.5 bg-slate-900/60 rounded border border-slate-800/40">
                CURRENT STAGE
              </span>
              {isRejected && <span className="bg-rose-900/60 text-rose-305 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/20">Action Required</span>}
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold text-slate-100">{statusHeader}</h3>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed max-w-2xl">{statusDesc}</p>
          </div>
        </div>

        {/* Audit Rejection Review comments */}
        {isRejected && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-md space-y-4">
            <h4 className="text-xs tracking-wider uppercase font-black text-rose-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              Compliance Rejection Comments
            </h4>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-slate-300 italic font-mono text-xs leading-relaxed">
              "{profileComments || 'No audit comments provided.'}"
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigateTo('vendorUpdate')}
                className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <span>Edit & Resubmit Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Premium Tracking Timeline Stepper */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-md">
          <h4 className="text-xs tracking-wider uppercase font-black text-slate-400 mb-8">
            Onboarding Timeline Pipeline
          </h4>
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-4">
            {/* Horizontal Timeline Connector (visible on desktop) */}
            <div className="absolute top-[18px] left-[5%] right-[5%] h-0.5 bg-slate-800 hidden md:block z-0" />
            {/* Active Horizontal line */}
            {activeIndex > 0 && (
              <div 
                className="absolute top-[18px] left-[5%] h-0.5 bg-gradient-to-r from-emerald-500 to-indigo-500 hidden md:block z-0 transition-all duration-500" 
                style={{ width: `${(activeIndex / 3) * 90}%` }}
              />
            )}

            {stepsList.map((st, idx) => {
              const isPast = idx < activeIndex;
              const isCurrent = idx === activeIndex;

              let circleStyle = 'bg-slate-950 border-slate-800 text-slate-500';
              let textTitleStyle = 'text-slate-500';
              let lineConnectorColor = 'bg-slate-850';

              if (isPast) {
                circleStyle = 'bg-emerald-950 border-emerald-500 text-emerald-450 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
                textTitleStyle = 'text-emerald-450';
                lineConnectorColor = 'bg-emerald-500';
              } else if (isCurrent) {
                if (isRejected) {
                  circleStyle = 'bg-rose-955 border-rose-500 text-rose-455 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse';
                  textTitleStyle = 'text-rose-400 font-extrabold';
                } else if (isApproved) {
                  circleStyle = 'bg-emerald-950 border-emerald-500 text-emerald-450 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
                  textTitleStyle = 'text-emerald-450';
                } else {
                  circleStyle = 'bg-indigo-950 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]';
                  textTitleStyle = 'text-indigo-455 font-extrabold';
                }
              }

              return (
                <div key={st.label} className="flex-1 flex flex-row md:flex-col items-center md:text-center gap-4 relative z-10 w-full">
                  {/* Vertical Timeline Connector (visible on mobile) */}
                  {idx < 3 && (
                    <div className={`absolute left-[18px] top-9 bottom-[-32px] w-0.5 ${lineConnectorColor} md:hidden z-0`} />
                  )}

                  {/* Circular Step Node with Pulsating Halo */}
                  <div className="relative shrink-0">
                    {isCurrent && !isApproved && (
                      <div className="absolute inset-0 rounded-full bg-current opacity-20 blur-md animate-ping" />
                    )}
                    <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-black text-xs transition-all duration-300 relative z-10 ${circleStyle}`}>
                      {isPast ? '✓' : idx + 1}
                    </div>
                  </div>

                  {/* Step Descriptions */}
                  <div className="space-y-1">
                    <div className={`text-xs md:text-sm font-bold tracking-tight ${textTitleStyle}`}>
                      {st.label}
                    </div>
                    <div className="text-[10px] md:text-xs text-slate-500 leading-normal max-w-[160px] md:mx-auto">
                      {st.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
            <h5 className="text-xs tracking-wider uppercase font-black text-slate-400">Onboarding Quick Links</h5>
            <div className="space-y-2 pt-1 text-xs">
              <button 
                onClick={() => navigateTo('vendorUpdate')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 transition text-slate-300 font-medium"
              >
                <span>Browse Form Submission</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase">Review Details</span>
              </button>
              <button 
                onClick={() => navigateTo('vendorForm')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 transition text-slate-300 font-medium"
              >
                <span>Onboarding Form Steps</span>
                <span className="text-[10px] font-black text-indigo-400 uppercase">View Layout</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
            <h5 className="text-xs tracking-wider uppercase font-black text-slate-400">Verification Steps & Timeline</h5>
            <div className="space-y-3 text-[11px] text-slate-400 pt-1 leading-relaxed">
              <div className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-450 mt-1.5 shrink-0" />
                <span><strong>L2 Compliance Auditor:</strong> Audits documents, bank details, tax filings, and certifications.</span>
              </div>
              <div className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-455 mt-1.5 shrink-0" />
                <span><strong>L1 Senior Director:</strong> Provides final executive onboarding signature and uploads data into ERP.</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-10 px-4">
      <div className="max-w-4xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-10">
        
        {/* Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100">
            {entityName} Registration Form
          </h1>
          <p className="text-slate-400 mt-2">To be filled up by the concerned {entityNameLower}/department. (* indicates mandatory)</p>
          {userRole === 'Vendor' && profileStatus === 'Sent' && (
            <div className="mt-4">
              <span className="px-3 py-1 bg-indigo-950/60 text-indigo-400 border border-indigo-800/40 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Status: Invitation Sent (Awaiting Submission)
              </span>
            </div>
          )}
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
                  Your Onboarding Reference ID
                </span>
                <span className="text-indigo-400 font-mono font-black text-xl select-all tracking-wide">
                  {`${isCustomer ? 'CUST' : 'VK18'}-${submittedVendorId.split('-')[0].toUpperCase()}`}
                </span>
                <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
                  Please keep this ID safe. You can reference it in any future communications regarding your application.
                </p>
              </div>
            )}

            <p className="text-slate-400 mt-3 max-w-md mx-auto text-sm">
              Your {entityNameLower} registration application has been submitted successfully. Our compliance team will review your details shortly.
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
            <fieldset disabled={isReadOnly} className="space-y-6 border-0 p-0 m-0">
            
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
                      disabled={userRole === 'Vendor' && !!currentUser}
                      placeholder={`e.g. ${entityNameLower}@company.com`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">Company Name *</label>
                    <input 
                      type="text" 
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleTextChange}
                      placeholder="e.g. Enterprise Logistics Supplies"
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
                      disabled={userRole === 'Vendor' && !!currentUser}
                      placeholder="e.g. manager@yourcompany.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-900"
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
                    {!isReadOnly && (
                      <label htmlFor="pan-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                        <UploadCloud className="w-4 h-4" />
                        <span>{uploadedFiles.panFile ? 'Change File' : 'Select Document'}</span>
                      </label>
                    )}
                    {uploadedFiles.panFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.panFile.name}
                      </div>
                    )}
                    {!uploadedFiles.panFile && formData.panFileUrl && (
                      <div className="text-[11px] text-indigo-400 font-bold mt-2 truncate">
                        ✓ Document Uploaded (<a href={formData.panFileUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-305">View Document</a>)
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
                      {!isReadOnly && (
                        <label htmlFor="gst-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                          <UploadCloud className="w-4 h-4" />
                          <span>{uploadedFiles.gstFile ? 'Change File' : 'Select Document'}</span>
                        </label>
                      )}
                      {uploadedFiles.gstFile && (
                        <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                          ✓ {uploadedFiles.gstFile.name}
                        </div>
                      )}
                      {!uploadedFiles.gstFile && formData.gstFileUrl && (
                        <div className="text-[11px] text-indigo-400 font-bold mt-2 truncate">
                          ✓ Document Uploaded (<a href={formData.gstFileUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-305">View Document</a>)
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
                    {!isReadOnly && (
                      <label htmlFor="reg-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                        <UploadCloud className="w-4 h-4" />
                        <span>{uploadedFiles.regFile ? 'Change File' : 'Select Document'}</span>
                      </label>
                    )}
                    {uploadedFiles.regFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.regFile.name}
                      </div>
                    )}
                    {!uploadedFiles.regFile && formData.regFileUrl && (
                      <div className="text-[11px] text-indigo-400 font-bold mt-2 truncate">
                        ✓ Document Uploaded (<a href={formData.regFileUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-305">View Document</a>)
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
                    {!isReadOnly && (
                      <label htmlFor="cheque-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                        <UploadCloud className="w-4 h-4" />
                        <span>{uploadedFiles.chequeFile ? 'Change File' : 'Select Document'}</span>
                      </label>
                    )}
                    {uploadedFiles.chequeFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.chequeFile.name}
                      </div>
                    )}
                    {!uploadedFiles.chequeFile && formData.chequeFileUrl && (
                      <div className="text-[11px] text-indigo-400 font-bold mt-2 truncate">
                        ✓ Document Uploaded (<a href={formData.chequeFileUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-305">View Document</a>)
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
                    {!isReadOnly && (
                      <label htmlFor="iso-file-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition">
                        <UploadCloud className="w-4 h-4" />
                        <span>{uploadedFiles.isoFile ? 'Change File' : 'Select Document'}</span>
                      </label>
                    )}
                    {uploadedFiles.isoFile && (
                      <div className="text-[11px] text-emerald-400 font-bold mt-2 truncate">
                        ✓ {uploadedFiles.isoFile.name}
                      </div>
                    )}
                    {!uploadedFiles.isoFile && formData.isoFileUrl && (
                      <div className="text-[11px] text-indigo-400 font-bold mt-2 truncate">
                        ✓ Document Uploaded (<a href={formData.isoFileUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-305">View Document</a>)
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
              ) : !isReadOnly ? (
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
              ) : (
                <div className="text-xs font-bold text-slate-505 border border-slate-800 bg-slate-950/40 rounded-xl px-4 py-2.5">
                  ✓ Review Mode Only
                </div>
              )}
            </div>
            </fieldset>
          </form>
        )}

      </div>
    </div>
  );
}
