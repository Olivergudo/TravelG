import { z } from "zod";
import { authenticatedSupabase } from "@/lib/server/authenticated-supabase";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function POST(request: Request) {
  const auth = await authenticatedSupabase(request);
  if (!auth) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Suscripción inválida." }, { status: 400 });
  const { error } = await auth.client.from("push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return Response.json({ error: "No pudimos guardar la suscripción." }, { status: 500 });
  return Response.json({ ok: true });
}
