import { t } from "elysia";

export namespace UserModel {
  export const signUpBody = t.Object({
    email: t.String(),
    firstName: t.String(),
    lastName: t.String(),
    gender: t.String(),
    phoneNumber: t.String(),
    dob: t.Date(),
    clerkId: t.String()
  });

  export type signUpBody = typeof signUpBody.static;

  export const signUpResponse = t.Object({
		email: t.String(),
	})

  export type signUpResponse = typeof signUpResponse.static;

  export const signUpInvalid = t.Literal("Invalid sign up parameters");
  export type signUpInvalid = typeof signUpInvalid.static;

  // Standard error envelope for webhook/controller errors
  export const errorResponse = t.Object({
    error: t.String(),
    code: t.String(),
  });
  export type ErrorResponse = typeof errorResponse.static;

  // OTP request body
  export const otpRequestBody = t.Object({});
  export type otpRequestBody = typeof otpRequestBody.static;

  // OTP verification request body
  export const otpVerificationBody = t.Object({
    otp: t.String(),
  });
  export type otpVerificationBody = typeof otpVerificationBody.static;

  // OTP response
  export const otpResponse = t.Object({
    success: t.Boolean(),
    message: t.String(),
    isAlreadyVerified: t.Optional(t.Boolean()),
  });
  export type otpResponse = typeof otpResponse.static;

  // OTP verification response
  export const otpVerificationResponse = t.Object({
    success: t.Boolean(),
    message: t.String(),
  });
  export type otpVerificationResponse = typeof otpVerificationResponse.static;

  // OTP verification query parameters
  export const otpVerificationQuery = t.Object({
    otp: t.String(),
  });
  export type otpVerificationQuery = typeof otpVerificationQuery.static;
}
