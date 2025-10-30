## Internal Users Invitations & RBAC — Implementation Checklist

Decisions locked:
- Use local `internal_invitations` table.
- Skip OTP for internal users during onboarding.
- Disable Clerk built-in invitation emails; listen to webhook to trigger our custom email using `src/templates/email/base-template.tsx`.
- Inactive approach: disable Clerk user (source of truth). Optionally mirror local `users.disabledAt` later if needed.

### Database
- [ ] Create `internal_invitations` table: id, email, role, clerkInvitationId, status (pending|revoked|accepted|expired), invitedByUserId, createdAt, updatedAt, lastSentAt
- [ ] Drizzle migration + push

### Backend APIs (Admin-only)
- [ ] POST `/admin/internal-users/invitations` — create Clerk invitation, store local record, send custom email
- [ ] POST `/admin/internal-users/invitations/:id/resend` — create fresh Clerk invite, update local record, send custom email
- [ ] POST `/admin/internal-users/invitations/:id/revoke` — revoke Clerk invite, update local record
- [ ] GET `/admin/internal-users` — list: pending (from invitations), active/inactive (from Clerk users + local mirror)
- [ ] POST `/admin/internal-users/:clerkUserId/deactivate` — disable Clerk user (inactive)
- [ ] DELETE `/admin/internal-users/:clerkUserId` — delete Clerk user and run local deletion

### AuthZ & Guards
- [ ] Add role guards: `requireRole("super-admin")`, `requireAnyRole(["super-admin","admin"])`
- [ ] Apply guards to admin invitation and management endpoints

### Clerk Integration
- [ ] Implement server-side invitation creation with `public_metadata: { role, internal: true }` and `redirect_url`
- [ ] Ensure Clerk invitation emails are disabled in dashboard
- [ ] Map `public_metadata.role` → local `users.role` on `user.created`

### Webhooks
- [ ] Extend Clerk webhook handler to capture invitation-related email events for custom email dispatch
- [ ] On `user.created`, skip phone OTP when `public_metadata.internal === true`
- [ ] On `user.deleted`, already handled; confirm cleanup for internal users
- [ ] Optionally handle invite lifecycle sync (accepted/revoked/expired) to update `internal_invitations.status`

### Email
- [ ] Build custom invitation email using `src/templates/email/base-template.tsx`
- [ ] Email service method: sendInternalInviteEmail({ email, inviteUrl, role })
- [ ] Include analytics-friendly params (invitationId) in invite link

### Frontend Contract (for reference)
- [ ] Accept page `/internal/accept-invite` reads `__clerk_ticket`
- [ ] Form collects password, firstName, lastName, phoneNumber
- [ ] Completes sign-up via ticket strategy; redirects to internal dashboard

### Admin UI (Backend responses ready)
- [ ] Users list shows: name, imageUrl, phone, email, role, status (pending|active|inactive)
- [ ] Actions: resend invite, revoke invite, deactivate, remove

### Observability & Safety
- [ ] Rate-limit admin endpoints
- [ ] Log invite actions with requestId and `invitedByUserId`
- [ ] Validate that only super-admin can assign super-admin role

### Docs
- [ ] Update `docs/internal-user-invitations.md` once endpoints and schema are finalized


