## Internal Users Invitation & RBAC Flow (Clerk-managed Auth)

This document proposes an end-to-end flow to invite internal users with roles, send custom emails, and onboard them with password and profile collection — while Clerk manages authentication.

### Goals
- Invite internal users (super-admin, admin, member) via backend-controlled API
- Send a custom email (not Clerk’s) containing an invitation link
- On acceptance, users set password and provide first name, last name, phone (no phone verification required for onboarding)
- Super-admin can list internal users with name, imageUrl, phone, email, status (pending, active, inactive), and can resend/revoke invites, deactivate/remove users
- Keep Clerk as the source of truth for auth; mirror essential user/role data in local DB for RBAC and admin UX

### Current Building Blocks (already in repo)
- Clerk Fastify plugin registered globally and used for protected routes.
- Clerk webhook endpoint implemented and signature verified with Svix.
- Local `users` table includes `clerkId`, `firstName`, `lastName`, `imageUrl`, `email`, `phoneNumber`, `role`, timestamps.
- Webhook handles `user.created` to create local user; also handles `user.updated`, `email.created`, `user.deleted`.

Code references:

```65:86:src/routes/webhooks.routes.ts
  fastify.post(
    "/clerk",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // ... verify signature ...
      const { event } = webhookResult;
      const { type } = event!;

      if (type === "user.created") {
        const userDataResult = extractUserDataFromWebhook(event!);
        const userResult = await User.signUp(userDataResult.userData!);
        // send welcome email and optionally phone OTP
        return reply.send(userResult);
      }
```

```4:20:src/db/schema/users.ts
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    clerkId: varchar("clerk_id", { length: 64 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    imageUrl: text("image_url"),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    role: varchar("role", { length: 50 }),
    // ...
  },
);
```

### Proposed Architecture
- Clerk remains the identity provider; invitations and accounts are created through Clerk APIs.
- Roles are stored in Clerk `public_metadata.role` for portability and mirrored into our local `users.role` for fast backend authorization checks.
- Admin actions (invite, resend, revoke, deactivate, remove) are invoked through our backend, which calls Clerk’s server APIs and sends custom emails.
- We surface “pending/active/inactive” in Admin UI by combining Clerk state + local state:
  - pending: pending Clerk invitation exists, or local placeholder created without Clerk user yet
  - active: Clerk user exists and is enabled
  - inactive: Clerk user exists but is disabled/deactivated

### Data Model Additions
Option A (lean): Do not persist invites locally. Query Clerk invitations list as needed and map to UI. Pros: fewer tables. Cons: limited history/analytics and tight coupling to Clerk API responses at runtime.

Option B (recommended): Add `internal_invitations` table to track invitations we issued.
- Fields: id, email, role, clerkInvitationId, status (pending|revoked|accepted|expired), invitedByUserId, createdAt, updatedAt, lastSentAt
- Purpose: power admin UI (filters/search), show resend/revoked state, and analytics. Clerk remains source of truth; we sync minimal state.

### End-to-End Flow
1) Super-admin creates invitation (backend endpoint)
- Request: email, role (super-admin|admin|member)
- Backend validates role and permissions (only super-admin can invite)
- Backend calls Clerk Invitations API with:
  - email_address
  - redirect_url = `FRONTEND_URL/internal/accept-invite` (custom page)
  - public_metadata = { role, internal: true }
- Backend stores an `internal_invitations` record (Option B) and dispatches a custom email to the user with a deep link to the accept page (no Clerk email)

2) User accepts invitation (frontend custom page)
- The Clerk invitation link appends `__clerk_ticket` to the redirect URL
- Frontend page extracts the `__clerk_ticket` and shows a form for: password, first name, last name, phone number
- Frontend completes sign up using Clerk ticket strategy:
  - strategy: "ticket", ticket: `__clerk_ticket`, password, firstName, lastName, phoneNumber (no phone verification required here)
- On success, Clerk creates the user; session may be started automatically client-side

3) Backend reacts to Clerk webhooks
- `user.created`: create local `users` row using webhook payload. Map Clerk `public_metadata.role` to local `users.role`. Persist firstName, lastName, imageUrl, email, phoneNumber.
- Optional: Do not send phone OTP for internal users (we can gate this based on `public_metadata.internal === true`).
- `user.deleted`: cascade delete or soft-delete locally using our `UserDeletionService` (already present).
- We may also monitor Clerk invitation lifecycle (if needed) to set local invitation status to `accepted`/`revoked`.

4) Admin listing and actions
- List internal users: collate from local `users` (role not null AND/OR `public_metadata.internal === true`) and include Clerk status
  - status mapping:
    - pending: from `internal_invitations` with no linked Clerk user
    - active: Clerk user exists and is enabled
    - inactive: Clerk user exists but disabled
- Resend invite: create a fresh Clerk invitation and update `internal_invitations.lastSentAt`. Send our custom email again.
- Revoke invite: call Clerk revoke on the invitation id; update local record to `revoked`.
- Deactivate user: update Clerk user to disabled; reflect as `inactive` in UI.
- Remove user: delete Clerk user; run `UserDeletionService` for local cleanup.

### API Surface (Backend)
- POST `/admin/internal-users/invitations`
  - AuthZ: super-admin only
  - Body: { email, role }
  - Action: create Clerk invitation (with public_metadata), store local invitation, send custom email
- POST `/admin/internal-users/invitations/:id/resend`
  - AuthZ: super-admin only
  - Action: create a new Clerk invitation for same email/role, update local record, send custom email
- POST `/admin/internal-users/invitations/:id/revoke`
  - AuthZ: super-admin only
  - Action: revoke on Clerk, update local record
- GET `/admin/internal-users`
  - AuthZ: super-admin only
  - Returns: [{ name, imageUrl, phoneNumber, email, role, status }], combining:
    - Local users table (active/inactive)
    - Local/internal invitations (pending)
- POST `/admin/internal-users/:clerkUserId/deactivate`
  - AuthZ: super-admin only
  - Action: disable Clerk user
- DELETE `/admin/internal-users/:clerkUserId`
  - AuthZ: super-admin only
  - Action: delete Clerk user, run local deletion service

### Clerk Configuration
- Ensure backend has `CLERK_SECRET_KEY` and uses server-side `clerkClient` for invitations/users
- Disable Clerk’s invitation emails (or simply ignore them) and rely on custom email service
- Add webhook endpoint (already present) in Clerk dashboard with signing secret

### Role & Authorization Strategy
- Source of truth: Clerk `public_metadata.role`
- Mirror on user creation into local `users.role`
- Backend guards use local role for quick checks, optionally revalidating from Clerk when escalating privileges
- Define an authorization utility/middleware:
  - `requireRole("super-admin")`
  - `requireAnyRole(["super-admin", "admin"])`

### Email Strategy (Custom)
- After creating Clerk invitation, backend sends a custom email with CTA link to `FRONTEND_URL/internal/accept-invite` (no Clerk template)
- The link should include the `invitation.id` for analytics/tracking (optional) — the Clerk ticket will be appended by Clerk automatically to the redirect URL

### Frontend Accept Page Contract
- Route: `/internal/accept-invite`
- Reads `__clerk_ticket` from URL
- Collects: password, firstName, lastName, phoneNumber
- Calls Clerk SignUp with ticket strategy
- On success: redirect to internal dashboard; backend will pick up user.created webhook and persist data

### Status Mapping Details
- Pending: invitation exists, not accepted; no Clerk user yet
- Active: Clerk user exists and is enabled
- Inactive: Clerk user exists but `disabled: true`

### Security & Audit Notes
- Validate role transitions: only super-admin can assign super-admin role
- Store who invited whom (`invitedByUserId`) for audit
- Log all admin actions with requestId
- Rate-limit invite endpoints
- Avoid accepting roles from the client; enforce roles only in backend–>Clerk calls

### Open Questions for You
1) Should we implement Option B (`internal_invitations` table) for better admin UX and analytics?
2) Should internal users skip the phone OTP flow entirely, or only skip during onboarding and allow later verification?
3) Confirm we should disable Clerk’s built-in invitation emails entirely and only send custom emails.
4) For “inactive”, do you prefer Clerk user disabled or a local soft-delete flag, or both?
5) Any additional internal fields to collect at accept (e.g., position) beyond first/last/phone/password?


