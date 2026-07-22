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
    console.log('PostgreSQL database schema checked/initialized successfully via DB Service.');

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

// 1. Get all vendors (with server-side pagination, search, and filters)
app.get('/api/vendors', authenticateAdmin, async (req, res) => {
  try {
    const result = await dbService.getPaginatedVendors(pool, req.query);
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

// 4. Update vendor status and comments (From Admin Dashboard)
app.patch('/api/vendors/:id/status', authenticateAdmin, async (req, res) => {
  const { status, comments } = req.body;
  const validStatuses = ['Pending', 'Approved', 'Rejected'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid or missing status' });
  }

  try {
    const updatedVendor = await dbService.updateVendorStatus(pool, req.params.id, status, comments);
    res.json(updatedVendor);
  } catch (error) {
    console.error('Error updating vendor status:', error, req.params.id);
    res.status(500).json({ message: error.message || 'Failed to update database' });
  }
});

// 4.5. Update vendor details (From Admin Dashboard - Admin Only)
app.put('/api/vendors/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const updatedVendor = await dbService.updateVendorDetails(pool, req.params.id, req.body);
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

// Create a new user
app.post('/api/users', authenticateAdmin, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required.' });
  }
  
  const validRoles = ['Admin', 'Approver', 'Vendor'];
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

    // Dispatch email
    let emailSent = false;
    let emailMessage = 'Vendor user account created, but SMTP is not configured. Credentials printed to server logs.';

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    console.log(`[INVITATION CREATED] Vendor Email: ${cleanEmail} | Temporary Password: ${generatedPassword}`);

    if (smtpHost && smtpUser && smtpPass) {
      emailSent = true;
      emailMessage = 'Vendor registered and invitation email is being sent.';

      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: `"VK18 Vendor Portal" <${smtpUser}>`,
        to: cleanEmail,
        subject: 'Welcome to VK18 Vendor Portal - Onboarding Invitation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">VK18 Pvt Ltd - Vendor Onboarding</h2>
            <p>Hello,</p>
            <p>You have been invited to register as a partner/vendor on the VK18 Portal.</p>
            <p>Please use the credentials below to log in and fill out the Vendor Registration Form:</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5;">
              <p style="margin: 5px 0;"><strong>Portal URL:</strong> <a href="${portalUrl}" style="color: #4f46e5; text-decoration: underline;">${portalUrl}</a></p>
              <p style="margin: 5px 0;"><strong>Username (Email):</strong> <code>${cleanEmail}</code></p>
              <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code>${generatedPassword}</code></p>
            </div>

            <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
              Note: This is a system generated email. For security reasons, please change your password after logging in.
            </p>
          </div>
        `
      };

      // Non-blocking background dispatch
      transporter.sendMail(mailOptions).then(() => {
        console.log(`[EMAIL DISPATCHED] Vendor invitation email sent successfully to ${cleanEmail}`);
      }).catch((mailError) => {
        console.error('SMTP Error dispatching vendor invitation email:', mailError);
      });
    }

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

// Serve frontend in production (optional, we can run them on separate ports for dev)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
