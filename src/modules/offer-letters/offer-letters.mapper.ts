import { OfferLettersModel } from "./offer-letters.model";

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export function mapOfferLetterRow(
  row: any,
  related?: {
    loanApplication?: any;
  }
): OfferLettersModel.OfferLetterItem {
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
    // Related data
    loanApplication: related?.loanApplication ? {
      id: related.loanApplication.id,
      applicationNumber: related.loanApplication.applicationNumber,
      loanAmount: toNumber(related.loanApplication.loanAmount) ?? 0,
      loanTerm: related.loanApplication.loanTerm,
      currency: related.loanApplication.currency,
      purpose: related.loanApplication.purpose,
      status: related.loanApplication.status,
    } : undefined,
  };
}

export function generateOfferNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
  return `OFFER-${year}-${random}`;
}

export { toNumber };



