import {
  type loanApplications,
  loanApplicationStatusEnum,
  loanPurposeEnum,
} from "../../db/schema";

export namespace LoanApplicationsModel {
  // Status enums derived from DB
  export const LoanApplicationStatusEnum = loanApplicationStatusEnum.enumValues;
  export type LoanApplicationStatus = (typeof loanApplications.$inferSelect)["status"];

  export const LoanPurposeEnum = loanPurposeEnum.enumValues;
  export type LoanPurpose = (typeof loanApplications.$inferSelect)["purpose"];

  // ========================================
  // CREATE LOAN APPLICATION
  // ========================================
  export interface CreateLoanApplicationBody {
    loanProductId: string;
    businessId?: string; // Optional for business loans
    coApplicantIds?: string[]; // Array of user IDs for co-applicants
    loanAmount: number;
    loanTerm: number;
    currency: string;
    purpose: LoanPurpose;
    purposeDescription?: string; // Required if purpose is "other"
    isBusinessLoan: boolean;
  }

  // ========================================
  // UPDATE LOAN APPLICATION
  // ========================================
  export interface UpdateLoanApplicationBody {
    loanAmount?: number;
    loanTerm?: number;
    purpose?: LoanPurpose;
    purposeDescription?: string;
    coApplicantIds?: string[];
  }

  // ========================================
  // LOAN APPLICATION ITEM
  // ========================================
  export interface LoanApplicationItem {
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
    createdAt: string;
    updatedAt: string;
    // Related data (populated by service)
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
    offerLetters?: any[]; // Will be typed properly when offer letters are imported
  }

  // ========================================
  // RESPONSE TYPES
  // ========================================
  export interface CreateLoanApplicationResponse {
    success: boolean;
    message: string;
    data: LoanApplicationItem;
  }

  export interface ListLoanApplicationsResponse {
    success: boolean;
    message: string;
    data: LoanApplicationItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export interface GetLoanApplicationResponse {
    success: boolean;
    message: string;
    data: LoanApplicationItem;
  }

  export interface UpdateLoanApplicationResponse {
    success: boolean;
    message: string;
    data: LoanApplicationItem;
  }

  export interface BasicSuccessResponse {
    success: boolean;
    message: string;
  }

  // ========================================
  // QUERY PARAMETERS
  // ========================================
  export interface LoanApplicationIdParams {
    id: string;
  }

  export interface ListLoanApplicationsQuery {
    page?: string;
    limit?: string;
    status?: LoanApplicationStatus;
    isBusinessLoan?: string;
    userId?: string;
    businessId?: string;
    loanProductId?: string;
  }

  // ========================================
  // OFFER LETTER ITEM
  // ========================================
  export interface OfferLetterItem {
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

  // ========================================
  // STATUS UPDATE TYPES
  // ========================================
  export interface UpdateApplicationStatusBody {
    status: LoanApplicationStatus;
    rejectionReason?: string; // Required if status is "rejected"
  }
}