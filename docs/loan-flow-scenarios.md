# Loan Approval Flow - Complete Scenarios & User Stories

## Current System Flow Overview

Based on the simplified audit trail plan, here's the complete flow with all possible scenarios:

## 1. Happy Path - Successful Loan Approval

### Flow Steps:
```
1. User Onboarding → Personal & Business Documents Uploaded
2. User Creates Loan Application → Status: 'submitted'
3. Admin Reviews Application → Status: 'under_review'
4. Admin Approves Loan → Status: 'approved' + Snapshot Created
5. Offer Letter Generated & Sent → Status: 'offer_letter_sent'
6. User Signs Offer Letter → Status: 'offer_letter_signed'
7. Loan Disbursed → Status: 'disbursed'
```

### Audit Trail Entries:
- `application_created` - User creates application
- `application_submitted` - User submits for review
- `application_under_review` - Admin starts review
- `loan_approved` - Admin approves loan
- `offer_letter_generated` - System generates offer
- `offer_letter_sent` - Offer sent to user
- `offer_letter_signed` - User signs offer
- `disbursement_completed` - Loan disbursed

### Snapshot Created:
- **When**: At loan approval (step 4)
- **Contains**: All documents, business profile, application details at approval time
- **Purpose**: Immutable record for compliance

## 2. Document Request Scenario

### Flow Steps:
```
1. User Creates & Submits Application → Status: 'submitted'
2. Admin Reviews Application → Status: 'under_review'
3. Admin Identifies Missing Documents → Document Request Created
4. User Receives Email Notification → User uploads documents
5. System Marks Request as Fulfilled → Admin continues review
6. Admin Approves Loan → Status: 'approved' + Snapshot Created
7. Loan Process Continues...
```

### Audit Trail Entries:
- `application_created`
- `application_submitted`
- `application_under_review`
- `document_request_created` - Admin requests documents
- `documents_uploaded` - User uploads requested documents
- `document_request_fulfilled` - System marks request complete
- `loan_approved` - Admin approves loan
- `disbursement_completed`

### Document Request Details:
- **Type**: Specific document type needed
- **Description**: What's needed and why
- **Status**: 'pending' → 'fulfilled'
- **Notification**: Email sent to user

## 3. Multiple Document Requests Scenario

### Flow Steps:
```
1. User Submits Application → Status: 'submitted'
2. Admin Reviews → Status: 'under_review'
3. Admin Requests Document A → Document Request 1 Created
4. User Uploads Document A → Request 1 Fulfilled
5. Admin Reviews Again → Requests Document B → Document Request 2 Created
6. User Uploads Document B → Request 2 Fulfilled
7. Admin Approves Loan → Status: 'approved' + Snapshot Created
```

### Audit Trail Entries:
- `application_created`
- `application_submitted`
- `application_under_review`
- `document_request_created` (Document A)
- `documents_uploaded` (Document A)
- `document_request_fulfilled` (Document A)
- `document_request_created` (Document B)
- `documents_uploaded` (Document B)
- `document_request_fulfilled` (Document B)
- `loan_approved`
- `disbursement_completed`

## 4. Loan Rejection Scenario

### Flow Steps:
```
1. User Creates & Submits Application → Status: 'submitted'
2. Admin Reviews Application → Status: 'under_review'
3. Admin Rejects Loan → Status: 'rejected'
4. User Receives Rejection Notification
```

### Audit Trail Entries:
- `application_created`
- `application_submitted`
- `application_under_review`
- `loan_rejected` - Admin rejects loan with reason

### No Snapshot Created:
- **Reason**: Loan was not approved
- **Data Retention**: 3 years for failed applications

## 5. User Withdrawal Scenario

### Flow Steps:
```
1. User Creates & Submits Application → Status: 'submitted'
2. Admin Reviews Application → Status: 'under_review'
3. User Withdraws Application → Status: 'withdrawn'
```

### Audit Trail Entries:
- `application_created`
- `application_submitted`
- `application_under_review`
- `application_withdrawn` - User withdraws application

## 6. Offer Letter Scenarios

### 6a. Offer Letter Signed Successfully
```
1. Loan Approved → Status: 'approved'
2. Offer Letter Generated → Status: 'offer_letter_generated'
3. Offer Letter Sent → Status: 'offer_letter_sent'
4. User Signs Offer → Status: 'offer_letter_signed'
5. Loan Disbursed → Status: 'disbursed'
```

### 6b. Offer Letter Declined
```
1. Loan Approved → Status: 'approved'
2. Offer Letter Generated → Status: 'offer_letter_generated'
3. Offer Letter Sent → Status: 'offer_letter_sent'
4. User Declines Offer → Status: 'offer_declined'
5. Application Closed → Status: 'closed'
```

### 6c. Offer Letter Expired
```
1. Loan Approved → Status: 'approved'
2. Offer Letter Generated → Status: 'offer_letter_generated'
3. Offer Letter Sent → Status: 'offer_letter_sent'
4. Offer Expires → Status: 'offer_expired'
5. Application Closed → Status: 'closed'
```

## 7. Document Update Scenarios

### 7a. User Updates Documents Before Approval
```
1. User Submits Application → Status: 'submitted'
2. User Updates Documents → Audit trail: 'documents_updated'
3. Admin Reviews Updated Documents → Status: 'under_review'
4. Admin Approves Loan → Status: 'approved' + Snapshot Created
```

### 7b. User Updates Documents After Approval
```
1. Loan Approved → Status: 'approved' + Snapshot Created
2. User Updates Documents → Audit trail: 'documents_updated'
3. Snapshot Remains Unchanged → Original approval snapshot preserved
4. New Applications Can Reference Updated Documents
```

## User Stories

### 1. User Stories - Loan Applicant

#### US-001: Create Loan Application
**As a** loan applicant  
**I want to** create a loan application  
**So that** I can apply for a business loan  

**Acceptance Criteria:**
- User can create application with business details
- System creates audit trail entry 'application_created'
- Application status is set to 'draft'

#### US-002: Upload Documents
**As a** loan applicant  
**I want to** upload required documents  
**So that** my application can be reviewed  

**Acceptance Criteria:**
- User can upload personal and business documents
- System creates audit trail entry 'documents_uploaded'
- Documents are linked to the application

#### US-003: Submit Application
**As a** loan applicant  
**I want to** submit my application for review  
**So that** an admin can review it  

**Acceptance Criteria:**
- User can submit application when all required fields are filled
- System creates audit trail entry 'application_submitted'
- Application status changes to 'submitted'
- User receives confirmation

#### US-004: View Application Status
**As a** loan applicant  
**I want to** see my application status  
**So that** I know where my application stands  

**Acceptance Criteria:**
- User can view current application status
- User can see status history and timeline
- User can see any pending document requests

#### US-005: Respond to Document Requests
**As a** loan applicant  
**I want to** upload requested documents  
**So that** my application can proceed  

**Acceptance Criteria:**
- User receives email notification for document requests
- User can upload requested documents
- System marks request as fulfilled
- Audit trail entry 'documents_uploaded' created

#### US-006: Receive Approval Notification
**As a** loan applicant  
**I want to** be notified when my loan is approved  
**So that** I can proceed with the loan process  

**Acceptance Criteria:**
- User receives email notification of approval
- User can view approval details
- System creates immutable snapshot

#### US-007: Sign Offer Letter
**As a** loan applicant  
**I want to** sign the offer letter  
**So that** I can receive the loan  

**Acceptance Criteria:**
- User receives offer letter via email
- User can sign offer letter electronically
- System creates audit trail entry 'offer_letter_signed'
- Status changes to 'offer_letter_signed'

### 2. User Stories - Admin

#### US-008: Review Loan Application
**As an** admin  
**I want to** review loan applications  
**So that** I can make approval decisions  

**Acceptance Criteria:**
- Admin can view application details and documents
- Admin can see application history and audit trail
- System creates audit trail entry 'application_under_review'
- Status changes to 'under_review'

#### US-009: Request Additional Documents
**As an** admin  
**I want to** request additional documents  
**So that** I can make an informed decision  

**Acceptance Criteria:**
- Admin can create document requests
- Admin can specify document type and description
- System sends email notification to user
- Audit trail entry 'document_request_created' created

#### US-010: Approve Loan Application
**As an** admin  
**I want to** approve loan applications  
**So that** approved applicants can receive loans  

**Acceptance Criteria:**
- Admin can approve application with reason
- System creates audit trail entry 'loan_approved'
- System creates immutable snapshot of all documents
- Status changes to 'approved'
- User receives approval notification

#### US-011: Reject Loan Application
**As an** admin  
**I want to** reject loan applications  
**So that** I can decline applications that don't meet criteria  

**Acceptance Criteria:**
- Admin can reject application with reason
- System creates audit trail entry 'loan_rejected'
- Status changes to 'rejected'
- User receives rejection notification

#### US-012: View Audit Trail
**As an** admin  
**I want to** view the complete audit trail  
**So that** I can track all actions and ensure compliance  

**Acceptance Criteria:**
- Admin can view complete audit trail for any application
- Audit trail shows all actions with timestamps and users
- Admin can export audit trail for compliance

#### US-013: Generate Compliance Reports
**As an** admin  
**I want to** generate compliance reports  
**So that** I can meet regulatory requirements  

**Acceptance Criteria:**
- Admin can generate reports for approved loans
- Reports include audit trail and snapshots
- Reports can be exported for external compliance

### 3. User Stories - System

#### US-014: Create Audit Trail Entries
**As a** system  
**I want to** create audit trail entries for all actions  
**So that** there is a complete record of all activities  

**Acceptance Criteria:**
- System creates audit trail entry for every action
- Each entry includes user, timestamp, and details
- Audit trail is immutable and cannot be modified

#### US-015: Create Snapshots
**As a** system  
**I want to** create snapshots at approval points  
**So that** there is an immutable record of approved applications  

**Acceptance Criteria:**
- System creates snapshot when loan is approved
- Snapshot contains all documents and data at approval time
- Snapshot is immutable and cannot be modified

#### US-016: Send Notifications
**As a** system  
**I want to** send email notifications for important events  
**So that** users are informed of status changes  

**Acceptance Criteria:**
- System sends email for document requests
- System sends email for approval/rejection
- System sends email for offer letter events
- All notifications are logged in audit trail

#### US-017: Manage Data Retention
**As a** system  
**I want to** manage data retention according to policy  
**So that** storage is optimized and compliance is maintained  

**Acceptance Criteria:**
- System retains approved loan data for 7 years
- System retains failed application data for 3 years
- System automatically archives old data
- System maintains audit trail for retention period

## API Endpoints for Each Scenario

### Application Management
- `POST /loan-applications` - Create application (US-001)
- `GET /loan-applications/{id}/status` - View status (US-004)
- `PUT /loan-applications/{id}/status` - Update status
- `POST /loan-applications/{id}/submit` - Submit application (US-003)

### Document Management
- `POST /documents` - Upload documents (US-002)
- `PUT /documents/{id}` - Update documents (US-007a)
- `GET /loan-applications/{id}/documents` - View documents

### Document Requests
- `GET /loan-applications/{id}/document-requests` - View requests (US-004)
- `POST /loan-applications/{id}/document-requests` - Create request (US-009)
- `PUT /document-requests/{id}/fulfill` - Fulfill request (US-005)

### Admin Actions
- `POST /loan-applications/{id}/approve` - Approve loan (US-010)
- `POST /loan-applications/{id}/reject` - Reject loan (US-011)
- `GET /loan-applications/{id}/audit-trail` - View audit trail (US-012)

### Audit and Compliance
- `GET /loan-applications/{id}/snapshot` - View snapshot
- `GET /audit-trail/export` - Export audit trail (US-013)
- `GET /compliance/reports` - Generate reports (US-013)

## Status Flow Diagram

```
draft → submitted → under_review → approved → offer_letter_sent → offer_letter_signed → disbursed
  ↓        ↓           ↓            ↓
withdrawn rejected   rejected    rejected
  ↓        ↓           ↓            ↓
closed    closed     closed      closed
```

## Key Benefits of This Flow

1. **Complete Audit Trail**: Every action is tracked and logged
2. **Immutable Snapshots**: Approved applications have permanent records
3. **Clear Communication**: Document requests and status updates
4. **Compliance Ready**: 7-year retention and audit capabilities
5. **User Friendly**: Clear status updates and notifications
6. **Admin Efficient**: Streamlined review and approval process

This comprehensive flow covers all possible scenarios and provides a robust foundation for the loan approval process with full audit trail capabilities.
