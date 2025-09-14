# Phone Verification Flow

This document describes the phone verification flow implemented in the Melanin Kapital backend application. The flow uses Africa's Talking SMS API to send OTP (One-Time Password) messages to users for phone number verification.

## Overview

The phone verification flow consists of the following steps:

1. After a user signs up, an OTP is automatically sent to their phone number
2. The user enters the OTP in the frontend application
3. The frontend sends the OTP to the backend for verification
4. If the OTP is valid, the user's phone number is marked as verified
5. If the OTP is invalid or expired, the user can request a new OTP

## API Endpoints

### 1. Send OTP

**Endpoint:** `POST /user/send-phone-otp`

**Request Body:**
```json
{
  "userId": "user_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "isAlreadyVerified": false
}
```

### 2. Verify OTP

**Endpoint:** `POST /user/verify-phone-otp`

**Request Body:**
```json
{
  "userId": "user_id_here",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully"
}
```

### 3. Resend OTP

**Endpoint:** `POST /user/resend-phone-otp`

**Request Body:**
```json
{
  "userId": "user_id_here"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "isAlreadyVerified": false
}
```

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `USER_NOT_FOUND`: The specified user ID does not exist
- `INVALID_PHONE`: No phone number found for the user
- `OTP_ERROR`: Failed to send OTP
- `VERIFICATION_ERROR`: Failed to verify OTP

## Configuration

To use the phone verification flow, you need to set up the following environment variables:

```
# Africa's Talking API Configuration
AT_USERNAME=your_username
AT_API_KEY=your_api_key
AT_SENDER_ID=MKAP  # Optional sender ID
```

## Implementation Details

### Database Schema

The user table has been extended with the following fields:
- `isPhoneVerified`: Boolean flag indicating if the phone number is verified
- `phoneVerificationCode`: The current OTP code (if any)
- `phoneVerificationExpiry`: The expiry time of the current OTP

### OTP Generation

- OTPs are 6-digit numeric codes
- OTPs expire after 10 minutes
- OTPs are sent via SMS using Africa's Talking API

### Security Considerations

- OTPs are stored in the database but are cleared after successful verification
- OTPs are time-limited to prevent brute force attacks
- Failed verification attempts do not reveal whether the OTP is incorrect or expired

## Integration with Sign-up Flow

When a new user signs up, the system automatically:
1. Creates the user record in the database
2. Sends a welcome email to the user
3. Generates and sends an OTP to the user's phone number

This ensures a smooth onboarding experience while maintaining security through phone verification.
