const { v4: uuidv4 } = require('uuid');

// Mock tax identifier verification engine
const verifyTaxIdentifiers = async (pan, gstin, legalName) => {
  const logs = {
    panVerifiedAt: new Date().toISOString(),
    gstinVerifiedAt: gstin ? new Date().toISOString() : null,
    panError: null,
    gstinError: null,
    panDetails: null,
    gstinDetails: null
  };

  let panVerificationStatus = 'Unverified';
  let gstVerificationStatus = 'Unverified';

  // 1. PAN validation mock check
  if (pan) {
    const cleanPan = pan.toUpperCase().trim();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (panRegex.test(cleanPan)) {
      panVerificationStatus = 'Verified';
      logs.panDetails = {
        status: 'Active',
        category: 'Firm/Individual',
        nameMatchScore: 98,
        remarks: 'PAN matches registered legal name in IT database.'
      };
    } else {
      panVerificationStatus = 'Verification Failed';
      logs.panError = 'Invalid PAN format structure.';
    }
  }

  // 2. GSTIN validation mock check
  if (gstin) {
    const cleanGst = gstin.toUpperCase().trim();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
    if (cleanGst.length === 15) {
      const embeddedPan = cleanGst.substring(2, 12);
      if (pan && embeddedPan !== pan.toUpperCase().trim()) {
        gstVerificationStatus = 'Verification Failed';
        logs.gstinError = 'GSTIN does not match the provided PAN identifier.';
      } else if (gstinRegex.test(cleanGst)) {
        gstVerificationStatus = 'Verified';
        logs.gstinDetails = {
          status: 'Active',
          taxpayerType: 'Regular',
          registrationDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          remarks: 'GSTIN successfully verified and matches database records.'
        };
      } else {
        gstVerificationStatus = 'Verification Failed';
        logs.gstinError = 'Invalid GSTIN format structure.';
      }
    } else {
      gstVerificationStatus = 'Verification Failed';
      logs.gstinError = 'GSTIN must be exactly 15 characters long.';
    }
  } else {
    gstVerificationStatus = 'Unregistered';
  }

  return {
    panVerificationStatus,
    gstVerificationStatus,
    verificationLogs: logs
  };
};

async function processGoogleFormWebhook(formPayload, pool) {
  console.log('Processing Google Form Webhook payload...');

  const legalName = (formPayload["Company Name"] || 'Unknown Company Name').trim();
  const tradeName = legalName;
  const entityType = formPayload["Type of Business"] || formPayload["Type of Business "] || 'Proprietorship';
  const dateOfIncorporation = ''; 

  const gstin = (formPayload["GST Number"] || '').toUpperCase().trim();
  const gstStatus = (gstin || formPayload["Do you have GST Registration?"] === 'Yes') ? 'Registered' : 'Unregistered';

  // Extract PAN from GSTIN or PAN question field
  let pan = (formPayload["PAN Number"] || '').toUpperCase().trim();
  if (!pan && gstin.length === 15) {
    pan = gstin.substring(2, 12);
  }

  // Parse Business Registration Number to see if it is a CIN, LLPIN, or PAN
  let cin = '';
  let llpin = '';
  const busRegNum = (formPayload["Business Registration Number"] || '').trim();
  if (busRegNum) {
    const cleanReg = busRegNum.toUpperCase();
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const cinRegex = /^[LU]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

    if (panRegex.test(cleanReg)) {
      if (!pan) pan = cleanReg;
    } else if (cinRegex.test(cleanReg)) {
      cin = cleanReg;
    } else if (cleanReg.startsWith("LLP") || cleanReg.length <= 10) {
      llpin = cleanReg;
    } else {
      cin = cleanReg;
    }
  }

  const msmeStatus = 'No';
  const udyamNumber = '';

  const registeredAddress = {
    street: formPayload["Office Address"] || '',
    city: formPayload["City"] || '',
    state: formPayload["State"] || '',
    pincode: formPayload["Postal Code"] || '',
    country: formPayload["Country"] || '',
    stateCode: ''
  };

  const billingAddress = { ...registeredAddress };

  const primaryContact = {
    name: formPayload["Contact Person Name"] || '',
    designation: formPayload["Designation"] || '',
    mobile: formPayload["Mobile Number"] || '',
    email: formPayload["Email Address"] || ''
  };

  const financeContact = {
    name: 'Alternate Contact',
    designation: '',
    mobile: formPayload["Alternate Contact Number"] || '',
    email: ''
  };

  const bankDetails = {
    beneficiaryName: formPayload["Account Holder Name"] || '',
    bankName: formPayload["Bank Name"] || '',
    branchName: formPayload["Branch Name"] || '',
    accountNumber: formPayload["Account Number"] || '',
    ifscCode: (formPayload["IFSC Code"] || '').toUpperCase().trim(),
    accountType: 'Current Account' 
  };

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();

  // Run mock Tax Identifier Verification
  const verification = await verifyTaxIdentifiers(pan, gstin, legalName);

  // Store extra custom form metadata inside JSONB logs object
  verification.verificationLogs.metadata = {
    website: formPayload["Company Website"] || '',
    isoCertified: formPayload["Do you have ISO Certification?"] || 'No',
    otherCertifications: formPayload["Other Certifications"] || ''
  };

  const status = 'Pending';
  const comments = 'Onboarded via Google Form Webhook.';

  // Map googleFormResponseId
  const googleFormResponseId = formPayload.googleFormResponseId || null;

  // Resolve direct drive URLs from question file IDs
  const panFileId = (formPayload["PAN Card"] && formPayload["PAN Card"].length > 0) ? formPayload["PAN Card"][0] : null;
  const gstFileId = (formPayload["GST Certificate"] && formPayload["GST Certificate"].length > 0) ? formPayload["GST Certificate"][0] : null;

  const panFileUrl = panFileId ? `https://drive.google.com/file/d/${panFileId}/view` : (formPayload.panFileUrl || null);
  const gstFileUrl = gstFileId ? `https://drive.google.com/file/d/${gstFileId}/view` : (formPayload.gstFileUrl || null);

  const query = `
    INSERT INTO vendors (
      id, "legalName", "tradeName", "entityType", "dateOfIncorporation", cin, llpin, pan,
      "gstStatus", gstin, "msmeStatus", "udyamNumber", "registeredAddress", "billingAddress",
      "primaryContact", "financeContact", "bankDetails", "panVerificationStatus", "gstVerificationStatus",
      "verificationLogs", status, comments, "googleFormResponseId", "panFileUrl", "gstFileUrl", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
    ) RETURNING *
  `;
  const values = [
    id, legalName, tradeName, entityType, dateOfIncorporation, cin, llpin, pan,
    gstStatus, gstin, msmeStatus, udyamNumber, JSON.stringify(registeredAddress), JSON.stringify(billingAddress),
    JSON.stringify(primaryContact), JSON.stringify(financeContact), JSON.stringify(bankDetails),
    verification.panVerificationStatus, verification.gstVerificationStatus, JSON.stringify(verification.verificationLogs),
    status, comments, googleFormResponseId, panFileUrl, gstFileUrl, createdAt, updatedAt
  ];

  await pool.query(query, values);
  return { success: true, vendorId: id };
}

module.exports = {
  processGoogleFormWebhook,
  verifyTaxIdentifiers
};
