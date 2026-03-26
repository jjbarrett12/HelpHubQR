/** Maps hh_tenant_accept_invite JSON `error` codes to user-facing copy (no secrets). */
export function formatTenantInviteAcceptError(code: string | undefined): string {
  switch (code) {
    case "NOT_AUTHENTICATED":
      return "Sign in with the email address the invite was sent to, then try again.";
    case "INVITE_NOT_FOUND":
      return "That invite code is not valid. Check for typos or ask for a new invite.";
    case "INVITE_NOT_PENDING":
      return "This invite was already used or cancelled.";
    case "INVITE_EXPIRED":
      return "This invite has expired. Ask an admin to send a new one.";
    case "EMAIL_MISMATCH":
      return "You are signed in with a different email than the invite. Sign out and sign in with the invited address.";
    default:
      return "Could not accept the invite. Try again or contact support.";
  }
}
