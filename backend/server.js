const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const googleFormService = require('./google_form_service');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_super_secret_key_123';

// Helper to hash passwords using SHA-256
const hashPassword = (password, salt) => {
  const hash = crypto.createHash('sha256');
  hash.update(password + salt);
  return hash.digest('hex');
};

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS vendors (
        id UUID PRIMARY KEY,
        "legalName" VARCHAR(255) NOT NULL,
        "tradeName" VARCHAR(255),
        "entityType" VARCHAR(100),
        "dateOfIncorporation" VARCHAR(100),
        cin VARCHAR(100),
        llpin VARCHAR(100),
        pan VARCHAR(50) NOT NULL,
        "gstStatus" VARCHAR(100),
        gstin VARCHAR(100),
        "msmeStatus" VARCHAR(50),
        "udyamNumber" VARCHAR(100),
        "registeredAddress" JSONB,
        "billingAddress" JSONB,
        "primaryContact" JSONB,
        "financeContact" JSONB,
        "bankDetails" JSONB,
        "panVerificationStatus" VARCHAR(50) DEFAULT 'Unverified',
        "gstVerificationStatus" VARCHAR(50) DEFAULT 'Unverified',
        "verificationLogs" JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(50) DEFAULT 'Pending',
        comments TEXT,
        "googleFormResponseId" VARCHAR(255),
        "panFileUrl" TEXT,
        "gstFileUrl" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createTableQuery);
    // Safely add columns if the table was created in a previous version
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "googleFormResponseId" VARCHAR(255);');
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "panFileUrl" TEXT;');
    await pool.query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "gstFileUrl" TEXT;');
    console.log('PostgreSQL vendors table checked/initialized successfully.');

    // Initialize users table
    const createUsersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        salt VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'Approver',
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createUsersTableQuery);
    console.log('PostgreSQL users table checked/initialized successfully.');

    // Seed default administrator if users table is empty
    const usersCheck = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(usersCheck.rows[0].count, 10);
    if (userCount === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminId = uuidv4();
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = hashPassword(adminPassword, salt);
      
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

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized access. No token provided.' });
  }
  const token = authHeader.split(' ')[1];
  
  // Legacy compatibility: check if it's the static admin token
  if (token === 'admin-session-token') {
    req.user = { username: process.env.ADMIN_USERNAME || 'admin', role: 'Admin' };
    return next();
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
app.post('/api/auth/login', async (req, res) => {
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
    const hashedPassword = hashPassword(password, user.salt);
    if (hashedPassword !== user.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate signed stateless JSON Web Token (JWT)
    const token = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, username: user.username, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Authentication server error.' });
  }
});

// 1. Get all vendors (with server-side pagination, search, and filters)
app.get('/api/vendors', authenticateAdmin, async (req, res) => {
  try {
    // 1. Get global stats for the dashboard summary
    const statsResult = await pool.query('SELECT status, COUNT(*) FROM vendors GROUP BY status');
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    statsResult.rows.forEach(row => {
      const count = parseInt(row.count, 10);
      stats.total += count;
      if (row.status === 'Pending') stats.pending = count;
      if (row.status === 'Approved') stats.approved = count;
      if (row.status === 'Rejected') stats.rejected = count;
    });

    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10) || 10;

    // Backward compatibility: if page is not specified, return all records
    if (isNaN(page) || page < 1) {
      const result = await pool.query('SELECT * FROM vendors ORDER BY "createdAt" DESC');
      return res.json(result.rows);
    }

    const search = req.query.search || '';
    const status = req.query.status || 'All';
    const entityType = req.query.entityType || 'All';

    let queryStr = 'SELECT * FROM vendors WHERE 1=1';
    let countStr = 'SELECT COUNT(*) FROM vendors WHERE 1=1';
    const queryParams = [];
    const countParams = [];
    let paramIdx = 1;

    if (search.trim()) {
      const searchPattern = `%${search.toLowerCase().trim()}%`;
      const searchClause = ` AND (LOWER("legalName") LIKE $${paramIdx} OR LOWER(pan) LIKE $${paramIdx} OR LOWER(gstin) LIKE $${paramIdx} OR LOWER("tradeName") LIKE $${paramIdx})`;
      queryStr += searchClause;
      countStr += searchClause;
      queryParams.push(searchPattern);
      countParams.push(searchPattern);
      paramIdx++;
    }

    if (status !== 'All') {
      const statusClause = ` AND status = $${paramIdx}`;
      queryStr += statusClause;
      countStr += statusClause;
      queryParams.push(status);
      countParams.push(status);
      paramIdx++;
    }

    if (entityType !== 'All') {
      const entityClause = ` AND "entityType" = $${paramIdx}`;
      queryStr += entityClause;
      countStr += entityClause;
      queryParams.push(entityType);
      countParams.push(entityType);
      paramIdx++;
    }

    // Get total count of filtered vendors
    const countResult = await pool.query(countStr, countParams);
    const totalFiltered = parseInt(countResult.rows[0].count, 10);

    // Add Order by, Limit, and Offset to query string
    queryStr += ` ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const offset = (page - 1) * limit;
    queryParams.push(limit, offset);

    const listResult = await pool.query(queryStr, queryParams);

    res.json({
      vendors: listResult.rows,
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
      stats
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ message: 'Internal server error while fetching vendors.' });
  }
});

// 2. Get single vendor details
app.get('/api/vendors/:id', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vendor details:', error);
    res.status(500).json({ message: 'Internal server error while retrieving vendor.' });
  }
});

// 3. Create a new vendor (From custom React UI Form)
app.post('/api/vendors', async (req, res) => {
  const newVendorData = req.body;

  // Basic server-side validation
  if (!newVendorData.legalName || !newVendorData.pan || !newVendorData.primaryContact?.email) {
    return res.status(400).json({ message: 'Legal Name, PAN, and Primary Email are required.' });
  }

  const id = uuidv4();
  const legalName = newVendorData.legalName;
  const tradeName = newVendorData.tradeName || '';
  const entityType = newVendorData.entityType || 'Proprietorship';
  const dateOfIncorporation = newVendorData.dateOfIncorporation || '';
  const cin = newVendorData.cin || '';
  const llpin = newVendorData.llpin || '';
  const pan = newVendorData.pan.toUpperCase().trim();
  const gstStatus = newVendorData.gstStatus || 'Unregistered';
  const gstin = newVendorData.gstin ? newVendorData.gstin.toUpperCase().trim() : '';
  const msmeStatus = newVendorData.msmeStatus || 'No';
  const udyamNumber = newVendorData.udyamNumber || '';
  const registeredAddress = newVendorData.registeredAddress || {};
  const billingAddress = newVendorData.billingAddress || {};
  const primaryContact = newVendorData.primaryContact || {};
  const financeContact = newVendorData.financeContact || {};
  const bankDetails = newVendorData.bankDetails || {};
  const status = 'Pending';
  const comments = 'Self-onboarded via portal. Awaiting review.';
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();

  // Run mock Tax Identifier Verification
  const verification = await verifyTaxIdentifiers(pan, gstin, legalName);

  try {
    const query = `
      INSERT INTO vendors (
        id, "legalName", "tradeName", "entityType", "dateOfIncorporation", cin, llpin, pan,
        "gstStatus", gstin, "msmeStatus", "udyamNumber", "registeredAddress", "billingAddress",
        "primaryContact", "financeContact", "bankDetails", "panVerificationStatus", "gstVerificationStatus",
        "verificationLogs", status, comments, "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING *
    `;
    const values = [
      id, legalName, tradeName, entityType, dateOfIncorporation, cin, llpin, pan,
      gstStatus, gstin, msmeStatus, udyamNumber, JSON.stringify(registeredAddress), JSON.stringify(billingAddress),
      JSON.stringify(primaryContact), JSON.stringify(financeContact), JSON.stringify(bankDetails),
      verification.panVerificationStatus, verification.gstVerificationStatus, JSON.stringify(verification.verificationLogs),
      status, comments, createdAt, updatedAt
    ];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error inserting vendor into DB:', error);
    res.status(500).json({ message: 'Failed to write to database' });
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
    const selectResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const currentVendor = selectResult.rows[0];
    const updatedComments = comments || currentVendor.comments;
    const updatedAt = new Date().toISOString();

    const updateQuery = `
      UPDATE vendors
      SET status = $1, comments = $2, "updatedAt" = $3
      WHERE id = $4
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [status, updatedComments, updatedAt, req.params.id]);
    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Error updating vendor status:', error);
    res.status(500).json({ message: 'Failed to update database' });
  }
});

// 4.5. Update vendor details (From Admin Dashboard - Admin Only)
app.put('/api/vendors/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    legalName,
    tradeName,
    entityType,
    dateOfIncorporation,
    cin,
    llpin,
    pan,
    gstin,
    msmeStatus,
    udyamNumber,
    registeredAddress,
    billingAddress,
    primaryContact,
    financeContact,
    bankDetails,
    verificationLogs,
    googleFormResponseId,
    panFileUrl,
    gstFileUrl
  } = req.body;

  try {
    const query = `
      UPDATE vendors
      SET 
        "legalName" = $1,
        "tradeName" = $2,
        "entityType" = $3,
        "dateOfIncorporation" = $4,
        cin = $5,
        llpin = $6,
        pan = $7,
        gstin = $8,
        "msmeStatus" = $9,
        "udyamNumber" = $10,
        "registeredAddress" = $11,
        "billingAddress" = $12,
        "primaryContact" = $13,
        "financeContact" = $14,
        "bankDetails" = $15,
        "verificationLogs" = $16,
        "googleFormResponseId" = $17,
        "panFileUrl" = $18,
        "gstFileUrl" = $19,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *
    `;
    const values = [
      legalName,
      tradeName,
      entityType,
      dateOfIncorporation,
      cin,
      llpin,
      pan,
      gstin,
      msmeStatus,
      udyamNumber,
      typeof registeredAddress === 'string' ? registeredAddress : JSON.stringify(registeredAddress),
      typeof billingAddress === 'string' ? billingAddress : JSON.stringify(billingAddress),
      typeof primaryContact === 'string' ? primaryContact : JSON.stringify(primaryContact),
      typeof financeContact === 'string' ? financeContact : JSON.stringify(financeContact),
      typeof bankDetails === 'string' ? bankDetails : JSON.stringify(bankDetails),
      typeof verificationLogs === 'string' ? verificationLogs : JSON.stringify(verificationLogs || {}),
      googleFormResponseId || null,
      panFileUrl || null,
      gstFileUrl || null,
      id
    ];

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vendor details:', error);
    res.status(500).json({ message: 'Failed to update vendor details.' });
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
  
  const validRoles = ['Admin', 'Approver'];
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
    const hashedPassword = hashPassword(password, salt);

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
