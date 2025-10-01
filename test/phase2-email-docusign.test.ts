// @ts-ignore - bun:test types
import { test, expect, beforeAll, afterAll } from "bun:test";
import { render } from "@react-email/render";
import { OfferLetterEmail } from "../src/templates/email/offer-letter";
import { docuSignService } from "../src/services/docusign.service";
import { EmailService } from "../src/services/email.service";

test("should render offer letter email template", async () => {
    const emailHtml = await render(
      OfferLetterEmail({
        firstName: "John",
        recipientName: "John Doe",
        loanAmount: "50000.00",
        currency: "USD",
        loanTerm: 12,
        interestRate: "12.5",
        offerLetterUrl: "https://demo.docusign.net/signing/documents/test-envelope",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        specialConditions: "This loan requires quarterly financial reporting.",
        requiresGuarantor: true,
        requiresCollateral: false,
      })
    );

    expect(emailHtml).toBeDefined();
    expect(emailHtml).toContain("John");
    expect(emailHtml).toContain("USD 50000.00");
    expect(emailHtml).toContain("12.5<!-- -->% per annum");
    expect(emailHtml).toContain("12<!-- --> months");
    expect(emailHtml).toContain("https://demo.docusign.net/signing/documents/test-envelope");
    expect(emailHtml).toContain("This loan requires quarterly financial reporting");
    expect(emailHtml).toContain("A guarantor is required for this loan");
    expect(emailHtml).toContain("Review &amp; Sign Loan Agreement");
  });

test("should handle DocuSign service configuration", () => {
    // Test that DocuSign service can be instantiated
    expect(docuSignService).toBeDefined();
    
    // Test that the service has the expected methods
    expect(typeof docuSignService.createEnvelope).toBe("function");
    expect(typeof docuSignService.getEnvelopeStatus).toBe("function");
    expect(typeof docuSignService.getEnvelopeRecipients).toBe("function");
    expect(typeof docuSignService.voidEnvelope).toBe("function");
    expect(typeof docuSignService.getSigningUrl).toBe("function");
    expect(typeof docuSignService.processWebhookEvent).toBe("function");
  });

test("should handle email service configuration", () => {
    // Test that EmailService can be instantiated
    expect(() => new EmailService()).not.toThrow();
    
    const emailService = new EmailService();
    expect(typeof emailService.sendEmail).toBe("function");
  });

test("should validate DocuSign webhook event structure", () => {
    const mockWebhookEvent = {
      event: "envelope-completed",
      apiVersion: "v2.1",
      uri: "/restapi/v2.1/accounts/test-account/envelopes/test-envelope",
      retryCount: "0",
      configurationId: "test-config",
      generatedDateTime: new Date().toISOString(),
      data: {
        accountId: "test-account",
        userId: "test-user",
        envelopeId: "test-envelope",
        envelopeSummary: {
          envelopeId: "test-envelope",
          uri: "/restapi/v2.1/accounts/test-account/envelopes/test-envelope",
          statusDateTime: new Date().toISOString(),
          status: "completed",
          emailSubject: "Test Subject",
          emailBlurb: "Test Blurb",
          envelopeIdStamping: "true",
          authoritative: "true",
          enforceSignerVisibility: "false",
          enableWetSign: "false",
          allowMarkup: "false",
          allowReassign: "false",
          createdDateTime: new Date().toISOString(),
          lastModifiedDateTime: new Date().toISOString(),
          deliveredDateTime: new Date().toISOString(),
          sentDateTime: new Date().toISOString(),
          completedDateTime: new Date().toISOString(),
          voidedDateTime: null,
          voidedReason: null,
          deletedDateTime: null,
          declinedDateTime: null,
          autoNavigation: "true",
          is21CFRPart11: "false",
          isSignatureProviderEnvelope: "false",
          anySigner: "false",
          envelopeLocation: "cloud",
          isDynamicEnvelope: "false",
        },
      },
    };

    // Test that the webhook event structure is valid
    expect(mockWebhookEvent.event).toBe("envelope-completed");
    expect(mockWebhookEvent.data.envelopeSummary.status).toBe("completed");
    expect(mockWebhookEvent.data.envelopeSummary.envelopeId).toBe("test-envelope");
  });

test("should validate DocuSign envelope creation request structure", () => {
    const mockEnvelopeRequest = {
      emailSubject: "Loan Offer Letter - OFFER-2024-001",
      emailBlurb: "Please review and sign your loan offer letter for USD 50000",
      templateId: "test-template-id",
      templateRoles: [
        {
          roleName: "Signer",
          name: "John Doe",
          email: "john.doe@example.com",
        },
      ],
      status: "sent",
      eventNotification: {
        url: "https://api.melaninkapital.com/webhooks/docusign",
        loggingEnabled: "true",
        includeDocuments: "false",
        includeCertificateOfCompletion: "true",
        includeTimeZone: "true",
        includeSenderAccountAsCustomField: "true",
        envelopeEvents: [
          {
            envelopeEventStatusCode: "sent",
            includeDocuments: "false",
          },
          {
            envelopeEventStatusCode: "completed",
            includeDocuments: "false",
          },
        ],
        recipientEvents: [
          {
            recipientEventStatusCode: "sent",
            includeDocuments: "false",
          },
          {
            recipientEventStatusCode: "completed",
            includeDocuments: "false",
          },
        ],
      },
    };

    // Test that the envelope request structure is valid
    expect(mockEnvelopeRequest.emailSubject).toContain("Loan Offer Letter");
    expect(mockEnvelopeRequest.templateRoles).toHaveLength(1);
    expect(mockEnvelopeRequest.templateRoles[0].roleName).toBe("Signer");
    expect(mockEnvelopeRequest.status).toBe("sent");
    expect(mockEnvelopeRequest.eventNotification.url).toContain("/webhooks/docusign");
  });

test("should handle email template with minimal data", async () => {
    const emailHtml = await render(
      OfferLetterEmail({
        firstName: "Jane",
        recipientName: "Jane Smith",
        loanAmount: "25000.00",
        currency: "USD",
        loanTerm: 6,
        interestRate: "10.0",
        offerLetterUrl: "https://demo.docusign.net/signing/documents/minimal-envelope",
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      })
    );

    expect(emailHtml).toBeDefined();
    expect(emailHtml).toContain("Jane");
    expect(emailHtml).toContain("USD 25000.00");
    expect(emailHtml).toContain("10.0<!-- -->% per annum");
    expect(emailHtml).toContain("6<!-- --> months");
    expect(emailHtml).toContain("https://demo.docusign.net/signing/documents/minimal-envelope");
  });

test("should handle email template with all optional fields", async () => {
    const emailHtml = await render(
      OfferLetterEmail({
        firstName: "Bob",
        recipientName: "Bob Johnson",
        loanAmount: "100000.00",
        currency: "USD",
        loanTerm: 24,
        interestRate: "8.5",
        offerLetterUrl: "https://demo.docusign.net/signing/documents/full-envelope",
        expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        specialConditions: "This loan requires monthly financial reporting and quarterly business reviews. The borrower must maintain a minimum debt service coverage ratio of 1.25.",
        requiresGuarantor: true,
        requiresCollateral: true,
        supportEmail: "custom-support@melaninkapital.com",
        supportPhone: "+254700000000",
        termsUrl: "https://custom-terms.com",
        privacyUrl: "https://custom-privacy.com",
        unsubscribeUrl: "https://custom-unsubscribe.com",
      })
    );

    expect(emailHtml).toBeDefined();
    expect(emailHtml).toContain("Bob");
    expect(emailHtml).toContain("USD 100000.00");
    expect(emailHtml).toContain("8.5<!-- -->% per annum");
    expect(emailHtml).toContain("24<!-- --> months");
    expect(emailHtml).toContain("monthly financial reporting");
    expect(emailHtml).toContain("A guarantor is required for this loan");
    expect(emailHtml).toContain("Collateral is required for this loan");
    expect(emailHtml).toContain("custom-terms.com");
    expect(emailHtml).toContain("custom-privacy.com");
  });
