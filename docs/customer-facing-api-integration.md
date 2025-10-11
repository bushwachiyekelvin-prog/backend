# Customer-Facing API Integration Guide

This document outlines all the customer-facing APIs that the frontend needs to integrate for the complete loan application user experience.

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Loan Applications Listing](#loan-applications-listing)
3. [Loan Application Detail View](#loan-application-detail-view)
4. [Loan Application Status Tracking](#loan-application-status-tracking)
5. [Document Management](#document-management)
6. [Offer Letter Management](#offer-letter-management)
7. [Error Handling](#error-handling)
8. [Data Models](#data-models)

---

## 🔐 Authentication

All customer-facing APIs require Clerk authentication. Include the Clerk session token in the Authorization header.

```javascript
headers: {
  'Authorization': `Bearer ${clerkToken}`,
  'Content-Type': 'application/json'
}
```

---

## 📊 Loan Applications Listing

### GET /loan-applications

**Purpose**: Display all loan applications for the authenticated user

**Query Parameters**:
```typescript
{
  page?: string;           // Page number (default: 1)
  limit?: string;          // Items per page (default: 20, max: 100)
  status?: LoanApplicationStatus; // Filter by status
  isBusinessLoan?: "true" | "false"; // Filter by loan type
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: {
    applications: LoanApplicationItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}
```

**Example Usage**:
```javascript
// Get all applications
const response = await fetch('/loan-applications?page=1&limit=10');

// Filter by status
const activeApps = await fetch('/loan-applications?status=under_review');

// Filter business loans
const businessLoans = await fetch('/loan-applications?isBusinessLoan=true');
```

---

## 🔍 Loan Application Detail View

### GET /loan-applications/:id

**Purpose**: Get detailed information about a specific loan application

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: {
    id: string;
    applicationNumber: string;
    status: LoanApplicationStatus;
    statusReason: string;
    loanAmount: number;
    loanTerm: number;
    currency: string;
    purpose: LoanPurpose;
    purposeDescription?: string;
    isBusinessLoan: boolean;
    interestRate: number;
    monthlyPayment: number;
    
    // Timestamps
    submittedAt?: string;
    reviewedAt?: string;
    approvedAt?: string;
    disbursedAt?: string;
    rejectedAt?: string;
    
    // Related data
    loanProduct: {
      id: string;
      name: string;
      description: string;
      interestRate: number;
      maxAmount: number;
      maxTerm: number;
    };
    
    business?: {
      id: string;
      businessName: string;
      businessType: string;
      industry: string;
    };
    
    // Rejection info (if applicable)
    rejectionReason?: string;
    
    createdAt: string;
    updatedAt: string;
  };
}
```

**Example Usage**:
```javascript
const response = await fetch(`/loan-applications/${applicationId}`);
const application = response.data;

// Display application details
console.log(`Application #${application.applicationNumber}`);
console.log(`Status: ${application.status}`);
console.log(`Amount: ${application.currency} ${application.loanAmount}`);
```

---

## 📈 Loan Application Status Tracking

### GET /loan-applications/:id/status

**Purpose**: Get current status and allowed transitions

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: {
    status: LoanApplicationStatus;
    statusReason: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
    allowedTransitions: LoanApplicationStatus[];
  };
}
```

### GET /loan-applications/:id/status/history

**Purpose**: Get complete status change history

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    status: string;
    reason: string;
    details: string;
    userId: string;
    userName: string;
    userEmail: string;
    createdAt: string;
    metadata: Record<string, any>;
  }>;
}
```

**Example Usage**:
```javascript
// Get current status
const statusResponse = await fetch(`/loan-applications/${id}/status`);
const currentStatus = statusResponse.data.status;

// Get status history for timeline
const historyResponse = await fetch(`/loan-applications/${id}/status/history`);
const timeline = historyResponse.data;

// Display timeline
timeline.forEach(entry => {
  console.log(`${entry.createdAt}: ${entry.status} - ${entry.reason}`);
});
```

---

## 📄 Document Management

### GET /loan-applications/:id/document-requests

**Purpose**: Get all document requests for the application

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    loanApplicationId: string;
    requestedDocumentType: RequestedDocumentType;
    description: string;
    isRequired: boolean;
    status: DocumentRequestStatus;
    dueDate?: string;
    fulfilledAt?: string;
    fulfilledWith?: string;
    requestedBy: string;
    requestedAt: string;
  }>;
}
```

### GET /document-requests/pending/:userId

**Purpose**: Get all pending document requests for the user

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    id: string;
    loanApplicationId: string;
    applicationNumber: string;
    requestedDocumentType: RequestedDocumentType;
    description: string;
    isRequired: boolean;
    dueDate?: string;
    requestedAt: string;
  }>;
}
```

### PATCH /document-requests/:id/fulfill

**Purpose**: Mark a document request as fulfilled

**Request Body**:
```typescript
{
  fulfilledWith: string; // URL or reference to uploaded document
}
```

**Example Usage**:
```javascript
// Get pending documents for user
const pendingDocs = await fetch(`/document-requests/pending/${userId}`);

// Fulfill a document request
await fetch(`/document-requests/${requestId}/fulfill`, {
  method: 'PATCH',
  body: JSON.stringify({
    fulfilledWith: 'https://storage.example.com/documents/bank-statement.pdf'
  })
});
```

---

## 📋 Offer Letter Management

### GET /offer-letters

**Purpose**: Get all offer letters for the authenticated user

**Query Parameters**:
```typescript
{
  page?: number;
  limit?: number;
  status?: OfferLetterStatus;
  loanApplicationId?: string;
  isActive?: boolean;
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string;
  data: {
    offerLetters: Array<{
      id: string;
      offerNumber: string;
      loanApplicationId: string;
      applicationNumber: string;
      version: number;
      
      // Offer details
      offerAmount: number;
      offerTerm: number;
      interestRate: number;
      currency: string;
      monthlyPayment: number;
      
      // Status and URLs
      status: OfferLetterStatus;
      docuSignStatus: DocuSignStatus;
      offerLetterUrl?: string;
      signedDocumentUrl?: string;
      
      // Timestamps
      expiresAt: string;
      sentAt?: string;
      signedAt?: string;
      declinedAt?: string;
      
      // Recipient info
      recipientEmail: string;
      recipientName: string;
      
      createdAt: string;
      updatedAt: string;
    }>;
    pagination: PaginationInfo;
  };
}
```

### GET /offer-letters/:id

**Purpose**: Get detailed information about a specific offer letter

**Response**: Same as individual offer letter object above

**Example Usage**:
```javascript
// Get all offer letters
const offers = await fetch('/offer-letters?isActive=true');

// Get specific offer letter
const offer = await fetch(`/offer-letters/${offerId}`);

// Check if offer letter is ready to sign
if (offer.data.status === 'sent' && offer.data.offerLetterUrl) {
  // Show "Sign Document" button
  window.open(offer.data.offerLetterUrl, '_blank');
}
```

---

## ⚠️ Error Handling

All APIs follow consistent error response format:

```typescript
{
  error: string;        // Human-readable error message
  code: string;         // Machine-readable error code
  details?: any;        // Additional error details (optional)
}
```

**Common Error Codes**:
- `UNAUTHORIZED` - Invalid or missing authentication
- `FORBIDDEN` - User doesn't have access to resource
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMITED` - Too many requests

**Example Error Handling**:
```javascript
try {
  const response = await fetch('/loan-applications/123');
  
  if (!response.ok) {
    const error = await response.json();
    
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        break;
      case 'NOT_FOUND':
        // Show 404 page
        break;
      default:
        // Show generic error
        console.error(error.error);
    }
  }
  
  const data = await response.json();
  // Handle success
} catch (error) {
  // Handle network errors
  console.error('Network error:', error);
}
```

---

## 📊 Data Models

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
  | "disbursed"
  | "rejected"
  | "withdrawn"
  | "expired";
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

### DocumentRequestStatus
```typescript
type DocumentRequestStatus = 
  | "pending"
  | "fulfilled"
  | "overdue"
  | "cancelled";
```

### RequestedDocumentType
```typescript
// Personal Documents
type PersonalDocumentType = 
  | "government_id"
  | "proof_of_address"
  | "bank_statements"
  | "tax_returns"
  | "pay_stubs"
  | "credit_report";

// Business Documents  
type BusinessDocumentType = 
  | "business_license"
  | "articles_of_incorporation"
  | "business_bank_statements"
  | "business_tax_returns"
  | "financial_statements"
  | "profit_loss_statement"
  | "cash_flow_statement"
  | "balance_sheet"
  | "business_plan"
  | "contracts_agreements"
  | "accounts_receivable_aging"
  | "accounts_payable_aging"
  | "inventory_reports"
  | "insurance_certificates"
  | "lease_agreements";

type RequestedDocumentType = PersonalDocumentType | BusinessDocumentType | "other";
```

### OfferLetterStatus
```typescript
type OfferLetterStatus = 
  | "draft"
  | "sent"
  | "signed"
  | "declined"
  | "expired"
  | "voided";
```

### DocuSignStatus
```typescript
type DocuSignStatus = 
  | "not_sent"
  | "sent"
  | "delivered"
  | "completed"
  | "declined"
  | "voided";
```

---

## 🔄 Complete User Flow Example

Here's how a typical customer journey would use these APIs:

### 1. Dashboard - List Applications
```javascript
// Load user's applications
const apps = await fetch('/loan-applications?page=1&limit=10');
// Display in dashboard table/cards
```

### 2. Application Detail View
```javascript
// User clicks on an application
const app = await fetch(`/loan-applications/${appId}`);
const status = await fetch(`/loan-applications/${appId}/status`);
const history = await fetch(`/loan-applications/${appId}/status/history`);

// Display application details, current status, and timeline
```

### 3. Document Requests (if any)
```javascript
// Check for pending documents
const pendingDocs = await fetch(`/document-requests/pending/${userId}`);

if (pendingDocs.data.length > 0) {
  // Show document upload interface
  // After upload, fulfill the request
  await fetch(`/document-requests/${docId}/fulfill`, {
    method: 'PATCH',
    body: JSON.stringify({ fulfilledWith: uploadedFileUrl })
  });
}
```

### 4. Offer Letter (if approved)
```javascript
// Check for offer letters
const offers = await fetch(`/offer-letters?loanApplicationId=${appId}`);

if (offers.data.offerLetters.length > 0) {
  const activeOffer = offers.data.offerLetters.find(o => o.isActive);
  
  if (activeOffer?.status === 'sent' && activeOffer.offerLetterUrl) {
    // Show "Review & Sign" button
    // Opens DocuSign in new tab
  }
}
```

### 5. Real-time Updates
```javascript
// Poll for status updates (or use WebSockets if implemented)
setInterval(async () => {
  const currentStatus = await fetch(`/loan-applications/${appId}/status`);
  if (currentStatus.data.status !== lastKnownStatus) {
    // Update UI with new status
    // Refresh relevant sections
  }
}, 30000); // Check every 30 seconds
```

---

## 🎯 Frontend Implementation Tips

1. **Status-based UI**: Show different components based on application status
2. **Progress Indicators**: Use status history to show progress timeline
3. **Document Alerts**: Highlight pending document requests prominently
4. **Offer Letter Actions**: Make signing process clear and accessible
5. **Error Boundaries**: Implement proper error handling for all API calls
6. **Loading States**: Show loading indicators for async operations
7. **Caching**: Cache application data to reduce API calls
8. **Optimistic Updates**: Update UI immediately, then sync with server

This covers the complete customer-facing API integration for the loan application lifecycle! 🚀

