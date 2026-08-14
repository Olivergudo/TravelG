"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { AdminUser } from "@/lib/admin/admin-service";

export function ChangePlanDialog({
  user,
  close,
  confirm,
}: {
  user: AdminUser;
  close: () => void;
  confirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const next = user.plan === "pro" ? "Basic" : "Pro";
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-md rounded-t-[28px] bg-white p-5 safe-bottom sm:rounded-[28px]">
        <h2 className="text-xl font-bold">¿Cambiar a {next}?</h2>
        <p className="mt-2 text-sm text-[#587067]">
          {user.plan === "basic"
            ? `${user.displayName || user.email || "Este usuario"} tendrá acceso a Refrigerador, escáner de productos y recetas con IA.`
            : "Perderá acceso a las funciones Pro. Sus datos no serán eliminados."}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            disabled={saving}
            onClick={close}
            className="min-h-12 rounded-xl border border-black/10 font-semibold"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await confirm().finally(() => setSaving(false));
            }}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#176b46] font-semibold text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle className="animate-spin" size={18} />}
            Confirmar
          </button>
        </div>
      </section>
    </div>
  );
}
