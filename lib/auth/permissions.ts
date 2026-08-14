export type UserRole = "user" | "admin";
export type UserPlan = "basic" | "pro";

export type ProfilePermissions = {
  role: UserRole;
  plan: UserPlan;
  proExpiresAt?: string | null;
};

export function isAdmin(
  profile: Pick<ProfilePermissions, "role"> | null | undefined,
) {
  return profile?.role === "admin";
}

export const canAccessAdmin = isAdmin;
