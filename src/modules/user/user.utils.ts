import { UserModel } from "./user.model";
import { WebhookEvent } from "@clerk/fastify";

// Define proper types for Clerk webhook data
interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification: {
    status: string;
    strategy: string;
  };
  linked_to: any[];
}

interface ClerkUserData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  unsafe_metadata?: {
    gender?: string;
    phoneNumber?: string;
    dob?: string | Date;
    [key: string]: any;
  };

  [key: string]: any;
}

export interface UserDataExtractionResult {
  success: boolean;
  userData?: UserModel.SignUpBody;
  missingFields?: string[];
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Extracts and validates user data from a Clerk webhook event
 * @param event The Clerk webhook event
 * @returns UserDataExtractionResult with success status and user data or error
 */
export const extractUserDataFromWebhook = (
  event: WebhookEvent,
): UserDataExtractionResult => {
  try {
    // Cast data to our defined type for better type safety
    const data = event.data as ClerkUserData;

    const {
      id: clerkUserId,
      email_addresses,
      first_name,
      last_name,
      primary_email_address_id,
    } = data;

    // Find primary email with proper type safety
    const primaryEmail = Array.isArray(email_addresses)
      ? (email_addresses.find((e) => e.id === primary_email_address_id)
          ?.email_address ?? email_addresses[0]?.email_address)
      : undefined;

    // Extract metadata with proper type safety
    const publicMetadata = data.unsafe_metadata || {};
    const gender = publicMetadata.gender;
    const phoneNumber = publicMetadata.phoneNumber;
    const dobRaw = publicMetadata.dob;

    let dob: Date | undefined;
    if (typeof dobRaw === "string") {
      const parsed = new Date(dobRaw);
      if (!isNaN(parsed.getTime())) dob = parsed;
    } else if (dobRaw instanceof Date) {
      dob = dobRaw;
    }

    const missing: string[] = [];
    if (!primaryEmail) missing.push("email");
    if (!first_name) missing.push("firstName");
    if (!last_name) missing.push("lastName");
    if (!gender) missing.push("gender");
    if (!phoneNumber) missing.push("phoneNumber");
    if (!dob) missing.push("dob");

    if (missing.length > 0) {
      return {
        success: false,
        missingFields: missing,
        error: {
          message: `Missing required fields: ${missing.join(", ")}`,
          code: "INVALID_METADATA",
        },
      };
    }

    const userData: UserModel.SignUpBody = {
      email: primaryEmail as string,
      firstName: first_name as string,
      lastName: last_name as string,
      gender: gender as string,
      phoneNumber: phoneNumber as string,
      dob: dob as Date,
      clerkId: clerkUserId as string,
    };

    return {
      success: true,
      userData,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: "Failed to extract user data from webhook",
        code: "USER_DATA_EXTRACTION_FAILED",
      },
    };
  }
};

/**
 * Extracts clerkId and primary email from any Clerk user webhook event (e.g. user.updated)
 */
export const extractEmailUpdateFromWebhook = (
  event: WebhookEvent,
): {
  success: boolean;
  clerkId?: string;
  email?: string;
  error?: { message: string; code: string };
} => {
  try {
    const data = event.data as ClerkUserData;
    const clerkId = data.id;
    const { email_addresses, primary_email_address_id } = data;

    const primaryEmail = Array.isArray(email_addresses)
      ? (
          email_addresses.find((e) => e.id === primary_email_address_id)
            ?.email_address ?? email_addresses[0]?.email_address
        )
      : undefined;

    if (!clerkId || !primaryEmail) {
      return {
        success: false,
        error: {
          message: "Missing clerkId or primary email in webhook payload",
          code: "EMAIL_UPDATE_EXTRACTION_FAILED",
        },
      };
    }

    return { success: true, clerkId, email: primaryEmail };
  } catch (error) {
    return {
      success: false,
      error: {
        message: "Failed to extract email update from webhook",
        code: "EMAIL_UPDATE_EXTRACTION_FAILED",
      },
    };
  }
};
