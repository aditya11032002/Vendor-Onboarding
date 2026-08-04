# Vendor & Customer Onboarding Portal

A complete, premium web application designed to automate, streamline, and secure the onboarding pipeline for new Vendors and Customers. Features a robust **Maker-Checker verification workflow** (Level 1 & Level 2 Approvers), dynamic API-driven document uploads, automated validation, and a simulated ERP sync integration (SAP queue).

---

## 👥 User Roles & Access Matrix

The portal enforces role-based access control (RBAC) across five distinct user roles:

| Role | Access Scope & Responsibilities | Key Portal Features |
| :--- | :--- | :--- |
| **System Administrator (Admin)** | Complete system control and configuration capability. | • Generate & email onboarding invites (Vendor/Customer).<br>• Access all records in the unified dashboard (search/filter/paginate).<br>• Force edit/override any profile details.<br>• Add and manage system users (User Settings tab).<br>• Review SAP integration queue and mark records as integrated. |
| **Compliance Auditor (Approver L2)** | First-level audit (Maker stage) for submitted registrations. | • View pending queues of newly submitted forms.<br>• Review fields, download attachments, and check PAN/GSTIN logs.<br>• Grant compliance validation (**L2 Approved**) or **Reject** with corrections comments. |
| **Final Sign-off (Approver L1)** | Second-level Checker review and final operational approval. | • Reviews only profiles that have successfully passed the L2 audit.<br>• Perform Checker checks on banking/legal details.<br>• Grant final onboarding authorization (**Approved**) or **Reject** back to submitter. |
| **Vendor** | External supplier onboarding portal. | • Log in securely using temporary invitation credentials.<br>• Fill out and submit the 5-step registration form.<br>• View live onboarding progress timeline tracker.<br>• Unlock & edit submitted forms on-demand (resubmitting resets status to Pending). |
| **Customer** | External client onboarding portal. | • Tailored onboarding workflow styled with premium Emerald accents.<br>• Fill out and submit the 5-step customer onboarding form.<br>• View live progress timeline.<br>• Unlock & edit details on-demand. |

---

## 🚀 Key Technical Features

1. **Maker-Checker Verification Flow**
   - Application submission automatically queues the profile for Level 2 (Maker) compliance audit.
   - Level 2 approval forwards the record to the Level 1 (Checker) queue.
   - Level 1 approval marks the profile as fully `Approved`, making it eligible for ERP integration.

2. **On-Demand Edit & Self-Correction Toggle**
   - Logged-in vendors and customers can toggle an **"Edit Application Details"** mode in their portal.
   - This unlocks all fields, banking inputs, and file upload selectors for modifications.
   - Submitting updates resets the profile's status back to `Pending` and alerts checkers.

3. **Unified Single-List View for Updates**
   - The onboarding wizard steps (1 to 5) are rendered as a continuous, unified list when in update/review mode.
   - Includes custom dividers and margin separation to review all details on a single scrollable page.

4. **Multi-File Upload Storage**
   - Supports uploading up to 5 verification files (cheques, PAN, GST certificates, ISO certifications).
   - Saved as binary blocks directly in PostgreSQL (`BYTEA` format) for high security and offline reliability, served securely via stream endpoints.

5. **Automated Verification Pipeline**
   - Auto-checks PAN and GSTIN formats against regional regex identifiers.
   - Automatically maintains integration-ready SAP queues.

---

## 🛠️ Tech Stack

* **Frontend**: React (SPA), Vite, Tailwind CSS, Lucide React (Icons), React Router.
* **Backend**: Node.js, Express, Multer (multipart request handling), PostgreSQL (client pool).
* **Database**: PostgreSQL (relational storage for users, log tables, and binary documents).

---

## ⚙️ Environment Configuration

Ensure both frontend and backend contain proper `.env` variables.

### Backend `.env` (`/backend/.env`)
```ini
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/onboarding_db
JWT_SECRET=your_jwt_signing_key_here

# SMTP Server Configurations (For sending invitation links)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=onboarding.notifications@yourcompany.com
SMTP_PASS=app_specific_email_password
SMTP_FROM="Onboarding Portal" <onboarding.notifications@yourcompany.com>
```

### Frontend `.env` (`/frontend/.env`)
```ini
VITE_API_BASE_URL=http://localhost:5000
```

---

## 🏗️ Database Setup & Initialization

The backend automatically initializes tables and schemas upon startup. It creates the following tables:
* `users` - System administrator and approver credentials.
* `vendors` - Vendor details, status indicators, and binary documents.
* `customers` - Customer details, status indicators, and binary documents.

If the `users` table is empty, the application seeds a **default administrator account** to let you get started:
* **Username**: `admin@company.com`
* **Password**: `admin123` (Enforces mandatory password reset on first login)

---

## 🏃 Run the Project Locally

### 1. Start the Backend API Server
```bash
cd backend
npm install
npm run dev
```

### 2. Start the Frontend Dev Environment
```bash
cd frontend
npm install
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.
