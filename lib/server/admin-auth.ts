import { canAccessAdmin } from "@/lib/auth/permissions";
import { authenticatedSupabase } from "./authenticated-supabase";

export async function requireAdmin(request: Request) {
  const auth = await authenticatedSupabase(request);
  if (!auth)
    return {
      error: Response.json({ error: "Debes iniciar sesión." }, { status: 401 }),
    } as const;
  if (!canAccessAdmin(auth.profile))
    return {
      error: Response.json(
        { error: "No tienes permisos para acceder." },
        { status: 403 },
      ),
    } as const;
  return { auth } as const;
}
