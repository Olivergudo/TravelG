"use client";

import type { AdminUser } from "@/lib/admin/admin-service";

export function AdminUserRow({
  user,
  change,
}: {
  user: AdminUser;
  change: (user: AdminUser) => void;
}) {
  const admin = user.role === "admin";
  return (
    <article className="theme-card flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {user.displayName || user.email?.split("@")[0] || "Usuario"}
        </p>
        <p className="truncate text-sm text-[#718078]">
          {user.email || "Sin correo"}
        </p>
        <div className="mt-2 flex gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${user.plan === "pro" ? "bg-[#e5f3ea] text-[#176b46]" : "bg-[#edf0ee] text-[#65736c]"}`}
          >
            {user.plan.toUpperCase()}
          </span>
          {admin && (
            <span className="rounded-full bg-[#173d2d] px-2.5 py-1 text-[11px] font-bold text-white">
              ADMIN
            </span>
          )}
        </div>
      </div>
      <button
        disabled={admin}
        onClick={() => change(user)}
        className="min-h-11 shrink-0 rounded-xl border border-[#176b46] px-3 text-sm font-bold text-[#176b46] disabled:border-black/10 disabled:text-[#91a098]"
      >
        {admin
          ? "Protegido"
          : user.plan === "pro"
            ? "Pasar a Basic"
            : "Pasar a Pro"}
      </button>
    </article>
  );
}
