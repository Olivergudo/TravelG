import { z } from "zod";
import { authenticatedSupabase, serviceSupabase } from "@/lib/server/authenticated-supabase";
import { pushClient } from "@/lib/server/roomies-push";

const bodySchema = z.object({ messageId: z.string().uuid() });

type Metadata = Record<string, unknown>;

export async function POST(request: Request) {
  const auth = await authenticatedSupabase(request);
  if (!auth) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Evento inválido." }, { status: 400 });
  const { data: message, error } = await auth.client
    .from("household_messages")
    .select("id,household_id,user_id,type,metadata")
    .eq("id", parsed.data.messageId)
    .single();
  if (error || !message || message.user_id !== auth.user.id)
    return Response.json({ error: "Evento no disponible." }, { status: 403 });
  const webpush = pushClient();
  const service = serviceSupabase();
  if (!webpush || !service) return Response.json({ ok: true, delivered: 0 });
  const { data: members } = await service
    .from("household_members")
    .select("user_id,display_name")
    .eq("household_id", message.household_id);
  const names = new Map((members || []).map((member) => [member.user_id, member.display_name]));
  const actor = names.get(message.user_id) || "Un roomie";
  const metadata = (message.metadata || {}) as Metadata;
  const product = String(metadata.productName || "un producto");
  let recipients: string[] = [];
  let title = "Roomies";
  let body = "Tienes una actualización en tu hogar.";
  let url = "/?tab=roomies&view=chat";
  if (message.type === "product_request") {
    recipients = (members || []).map((member) => member.user_id).filter((id) => id !== message.user_id);
    title = `🔎 ${actor} pregunta`;
    body = `¿Alguien tiene ${product}?`;
  } else if (message.type === "product_taken") {
    recipients = metadata.ownerUserId ? [String(metadata.ownerUserId)] : [];
    title = `🥛 ${actor} tomó tu ${product}`;
    body = metadata.needsReplacement ? "Indicó que debe reponerlo." : "No requiere reposición.";
    url = "/?tab=roomies&view=pending";
  } else if (message.type === "replacement_reported") {
    recipients = metadata.ownerUserId ? [String(metadata.ownerUserId)] : [];
    title = `✅ ${actor} dice que ya repuso ${product}`;
    body = "Toca para confirmar.";
    url = `/?tab=roomies&view=pending&id=${metadata.debtId || ""}`;
  } else if (message.type === "replacement_confirmed") {
    recipients = metadata.debtorUserId ? [String(metadata.debtorUserId)] : [];
    title = `✅ ${actor} confirmó la reposición`;
    body = product;
    url = "/?tab=roomies&view=resolved";
  } else if (message.type === "group_expense_created") {
    const expenseId = String(metadata.expenseId || "");
    const { data: shares } = await service.from("group_expense_shares").select("user_id").eq("expense_id", expenseId);
    recipients = (shares || []).map((share) => share.user_id);
    title = `💸 ${actor} agregó una cuenta`;
    body = String(metadata.concept || "Gasto grupal");
    url = "/?tab=roomies&view=pending";
  } else if (message.type === "group_expense_payment_reported") {
    const expenseId = String(metadata.expenseId || "");
    const { data: expense } = await service.from("group_expenses").select("payer_id").eq("id", expenseId).single();
    recipients = expense?.payer_id ? [expense.payer_id] : [];
    title = `⏳ ${actor} reportó un pago`;
    body = String(metadata.concept || "Gasto grupal");
    url = "/?tab=roomies&view=pending";
  } else if (message.type === "group_expense_payment_confirmed") {
    recipients = metadata.participantUserId ? [String(metadata.participantUserId)] : [];
    title = `✅ ${actor} confirmó tu pago`;
    body = String(metadata.concept || "Gasto grupal");
    url = "/?tab=roomies&view=resolved";
  } else {
    return Response.json({ ok: true, delivered: 0 });
  }
  recipients = [...new Set(recipients)].filter((id) => id !== auth.user.id);
  if (!recipients.length) return Response.json({ ok: true, delivered: 0 });
  const { data: subscriptions } = await service
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth_key")
    .in("user_id", recipients);
  const expired: string[] = [];
  const payload = JSON.stringify({ title, body, url, tag: `roomies-${message.id}` });
  const results = await Promise.allSettled(
    (subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          payload,
        );
      } catch (pushError) {
        const statusCode = (pushError as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) expired.push(subscription.id);
        else throw pushError;
      }
    }),
  );
  if (expired.length) await service.from("push_subscriptions").delete().in("id", expired);
  return Response.json({ ok: true, delivered: results.filter((result) => result.status === "fulfilled").length });
}
