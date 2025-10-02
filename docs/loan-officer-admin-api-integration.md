# Loan Officer/Admin API Integration Guide

This document provides comprehensive integration guidance for frontend teams implementing the loan officer and admin dashboard functionality for the Melanin Kapital loan application system.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Frontend vs Backend Endpoints](#frontend-vs-backend-endpoints)
4. [Core Loan Application Management](#core-loan-application-management)
5. [Status Management System](#status-management-system)
6. [Audit Trail & Compliance](#audit-trail--compliance)
7. [Document Request Management](#document-request-management)
8. [Offer Letter Management](#offer-letter-management)
9. [Snapshot System](#snapshot-system)
10. [Business Logic & Workflows](#business-logic--workflows)
11. [Error Handling](#error-handling)
12. [Data Models](#data-models)

## Overview

The loan officer/admin flow provides comprehensive tools for managing loan applications throughout their lifecycle. Key features include:

- **Application Review & Processing**: View, update, and manage loan applications
- **Status Management**: Control application status with validation and audit trails
- **Document Management**: Request and track required documents from applicants
- **Offer Letter Generation**: Create, send, and manage DocuSign-powered offer letters
- **Audit Compliance**: Complete audit trail with immutable snapshots
- **Workflow Automation**: Automated notifications and status transitions

**Base URL**: `https://your-api-domain.com`
**Authentication**: Clerk JWT tokens via Authorization header

## Authentication

All endpoints require Clerk authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <clerk-jwt-token>
```

The system extracts `userId` from the Clerk token for audit trails and permissions.

## Frontend vs Backend Endpoints

**🎯 FRONTEND TEAM NEEDS** (User-facing dashboard endpoints):

### Essential Officer/Admin Endpoints:
- ✅ `GET /loan-applications` - List applications
- ✅ `GET /loan-applications/:id` - View application details  
- ✅ `PUT /loan-applications/:id/status` - Update status
- ✅ `POST /loan-applications/:id/approve` - Quick approve
- ✅ `POST /loan-applications/:id/reject` - Quick reject
- ✅ `GET /loan-applications/:id/status/history` - Status timeline
- ✅ `GET /loan-applications/:id/audit-trail` - Audit history
- ✅ `GET /loan-applications/:id/snapshots` - View snapshots
- ✅ `GET /loan-applications/:id/document-requests` - Document tracking
- ✅ `GET /loan-applications/:id/document-requests/statistics` - Document stats
- ✅ `POST /document-requests` - Create document request
- ✅ `PATCH /document-requests/:id/fulfill` - Fulfill document request
- ✅ `GET /document-requests/pending/:userId` - Get pending requests
- ✅ `GET /document-requests/:id` - Get document request by ID
- ✅ `POST /offer-letters` - Create offer letters
- ✅ `POST /offer-letters/:id/send` - Send via DocuSign
- ✅ `GET /offer-letters` - List offer letters

### Optional/Advanced Endpoints:
- 🔶 `PATCH /loan-applications/:id` - Update application (limited use)
- 🔶 `GET /loan-applications/:id/audit-trail/summary` - Audit summary
- 🔶 `PATCH /offer-letters/:id` - Update offer letter
- 🔶 `PATCH /offer-letters/:id/void` - Void offer letter

**🚫 BACKEND-ONLY** (Infrastructure/automation - NOT for frontend):

- ❌ `POST /offer-letters/webhooks/docusign` - **DocuSign webhook handler**
- ❌ `DELETE /loan-applications/:id` - **Soft delete (customer-only)**  
- ❌ `PATCH /loan-applications/:id/withdraw` - **Customer withdrawal**
- ❌ `DELETE /offer-letters/:id` - **Admin cleanup only**

**Why webhooks aren't for frontend:**
- Webhooks are server-to-server communication
- DocuSign calls your backend directly when documents are signed
- Frontend gets updates through polling or WebSocket connections
- No user interaction needed - it's automated

## Core Loan Application Management

### List All Loan Applications

**Endpoint**: `GET /loan-applications`

**Description**: Retrieve paginated list of loan applications with filtering options.

**Query Parameters**:
```typescript
interface ListQuery {
  page?: string;           // Page number (default: 1)
  limit?: string;          // Items per page (default: 20)
  status?: LoanApplicationStatus;
  isBusinessLoan?: "true" | "false";
  userId?: string;         // Filter by applicant
  businessId?: string;     // Filter by business
  loanProductId?: string;  // Filter by loan product
}
```

**Response**:
```typescript
interface ListResponse {
  success: boolean;
  message: string;
  data: LoanApplicationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Example Request**:
```http
GET /loan-applications?status=under_review&page=1&limit=10
Authorization: Bearer <token>
```

### Get Single Loan Application

**Endpoint**: `GET /loan-applications/:id`

**Description**: Retrieve detailed information for a specific loan application including related data.

**Response**: Returns complete `LoanApplicationItem` with:
- User information
- Business profile (if business loan)
- Loan product details
- Associated offer letters

### Update Loan Application

**Endpoint**: `PATCH /loan-applications/:id`

**Description**: Update loan application details (limited to draft/submitted status).

**Request Body**:
```typescript
interface UpdateBody {
  loanAmount?: number;
  loanTerm?: number;
  purpose?: LoanPurpose;
  purposeDescription?: string;
  coApplicantIds?: string[];
}
```

**Business Rules**:
- Only applications in "draft" or "submitted" status can be updated
- Loan amount/term must comply with product constraints
- Updates are logged in audit trail

## Status Management System

### Get Current Status & Allowed Transitions

**Endpoint**: `GET /loan-applications/:id/status`

**Description**: Retrieve current status and valid next transitions.

**Response**:
```typescript
interface StatusResponse {
  success: boolean;
  message: string;
  data: {
    status: LoanApplicationStatus;
    statusReason: string | null;
    lastUpdatedBy: string | null;
    lastUpdatedAt: string | null;
    allowedTransitions: LoanApplicationStatus[];
  };
}
```

### Update Application Status

**Endpoint**: `PUT /loan-applications/:id/status`

**Description**: Update application status with validation and audit logging.

**Request Body**:
```typescript
interface StatusUpdateBody {
  status: LoanApplicationStatus;
  reason?: string;
  rejectionReason?: string;  // Required if status = "rejected"
  metadata?: Record<string, any>;
}
```

**Status Flow**:
```
draft → submitted → under_review → approved → offer_letter_sent → offer_letter_signed → disbursed
                                      ↓
                                  rejected
```

**Business Logic**:
- Validates status transitions using predefined rules
- Creates audit trail entries automatically
- Triggers snapshot creation on approval
- Sends notifications to applicants
- Auto-creates offer letters when status = "offer_letter_sent"

### Quick Status Actions

**Approve Application**: `POST /loan-applications/:id/approve`
```typescript
interface ApproveBody {
  reason?: string;
  metadata?: Record<string, any>;
}
```

**Reject Application**: `POST /loan-applications/:id/reject`
```typescript
interface RejectBody {
  rejectionReason: string;  // Required
  reason?: string;
  metadata?: Record<string, any>;
}
```

### Status History

**Endpoint**: `GET /loan-applications/:id/status/history`

**Description**: Get complete status change history with user details.

**Response**:
```typescript
interface StatusHistoryResponse {
  success: boolean;
  message: string;
  data: Array<{
    status: string;
    reason: string | null;
    details: string | null;
    userId: string;
    userName: string;
    userEmail: string;
    createdAt: string;
    metadata: Record<string, any> | null;
  }>;
}
```

## Audit Trail & Compliance

### Get Audit Trail

**Endpoint**: `GET /loan-applications/:id/audit-trail`

**Query Parameters**:
```typescript
interface AuditQuery {
  limit?: number;    // Default: 100
  offset?: number;   // Default: 0
  action?: AuditAction;  // Filter by action type
}
```

**Response**:
```typescript
interface AuditTrailResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    loanApplicationId: string;
    userId: string;
    action: AuditAction;
    reason: string | null;
    details: string | null;
    metadata: string | null;
    beforeData: string | null;
    afterData: string | null;
    createdAt: string;
  }>;
}
```

**Audit Actions**:
- `application_created`
- `application_submitted`
- `application_under_review`
- `application_approved`
- `application_rejected`
- `application_withdrawn`
- `application_disbursed`
- `status_updated`
- `snapshot_created`
- `offer_letter_created`
- `offer_letter_sent`
- `document_requested`

### Get Audit Summary

**Endpoint**: `GET /loan-applications/:id/audit-trail/summary`

**Response**:
```typescript
interface AuditSummaryResponse {
  success: boolean;
  message: string;
  data: {
    totalEntries: number;
    lastAction?: AuditAction;
    lastActionAt?: string;
    actions: Record<AuditAction, number>;
  };
}
```

## Document Request Management

The document request system allows loan officers to request specific documents from applicants during the review process. This creates a trackable workflow for document collection.

### Create Document Request

**Endpoint**: `POST /document-requests`

**Description**: Create a new document request for a loan application.

**Request Body**:
```typescript
interface CreateDocumentRequestBody {
  loanApplicationId: string;
  requestedFrom: string;      // User ID to request document from
  documentType: RequestedDocumentType;
  description: string;        // What's needed and why
  isRequired?: boolean;       // Default: true
}
```

**Response**:
```typescript
interface DocumentRequestResponse {
  success: boolean;
  message: string;
  data: DocumentRequestItem;
}
```

### Get Document Requests

**Endpoint**: `GET /loan-applications/:id/document-requests`

**Description**: Retrieve all document requests for a specific loan application.

**Query Parameters**:
```typescript
interface DocumentRequestQuery {
  status?: "pending" | "fulfilled" | "overdue";
}
```

**Response**:
```typescript
interface DocumentRequestsResponse {
  success: boolean;
  message: string;
  data: DocumentRequestItem[];
}
```

### Fulfill Document Request

**Endpoint**: `PATCH /document-requests/:id/fulfill`

**Description**: Mark a document request as fulfilled when the document is uploaded.

**Request Body**:
```typescript
interface FulfillDocumentRequestBody {
  fulfilledWith: string;  // Document ID that fulfills the request
}
```

### Get Document Request Statistics

**Endpoint**: `GET /loan-applications/:id/document-requests/statistics`

**Description**: Get statistics about document requests for a loan application.

**Response**:
```typescript
interface DocumentStatsResponse {
  success: boolean;
  message: string;
  data: {
    total: number;
    pending: number;
    fulfilled: number;
    overdue: number;
  };
}
```

### Get Pending Requests for User

**Endpoint**: `GET /document-requests/pending/:userId`

**Description**: Get all pending document requests for a specific user.

**Response**:
```typescript
interface PendingRequestsResponse {
  success: boolean;
  message: string;
  data: DocumentRequestItem[];
}
```

### Document Request Data Model

```typescript
interface DocumentRequestItem {
  id: string;
  loanApplicationId: string;
  requestedBy: string;        // Officer who made the request
  requestedFrom: string;      // User who needs to provide document
  documentType: RequestedDocumentType;
  description: string;
  isRequired: string;         // "true" or "false"
  status: DocumentRequestStatus;
  fulfilledAt?: string | null;
  fulfilledWith?: string | null;  // Document ID
  createdAt: string;
  updatedAt: string;
}
```

### Document Types (Complete List)

**Personal Documents**:
- `national_id_front` - Front of national ID card
- `national_id_back` - Back of national ID card  
- `passport_bio_page` - Passport biographical page
- `drivers_license` - Driver's license
- `utility_bill` - Utility bill for address verification
- `bank_statement` - Personal bank statement

**Business Documents**:
- `business_registration` - Business registration certificate
- `articles_of_association` - Articles of association
- `business_permit` - Business operating permit
- `tax_registration_certificate` - Tax registration
- `certificate_of_incorporation` - Certificate of incorporation
- `tax_clearance_certificate` - Tax clearance certificate
- `partnership_deed` - Partnership deed
- `memorandum_of_association` - Memorandum of association
- `business_plan` - Business plan document
- `pitch_deck` - Business pitch deck
- `annual_bank_statement` - Annual business bank statement
- `audited_financial_statements` - Audited financial statements

**Other**:
- `other` - Custom document type

### Document Request Status Flow

```typescript
type DocumentRequestStatus = "pending" | "fulfilled" | "overdue";
```

**Status Transitions**:
- `pending` → `fulfilled` (when document is uploaded)
- `pending` → `overdue` (automated based on time rules)
- `overdue` → `fulfilled` (when document is finally uploaded)

### Integration Example - Request Documents

```typescript
// Officer requests additional documents during review
const requestResponse = await fetch('/document-requests', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loanApplicationId: applicationId,
    requestedFrom: applicantUserId,
    documentType: 'business_registration',
    description: 'Please provide your current business registration certificate to verify business details.',
    isRequired: true
  })
});

// Get all document requests for an application
const requestsResponse = await fetch(`/loan-applications/${applicationId}/document-requests`, {
  headers: { 'Authorization': `Bearer ${clerkToken}` }
});

const { data: documentRequests } = await requestsResponse.json();

// Check statistics
const statsResponse = await fetch(`/loan-applications/${applicationId}/document-requests/statistics`, {
  headers: { 'Authorization': `Bearer ${clerkToken}` }
});

const { data: stats } = await statsResponse.json();
console.log(`${stats.pending} pending, ${stats.fulfilled} fulfilled out of ${stats.total} total requests`);
```

## Offer Letter Management

### Create Offer Letter

**Endpoint**: `POST /offer-letters`

**Request Body**:
```typescript
interface CreateOfferLetterBody {
  loanApplicationId: string;
  recipientEmail: string;
  recipientName: string;
  offerAmount: number;
  offerTerm: number;
  interestRate: number;
  currency: string;
  specialConditions?: string;
  requiresGuarantor?: boolean;
  requiresCollateral?: boolean;
  expiresAt: string;  // ISO date string
}
```

### Send Offer Letter via DocuSign

**Endpoint**: `POST /offer-letters/:id/send`

**Request Body**:
```typescript
interface SendOfferLetterBody {
  templateId?: string;  // DocuSign template ID
  customMessage?: string;
}
```

**Response**:
```typescript
interface SendOfferLetterResponse {
  success: boolean;
  message: string;
  data: {
    envelopeId: string;
    status: string;
    sentAt: string;
    viewUrl?: string;
  };
}
```

### List Offer Letters

**Endpoint**: `GET /offer-letters`

**Query Parameters**:
```typescript
interface OfferLetterQuery {
  page?: string;
  limit?: string;
  status?: OfferLetterStatus;
  loanApplicationId?: string;
  docuSignStatus?: DocuSignStatus;
}
```

### Update Offer Letter

**Endpoint**: `PATCH /offer-letters/:id`

**Request Body**:
```typescript
interface UpdateOfferLetterBody {
  offerAmount?: number;
  offerTerm?: number;
  interestRate?: number;
  specialConditions?: string;
  requiresGuarantor?: boolean;
  requiresCollateral?: boolean;
  expiresAt?: string;
}
```

### Void Offer Letter

**Endpoint**: `PATCH /offer-letters/:id/void`

**Description**: Voids an offer letter and updates DocuSign envelope status.

## Snapshot System

### Get Application Snapshots

**Endpoint**: `GET /loan-applications/:id/snapshots`

**Description**: Retrieve all immutable snapshots for audit compliance.

**Response**:
```typescript
interface SnapshotsResponse {
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    loanApplicationId: string;
    createdBy: string;
    approvalStage: string;
    createdAt: string;
    snapshotData: {
      application: LoanApplicationData;
      businessProfile?: BusinessProfileData;
      personalDocuments: DocumentData[];
      businessDocuments: DocumentData[];
      offerLetters: OfferLetterData[];
      metadata: {
        createdAt: string;
        createdBy: string;
        approvalStage: string;
      };
    };
  }>;
}
```

### Get Latest Snapshot

**Endpoint**: `GET /loan-applications/:id/snapshots/latest`

**Description**: Retrieve the most recent snapshot or null if none exists.

## Business Logic & Workflows

### Status Transition Rules

```typescript
const STATUS_TRANSITIONS = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["approved", "rejected", "withdrawn"],
  approved: ["offer_letter_sent", "disbursed", "withdrawn"],
  offer_letter_sent: ["offer_letter_signed", "offer_letter_declined", "withdrawn"],
  offer_letter_signed: ["disbursed", "withdrawn"],
  offer_letter_declined: ["approved", "rejected", "withdrawn"],
  rejected: ["submitted", "withdrawn"],
  withdrawn: [], // Terminal
  disbursed: []  // Terminal
};
```

### Automated Workflows

1. **Status Update to "approved"**:
   - Creates immutable snapshot
   - Logs audit trail entry
   - Sends notification to applicant

2. **Status Update to "offer_letter_sent"**:
   - Auto-creates offer letter
   - Sends via DocuSign
   - Updates application timestamps
   - Logs audit trail

3. **DocuSign Webhook Processing**:
   - Updates offer letter status
   - Updates application status if signed/declined
   - Logs audit trail entries

### Validation Rules

1. **Loan Amount/Term**: Must comply with loan product constraints
2. **Status Transitions**: Must follow predefined flow rules  
3. **Document Requirements**: Based on loan type and amount
4. **Approval Authority**: Role-based permissions (future enhancement)

## Error Handling

### Standard Error Response

```typescript
interface ErrorResponse {
  error: string;
  code: string;
}
```

### Common Error Codes

- `UNAUTHORIZED`: Missing or invalid authentication
- `LOAN_APPLICATION_NOT_FOUND`: Application doesn't exist
- `INVALID_STATUS_TRANSITION`: Status change not allowed
- `INVALID_AMOUNT_RANGE`: Loan amount outside product limits
- `INVALID_TERM_RANGE`: Loan term outside product limits
- `DOCUMENT_REQUEST_NOT_FOUND`: Document request doesn't exist
- `OFFER_LETTER_NOT_FOUND`: Offer letter doesn't exist
- `AUDIT_LOG_FAILED`: Audit trail logging failed

### HTTP Status Codes

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `404`: Resource Not Found
- `409`: Conflict (business rule violations)
- `500`: Internal Server Error

## Data Models

### LoanApplicationStatus

```typescript
type LoanApplicationStatus = 
  | "draft"
  | "submitted" 
  | "under_review"
  | "approved"
  | "offer_letter_sent"
  | "offer_letter_signed"
  | "offer_letter_declined"
  | "rejected"
  | "withdrawn"
  | "disbursed";
```

### LoanPurpose

```typescript
type LoanPurpose =
  | "working_capital"
  | "business_expansion"
  | "equipment_purchase"
  | "inventory_financing"
  | "debt_consolidation"
  | "seasonal_financing"
  | "emergency_funding"
  | "other";
```

### LoanApplicationItem

```typescript
interface LoanApplicationItem {
  id: string;
  applicationNumber: string;
  userId: string;
  businessId?: string | null;
  loanProductId: string;
  coApplicantIds?: string | null;
  loanAmount: number;
  loanTerm: number;
  currency: string;
  purpose: LoanPurpose;
  purposeDescription?: string | null;
  status: LoanApplicationStatus;
  isBusinessLoan: boolean;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  statusReason?: string | null;
  lastUpdatedBy?: string | null;
  lastUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  
  // Related data
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  business?: {
    id: string;
    name: string;
  } | null;
  loanProduct?: {
    id: string;
    name: string;
    currency: string;
    minAmount: number;
    maxAmount: number;
    minTerm: number;
    maxTerm: number;
    termUnit: string;
    interestRate: number;
  };
  offerLetters?: OfferLetterItem[];
}
```

### OfferLetterItem

```typescript
interface OfferLetterItem {
  id: string;
  loanApplicationId: string;
  offerNumber: string;
  version: number;
  offerAmount: number;
  offerTerm: number;
  interestRate: number;
  currency: string;
  specialConditions?: string | null;
  requiresGuarantor: boolean;
  requiresCollateral: boolean;
  docuSignEnvelopeId?: string | null;
  docuSignStatus: string;
  docuSignTemplateId?: string | null;
  offerLetterUrl?: string | null;
  signedDocumentUrl?: string | null;
  recipientEmail: string;
  recipientName: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  viewedAt?: string | null;
  signedAt?: string | null;
  declinedAt?: string | null;
  expiredAt?: string | null;
  expiresAt: string;
  reminderSentAt?: string | null;
  status: string;
  isActive: boolean;
  createdBy?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Integration Examples

### Loan Officer Dashboard - Application List

```typescript
// Fetch applications under review
const response = await fetch('/loan-applications?status=under_review&limit=20', {
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  }
});

const { data: applications, pagination } = await response.json();

// Display applications with status badges, applicant info, and action buttons
applications.forEach(app => {
  console.log(`${app.applicationNumber} - ${app.user?.firstName} ${app.user?.lastName}`);
  console.log(`Amount: ${app.currency} ${app.loanAmount}`);
  console.log(`Status: ${app.status}`);
});
```

### Approve Application with Audit Trail

```typescript
// Approve application
const approveResponse = await fetch(`/loan-applications/${applicationId}/approve`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Application meets all criteria',
    metadata: {
      reviewedBy: 'John Doe',
      reviewDate: new Date().toISOString(),
      notes: 'Excellent credit score and business financials'
    }
  })
});

// This automatically:
// 1. Updates status to "approved"
// 2. Creates audit trail entry
// 3. Creates immutable snapshot
// 4. Sends notification to applicant
```

### Create and Send Offer Letter

```typescript
// Create offer letter
const createResponse = await fetch('/offer-letters', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    loanApplicationId: applicationId,
    recipientEmail: 'applicant@example.com',
    recipientName: 'John Smith',
    offerAmount: 50000,
    offerTerm: 24,
    interestRate: 12.5,
    currency: 'USD',
    specialConditions: 'Personal guarantee required',
    requiresGuarantor: true,
    requiresCollateral: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  })
});

const { data: offerLetter } = await createResponse.json();

// Send via DocuSign
const sendResponse = await fetch(`/offer-letters/${offerLetter.id}/send`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customMessage: 'Please review and sign your loan offer letter.'
  })
});
```

### Monitor Application Progress

```typescript
// Get current status and allowed actions
const statusResponse = await fetch(`/loan-applications/${applicationId}/status`, {
  headers: { 'Authorization': `Bearer ${clerkToken}` }
});

const { data: statusInfo } = await statusResponse.json();

// Show available actions based on current status
const availableActions = statusInfo.allowedTransitions.map(status => ({
  label: formatStatusLabel(status),
  action: () => updateStatus(applicationId, status)
}));

// Get audit trail for compliance
const auditResponse = await fetch(`/loan-applications/${applicationId}/audit-trail`, {
  headers: { 'Authorization': `Bearer ${clerkToken}` }
});

const { data: auditEntries } = await auditResponse.json();

// Display timeline of all actions
auditEntries.forEach(entry => {
  console.log(`${entry.createdAt}: ${entry.action} - ${entry.reason}`);
});
```

This comprehensive guide provides everything needed to integrate the loan officer/admin functionality into your frontend application. The system is designed for compliance, auditability, and efficient workflow management.
