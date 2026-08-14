"use client";

import { supabase } from "@/lib/supabase";
import type { UserPlan, UserRole } from "@/lib/auth/permissions";

export type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  plan: UserPlan;
  proExpiresAt: string | null;
  createdAt: string;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const requestHeaders = new Headers(init?.headers);
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
  });
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(body.error || "Ocurrió un error."), {
      status: response.status,
    });
  return body as T;
}

export const AdminService = {
  me: () =>
    request<{ id: string; role: UserRole; plan: UserPlan }>("/api/admin/me"),
  searchUsers: (search: string) =>
    request<{ users: AdminUser[] }>(
      `/api/admin/users?search=${encodeURIComponent(search)}`,
    ),
  changePlan: (userId: string, plan: UserPlan) =>
    request<{ id: string; plan: UserPlan }>(
      `/api/admin/users/${encodeURIComponent(userId)}/plan`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      },
    ),
};
