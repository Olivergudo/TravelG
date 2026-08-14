"use client";

import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AdminService } from "@/lib/admin/admin-service";
import { AdminUserList } from "@/components/admin/admin-user-list";

export default function AdminPage() {
  const router = useRouter();
  const dark = useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
  const [state, setState] = useState<"loading" | "allowed" | "denied">(
    "loading",
  );
  useEffect(() => {
    AdminService.me()
      .then(() => setState("allowed"))
      .catch((error: { status?: number }) => {
        if (error.status === 401) router.replace("/");
        else setState("denied");
      });
  }, [router]);
  if (state === "loading")
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f3f6f3] text-[#718078]">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  if (state === "denied")
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f3f6f3] p-5">
        <section className="theme-card max-w-sm rounded-[26px] bg-white p-7 text-center">
          <ShieldCheck className="mx-auto text-[#718078]" size={40} />
          <h1 className="mt-3 text-xl font-bold">
            No tienes permisos para acceder
          </h1>
          <button
            onClick={() => router.push("/")}
            className="mt-5 min-h-12 w-full rounded-xl bg-[#176b46] font-semibold text-white"
          >
            Volver a la app
          </button>
        </section>
      </main>
    );
  return (
    <main
      data-theme={dark ? "dark" : "light"}
      className="theme-root mx-auto min-h-dvh w-full max-w-2xl bg-[#f3f6f3] px-4 pb-10"
    >
      <header className="pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
        <button
          onClick={() => router.push("/")}
          className="mb-5 flex min-h-11 items-center gap-2 text-sm font-semibold text-[#176b46]"
        >
          <ArrowLeft size={19} />
          Volver
        </button>
        <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#176b46]">
          Gasto Listo
        </p>
        <h1 className="mt-1 text-[30px] font-bold">Administración</h1>
        <p className="mt-1 text-sm text-[#718078]">Usuarios y planes</p>
      </header>
      <AdminUserList />
    </main>
  );
}
