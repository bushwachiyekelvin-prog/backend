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
}
