import { requireAdmin } from "@/lib/server/admin-auth";
import { serviceSupabase } from "@/lib/server/authenticated-supabase";

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const search =
    new URL(request.url).searchParams.get("search")?.trim().slice(0, 100) || "";
  if (search.length < 2) return Response.json({ users: [] });
  const admin = serviceSupabase();
  if (!admin)
    return Response.json(
      { error: "Falta configuración segura del servidor." },
      { status: 503 },
    );
  const safe = search
    .replace(/[,()%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (safe.length < 2) return Response.json({ users: [] });
  const { data, error } = await admin
    .from("profiles")
    .select("id,email,display_name,role,plan,pro_expires_at,created_at")
    .or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error)
    return Response.json(
      { error: "No pudimos buscar usuarios." },
      { status: 500 },
    );
  return Response.json({
    users: (data || []).map((profile) => ({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      plan: profile.plan,
      proExpiresAt: profile.pro_expires_at,
      createdAt: profile.created_at,
    })),
  });
}
