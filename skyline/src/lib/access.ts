export type AccountAccess = {
  role: string;
  approvalStatus: string;
  emailVerifiedAt: Date | null;
  disabledAt: Date | null;
};
export function hasClubAccess(
  user: AccountAccess | null | undefined,
  roles: readonly string[] = ["MEMBER", "STAFF", "TREASURER"],
): user is AccountAccess {
  return (
    !!user &&
    !!user.emailVerifiedAt &&
    !user.disabledAt &&
    user.approvalStatus === "APPROVED" &&
    roles.includes(user.role)
  );
}
