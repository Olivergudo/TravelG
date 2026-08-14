import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { serviceSupabase } from "@/lib/server/authenticated-supabase";

const payloadSchema = z.object({ plan: z.enum(["basic", "pro"]) }).strict();
const uuidSchema = z.string().uuid();

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const result = await requireAdmin(request);
  if ("error" in result) return result.error;
  const userId = uuidSchema.safeParse((await context.params).userId);
  const payload = payloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!userId.success || !payload.success)
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const admin = serviceSupabase();
  if (!admin)
    return Response.json(
      { error: "Falta configuración segura del servidor." },
      { status: 503 },
    );
  const { data: target, error: readError } = await admin
    .from("profiles")
    .select("id,role,plan")
    .eq("id", userId.data)
    .maybeSingle();
  if (readError || !target)
    return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
  if (target.role === "admin")
    return Response.json(
      { error: "El plan de un administrador no puede cambiarse aquí." },
      { status: 409 },
    );
  if (target.plan === payload.data.plan)
    return Response.json({ id: target.id, plan: target.plan });
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ plan: payload.data.plan, pro_expires_at: null, updated_at: now })
    .eq("id", target.id);
  if (updateError)
    return Response.json(
      { error: "No pudimos cambiar el plan." },
      { status: 500 },
    );
  const { error: auditError } = await admin.from("admin_audit_logs").insert({
    admin_user_id: result.auth.user.id,
    target_user_id: target.id,
    action: "plan_changed",
    old_value: target.plan,
    new_value: payload.data.plan,
  });
  if (auditError) {
    await admin
      .from("profiles")
      .update({ plan: target.plan, updated_at: new Date().toISOString() })
      .eq("id", target.id);
    return Response.json(
      { error: "El cambio se revirtió porque no pudo auditarse." },
      { status: 500 },
    );
  }
  console.info("admin_plan_changed", {
    adminUserId: result.auth.user.id,
    targetUserId: target.id,
    oldPlan: target.plan,
    newPlan: payload.data.plan,
  });
  return Response.json({ id: target.id, plan: payload.data.plan });
}
