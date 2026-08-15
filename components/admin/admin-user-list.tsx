"use client";

import { LoaderCircle, Search, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminService, type AdminUser } from "@/lib/admin/admin-service";
import { AdminUserRow } from "./admin-user-row";
import { ChangePlanDialog } from "./change-plan-dialog";

export function AdminUserList() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminUser>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = await AdminService.searchUsers(search.trim());
        if (!controller.signal.aborted) setUsers(result.users);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "No pudimos buscar.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, search.trim() ? 350 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search]);
  const change = async () => {
    if (!selected) return;
    const next = selected.plan === "pro" ? "basic" : "pro";
    try {
      await AdminService.changePlan(selected.id, next);
      setUsers((current) =>
        current.map((user) =>
          user.id === selected.id
            ? { ...user, plan: next, proExpiresAt: null }
            : user,
        ),
      );
      setSelected(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos cambiar el plan.",
      );
    }
  };
  return (
    <>
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]"
          size={20}
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar usuario…"
          aria-label="Buscar por correo o nombre"
          className="theme-card min-h-14 w-full rounded-2xl border border-black/[.06] bg-white pl-12 pr-4 outline-none focus:border-[#176b46]"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-[#718078]">
            <LoaderCircle className="animate-spin" />
            Buscando…
          </p>
        ) : (
          users.map((user) => (
            <AdminUserRow key={user.id} user={user} change={setSelected} />
          ))
        )}
      </div>
      {!loading && !users.length && !error && (
        <div className="py-10 text-center text-[#718078]">
          <Users className="mx-auto mb-2" />
          <p>No encontramos usuarios.</p>
        </div>
      )}
      {selected && (
        <ChangePlanDialog
          user={selected}
          close={() => setSelected(undefined)}
          confirm={change}
        />
      )}
    </>
  );
}
