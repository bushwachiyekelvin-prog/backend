# Loan Products API Documentation

This document provides comprehensive documentation for the Loan Products API endpoints.

## Product Lifecycle

### Status Flow
```
draft → active → archived
  ↓       ↓        ↓
Create   Launch   Discontinue
```

### Status Definitions
- **draft**: Product being configured, not available for applications
- **active**: Product available for new loan applications
- **archived**: Historical record only, no new applications

### Edit Rules by Status
- **draft**: ✅ Can edit all fields (name, rates, terms, etc.)
- **active**: ✅ Can edit all fields with automatic versioning for critical changes
- **archived**: ❌ Cannot edit - read-only historical record

## Endpoints

### 1. List Loan Products

**GET** `/loan-products`

Retrieves loan products with comprehensive filtering, sorting, and pagination.

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | string | Page number (default: 1) | `?page=1` |
| `limit` | string | Items per page (default: 20, max: 100) | `?limit=10` |
| `status` | string | Filter by product status | `?status=active` |
| `includeArchived` | string | Include archived products (default: false) | `?includeArchived=true` |
| `currency` | string | Filter by currency | `?currency=USD` |
| `minAmount` | string | Filter by minimum amount | `?minAmount=10000` |
| `maxAmount` | string | Filter by maximum amount | `?maxAmount=1000000` |
| `minTerm` | string | Filter by minimum term | `?minTerm=6` |
| `maxTerm` | string | Filter by maximum term | `?maxTerm=24` |
| `termUnit` | string | Filter by term unit | `?termUnit=months` |
| `interestType` | string | Filter by interest type | `?interestType=fixed` |
| `ratePeriod` | string | Filter by rate period | `?ratePeriod=per_year` |
| `amortizationMethod` | string | Filter by amortization method | `?amortizationMethod=reducing_balance` |
| `repaymentFrequency` | string | Filter by repayment frequency | `?repaymentFrequency=monthly` |
| `isActive` | string | Filter by active status | `?isActive=true` |
| `search` | string | Search in name and description | `?search=bridge` |
| `sortBy` | string | Sort field (default: createdAt) | `?sortBy=name` |
| `sortOrder` | string | Sort order (default: desc) | `?sortOrder=asc` |

#### Valid Values

**Status**: `draft`, `active`, `archived`
**Term Unit**: `months`, `years`
**Interest Type**: `fixed`, `variable`
**Rate Period**: `per_year`, `per_month`
**Amortization Method**: `flat`, `reducing_balance`
**Repayment Frequency**: `monthly`, `quarterly`, `semi_annual`, `annual`
**Sort By**: `name`, `createdAt`, `updatedAt`, `interestRate`, `minAmount`, `maxAmount`
**Sort Order**: `asc`, `desc`


### 2. Get Loan Product by ID

**GET** `/loan-products/{id}`

Retrieves a specific loan product by its ID.

#### Path Parameters
- `id` (string, required): The loan product ID

### 3. Create Loan Product

**POST** `/loan-products`

Creates a new loan product in draft status.

#### Request Body
```json
{
  "name": "Small Business Loan",
  "slug": "small-business-loan",
  "imageUrl": "https://example.com/image.jpg",
  "summary": "Quick access to working capital",
  "description": "Fast approval for small business financing",
  "currency": "USD",
  "minAmount": 5000,
  "maxAmount": 50000,
  "minTerm": 6,
  "maxTerm": 24,
  "termUnit": "months",
  "interestRate": 8.5,
  "interestType": "fixed",
  "ratePeriod": "per_year",
  "amortizationMethod": "reducing_balance",
  "repaymentFrequency": "monthly",
  "gracePeriodDays": 0,
  "processingFeeFlat": 0,
  "lateFeeRate": 0,
  "lateFeeFlat": 0,
  "prepaymentPenaltyRate": 0,
  "isActive": true
}
```

#### Required Fields
- `name` (string): Product name
- `currency` (string): Currency code (e.g., "USD", "EUR")
- `minAmount` (number): Minimum loan amount
- `maxAmount` (number): Maximum loan amount
- `minTerm` (number): Minimum loan term
- `maxTerm` (number): Maximum loan term
- `termUnit` (string): Term unit ("months" or "years")
- `interestRate` (number): Interest rate
- `interestType` (string): Interest type ("fixed" or "variable")
- `ratePeriod` (string): Rate period ("per_year" or "per_month")
- `amortizationMethod` (string): Amortization method ("flat" or "reducing_balance")
- `repaymentFrequency` (string): Repayment frequency


### 4. Update Loan Product

**PATCH** `/loan-products/{id}`

Updates an existing loan product. The ability to edit depends on the product's status.

#### Path Parameters
- `id` (string, required): The loan product ID

#### Request Body
```json
{
  "name": "Updated Product Name",
  "description": "Updated description",
  "interestRate": 9.0,
  "minAmount": 10000,
  "maxAmount": 75000,
  "changeReason": "Updated rates due to market conditions"
}
```

#### Edit Rules
- **Draft products**: Can edit all fields
- **Active products**: Can edit all fields, but critical changes increment version
- **Archived products**: Cannot edit (read-only)

#### Critical Fields (trigger version increment)
- `minAmount`, `maxAmount`
- `minTerm`, `maxTerm`
- `interestRate`
- `interestType`
- `ratePeriod`
- `amortizationMethod`
- `repaymentFrequency`


### 5. Update Product Status

**PATCH** `/loan-products/{id}/status`

Changes the status of a loan product. This is the primary way to manage product lifecycle.

#### Path Parameters
- `id` (string, required): The loan product ID

#### Request Body
```json
{
  "status": "active",
  "changeReason": "Product approved for launch",
  "approvedBy": "admin_user_id"
}
```

#### Valid Status Transitions
- `draft` → `active`: Product becomes available for applications
- `active` → `archived`: Product becomes read-only historical record
- `archived` → `active`: Can reactivate with proper approval

#### Required Fields
- `status` (string): New status ("draft", "active", "archived")
- `changeReason` (string): Reason for status change
- `approvedBy` (string): ID of the user approving the change


### 6. Delete Loan Product

**DELETE** `/loan-products/{id}`

Soft deletes a loan product by setting deletedAt timestamp.

#### Path Parameters
- `id` (string, required): The loan product ID

#### Deletion Rules
- **Draft products**: ✅ Can delete (no applications exist)
- **Active products**: ⚠️ Can delete but check for existing applications first
- **Archived products**: ✅ Can delete (already archived)


## Error Responses

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `LOAN_PRODUCT_NOT_FOUND` | 404 | Product not found |
| `PRODUCT_ARCHIVED` | 400 | Cannot edit archived products |
| `CRITICAL_FIELD_CHANGE` | 400 | Cannot edit critical fields on active products |
| `INVALID_TRANSITION` | 400 | Invalid status transition |
| `PRODUCT_HAS_APPLICATIONS` | 400 | Cannot archive/delete product with active applications |
| `INVALID_AMOUNT_RANGE` | 400 | minAmount cannot exceed maxAmount |
| `INVALID_TERM_RANGE` | 400 | minTerm cannot exceed maxTerm |


## Data Models

### LoanProductItem
```typescript
interface LoanProductItem {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  summary?: string;
  description?: string;
  currency: string;
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  termUnit: "months" | "years";
  interestRate: number;
  interestType: "fixed" | "variable";
  ratePeriod: "per_year" | "per_month";
  amortizationMethod: "flat" | "reducing_balance";
  repaymentFrequency: "monthly" | "quarterly" | "semi_annual" | "annual";
  gracePeriodDays: number;
  version: number;
  status: "draft" | "active" | "archived";
  isActive: boolean;
  processingFeeFlat?: number;
  lateFeeRate?: number;
  lateFeeFlat?: number;
  prepaymentPenaltyRate?: number;
  changeReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Best Practices

### 1. Pagination
Always use pagination for list endpoints to avoid performance issues.

### 2. Filtering
Use specific filters to get relevant products.

### 3. Error Handling
Always handle errors gracefully and check response status codes.

### 4. Status Management
Follow the proper status flow: draft → active → archived.

### 5. Version Awareness
Be aware of version changes when editing active products with critical fields.
