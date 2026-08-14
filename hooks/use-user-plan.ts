"use client";

import { useEffect, useState } from "react";
import type { Plan, UserEntitlements } from "@/lib/features/plans";
import { supabase } from "@/lib/supabase";

export function useUserPlan(userId?: string) {
  const [plan, setPlan] = useState<Plan>("basic");
  const [proExpiresAt, setProExpiresAt] = useState<string | null>(null);
  const [ready, setReady] = useState(!userId);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    supabase.from("profiles").select("plan,pro_expires_at").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setPlan(data?.plan === "pro" ? "pro" : "basic");
        setProExpiresAt(data?.pro_expires_at ?? null);
        setReady(true);
      });
    return () => { active = false; };
  }, [userId]);

  const user: UserEntitlements | null = userId ? { id: userId, plan, proExpiresAt } : null;
  return { user, plan, ready };
}
