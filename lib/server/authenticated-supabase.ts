import { createClient } from "@supabase/supabase-js";

export async function authenticatedSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser(
    authorization.replace(/^Bearer\s+/i, ""),
  );
  if (error || !data.user) return null;
  const { data: profile } = await client
    .from("profiles")
    .select("role,plan,pro_expires_at")
    .eq("id", data.user.id)
    .maybeSingle();
  const pro =
    profile?.plan === "pro" &&
    (!profile.pro_expires_at ||
      new Date(profile.pro_expires_at).getTime() > Date.now());
  return {
    client,
    user: data.user,
    profile: {
      role: profile?.role === "admin" ? ("admin" as const) : ("user" as const),
      plan: profile?.plan === "pro" ? ("pro" as const) : ("basic" as const),
      proExpiresAt: profile?.pro_expires_at ?? null,
    },
    pro,
  };
}

export function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
