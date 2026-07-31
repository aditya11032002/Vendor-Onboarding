# VK18 Onboarding Portal - API Reference Manual

This document details the API endpoints, authorization mechanisms, status flows, and payload definitions for the VK18 Vendor & Customer Onboarding platform.

---

## 1. Global Configuration

* **Base URL**: `http://localhost:5000` (Local) / Production URL
* **Authentication Scheme**: JWT Bearer Token
  * Header: `Authorization: Bearer <token>`
  * Cookies: Some routes support fallback cookie-based tokens.

---

## 2. Authentication & Account Management

### POST `/api/auth/login`
Authenticates users (Admin, L1 Approver, L2 Approver, Vendor) and issues a JWT token.

* **Payload**:
  ```json
  {
    "username": "vendor@example.com",
    "password": "temporaryPassword123"
  }
  ```
* **Response (Success)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "username": "vendor@example.com",
    "role": "Vendor",
    "passwordResetRequired": true
  }
  ```

---

### POST `/api/auth/logout`
Terminates the active session and clears HTTP-only authorization cookies.

* **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

---

### POST `/api/auth/reset-password`
Enforces mandatory password resets for new profiles logging in with temporary credentials.

* **Payload**:
  ```json
  {
    "username": "vendor@example.com",
    "currentPassword": "temporaryPassword123",
    "newPassword": "SecureNewPassword456!"
  }
  ```
* **Response (Success)**:
  ```json
  {
    "success": true,
    "message": "Password updated successfully."
  }
  ```

---

## 3. Maker-Checker Onboarding Workflows

Status transitions follow the two-level validation workflow:
* **Sent**: Account invited.
* **Pending** *(Awaiting L2 Review)*: Form submitted by Vendor.
* **L2_Approved** *(Awaiting L1 Review)*: Audited and verified by L2 Approver (Maker).
* **Approved** *(Final Approval)*: Signed-off by L1 Approver (Checker). Ready for ERP.
* **Vendor Created** / **Customer Created**: Sync confirmed by SAP/ERP.

---

### GET `/api/vendors`
Retrieves a paginated list of vendor applications based on review roles.
* **Query Parameters**:
  * `page` (number, default: 1)
  * `limit` (number, default: 10)
  * `search` (string, filters Legal Name, PAN, GSTIN)
  * `status` (`'Pending'`, `'Approved'`, `'Rejected'`, `'All'`)
  * `entityType` (string)
* **Response**:
  ```json
  {
    "vendors": [ ... ],
    "total": 24,
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "stats": {
      "total": 24,
      "pending": 5,
      "approved": 15,
      "rejected": 4
    }
  }
  ```

---

### GET `/api/vendors/:id`
Retrieves detailed profile columns for a single vendor application.

* **Response**:
  ```json
  {
    "id": "1c1f8376-3316-4503-978e-eaebb4a02636",
    "legalName": "Enterprise Logistics Supplies",
    "pan": "ABCDE1234F",
    "status": "L2_Approved",
    "primaryContact": {
      "name": "John Doe",
      "email": "vendor@company.com",
      "mobile": "9876543210"
    },
    "bankDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "501002938472"
    }
  }
  ```

---

### POST `/api/vendors`
Submit the onboarding form details. This request requires `multipart/form-data` formatting.

* **Form Fields**:
  * `legalName` (string, required)
  * `pan` (string, required)
  * `email` (string, required)
  * `registeredAddress` (JSON string)
  * `billingAddress` (JSON string)
  * `primaryContact` (JSON string)
  * `bankDetails` (JSON string)
* **Uploaded Files**:
  * `panFile` (Binary PDF/Image)
  * `gstFile` (Binary PDF/Image)
  * `regFile` (Binary PDF/Image)
  * `chequeFile` (Binary PDF/Image)
  * `isoFile` (Binary PDF/Image)
* **Response (Success)**:
  ```json
  {
    "id": "1c1f8376-...",
    "legalName": "Enterprise Logistics",
    "status": "Pending"
  }
  ```

---

### PATCH `/api/vendors/:id/status`
Updates status. Transitions are restricted based on Maker-Checker rules:
* L2 Auditor can transition `Pending` -> `L2_Approved` (or `Rejected`).
* L1 Senior Director can transition `L2_Approved` -> `Approved` (or `Rejected`).

* **Payload**:
  ```json
  {
    "status": "Approved",
    "comments": "Audited bank records and PAN match. Approved."
  }
  ```

---

### GET `/api/vendors/my-profile`
Self status lookup for logged-in vendors based on their primary contact email.

* **Response**:
  ```json
  {
    "id": "1c1f8376-3316-4503-978e-eaebb4a02636",
    "status": "Pending",
    "comments": "Awaiting initial Level 2 verification."
  }
  ```

---

### GET `/api/vendors/files/:vendorId/:fileKey`
Serves binary document contents directly from the PostgreSQL store.
* **URL Variables**:
  * `fileKey`: `'pan'`, `'gst'`, `'reg'`, `'cheque'`, `'iso'`

---

## 4. SAP ERP Integration Queue

These API endpoints allow automated pipelines to synchronize approved data with SAP ERP databases.

### GET `/api/integration/sap-queue`
Exposes lists of fully approved vendors and customers awaiting ERP registration.
* **Role Requirement**: `Admin`

* **Response**:
  ```json
  {
    "success": true,
    "vendors": [
      {
        "id": "1c1f8376-3316-4503-978e-eaebb4a02636",
        "legalName": "Enterprise Logistics",
        "pan": "ABCDE1234F",
        "bankDetails": { ... },
        "status": "Approved"
      }
    ],
    "customers": []
  }
  ```

---

### POST `/api/integration/mark-synced`
Confirms integration, transitioning statuses from `Approved` to `Vendor Created` / `Customer Created`.
* **Role Requirement**: `Admin`

* **Payload**:
  ```json
  {
    "id": "1c1f8376-3316-4503-978e-eaebb4a02636",
    "type": "vendor"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "Vendor status marked as Vendor Created in SAP.",
    "record": {
      "id": "1c1f8376-3316-4503-978e-eaebb4a02636",
      "status": "Vendor Created"
    }
  }
  ```

---

## 5. User Administration

### POST `/api/users/invite-vendor`
Creates a vendor login profile and dispatches onboarding credentials.

* **Payload**:
  ```json
  {
    "email": "partner@company.com"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "Invitation dispatched successfully.",
    "username": "partner@company.com",
    "password": "TempPasswordX!",
    "portalUrl": "http://localhost:5173"
  }
  ```
