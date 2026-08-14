"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, LoaderCircle, LogIn, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AccountAccess({ onAccountChanged }: { onAccountChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"link" | "login">("link");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const isAnonymous = user?.is_anonymous !== false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setError("");
    setSent(false);

    const redirectTo = window.location.origin;
    const result = mode === "link"
      ? await supabase.auth.updateUser(
          { email: email.trim() },
          { emailRedirectTo: redirectTo },
        )
      : await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });

    setSending(false);
    if (result.error) {
      const manualLinking = result.error.message.toLowerCase().includes("manual")
        ? "Activa Manual Linking en Supabase → Authentication → Settings y vuelve a intentarlo."
        : result.error.message;
      setError(manualLinking);
      return;
    }
    setSent(true);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
    onAccountChanged();
  }

  if (!supabase) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Cuenta y sincronización" className="theme-card grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#176b46] shadow-sm">
        {isAnonymous ? <ShieldCheck size={21} /> : <UserRound size={21} />}
      </button>
      {open && <div className="fixed inset-0 z-[80] grid items-end bg-black/45 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <section className="theme-card sheet mx-auto w-full max-w-md rounded-t-[30px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px]">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Tu cuenta</p><h2 className="mt-1 text-2xl font-bold">Sincroniza tus datos</h2></div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]"><X size={20}/></button>
          </div>

          {!isAnonymous ? <div className="space-y-4">
            <div className="rounded-2xl bg-[#e5f3ea] p-4"><div className="flex items-center gap-2 font-bold text-[#176b46]"><CheckCircle2 size={20}/> Cuenta protegida</div><p className="mt-2 break-all text-sm">{user?.email}</p><p className="mt-1 text-sm text-[#587067]">Puedes usar este correo para abrir tus datos en otro dispositivo.</p></div>
            <button onClick={signOut} className="min-h-12 w-full rounded-2xl border border-black/10 font-semibold">Cerrar sesión</button>
          </div> : <>
            <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#f1f4f2] p-1">
              <button onClick={() => { setMode("link"); setSent(false); setError(""); }} className={`min-h-11 rounded-xl px-2 text-sm font-bold ${mode === "link" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}>Vincular mis datos</button>
              <button onClick={() => { setMode("login"); setSent(false); setError(""); }} className={`min-h-11 rounded-xl px-2 text-sm font-bold ${mode === "login" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}>Ya tengo cuenta</button>
            </div>
            <p className="mb-4 text-sm text-[#587067]">{mode === "link" ? "Conservaremos toda la información de este dispositivo y la vincularemos a tu correo." : "Te enviaremos un enlace para abrir la información que ya vinculaste a este correo."}</p>
            {sent ? <div className="rounded-2xl bg-[#e5f3ea] p-4 text-sm"><div className="flex items-center gap-2 font-bold text-[#176b46]"><Mail size={19}/> Revisa tu correo</div><p className="mt-2">Abre el enlace que enviamos a <b>{email}</b>. Puedes volver a esta pantalla después de confirmarlo.</p></div> : <form onSubmit={submit} className="space-y-3">
              <label className="block text-sm font-bold" htmlFor="account-email">Correo electrónico</label>
              <input id="account-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/>
              {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <button disabled={sending} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : mode === "link" ? <ShieldCheck size={20}/> : <LogIn size={20}/>} {sending ? "Enviando…" : mode === "link" ? "Proteger mis datos" : "Enviar enlace de acceso"}</button>
            </form>}
          </>}
        </section>
      </div>}
    </>
  );
}
