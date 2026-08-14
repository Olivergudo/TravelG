import { supabase } from "@/lib/supabase";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

async function authorizationHeaders() {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Debes iniciar sesión.");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function enableRoomieNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error("Este navegador no admite notificaciones push.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Falta configurar las notificaciones.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("No se concedió permiso para notificaciones.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(publicKey),
  });
  const response = await fetch("/api/roomies/push-subscriptions", {
    method: "POST",
    headers: await authorizationHeaders(),
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error("No pudimos activar las notificaciones.");
}

export async function notifyRoomieEvent(messageId: string) {
  try {
    await fetch("/api/roomies/notify", {
      method: "POST",
      headers: await authorizationHeaders(),
      body: JSON.stringify({ messageId }),
    });
  } catch {
    // El evento ya quedó guardado; una falla de push no debe revertirlo.
  }
}
