const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const googleFormService = require('./google_form_service');
const dbService = require('./vendor_db_service');
const emailService = require('./email_service');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_super_secret_key_123';

// Hashing round count for Bcrypt
const BCRYPT_ROUNDS = 10;

// Helper to hash passwords using SHA-256 (Legacy Compatibility)
const legacyHashPassword = (password, salt) => {
  const hash = crypto.createHash('sha256');
  hash.update(password + salt);
  return hash.digest('hex');
};

// New Bcrypt hash helper
const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

// Global rate limiting rule (300 requests / 15 minutes)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { message: 'Too many requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiting rule for authentication (20 attempts / 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many auth requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxies (Render, Vercel, Cloudflare, Ngrok) for express-rate-limit
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const clientOrigin = process.env.CLIENT_ORIGIN;
    if (
      (clientOrigin && origin === clientOrigin) ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.ngrok-free.app') ||
      origin.endsWith('.ngrok.io')
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(globalLimiter);

// Serve uploaded documents statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for in-memory file buffers with validation filter
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file size limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
    }
  }
});

// Initialize PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('127.0.0.1') && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

// Auto-initialize PostgreSQL Database Tables on Startup
const initializeDatabase = async () => {
  try {
    await dbService.initializeDatabaseSchema(pool);
    console.log('PostgreSQL database tables checked/initialized successfully.');

    // Seed default administrator if users table is empty
    const usersCheck = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(usersCheck.rows[0].count, 10);
    if (userCount === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminId = uuidv4();
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await hashPassword(adminPassword);

      await pool.query(
        'INSERT INTO users (id, username, password, salt, role) VALUES ($1, $2, $3, $4, $5)',
        [adminId, adminUsername, hashedPassword, salt, 'Admin']
      );
      console.log(`Default administrator account "${adminUsername}" seeded successfully.`);
    }
  } catch (error) {
    console.error('Error initializing PostgreSQL database:', error);
  }
};
initializeDatabase();

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
    // Valid Indian PAN format regex: 5 letters, 4 digits, 1 letter
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
    // Valid Indian GSTIN format: 2 digits, PAN, 1 char, Z, 1 char (15 characters)
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

// --- Authentication & Security Middleware ---

const extractToken = (req) => {
  if (req.query && req.query.token) {
    return req.query.token;
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

const authenticateAdmin = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized access. No session token provided.' });
  }

  // Legacy compatibility: check if it's the static admin token
  if (token === 'admin-session-token') {
    req.user = { username: process.env.ADMIN_USERNAME || 'admin', role: 'Admin' };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'Vendor') {
      return res.status(403).json({ message: 'Forbidden access. Vendors cannot access administrative resources.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized access. Invalid or expired token.' });
  }
};

const authenticateUser = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized access. No session token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized access. Invalid or expired token.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Forbidden access. Admin privileges required.' });
  }
  next();
};

// --- API Endpoints ---

// 0. Login Handler (Dynamic Database Validation)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = result.rows[0];
    let passwordIsValid = false;
    let shouldUpgradeHash = false;

    // Check if stored password uses bcrypt hashing
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      passwordIsValid = await bcrypt.compare(password, user.password);
    } else {
      // Fallback: check legacy SHA-256 format
      const legacyHashed = legacyHashPassword(password, user.salt);
      if (legacyHashed === user.password) {
        passwordIsValid = true;
        shouldUpgradeHash = true;
      }
    }

    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Auto-upgrade legacy hash to Bcrypt
    if (shouldUpgradeHash) {
      try {
        const newBcryptHash = await hashPassword(password);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newBcryptHash, user.id]);
        console.log(`[SECURITY MIGRATION] Upgraded credentials for user "${user.username}" to Bcrypt format.`);
      } catch (upgradeErr) {
        console.error('Failed to automatically migrate password hash to Bcrypt:', upgradeErr);
      }
    }

    const resetRequired = !!user.passwordResetRequired;

    // Generate signed stateless JSON Web Token (JWT)
    const token = jwt.sign(
      { username: user.username, role: user.role, passwordResetRequired: resetRequired },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set secure HttpOnly cookie
    const isHttps = req.get('origin')?.startsWith('https') || false;
    res.cookie('token', token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 3600000 // 1 hour
    });

    res.json({ token, username: user.username, role: user.role, passwordResetRequired: resetRequired });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Authentication server error.' });
  }
});

// 0.5. Change password / Force Reset first login
app.post('/api/auth/change-password', authenticateUser, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || !newPassword.trim()) {
    return res.status(400).json({ message: 'New password is required.' });
  }

  const username = req.user.username;

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userCheck.rows[0];

    // Generate new salt and hashed password
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(newPassword.trim());

    // Update password, salt, and reset required flag in DB
    await pool.query(
      'UPDATE users SET password = $1, salt = $2, "passwordResetRequired" = $3 WHERE username = $4',
      [hashedPassword, salt, false, username]
    );

    // Sign and return a fresh token without the resetRequired flag set to true
    const newToken = jwt.sign(
      { username: user.username, role: user.role, passwordResetRequired: false },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set secure HttpOnly cookie
    const isHttps = req.get('origin')?.startsWith('https') || false;
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      maxAge: 3600000 // 1 hour
    });

    res.json({
      success: true,
      message: 'Password updated successfully.',
      token: newToken
    });
  } catch (error) {
    console.error('Error changing user password:', error);
    res.status(500).json({ message: 'Internal server error changing password.' });
  }
});

// 0.7. Logout Handler
app.post('/api/auth/logout', (req, res) => {
  const isHttps = req.get('origin')?.startsWith('https') || false;
  res.clearCookie('token', {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax'
  });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// 0.5. Get vendor profile status (For Vendor Portal self-lookup)
app.get('/api/vendors/my-profile', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM vendors
      WHERE LOWER("primaryContact"->>'email') = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [req.user.username.toLowerCase()]);
    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
    return res.json({ status: 'Sent' });
  } catch (error) {
    console.error('Error fetching my-profile status:', error);
    res.status(500).json({ message: 'Internal server error fetching application status.' });
  }
});

// 0.6. Get customer profile status (For Customer Portal self-lookup)
app.get('/api/customers/my-profile', authenticateUser, async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM customers
      WHERE LOWER("primaryContact"->>'email') = $1
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const result = await pool.query(query, [req.user.username.toLowerCase()]);
    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }
    return res.json({ status: 'Sent' });
  } catch (error) {
    console.error('Error fetching my-profile status:', error);
    res.status(500).json({ message: 'Internal server error fetching application status.' });
  }
});

// 1. Get all vendors (with server-side pagination, search, and filters)
app.get('/api/vendors', authenticateAdmin, async (req, res) => {
  try {
    const queryParams = { ...req.query, role: req.user.role };
    const result = await dbService.getPaginatedVendors(pool, queryParams);
    res.json(result);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Internal server error while fetching vendors.' });
  }
});

// 2. Get single vendor details
app.get('/api/vendors/:id', authenticateAdmin, async (req, res) => {
  try {
    const vendor = await dbService.getVendorById(pool, req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor details:', error);
    res.status(500).json({ message: 'Internal server error while retrieving vendor.' });
  }
});

// Public route to retrieve binary files from PostgreSQL
app.get('/api/vendors/files/:vendorId/:fileKey', async (req, res) => {
  const { vendorId, fileKey } = req.params;

  // Map keys to DB column names
  const keyMap = {
    pan: { data: 'panFileData', name: 'panFileName', mimetype: 'panFileMimetype' },
    gst: { data: 'gstFileData', name: 'gstFileName', mimetype: 'gstFileMimetype' },
    reg: { data: 'regFileData', name: 'regFileName', mimetype: 'regFileMimetype' },
    cheque: { data: 'chequeFileData', name: 'chequeFileName', mimetype: 'chequeFileMimetype' },
    iso: { data: 'isoFileData', name: 'isoFileName', mimetype: 'isoFileMimetype' }
  };

  const columns = keyMap[fileKey];
  if (!columns) {
    return res.status(400).json({ message: 'Invalid file key.' });
  }

  try {
    const query = `SELECT "${columns.data}" as file_data, "${columns.name}" as file_name, "${columns.mimetype}" as mime_type FROM vendors WHERE id = $1`;
    const result = await pool.query(query, [vendorId]);

    if (result.rows.length === 0 || !result.rows[0].file_data) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const { file_data, file_name, mime_type } = result.rows[0];

    // Set correct headers
    res.set('Content-Type', mime_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file_name || 'download')}"`);
    res.send(file_data);
  } catch (error) {
    console.error('Error serving file from DB:', error);
    res.status(500).json({ message: 'Internal server error serving file.' });
  }
});

// 3. Create a new vendor (From custom React UI Form - Multi-file multipart upload)
app.post('/api/vendors', upload.fields([
  { name: 'panFile', maxCount: 1 },
  { name: 'gstFile', maxCount: 1 },
  { name: 'regFile', maxCount: 1 },
  { name: 'chequeFile', maxCount: 1 },
  { name: 'isoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const body = req.body;

    // Parse nested object strings sent as multipart/form-data
    const parseField = (field) => {
      if (!field) return {};
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch (e) { return {}; }
      }
      return field;
    };

    const registeredAddress = parseField(body.registeredAddress);
    const billingAddress = parseField(body.billingAddress);
    const primaryContact = parseField(body.primaryContact);
    const financeContact = parseField(body.financeContact);
    const bankDetails = parseField(body.bankDetails);

    const legalName = body.legalName;
    const pan = body.pan ? body.pan.toUpperCase().trim() : '';
    const primaryEmail = primaryContact.email || body.email || '';

    if (!legalName || !pan || !primaryEmail) {
      return res.status(400).json({ message: 'Legal Name, PAN, and Email Address are required.' });
    }

    const gstin = body.gstin ? body.gstin.toUpperCase().trim() : '';

    // Run mock Tax Identifier Verification
    const verification = await verifyTaxIdentifiers(pan, gstin, legalName);

    // Pre-generate the vendor UUID
    const vendorId = uuidv4();

    // Resolve file upload URLs (custom DB file retriever endpoints)
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const hasPanFile = req.files && req.files.panFile && req.files.panFile[0];
    const hasGstFile = req.files && req.files.gstFile && req.files.gstFile[0];
    const hasRegFile = req.files && req.files.regFile && req.files.regFile[0];
    const hasChequeFile = req.files && req.files.chequeFile && req.files.chequeFile[0];
    const hasIsoFile = req.files && req.files.isoFile && req.files.isoFile[0];

    const getExt = (filesObj, fieldName) => {
      const file = filesObj && filesObj[fieldName] && filesObj[fieldName][0];
      return file ? path.extname(file.originalname).toLowerCase() : '';
    };

    const panFileUrl = hasPanFile ? `${baseUrl}/api/vendors/files/${vendorId}/pan?ext=${getExt(req.files, 'panFile')}` : null;
    const gstFileUrl = hasGstFile ? `${baseUrl}/api/vendors/files/${vendorId}/gst?ext=${getExt(req.files, 'gstFile')}` : null;
    const regFileUrl = hasRegFile ? `${baseUrl}/api/vendors/files/${vendorId}/reg?ext=${getExt(req.files, 'regFile')}` : null;
    const chequeFileUrl = hasChequeFile ? `${baseUrl}/api/vendors/files/${vendorId}/cheque?ext=${getExt(req.files, 'chequeFile')}` : null;
    const isoFileUrl = hasIsoFile ? `${baseUrl}/api/vendors/files/${vendorId}/iso?ext=${getExt(req.files, 'isoFile')}` : null;

    // Attach extra documents inside verificationLogs
    verification.verificationLogs.uploadedDocuments = {
      regFileUrl,
      chequeFileUrl,
      isoFileUrl
    };

    // Attach metadata
    verification.verificationLogs.metadata = {
      website: body.website || '',
      isoCertified: body.isoCertified || 'No',
      otherCertifications: body.otherCertifications || ''
    };

    const vendorData = {
      id: vendorId,
      legalName,
      tradeName: body.tradeName || '',
      entityType: body.entityType || 'Proprietorship',
      dateOfIncorporation: body.dateOfIncorporation || '',
      cin: body.cin || '',
      llpin: body.llpin || '',
      pan,
      gstStatus: body.gstStatus || 'Unregistered',
      gstin,
      msmeStatus: body.msmeStatus || 'No',
      udyamNumber: body.udyamNumber || '',
      registeredAddress,
      billingAddress,
      primaryContact: {
        ...primaryContact,
        email: primaryEmail
      },
      financeContact,
      bankDetails,
      panVerificationStatus: verification.panVerificationStatus,
      gstVerificationStatus: verification.gstVerificationStatus,
      verificationLogs: verification.verificationLogs,
      status: 'Pending',
      comments: 'Self-onboarded via portal. Awaiting review.',
      panFileUrl,
      gstFileUrl,

      // Pass binary data fields to PostgreSQL DB service
      panFileData: hasPanFile ? req.files.panFile[0].buffer : null,
      panFileName: hasPanFile ? req.files.panFile[0].originalname : null,
      panFileMimetype: hasPanFile ? req.files.panFile[0].mimetype : null,

      gstFileData: hasGstFile ? req.files.gstFile[0].buffer : null,
      gstFileName: hasGstFile ? req.files.gstFile[0].originalname : null,
      gstFileMimetype: hasGstFile ? req.files.gstFile[0].mimetype : null,

      regFileData: hasRegFile ? req.files.regFile[0].buffer : null,
      regFileName: hasRegFile ? req.files.regFile[0].originalname : null,
      regFileMimetype: hasRegFile ? req.files.regFile[0].mimetype : null,

      chequeFileData: hasChequeFile ? req.files.chequeFile[0].buffer : null,
      chequeFileName: hasChequeFile ? req.files.chequeFile[0].originalname : null,
      chequeFileMimetype: hasChequeFile ? req.files.chequeFile[0].mimetype : null,

      isoFileData: hasIsoFile ? req.files.isoFile[0].buffer : null,
      isoFileName: hasIsoFile ? req.files.isoFile[0].originalname : null,
      isoFileMimetype: hasIsoFile ? req.files.isoFile[0].mimetype : null
    };

    const newVendor = await dbService.createVendor(pool, vendorData);
    res.status(201).json(newVendor);
  } catch (error) {
    console.error('Error in self-onboarding:', error);
    res.status(500).json({ message: 'Internal server error during vendor onboarding.' });
  }
});

// 4. Update vendor status and comments (From Admin Dashboard - Dynamic 2-Level Approval)
app.patch('/api/vendors/:id/status', authenticateAdmin, async (req, res) => {
  const { status, comments } = req.body;
  const validStatuses = ['Pending', 'Approved', 'Rejected'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid or missing status' });
  }

  try {
    const currentVendor = await dbService.getVendorById(pool, req.params.id);
    if (!currentVendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Role-based Maker-Checker stage enforcement
    if (req.user.role === 'Approver L1' && currentVendor.status === 'Pending') {
      return res.status(400).json({
        message: 'Forbidden. This profile must first be verified by Approver L2 before L1 senior approval.'
      });
    }

    if (req.user.role === 'Approver L2' && currentVendor.status === 'L2_Approved') {
      return res.status(400).json({
        message: 'Forbidden. This profile is already verified and awaiting senior L1 approval.'
      });
    }

    let targetStatus = status;
    if (status === 'Approved') {
      if (req.user.role === 'Approver L2') {
        targetStatus = 'L2_Approved';
      } else {
        targetStatus = 'Approved';
      }
    }

    const updatedVendor = await dbService.updateVendorStatus(pool, req.params.id, targetStatus, comments);
    res.json(updatedVendor);
  } catch (error) {
    console.error('Error updating vendor status:', error, req.params.id);
    res.status(500).json({ message: error.message || 'Failed to update database' });
  }
});

// 4.5. Update vendor details (From Admin Dashboard or Vendor Portal self-update - supports multi-file multipart upload)
app.put('/api/vendors/:id', authenticateUser, upload.fields([
  { name: 'panFile', maxCount: 1 },
  { name: 'gstFile', maxCount: 1 },
  { name: 'regFile', maxCount: 1 },
  { name: 'chequeFile', maxCount: 1 },
  { name: 'isoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const currentVendor = await dbService.getVendorById(pool, req.params.id);
    if (!currentVendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Authorization: Only Admin or the Vendor owner itself can update
    const isAdmin = req.user.role === 'Admin';
    const isOwner = req.user.role === 'Vendor' && currentVendor.primaryContact?.email?.toLowerCase() === req.user.username.toLowerCase();
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden. You do not have permission to edit this profile.' });
    }

    const body = req.body;
    const parseField = (field) => {
      if (!field) return {};
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch (e) { return {}; }
      }
      return field;
    };

    const registeredAddress = parseField(body.registeredAddress);
    const billingAddress = parseField(body.billingAddress);
    const primaryContact = parseField(body.primaryContact);
    const financeContact = parseField(body.financeContact);
    const bankDetails = parseField(body.bankDetails);

    // If new files are uploaded, resolve their URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const getExt = (filesObj, fieldName) => {
      const file = filesObj && filesObj[fieldName] && filesObj[fieldName][0];
      return file ? path.extname(file.originalname).toLowerCase() : '';
    };

    const hasPanFile = req.files && req.files.panFile && req.files.panFile[0];
    const hasGstFile = req.files && req.files.gstFile && req.files.gstFile[0];
    const hasRegFile = req.files && req.files.regFile && req.files.regFile[0];
    const hasChequeFile = req.files && req.files.chequeFile && req.files.chequeFile[0];
    const hasIsoFile = req.files && req.files.isoFile && req.files.isoFile[0];

    const updatedData = {
      legalName: body.legalName || currentVendor.legalName,
      tradeName: body.tradeName || currentVendor.tradeName,
      entityType: body.entityType || currentVendor.entityType,
      dateOfIncorporation: body.dateOfIncorporation || currentVendor.dateOfIncorporation,
      cin: body.cin || currentVendor.cin,
      llpin: body.llpin || currentVendor.llpin,
      pan: body.pan ? body.pan.toUpperCase().trim() : currentVendor.pan,
      gstStatus: body.gstStatus || currentVendor.gstStatus,
      gstin: body.gstin ? body.gstin.toUpperCase().trim() : currentVendor.gstin,
      msmeStatus: body.msmeStatus || currentVendor.msmeStatus,
      udyamNumber: body.udyamNumber || currentVendor.udyamNumber,
      registeredAddress,
      billingAddress,
      primaryContact,
      financeContact,
      bankDetails,
      
      panFileUrl: hasPanFile ? `${baseUrl}/api/vendors/files/${req.params.id}/pan?ext=${getExt(req.files, 'panFile')}` : currentVendor.panFileUrl,
      gstFileUrl: hasGstFile ? `${baseUrl}/api/vendors/files/${req.params.id}/gst?ext=${getExt(req.files, 'gstFile')}` : currentVendor.gstFileUrl,
      
      panFileData: hasPanFile ? req.files.panFile[0].buffer : currentVendor.panFileData,
      panFileName: hasPanFile ? req.files.panFile[0].originalname : currentVendor.panFileName,
      panFileMimetype: hasPanFile ? req.files.panFile[0].mimetype : currentVendor.panFileMimetype,

      gstFileData: hasGstFile ? req.files.gstFile[0].buffer : currentVendor.gstFileData,
      gstFileName: hasGstFile ? req.files.gstFile[0].originalname : currentVendor.gstFileName,
      gstFileMimetype: hasGstFile ? req.files.gstFile[0].mimetype : currentVendor.gstFileMimetype,

      regFileData: hasRegFile ? req.files.regFile[0].buffer : currentVendor.regFileData,
      regFileName: hasRegFile ? req.files.regFile[0].originalname : currentVendor.regFileName,
      regFileMimetype: hasRegFile ? req.files.regFile[0].mimetype : currentVendor.regFileMimetype,

      chequeFileData: hasChequeFile ? req.files.chequeFile[0].buffer : currentVendor.chequeFileData,
      chequeFileName: hasChequeFile ? req.files.chequeFile[0].originalname : currentVendor.chequeFileName,
      chequeFileMimetype: hasChequeFile ? req.files.chequeFile[0].mimetype : currentVendor.chequeFileMimetype,

      isoFileData: hasIsoFile ? req.files.isoFile[0].buffer : currentVendor.isoFileData,
      isoFileName: hasIsoFile ? req.files.isoFile[0].originalname : currentVendor.isoFileName,
      isoFileMimetype: hasIsoFile ? req.files.isoFile[0].mimetype : currentVendor.isoFileMimetype,

      verificationLogs: {
        ...currentVendor.verificationLogs,
        uploadedDocuments: {
          regFileUrl: hasRegFile ? `${baseUrl}/api/vendors/files/${req.params.id}/reg?ext=${getExt(req.files, 'regFile')}` : (currentVendor.verificationLogs?.uploadedDocuments?.regFileUrl || null),
          chequeFileUrl: hasChequeFile ? `${baseUrl}/api/vendors/files/${req.params.id}/cheque?ext=${getExt(req.files, 'chequeFile')}` : (currentVendor.verificationLogs?.uploadedDocuments?.chequeFileUrl || null),
          isoFileUrl: hasIsoFile ? `${baseUrl}/api/vendors/files/${req.params.id}/iso?ext=${getExt(req.files, 'isoFile')}` : (currentVendor.verificationLogs?.uploadedDocuments?.isoFileUrl || null)
        },
        metadata: {
          website: body.website || (currentVendor.verificationLogs?.metadata?.website || ''),
          isoCertified: body.isoCertified || (currentVendor.verificationLogs?.metadata?.isoCertified || 'No'),
          otherCertifications: body.otherCertifications || (currentVendor.verificationLogs?.metadata?.otherCertifications || '')
        }
      }
    };

    if (currentVendor.status === 'Rejected') {
      updatedData.status = 'Pending';
      updatedData.comments = 'Resubmitted details after compliance request corrections.';
    }

    const updatedVendor = await dbService.updateVendorDetails(pool, req.params.id, updatedData);
    res.json(updatedVendor);
  } catch (error) {
    console.error('Error updating vendor details:', error, req.params.id);
    res.status(500).json({ message: 'Failed to update database' });
  }
});

// 5. Webhook receiver for Google Form submission (via Apps Script)
app.post('/api/webhook/google-form', async (req, res) => {
  console.log('Received Google Form Webhook payload:', req.body);
  try {
    const result = await googleFormService.processGoogleFormWebhook(req.body, pool);
    res.status(201).json({ success: true, message: 'Vendor added from Google Form successfully', vendorId: result.vendorId });
  } catch (error) {
    console.error('Error inserting webhook vendor into DB:', error);
    res.status(500).json({ success: false, message: 'Failed to write to database' });
  }
});

// --- SAP ERP Integration Endpoints (Admin Only) ---

// 1. Get L1 approved queue (vendors and customers with status = 'Approved')
app.get('/api/integration/sap-queue', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const vendorsResult = await pool.query(
      `SELECT id, "legalName", "tradeName", "entityType", "dateOfIncorporation", cin, llpin, pan, "gstStatus", gstin, "msmeStatus", "udyamNumber", "primaryContact", "financeContact", "bankDetails", "registeredAddress", "billingAddress", status, "createdAt", "panFileUrl", "gstFileUrl"
       FROM vendors 
       WHERE status = 'Approved' 
       ORDER BY "createdAt" ASC`
    );

    const customersResult = await pool.query(
      `SELECT id, "legalName", "tradeName", "entityType", "dateOfIncorporation", cin, llpin, pan, "gstStatus", gstin, "msmeStatus", "udyamNumber", "primaryContact", "financeContact", "bankDetails", "registeredAddress", "billingAddress", status, "createdAt", "panFileUrl", "gstFileUrl"
       FROM customers 
       WHERE status = 'Approved' 
       ORDER BY "createdAt" ASC`
    );

    res.json({
      success: true,
      vendors: vendorsResult.rows,
      customers: customersResult.rows
    });
  } catch (error) {
    console.error('Error fetching SAP queue:', error);
    res.status(500).json({ message: 'Internal server error while fetching SAP queue.' });
  }
});

// 2. Mark profile as synced/integrated to SAP ERP
app.post('/api/integration/mark-synced', authenticateAdmin, requireAdmin, async (req, res) => {
  const { id, type } = req.body; // type is 'vendor' or 'customer'
  if (!id || !type) {
    return res.status(400).json({ message: 'Missing record id or type (vendor/customer).' });
  }

  try {
    if (type === 'vendor') {
      const result = await pool.query(
        `UPDATE vendors 
         SET status = 'Vendor Created', "updatedAt" = NOW(), comments = 'Successfully integrated into SAP ERP.'
         WHERE id = $1 AND status = 'Approved'
         RETURNING id, status`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Approved vendor not found with the specified ID.' });
      }
      return res.json({ success: true, message: 'Vendor status marked as Vendor Created in SAP.', record: result.rows[0] });
    } else if (type === 'customer') {
      const result = await pool.query(
        `UPDATE customers 
         SET status = 'Customer Created', "updatedAt" = NOW(), comments = 'Successfully integrated into ERP.'
         WHERE id = $1 AND status = 'Approved'
         RETURNING id, status`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Approved customer not found with the specified ID.' });
      }
      return res.json({ success: true, message: 'Customer status marked as Customer Created in ERP.', record: result.rows[0] });
    } else {
      return res.status(400).json({ message: 'Invalid type parameter. Must be "vendor" or "customer".' });
    }
  } catch (error) {
    console.error('Error marking profile as synced:', error);
    res.status(500).json({ message: 'Internal server error updating sync status.' });
  }
});

// --- User Management API Endpoints (Admin Only) ---

// List all users
app.get('/api/users', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, "createdAt" FROM users ORDER BY "createdAt" ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users list.' });
  }
});

// --- Customer API Endpoints ---

// 1. Get all customers (with server-side pagination, search, and filters)
app.get('/api/customers', authenticateAdmin, async (req, res) => {
  try {
    const queryParams = { ...req.query, role: req.user.role };
    const result = await dbService.getPaginatedCustomers(pool, queryParams);
    res.json(result);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ message: 'Internal server error while fetching customers.' });
  }
});

// 2. Get single customer details
app.get('/api/customers/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ message: 'Internal server error while retrieving customer.' });
  }
});

// Public route to retrieve customer binary files from PostgreSQL
app.get('/api/customers/files/:customerId/:fileKey', async (req, res) => {
  const { customerId, fileKey } = req.params;

  // Map keys to DB column names
  const keyMap = {
    pan: { data: 'panFileData', name: 'panFileName', mimetype: 'panFileMimetype' },
    gst: { data: 'gstFileData', name: 'gstFileName', mimetype: 'gstFileMimetype' },
    reg: { data: 'regFileData', name: 'regFileName', mimetype: 'regFileMimetype' },
    cheque: { data: 'chequeFileData', name: 'chequeFileName', mimetype: 'chequeFileMimetype' },
    iso: { data: 'isoFileData', name: 'isoFileName', mimetype: 'isoFileMimetype' }
  };

  const columns = keyMap[fileKey];
  if (!columns) {
    return res.status(400).json({ message: 'Invalid file key.' });
  }

  try {
    const query = `SELECT "${columns.data}" as file_data, "${columns.name}" as file_name, "${columns.mimetype}" as mime_type FROM customers WHERE id = $1`;
    const result = await pool.query(query, [customerId]);

    if (result.rows.length === 0 || !result.rows[0].file_data) {
      return res.status(404).json({ message: 'File not found.' });
    }

    const { file_data, file_name, mime_type } = result.rows[0];

    // Set correct headers
    res.set('Content-Type', mime_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file_name || 'download')}"`);
    res.send(file_data);
  } catch (error) {
    console.error('Error serving customer file from DB:', error);
    res.status(500).json({ message: 'Internal server error serving file.' });
  }
});

// 3. Create a new customer (From custom React UI Form - Multi-file multipart upload)
app.post('/api/customers', upload.fields([
  { name: 'panFile', maxCount: 1 },
  { name: 'gstFile', maxCount: 1 },
  { name: 'regFile', maxCount: 1 },
  { name: 'chequeFile', maxCount: 1 },
  { name: 'isoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const body = req.body;

    // Parse nested object strings sent as multipart/form-data
    const parseField = (field) => {
      if (!field) return {};
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch (e) { return {}; }
      }
      return field;
    };

    const registeredAddress = parseField(body.registeredAddress);
    const billingAddress = parseField(body.billingAddress);
    const primaryContact = parseField(body.primaryContact);
    const financeContact = parseField(body.financeContact);
    const bankDetails = parseField(body.bankDetails);

    const legalName = body.legalName;
    const pan = body.pan ? body.pan.toUpperCase().trim() : '';
    const primaryEmail = primaryContact.email || body.email || '';

    if (!legalName || !pan || !primaryEmail) {
      return res.status(400).json({ message: 'Legal Name, PAN, and Email Address are required.' });
    }

    const gstin = body.gstin ? body.gstin.toUpperCase().trim() : '';

    // Run mock Tax Identifier Verification
    const verification = await verifyTaxIdentifiers(pan, gstin, legalName);

    // Pre-generate the customer UUID
    const customerId = uuidv4();

    // Resolve file upload URLs (custom DB file retriever endpoints)
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const hasPanFile = req.files && req.files.panFile && req.files.panFile[0];
    const hasGstFile = req.files && req.files.gstFile && req.files.gstFile[0];
    const hasRegFile = req.files && req.files.regFile && req.files.regFile[0];
    const hasChequeFile = req.files && req.files.chequeFile && req.files.chequeFile[0];
    const hasIsoFile = req.files && req.files.isoFile && req.files.isoFile[0];

    const getExt = (filesObj, fieldName) => {
      const file = filesObj && filesObj[fieldName] && filesObj[fieldName][0];
      return file ? path.extname(file.originalname).toLowerCase() : '';
    };

    const panFileUrl = hasPanFile ? `${baseUrl}/api/customers/files/${customerId}/pan?ext=${getExt(req.files, 'panFile')}` : null;
    const gstFileUrl = hasGstFile ? `${baseUrl}/api/customers/files/${customerId}/gst?ext=${getExt(req.files, 'gstFile')}` : null;
    const regFileUrl = hasRegFile ? `${baseUrl}/api/customers/files/${customerId}/reg?ext=${getExt(req.files, 'regFile')}` : null;
    const chequeFileUrl = hasChequeFile ? `${baseUrl}/api/customers/files/${customerId}/cheque?ext=${getExt(req.files, 'chequeFile')}` : null;
    const isoFileUrl = hasIsoFile ? `${baseUrl}/api/customers/files/${customerId}/iso?ext=${getExt(req.files, 'isoFile')}` : null;

    // Attach extra documents inside verificationLogs
    verification.verificationLogs.uploadedDocuments = {
      regFileUrl,
      chequeFileUrl,
      isoFileUrl
    };

    // Attach metadata
    verification.verificationLogs.metadata = {
      website: body.website || '',
      isoCertified: body.isoCertified || 'No',
      otherCertifications: body.otherCertifications || ''
    };

    const customerData = {
      id: customerId,
      legalName,
      tradeName: body.tradeName || '',
      entityType: body.entityType || 'Proprietorship',
      dateOfIncorporation: body.dateOfIncorporation || '',
      cin: body.cin || '',
      llpin: body.llpin || '',
      pan,
      gstStatus: body.gstStatus || 'Unregistered',
      gstin,
      msmeStatus: body.msmeStatus || 'No',
      udyamNumber: body.udyamNumber || '',
      registeredAddress,
      billingAddress,
      primaryContact: {
        ...primaryContact,
        email: primaryEmail
      },
      financeContact,
      bankDetails,
      panVerificationStatus: verification.panVerificationStatus,
      gstVerificationStatus: verification.gstVerificationStatus,
      verificationLogs: verification.verificationLogs,
      status: 'Pending',
      comments: 'Self-onboarded via portal. Awaiting review.',
      panFileUrl,
      gstFileUrl,

      // Pass binary data fields to PostgreSQL DB service
      panFileData: hasPanFile ? req.files.panFile[0].buffer : null,
      panFileName: hasPanFile ? req.files.panFile[0].originalname : null,
      panFileMimetype: hasPanFile ? req.files.panFile[0].mimetype : null,

      gstFileData: hasGstFile ? req.files.gstFile[0].buffer : null,
      gstFileName: hasGstFile ? req.files.gstFile[0].originalname : null,
      gstFileMimetype: hasGstFile ? req.files.gstFile[0].mimetype : null,

      regFileData: hasRegFile ? req.files.regFile[0].buffer : null,
      regFileName: hasRegFile ? req.files.regFile[0].originalname : null,
      regFileMimetype: hasRegFile ? req.files.regFile[0].mimetype : null,

      chequeFileData: hasChequeFile ? req.files.chequeFile[0].buffer : null,
      chequeFileName: hasChequeFile ? req.files.chequeFile[0].originalname : null,
      chequeFileMimetype: hasChequeFile ? req.files.chequeFile[0].mimetype : null,

      isoFileData: hasIsoFile ? req.files.isoFile[0].buffer : null,
      isoFileName: hasIsoFile ? req.files.isoFile[0].originalname : null,
      isoFileMimetype: hasIsoFile ? req.files.isoFile[0].mimetype : null
    };

    const newCustomer = await dbService.createCustomer(pool, customerData);
    res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Error in customer self-onboarding:', error);
    res.status(500).json({ message: 'Internal server error during customer onboarding.' });
  }
});

// 4. Update customer status and comments (From Admin Dashboard - Dynamic 2-Level Approval)
app.patch('/api/customers/:id/status', authenticateAdmin, async (req, res) => {
  const { status, comments } = req.body;
  const validStatuses = ['Pending', 'Approved', 'Rejected'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid or missing status' });
  }

  try {
    const selectResult = await pool.query('SELECT status FROM customers WHERE id = $1', [req.params.id]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const currentStatus = selectResult.rows[0].status;

    // Role-based Maker-Checker stage enforcement
    if (req.user.role === 'Approver L1' && currentStatus === 'Pending') {
      return res.status(400).json({
        message: 'Forbidden. This profile must first be verified by Approver L2 before L1 senior approval.'
      });
    }

    if (req.user.role === 'Approver L2' && currentStatus === 'L2_Approved') {
      return res.status(400).json({
        message: 'Forbidden. This profile is already verified and awaiting senior L1 approval.'
      });
    }

    let targetStatus = status;
    if (status === 'Approved') {
      if (req.user.role === 'Approver L2') {
        targetStatus = 'L2_Approved';
      } else {
        targetStatus = 'Approved';
      }
    }

    const updatedCustomer = await dbService.updateCustomerStatus(pool, req.params.id, targetStatus, comments);
    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer status:', error, req.params.id);
    res.status(500).json({ message: error.message || 'Failed to update database' });
  }
});

// 5. Update customer details (From Admin Dashboard or Customer Portal self-update - supports multi-file multipart upload)
app.put('/api/customers/:id', authenticateUser, upload.fields([
  { name: 'panFile', maxCount: 1 },
  { name: 'gstFile', maxCount: 1 },
  { name: 'regFile', maxCount: 1 },
  { name: 'chequeFile', maxCount: 1 },
  { name: 'isoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const selectResult = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const currentCustomer = selectResult.rows[0];

    // Authorization: Only Admin or the Customer owner itself can update
    const isAdmin = req.user.role === 'Admin';
    const isOwner = req.user.role === 'Customer' && currentCustomer.primaryContact?.email?.toLowerCase() === req.user.username.toLowerCase();
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden. You do not have permission to edit this profile.' });
    }

    const body = req.body;
    const parseField = (field) => {
      if (!field) return {};
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch (e) { return {}; }
      }
      return field;
    };

    const registeredAddress = parseField(body.registeredAddress);
    const billingAddress = parseField(body.billingAddress);
    const primaryContact = parseField(body.primaryContact);
    const financeContact = parseField(body.financeContact);
    const bankDetails = parseField(body.bankDetails);

    // If new files are uploaded, resolve their URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const getExt = (filesObj, fieldName) => {
      const file = filesObj && filesObj[fieldName] && filesObj[fieldName][0];
      return file ? path.extname(file.originalname).toLowerCase() : '';
    };

    const hasPanFile = req.files && req.files.panFile && req.files.panFile[0];
    const hasGstFile = req.files && req.files.gstFile && req.files.gstFile[0];
    const hasRegFile = req.files && req.files.regFile && req.files.regFile[0];
    const hasChequeFile = req.files && req.files.chequeFile && req.files.chequeFile[0];
    const hasIsoFile = req.files && req.files.isoFile && req.files.isoFile[0];

    const updatedData = {
      legalName: body.legalName || currentCustomer.legalName,
      tradeName: body.tradeName || currentCustomer.tradeName,
      entityType: body.entityType || currentCustomer.entityType,
      dateOfIncorporation: body.dateOfIncorporation || currentCustomer.dateOfIncorporation,
      cin: body.cin || currentCustomer.cin,
      llpin: body.llpin || currentCustomer.llpin,
      pan: body.pan ? body.pan.toUpperCase().trim() : currentCustomer.pan,
      gstStatus: body.gstStatus || currentCustomer.gstStatus,
      gstin: body.gstin ? body.gstin.toUpperCase().trim() : currentCustomer.gstin,
      msmeStatus: body.msmeStatus || currentCustomer.msmeStatus,
      udyamNumber: body.udyamNumber || currentCustomer.udyamNumber,
      registeredAddress,
      billingAddress,
      primaryContact,
      financeContact,
      bankDetails,
      
      panFileUrl: hasPanFile ? `${baseUrl}/api/customers/files/${req.params.id}/pan?ext=${getExt(req.files, 'panFile')}` : currentCustomer.panFileUrl,
      gstFileUrl: hasGstFile ? `${baseUrl}/api/customers/files/${req.params.id}/gst?ext=${getExt(req.files, 'gstFile')}` : currentCustomer.gstFileUrl,
      
      panFileData: hasPanFile ? req.files.panFile[0].buffer : currentCustomer.panFileData,
      panFileName: hasPanFile ? req.files.panFile[0].originalname : currentCustomer.panFileName,
      panFileMimetype: hasPanFile ? req.files.panFile[0].mimetype : currentCustomer.panFileMimetype,

      gstFileData: hasGstFile ? req.files.gstFile[0].buffer : currentCustomer.gstFileData,
      gstFileName: hasGstFile ? req.files.gstFile[0].originalname : currentCustomer.gstFileName,
      gstFileMimetype: hasGstFile ? req.files.gstFile[0].mimetype : currentCustomer.gstFileMimetype,

      regFileData: hasRegFile ? req.files.regFile[0].buffer : currentCustomer.regFileData,
      regFileName: hasRegFile ? req.files.regFile[0].originalname : currentCustomer.regFileName,
      regFileMimetype: hasRegFile ? req.files.regFile[0].mimetype : currentCustomer.regFileMimetype,

      chequeFileData: hasChequeFile ? req.files.chequeFile[0].buffer : currentCustomer.chequeFileData,
      chequeFileName: hasChequeFile ? req.files.chequeFile[0].originalname : currentCustomer.chequeFileName,
      chequeFileMimetype: hasChequeFile ? req.files.chequeFile[0].mimetype : currentCustomer.chequeFileMimetype,

      isoFileData: hasIsoFile ? req.files.isoFile[0].buffer : currentCustomer.isoFileData,
      isoFileName: hasIsoFile ? req.files.isoFile[0].originalname : currentCustomer.isoFileName,
      isoFileMimetype: hasIsoFile ? req.files.isoFile[0].mimetype : currentCustomer.isoFileMimetype,

      verificationLogs: {
        ...currentCustomer.verificationLogs,
        uploadedDocuments: {
          regFileUrl: hasRegFile ? `${baseUrl}/api/customers/files/${req.params.id}/reg?ext=${getExt(req.files, 'regFile')}` : (currentCustomer.verificationLogs?.uploadedDocuments?.regFileUrl || null),
          chequeFileUrl: hasChequeFile ? `${baseUrl}/api/customers/files/${req.params.id}/cheque?ext=${getExt(req.files, 'chequeFile')}` : (currentCustomer.verificationLogs?.uploadedDocuments?.chequeFileUrl || null),
          isoFileUrl: hasIsoFile ? `${baseUrl}/api/customers/files/${req.params.id}/iso?ext=${getExt(req.files, 'isoFile')}` : (currentCustomer.verificationLogs?.uploadedDocuments?.isoFileUrl || null)
        },
        metadata: {
          website: body.website || (currentCustomer.verificationLogs?.metadata?.website || ''),
          isoCertified: body.isoCertified || (currentCustomer.verificationLogs?.metadata?.isoCertified || 'No'),
          otherCertifications: body.otherCertifications || (currentCustomer.verificationLogs?.metadata?.otherCertifications || '')
        }
      }
    };

    if (currentCustomer.status === 'Rejected') {
      updatedData.status = 'Pending';
      updatedData.comments = 'Resubmitted customer details after compliance correction request.';
    }

    const updatedCustomer = await dbService.updateCustomerDetails(pool, req.params.id, updatedData);
    res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer details:', error, req.params.id);
    res.status(500).json({ message: 'Failed to update customer details.' });
  }
});

// Create a new user
app.post('/api/users', authenticateAdmin, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required.' });
  }

  const validRoles = ['Admin', 'Approver L1', 'Approver L2', 'Vendor', 'Customer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role selection.' });
  }

  try {
    const checkResult = await pool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const id = uuidv4();
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(password);

    await pool.query(
      'INSERT INTO users (id, username, password, salt, role) VALUES ($1, $2, $3, $4, $5)',
      [id, username.trim(), hashedPassword, salt, role]
    );

    res.status(201).json({ success: true, message: `User "${username}" created successfully.` });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Failed to create user.' });
  }
});

// Invite a vendor (Admin Only)
app.post('/api/users/invite-vendor', authenticateAdmin, requireAdmin, authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Vendor email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ message: 'Invalid email address format.' });
  }

  try {
    // Check if user already exists
    const checkResult = await pool.query('SELECT id FROM users WHERE username = $1', [cleanEmail]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ message: 'A user with this email address already exists.' });
    }

    // Generate random 10 character password
    const generateRandomPassword = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
      let pass = '';
      for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pass;
    };
    const generatedPassword = generateRandomPassword();

    // Create user with 'Vendor' role in DB
    const id = uuidv4();
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(generatedPassword);

    await pool.query(
      'INSERT INTO users (id, username, password, salt, role, "passwordResetRequired") VALUES ($1, $2, $3, $4, $5, $6)',
      [id, cleanEmail, hashedPassword, salt, 'Vendor', true]
    );

    // Build the login portal link pointing to the requesting client origin
    const portalUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;

    // Dispatch email via modular email service
    const { emailSent, message: emailMessage } = emailService.sendVendorInvitation({
      toEmail: cleanEmail,
      generatedPassword,
      portalUrl
    });

    res.status(201).json({
      success: true,
      message: emailMessage,
      emailSent,
      username: cleanEmail,
      password: generatedPassword,
      portalUrl
    });

  } catch (error) {
    console.error('Error executing vendor invitation:', error);
    res.status(500).json({ message: 'Internal server error while inviting vendor.' });
  }
});

// Invite a customer (Admin Only)
app.post('/api/users/invite-customer', authenticateAdmin, requireAdmin, authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ message: 'Customer email address is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ message: 'Invalid email address format.' });
  }

  try {
    // Check if user already exists
    const checkResult = await pool.query('SELECT id FROM users WHERE username = $1', [cleanEmail]);
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ message: 'A user with this email address already exists.' });
    }

    // Generate random 10 character password
    const generateRandomPassword = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
      let pass = '';
      for (let i = 0; i < 10; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pass;
    };
    const generatedPassword = generateRandomPassword();

    // Create user with 'Customer' role in DB
    const id = uuidv4();
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(generatedPassword);

    await pool.query(
      'INSERT INTO users (id, username, password, salt, role, "passwordResetRequired") VALUES ($1, $2, $3, $4, $5, $6)',
      [id, cleanEmail, hashedPassword, salt, 'Customer', true]
    );

    // Build the login portal link pointing to the requesting client origin
    const portalUrl = req.get('origin') || `${req.protocol}://${req.get('host')}`;

    // Dispatch email via modular email service
    const { emailSent, message: emailMessage } = emailService.sendCustomerInvitation({
      toEmail: cleanEmail,
      generatedPassword,
      portalUrl
    });

    res.status(201).json({
      success: true,
      message: emailMessage,
      emailSent,
      username: cleanEmail,
      password: generatedPassword,
      portalUrl
    });

  } catch (error) {
    console.error('Error executing customer invitation:', error);
    res.status(500).json({ message: 'Internal server error while inviting customer.' });
  }
});

// Delete a user
app.delete('/api/users/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  const userId = req.params.id;

  try {
    const selectResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const targetUser = selectResult.rows[0].username;
    if (targetUser === req.user.username) {
      return res.status(400).json({ message: 'You cannot delete your own logged-in account.' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true, message: `User "${targetUser}" deleted successfully.` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// Serve frontend build if dist folder exists (monorepo), otherwise return API status message
const frontendDistPath = path.join(__dirname, '../frontend/dist/index.html');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(frontendDistPath);
  });
} else {
  app.get('/', (req, res) => {
    res.json({ success: true, message: 'VK18 Vendor Onboarding Backend API is running.' });
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
