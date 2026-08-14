import { requireAdmin } from "@/lib/server/admin-auth";

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  return Response.json({
    id: result.auth.user.id,
    role: result.auth.profile.role,
    plan: result.auth.profile.plan,
  });
}
