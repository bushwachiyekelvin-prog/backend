import type { LoanApplicationsModel } from "./loan-applications.model";

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

type LoanApplicationRow = any; // This will be properly typed when imported
type OfferLetterRow = any;

export function mapLoanApplicationRow(
  row: LoanApplicationRow,
  related?: {
    user?: any;
    business?: any;
    loanProduct?: any;
    offerLetters?: any[];
  },
): LoanApplicationsModel.LoanApplicationItem {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    userId: row.userId,
    businessId: row.businessId,
    loanProductId: row.loanProductId,
    coApplicantIds: row.coApplicantIds ? JSON.parse(row.coApplicantIds) : null,
    loanAmount: toNumber(row.loanAmount) ?? 0,
    loanTerm: row.loanTerm,
    currency: row.currency,
    purpose: row.purpose,
    purposeDescription: row.purposeDescription,
    status: row.status,
    isBusinessLoan: row.isBusinessLoan,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    disbursedAt: row.disbursedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(), // Related data
    user: related?.user
      ? {
          id: related.user.id,
          firstName: related.user.firstName,
          lastName: related.user.lastName,
          email: related.user.email,
        }
      : undefined,
    business: related?.business
      ? {
          id: related.business.id,
          name: related.business.name,
        }
      : null,
    loanProduct: related?.loanProduct
      ? {
          id: related.loanProduct.id,
          name: related.loanProduct.name,
          currency: related.loanProduct.currency,
          minAmount: toNumber(related.loanProduct.minAmount) ?? 0,
          maxAmount: toNumber(related.loanProduct.maxAmount) ?? 0,
          minTerm: related.loanProduct.minTerm,
          maxTerm: related.loanProduct.maxTerm,
          termUnit: related.loanProduct.termUnit,
          interestRate: toNumber(related.loanProduct.interestRate) ?? 0,
        }
      : undefined,
    offerLetters: related?.offerLetters?.map(mapOfferLetterRow) ?? undefined,
  };
}

export function mapOfferLetterRow(row: any): LoanApplicationsModel.OfferLetterItem {
  return {
    id: row.id,
    loanApplicationId: row.loanApplicationId,
    offerNumber: row.offerNumber,
    version: row.version,
    offerAmount: toNumber(row.offerAmount) ?? 0,
    offerTerm: row.offerTerm,
    interestRate: toNumber(row.interestRate) ?? 0,
    currency: row.currency,
    specialConditions: row.specialConditions,
    requiresGuarantor: row.requiresGuarantor,
    requiresCollateral: row.requiresCollateral,
    docuSignEnvelopeId: row.docuSignEnvelopeId,
    docuSignStatus: row.docuSignStatus,
    docuSignTemplateId: row.docuSignTemplateId,
    offerLetterUrl: row.offerLetterUrl,
    signedDocumentUrl: row.signedDocumentUrl,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    viewedAt: row.viewedAt?.toISOString() ?? null,
    signedAt: row.signedAt?.toISOString() ?? null,
    declinedAt: row.declinedAt?.toISOString() ?? null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    status: row.status,
    isActive: row.isActive,
    createdBy: row.createdBy,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function generateApplicationNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `LOAN-${year}-${random}`;
}

export { toNumber };
