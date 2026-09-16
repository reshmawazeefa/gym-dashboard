# Authentication API Documentation

## Base path

```txt
/auth
```

This module covers the public authentication and password reset flow.

---

## Password Reset Flow

### POST `/auth/forgot-password`

**Purpose:** Initiates the password reset flow by generating a 6-digit OTP for the user's email. The OTP is bcrypt-hashed and stored in `PasswordResetToken` (expires after 5 minutes), then emailed to the user (fire-and-forget — skipped in dev when SMTP is not configured).

**Access:** Public (no auth required)

**Body:**

```json
{
  "email": "user@gym.com",
  "gymSlug": "fit24"
}
```

**Business rules:**

- Either `gymId` or `gymSlug` is required
- User is looked up by the `email + gymId` composite unique
- OTP is 6 digits and expires after 5 minutes

**Response (200):**

```json
{
  "success": true,
  "message": "OTP sent to your email"
}
```

**Error (404) — gym slug not found:**

```json
{
  "success": false,
  "message": "Gym not found"
}
```

**Error (404) — user not found:**

```json
{
  "success": false,
  "message": "No user found with this email in this gym"
}
```

**Error (400) — missing gym:**

```json
{
  "success": false,
  "message": "gymId or gymSlug is required"
}
```

---

### POST `/auth/verify-otp`

**Purpose:** Verifies the OTP submitted by the user (bcrypt-compared against unused OTP records), marks the OTP record as used, and returns a JWT reset token valid for 15 minutes. The reset token is also bcrypt-hashed and stored in `PasswordResetToken` for the final step.

**Access:** Public (no auth required)

**Body:**

```json
{
  "email": "user@gym.com",
  "otp": "123456",
  "gymId": "uuid"
}
```

Or using gym code:

```json
{
  "email": "user@gym.com",
  "otp": "123456",
  "gymSlug": "fit24"
}
```

**Business rules:**

- `otp` must be exactly 6 digits
- Only unused, unexpired OTP records are considered
- On success, the OTP record is marked `used` (single use)
- The returned `resetToken` must be passed to `/auth/reset-password` within 15 minutes

**Response (200):**

```json
{
  "success": true,
  "data": {
    "resetToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error (400) — wrong OTP:**

```json
{
  "success": false,
  "message": "Invalid OTP"
}
```

**Error (400) — expired OTP:**

```json
{
  "success": false,
  "message": "OTP has expired"
}
```

**Error (404):**

```json
{
  "success": false,
  "message": "No user found with this email in this gym"
}
```

---

### POST `/auth/reset-password`

**Purpose:** Completes the password reset by validating the reset token (JWT) and setting the new password. The reset token expires after 15 minutes and can only be used once. Also invalidates all existing refresh tokens for the user (forces re-login on all devices).

**Access:** Public (no auth required)

**Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "newPassword": "newPass123"
}
```

**Business rules:**

- `newPassword` must be at least 6 characters
- The `token` is the one returned by `/auth/verify-otp`
- On success, the password is updated (bcrypt, 12 rounds), the reset token is marked `used`, and all refresh tokens for the user are deleted

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

**Error (400) — invalid/expired token:**

```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

**Error (400) — already used token:**

```json
{
  "success": false,
  "message": "Invalid or already used reset token"
}
```

**Error (400) — expired token:**

```json
{
  "success": false,
  "message": "Reset token has expired"
}
```

---

## Notes

- The password reset flow is designed to be public and works with either `gymId` or `gymSlug`.
- The OTP and reset token are both stored using hashed values for security.
- A successful reset invalidates all existing refresh tokens so the user is forced to log in again on all devices.
