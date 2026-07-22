const { v4: uuidv4 } = require('uuid');

// 1. Auto-initialize Database
const initializeDatabaseSchema = async (pool) => {
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
        "verificationLogs" JSONB,
        status VARCHAR(50) DEFAULT 'Pending',
        comments TEXT,
        "googleFormResponseId" VARCHAR(255),
        "panFileUrl" TEXT,
        "gstFileUrl" TEXT,
        "createdAt" VARCHAR(100),
        "updatedAt" VARCHAR(100)
      );
    `;
    await pool.query(createTableQuery);

    // Ensure all binary columns exist
    const addBinaryColumns = `
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "panFileData" BYTEA;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "panFileName" TEXT;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "panFileMimetype" TEXT;

      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "gstFileData" BYTEA;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "gstFileName" TEXT;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "gstFileMimetype" TEXT;

      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "regFileData" BYTEA;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "regFileName" TEXT;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "regFileMimetype" TEXT;

      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "chequeFileData" BYTEA;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "chequeFileName" TEXT;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "chequeFileMimetype" TEXT;

      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "isoFileData" BYTEA;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "isoFileName" TEXT;
      ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "isoFileMimetype" TEXT;
    `;
    await pool.query(addBinaryColumns);

    // Seed default admin account if table exists
    const usersTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        salt VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'Approver',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "passwordResetRequired" BOOLEAN DEFAULT FALSE
      );
    `;
    await pool.query(usersTableQuery);

    // Ensure column exists for existing tables
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordResetRequired" BOOLEAN DEFAULT FALSE');
  } catch (error) {
    console.error('Error initializing PostgreSQL schema in DB service:', error);
    throw error;
  }
};

// 2. Fetch paginated and filtered vendors
const getPaginatedVendors = async (pool, queryParams) => {
  const page = parseInt(queryParams.page, 10);
  const limit = parseInt(queryParams.limit, 10) || 10;
  const search = queryParams.search || '';
  const status = queryParams.status || 'All';
  const entityType = queryParams.entityType || 'All';

  // Fetch global stats
  const statsResult = await pool.query('SELECT status, COUNT(*) FROM vendors GROUP BY status');
  const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  statsResult.rows.forEach(row => {
    const count = parseInt(row.count, 10);
    stats.total += count;
    if (row.status === 'Pending') stats.pending = count;
    if (row.status === 'Approved') stats.approved = count;
    if (row.status === 'Rejected') stats.rejected = count;
  });

  // Backward compatibility: if page is not specified, return all
  if (isNaN(page) || page < 1) {
    const result = await pool.query('SELECT id, "legalName", "tradeName", "entityType", "pan", gstin, "msmeStatus", status, "googleFormResponseId", "createdAt" FROM vendors ORDER BY "createdAt" DESC');
    return { vendors: result.rows, total: result.rows.length, page: 1, limit: result.rows.length, totalPages: 1, stats };
  }

  let queryStr = 'SELECT id, "legalName", "tradeName", "entityType", "pan", gstin, "msmeStatus", status, "googleFormResponseId", "createdAt" FROM vendors WHERE 1=1';
  let countStr = 'SELECT COUNT(*) FROM vendors WHERE 1=1';
  const values = [];
  const countValues = [];
  let paramIdx = 1;

  if (search.trim()) {
    let cleanSearch = search.trim();
    if (cleanSearch.toLowerCase().startsWith('vk18-')) {
      cleanSearch = cleanSearch.substring(5);
    }
    const searchPattern = `%${cleanSearch.toLowerCase()}%`;
    const searchClause = ` AND (LOWER("legalName") LIKE $${paramIdx} OR LOWER(pan) LIKE $${paramIdx} OR LOWER(gstin) LIKE $${paramIdx} OR LOWER("tradeName") LIKE $${paramIdx} OR CAST(id AS TEXT) LIKE $${paramIdx})`;
    queryStr += searchClause;
    countStr += searchClause;
    values.push(searchPattern);
    countValues.push(searchPattern);
    paramIdx++;
  }

  if (status !== 'All') {
    const statusClause = ` AND status = $${paramIdx}`;
    queryStr += statusClause;
    countStr += statusClause;
    values.push(status);
    countValues.push(status);
    paramIdx++;
  }

  if (entityType !== 'All') {
    const entityClause = ` AND "entityType" = $${paramIdx}`;
    queryStr += entityClause;
    countStr += entityClause;
    values.push(entityType);
    countValues.push(entityType);
    paramIdx++;
  }

  const countResult = await pool.query(countStr, countValues);
  const totalFiltered = parseInt(countResult.rows[0].count, 10);

  queryStr += ` ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  const offset = (page - 1) * limit;
  values.push(limit, offset);

  const listResult = await pool.query(queryStr, values);

  return {
    vendors: listResult.rows,
    total: totalFiltered,
    page,
    limit,
    totalPages: Math.ceil(totalFiltered / limit) || 1,
    stats
  };
};

// 3. Fetch single vendor
const getVendorById = async (pool, id) => {
  const result = await pool.query('SELECT * FROM vendors WHERE id = $1', [id]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

// 4. Create new vendor profile
const createVendor = async (pool, vendorData) => {
  const id = vendorData.id || uuidv4();
  const legalName = vendorData.legalName;
  const tradeName = vendorData.tradeName || '';
  const entityType = vendorData.entityType || 'Proprietorship';
  const dateOfIncorporation = vendorData.dateOfIncorporation || '';
  const cin = vendorData.cin || '';
  const llpin = vendorData.llpin || '';
  const pan = vendorData.pan.toUpperCase().trim();
  const gstStatus = vendorData.gstStatus || 'Unregistered';
  const gstin = vendorData.gstin ? vendorData.gstin.toUpperCase().trim() : '';
  const msmeStatus = vendorData.msmeStatus || 'No';
  const udyamNumber = vendorData.udyamNumber || '';
  const registeredAddress = vendorData.registeredAddress || {};
  const billingAddress = vendorData.billingAddress || {};
  const primaryContact = vendorData.primaryContact || {};
  const financeContact = vendorData.financeContact || {};
  const bankDetails = vendorData.bankDetails || {};
  
  const status = vendorData.status || 'Pending';
  const comments = vendorData.comments || 'Self-onboarded via portal. Awaiting review.';
  
  const panVerificationStatus = vendorData.panVerificationStatus || 'Unverified';
  const gstVerificationStatus = vendorData.gstVerificationStatus || 'Unverified';
  const verificationLogs = vendorData.verificationLogs || {};

  const googleFormResponseId = vendorData.googleFormResponseId || null;
  const panFileUrl = vendorData.panFileUrl || null;
  const gstFileUrl = vendorData.gstFileUrl || null;

  const createdAt = vendorData.createdAt || new Date().toISOString();
  const updatedAt = vendorData.updatedAt || new Date().toISOString();

  // Extract binary documents & metadata
  const panFileData = vendorData.panFileData || null;
  const panFileName = vendorData.panFileName || null;
  const panFileMimetype = vendorData.panFileMimetype || null;

  const gstFileData = vendorData.gstFileData || null;
  const gstFileName = vendorData.gstFileName || null;
  const gstFileMimetype = vendorData.gstFileMimetype || null;

  const regFileData = vendorData.regFileData || null;
  const regFileName = vendorData.regFileName || null;
  const regFileMimetype = vendorData.regFileMimetype || null;

  const chequeFileData = vendorData.chequeFileData || null;
  const chequeFileName = vendorData.chequeFileName || null;
  const chequeFileMimetype = vendorData.chequeFileMimetype || null;

  const isoFileData = vendorData.isoFileData || null;
  const isoFileName = vendorData.isoFileName || null;
  const isoFileMimetype = vendorData.isoFileMimetype || null;

  const query = `
    INSERT INTO vendors (
      id, "legalName", "tradeName", "entityType", "dateOfIncorporation", cin, llpin, pan,
      "gstStatus", gstin, "msmeStatus", "udyamNumber", "registeredAddress", "billingAddress",
      "primaryContact", "financeContact", "bankDetails", "panVerificationStatus", "gstVerificationStatus",
      "verificationLogs", status, comments, "googleFormResponseId", "panFileUrl", "gstFileUrl", "createdAt", "updatedAt",
      "panFileData", "panFileName", "panFileMimetype",
      "gstFileData", "gstFileName", "gstFileMimetype",
      "regFileData", "regFileName", "regFileMimetype",
      "chequeFileData", "chequeFileName", "chequeFileMimetype",
      "isoFileData", "isoFileName", "isoFileMimetype"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
      $28, $29, $30,
      $31, $32, $33,
      $34, $35, $36,
      $37, $38, $39,
      $40, $41, $42
    ) RETURNING *
  `;
  const values = [
    id, legalName, tradeName, entityType, dateOfIncorporation, cin, llpin, pan,
    gstStatus, gstin, msmeStatus, udyamNumber, 
    typeof registeredAddress === 'string' ? registeredAddress : JSON.stringify(registeredAddress), 
    typeof billingAddress === 'string' ? billingAddress : JSON.stringify(billingAddress),
    typeof primaryContact === 'string' ? primaryContact : JSON.stringify(primaryContact), 
    typeof financeContact === 'string' ? financeContact : JSON.stringify(financeContact), 
    typeof bankDetails === 'string' ? bankDetails : JSON.stringify(bankDetails),
    panVerificationStatus, gstVerificationStatus, 
    typeof verificationLogs === 'string' ? verificationLogs : JSON.stringify(verificationLogs),
    status, comments, googleFormResponseId, panFileUrl, gstFileUrl, createdAt, updatedAt,
    panFileData, panFileName, panFileMimetype,
    gstFileData, gstFileName, gstFileMimetype,
    regFileData, regFileName, regFileMimetype,
    chequeFileData, chequeFileName, chequeFileMimetype,
    isoFileData, isoFileName, isoFileMimetype
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// 5. Update vendor status & comments
const updateVendorStatus = async (pool, id, status, comments) => {
  const selectResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [id]);
  if (selectResult.rows.length === 0) {
    throw new Error('Vendor not found');
  }

  const currentVendor = selectResult.rows[0];
  const updatedComments = comments || currentVendor.comments;
  const updatedAt = new Date().toISOString();

  const query = `
    UPDATE vendors
    SET status = $1, comments = $2, "updatedAt" = $3
    WHERE id = $4
    RETURNING *
  `;
  const result = await pool.query(query, [status, updatedComments, updatedAt, id]);
  return result.rows[0];
};

// 6. Update vendor details (full admin edit)
const updateVendorDetails = async (pool, id, details) => {
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
    details.legalName,
    details.tradeName || '',
    details.entityType || 'Proprietorship',
    details.dateOfIncorporation || '',
    details.cin || '',
    details.llpin || '',
    details.pan.toUpperCase().trim(),
    details.gstin ? details.gstin.toUpperCase().trim() : '',
    details.msmeStatus || 'No',
    details.udyamNumber || '',
    typeof details.registeredAddress === 'string' ? details.registeredAddress : JSON.stringify(details.registeredAddress),
    typeof details.billingAddress === 'string' ? details.billingAddress : JSON.stringify(details.billingAddress),
    typeof details.primaryContact === 'string' ? details.primaryContact : JSON.stringify(details.primaryContact),
    typeof details.financeContact === 'string' ? details.financeContact : JSON.stringify(details.financeContact),
    typeof details.bankDetails === 'string' ? details.bankDetails : JSON.stringify(details.bankDetails),
    typeof details.verificationLogs === 'string' ? details.verificationLogs : JSON.stringify(details.verificationLogs),
    details.googleFormResponseId || null,
    details.panFileUrl || null,
    details.gstFileUrl || null,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
  initializeDatabaseSchema,
  getPaginatedVendors,
  getVendorById,
  createVendor,
  updateVendorStatus,
  updateVendorDetails
};
