// Who is allowed to be what.
//
// Privileged roles are derived from the EMAIL, never from what the client sends.
// Registration used to accept `role` straight off the request body, which meant
// anyone could sign up as an admin — so the rule now is: the server decides.
//
//   development@evprod.com   super_admin — owns the platform
//   *@mymymy.studio          manager     — runs work, assigns members
//   anyone else              the role they picked, from PUBLIC_ROLES only
//
// Managers are production staff: they can staff a stop and hand jobs to members
// the way a production coordinator hands work to a PA.

// Us. These accounts are admin, full stop — and they flip between the admin
// side and the general side with a switch, on the same login.
export const SUPER_ADMINS = (process.env.SUPER_ADMIN_EMAILS ||
  "benjamineasterday@gmail.com,development@evprod.com,ben@evprod.com," +
  "dewsterdad197107@gmail.com,bassdew55@hotmail.com")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export const MANAGER_DOMAINS = (process.env.MANAGER_DOMAINS || "mymymy.studio")
  .split(",").map(s => s.trim().toLowerCase().replace(/^@/, "")).filter(Boolean);

/** Roles a person may choose for themselves at signup. */
export const PUBLIC_ROLES = ["band", "venue", "sponsor", "pro", "fan"] as const;

/** Roles that can only ever be granted by the server. */
export const PRIVILEGED_ROLES = ["super_admin", "manager", "admin", "operator", "member"] as const;

export type Role = string;

export function domainOf(email: string): string {
  return String(email || "").toLowerCase().split("@")[1] || "";
}

/** The role this email is entitled to regardless of what it asked for. */
export function grantedRole(email: string): Role | null {
  const e = String(email || "").toLowerCase().trim();
  if (!e) return null;
  if (SUPER_ADMINS.includes(e)) return "super_admin";
  if (MANAGER_DOMAINS.includes(domainOf(e))) return "manager";
  return null;
}

/**
 * Decide the role to actually store. A granted role always wins; otherwise the
 * request is honoured only if it is a public role.
 *
 * `current` is the role the account already has — passing it means a returning
 * user is never silently demoted by signing in again or redeeming an invite.
 */
export function resolveRole(email: string, requested?: string, current?: string): Role {
  const granted = grantedRole(email);
  if (granted) return granted;
  const cur = String(current || "").toLowerCase();
  if (cur && (PRIVILEGED_ROLES as readonly string[]).includes(cur)) return cur; // never downgrade
  const r = String(requested || "").toLowerCase();
  return (PUBLIC_ROLES as readonly string[]).includes(r) ? r : (cur || "fan");
}

export const isSuperAdmin = (u: any) => String(u?.role) === "super_admin";
export const isManager = (u: any) => ["super_admin", "manager"].includes(String(u?.role));

/** Can staff stops, assign members, and see the operator console. */
export const canAssign = (u: any) => isManager(u);

/** Everything behind the curtain: admin console + backend consoles. */
export const isOperator = (u: any) =>
  ["super_admin", "manager", "admin", "operator"].includes(String(u?.role));

/**
 * Who has any business in mymymy.
 *
 * mymymy is the catalog: works, ISWC, splits, royalties, the Deck and the radio
 * stations. That is rights-holder territory — bands, and the pros who record
 * and release for them. Fans, host sites and sponsors own nothing in there, so
 * they are never shown a door to it.
 *
 * This matters beyond tidiness. mymymy's /sso auto-provisions an account for
 * whoever arrives with a valid token, so every fan shown that link is a stray
 * rights-holder account waiting to happen. Not showing the door is what
 * actually prevents it.
 */
export const MYMYMY_ROLES = ["band", "pro"] as const;

/**
 * Follows the ACTIVE PROFILE, not the person.
 *
 * The same login can be an artist and run two businesses. Wearing the EVPROD
 * sponsor hat, there is nothing in the catalog to reach and no reason to see a
 * door to it; switch to the artist and there is. Keying this off the person
 * would light it up permanently for anyone who is a band in any capacity.
 *
 * `profileKind` is the active profile's kind when there is one. With no
 * profiles at all we fall back to the account role, which is what a brand-new
 * signup has.
 */
export const usesMymymy = (u: any, profileKind?: string | null) => {
  if (!u) return false;
  if (isOperator(u)) return true;
  const kind = String(profileKind || "").trim();
  if (kind) return (MYMYMY_ROLES as readonly string[]).includes(kind);
  return (MYMYMY_ROLES as readonly string[]).includes(String(u?.role));
};
