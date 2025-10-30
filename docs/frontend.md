## Frontend Guide: Internal Invitations Flow (Clerk custom flow)

This doc explains the frontend work required to support internal invitations with Clerk-managed auth and our custom email/webhook flow.

### 1) Prereqs and setup
- Install Clerk frontend SDK for your framework (Next.js/React, etc.).
- Configure Clerk Provider with `CLERK_PUBLISHABLE_KEY` and app routes.
- In Clerk Dashboard:
  - Disable built-in invitation emails (we send custom ones via webhook).
  - Ensure the backend webhook is configured and healthy.

Clerk reference: `https://clerk.com/docs/raw/guides/development/custom-flows/authentication/application-invitations.mdx`

### 2) Accept Invite page: `/internal/accept-invite`
- Purpose: let invited users complete sign-up using the invitation ticket and set their password and profile fields.
- Input fields:
  - Password (required)
  - First name (required)
  - Last name (required)
  - Phone number (optional; unverified on onboarding)
- How it works:
  1. Read `__clerk_ticket` from `window.location.search`.
  2. Use Clerk sign-up with ticket strategy to complete the account.
  3. On success, set active session and redirect to internal dashboard.

Pseudo-code (React):
```tsx
import { useSignUp } from '@clerk/clerk-react';

export default function AcceptInvitePage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const ticket = new URLSearchParams(window.location.search).get('__clerk_ticket') || '';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isLoaded || !ticket) return;
    const form = new FormData(e.currentTarget);
    const firstName = String(form.get('firstName') || '');
    const lastName = String(form.get('lastName') || '');
    const password = String(form.get('password') || '');
    const phoneNumber = String(form.get('phoneNumber') || '');

    const attempt = await signUp.create({
      strategy: 'ticket',
      ticket,
      firstName,
      lastName,
      password,
      // phoneNumber is optional; no verification at this step
      ...(phoneNumber ? { phoneNumber } : {}),
    });

    if (attempt.status === 'complete') {
      await setActive({ session: attempt.createdSessionId });
      // redirect to internal app
      window.location.assign('/internal');
    } else {
      // show validation errors
      console.error('Sign-up incomplete', attempt);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input name="firstName" required />
      <input name="lastName" required />
      <input name="password" type="password" required />
      <input name="phoneNumber" />
      <button type="submit">Create account</button>
    </form>
  );
}
```

Notes:
- The `__clerk_ticket` comes from Clerk and is appended to our redirect_url by Clerk when the invite email link is clicked.
- Roles are assigned via Clerk `public_metadata` at invite creation and mirrored to our DB via webhook; no role selection is needed on the page.

### 3) Admin UI integration
Use these backend endpoints to manage internal users (super-admin only):

- Create invite
  - POST `/admin/internal-users/invitations`
  - Body: `{ email: string; role: 'super-admin'|'admin'|'member' }`
  - Behavior: Creates a Clerk invitation with metadata; webhook sends the custom email when Clerk produces the ticketed link.

- List internal users
  - GET `/admin/internal-users`
  - Returns: `{ items: Array<{ name, imageUrl?, phoneNumber?, email, role?, status: 'pending'|'active'|'inactive', clerkId?, invitationId? }>} `
  - Status mapping: pending (invitation only), active (Clerk user present, not banned), inactive (banned).

- Resend invite
  - POST `/admin/internal-users/invitations/:id/resend`
  - Creates a fresh Clerk invitation; custom email is sent by webhook when `email.created` arrives with the ticket link.

- Revoke invite
  - POST `/admin/internal-users/invitations/:id/revoke`
  - Revokes the Clerk invitation and updates local status.

- Deactivate user
  - POST `/admin/internal-users/:clerkUserId/deactivate`
  - Sets `banned: true` in Clerk and revokes sessions; treated as inactive in lists.

- Remove user
  - DELETE `/admin/internal-users/:clerkUserId`
  - Deletes the Clerk user and soft-deletes locally.

### 4) Testing checklist (frontend)
- Confirm invite email deep link lands on `/internal/accept-invite` with `__clerk_ticket` present.
- Verify form validation and error display on failed sign-up attempts.
- After success: confirm session is active and user reaches internal dashboard.
- For admin UI:
  - Create invite → entry appears as pending in list.
  - Resend/revoke behave as expected.
  - Deactivate flips status to inactive and logs the user out if they’re online.

### 5) UX recommendations
- Show a friendly loading state while validating the ticket.
- Provide clear errors for expired/invalid tickets and a CTA to request a new invite.
- Prefill email if Clerk provides it in the ticket payload (optional).


