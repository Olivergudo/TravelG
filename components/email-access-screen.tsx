"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Mail, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function EmailAccessScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setSending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="theme-root mx-auto grid min-h-dvh w-full max-w-2xl place-items-center bg-[#f3f6f3] px-5 py-10">
      <section className="theme-card w-full max-w-md rounded-[30px] bg-white p-6 shadow-[0_16px_50px_rgba(23,61,45,.1)]">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-[#e5f3ea] text-[#176b46]"><WalletCards size={31}/></div>
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Gasto Listo</p><h1 className="mt-2 text-3xl font-bold tracking-[-.03em]">Tus finanzas, siempre contigo</h1><p className="mt-3 text-sm text-[#587067]">Ingresa tu correo para crear una cuenta o abrir tus datos en este dispositivo.</p></div>
        {sent ? <div className="mt-6 rounded-2xl bg-[#e5f3ea] p-4 text-sm"><div className="flex items-center gap-2 font-bold text-[#176b46]"><Mail size={19}/> Revisa tu correo</div><p className="mt-2">Enviamos un enlace de acceso a <b>{email}</b>. Ábrelo para continuar.</p><button onClick={() => setSent(false)} className="mt-3 font-bold text-[#176b46]">Usar otro correo</button></div> : <form onSubmit={submit} className="mt-6 space-y-3">
          <label htmlFor="access-email" className="block text-sm font-bold">Correo electrónico</label>
          <input id="access-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={sending} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : <Mail size={20}/>} {sending ? "Enviando…" : "Continuar con correo"}</button>
        </form>}
        <p className="mt-5 text-center text-xs text-[#718078]">No necesitas contraseña. Te enviaremos un enlace seguro.</p>
      </section>
    </main>
  );
}

export function AnonymousLinkScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setError("");
    const { error: linkError } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: window.location.origin },
    );
    setSending(false);
    if (linkError) {
      setError(linkError.message.toLowerCase().includes("manual")
        ? "Activa Manual Linking en la configuración de Authentication de Supabase."
        : linkError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="theme-root mx-auto grid min-h-dvh w-full max-w-2xl place-items-center bg-[#f3f6f3] px-5 py-10">
      <section className="theme-card w-full max-w-md rounded-[30px] bg-white p-6 shadow-[0_16px_50px_rgba(23,61,45,.1)]">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-[#e5f3ea] text-[#176b46]"><WalletCards size={31}/></div>
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Protege tu información</p><h1 className="mt-2 text-3xl font-bold tracking-[-.03em]">Vincula tu cuenta</h1><p className="mt-3 text-sm text-[#587067]">Ya tienes información guardada. Vincúlala a tu correo para conservarla y abrirla desde cualquier dispositivo.</p></div>
        {sent ? <div className="mt-6 rounded-2xl bg-[#e5f3ea] p-4 text-sm"><div className="flex items-center gap-2 font-bold text-[#176b46]"><Mail size={19}/> Confirma tu correo</div><p className="mt-2">Enviamos un enlace a <b>{email}</b>. Debes abrirlo para entrar a la app; tus datos permanecerán guardados.</p><button onClick={() => setSent(false)} className="mt-3 font-bold text-[#176b46]">Cambiar correo</button></div> : <form onSubmit={submit} className="mt-6 space-y-3">
          <label htmlFor="link-email" className="block text-sm font-bold">Correo electrónico</label>
          <input id="link-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={sending} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : <Mail size={20}/>} {sending ? "Enviando…" : "Vincular y continuar"}</button>
        </form>}
        <p className="mt-5 text-center text-xs text-[#718078]">Este paso se realiza una sola vez. No perderás tus gastos ni compras.</p>
      </section>
    </main>
  );
}
