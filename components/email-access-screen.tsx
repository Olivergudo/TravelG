"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, LockKeyhole, WalletCards } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { IosPwaInstallGuide } from "./ios-pwa-install-guide";

type AccessMode = "signup" | "login";

export function EmailAccessScreen() {
  const [mode, setMode] = useState<AccessMode>("signup");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || password.length < 8) return;
    setSending(true);
    setError("");

    const result = mode === "signup"
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setSending(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (!result.data.session) {
      setError("Supabase todavía exige confirmar el correo. Desactiva Confirm email y vuelve a intentarlo.");
    }
  }

  async function requestRecovery(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setError("");
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/?recovery=1`,
    });
    setSending(false);
    if (recoveryError) {
      setError(recoveryError.message);
      return;
    }
    setRecoverySent(true);
  }

  if (forgotPassword) return <AccessCard title="Recupera tu contraseña" description="Te enviaremos un enlace seguro para crear una contraseña nueva.">
    {recoverySent ? <div className="mt-6 rounded-2xl bg-[#e5f3ea] p-4 text-sm"><b className="text-[#176b46]">Revisa tu correo</b><p className="mt-2">Enviamos el enlace de recuperación a <b>{email}</b>.</p></div> : <form onSubmit={requestRecovery} className="mt-6 space-y-3"><label htmlFor="recovery-email" className="block text-sm font-bold">Correo electrónico</label><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={sending} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : <LockKeyhole size={20}/>} {sending ? "Enviando…" : "Enviar enlace de recuperación"}</button></form>}
    <button onClick={() => { setForgotPassword(false); setRecoverySent(false); setError(""); }} className="mt-3 min-h-12 w-full text-sm font-bold text-[#176b46]">Volver a iniciar sesión</button>
  </AccessCard>;

  return (
    <AccessCard title="Tus finanzas, siempre contigo" description="Crea una cuenta o inicia sesión para abrir tus datos en cualquier dispositivo.">
      {mode === "signup" && <IosPwaInstallGuide />}
      <ModeTabs mode={mode} setMode={(next) => { setMode(next); setError(""); }} />
      <form onSubmit={submit} className="mt-5 space-y-3">
        <Credentials email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{friendlyError(error)}</p>}
        <button disabled={sending || password.length < 8} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : <LockKeyhole size={20}/>} {sending ? "Procesando…" : mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}</button>
        {mode === "login" && <button type="button" onClick={() => { setForgotPassword(true); setError(""); }} className="min-h-11 w-full text-sm font-bold text-[#176b46]">Olvidé mi contraseña</button>}
      </form>
      <p className="mt-5 text-center text-xs text-[#718078]">La sesión quedará guardada en este dispositivo.</p>
    </AccessCard>
  );
}

export function UpdatePasswordScreen({ completed }: { completed: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || password.length < 8) return;
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    window.history.replaceState({}, "", window.location.pathname);
    completed();
  }

  return <AccessCard title="Crea una contraseña nueva" description="Elige una contraseña de al menos 8 caracteres para recuperar tu cuenta."><form onSubmit={updatePassword} className="mt-6 space-y-3"><label htmlFor="new-password" className="block text-sm font-bold">Nueva contraseña</label><input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/><label htmlFor="confirm-password" className="block text-sm font-bold">Repite la contraseña</label><input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={saving || password.length < 8 || confirmation.length < 8} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={20}/> : <LockKeyhole size={20}/>} {saving ? "Guardando…" : "Guardar contraseña"}</button></form></AccessCard>;
}

export function AnonymousLinkScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || password.length < 8) return;
    setSending(true);
    setError("");
    const { data: linkData, error: linkError } = await supabase.auth.updateUser({
      email: email.trim(),
      password,
    });
    setSending(false);
    if (linkError) {
      setError(linkError.message);
      return;
    }
    if (linkData.user.is_anonymous) {
      setError("Supabase todavía exige confirmar el correo. Desactiva Confirm email y vuelve a intentarlo.");
      return;
    }
    await supabase.auth.refreshSession();
  }

  return (
    <AccessCard title="Protege tus datos actuales" description="Vincula la información de esta PWA a un correo y una contraseña. No cambiaremos tu usuario ni borraremos tus datos.">
      <form onSubmit={submit} className="mt-6 space-y-3">
        <Credentials email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{friendlyError(error)}</p>}
        <button disabled={sending || password.length < 8} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60">{sending ? <LoaderCircle className="animate-spin" size={20}/> : <LockKeyhole size={20}/>} {sending ? "Vinculando…" : "Vincular y continuar"}</button>
      </form>
      <p className="mt-5 text-center text-xs text-[#718078]">Este paso se realiza una sola vez.</p>
    </AccessCard>
  );
}

function AccessCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="theme-root mx-auto grid min-h-dvh w-full max-w-2xl place-items-center bg-[#f3f6f3] px-5 py-10"><section className="theme-card w-full max-w-md rounded-[30px] bg-white p-6 shadow-[0_16px_50px_rgba(23,61,45,.1)]"><div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-[22px] bg-[#e5f3ea] text-[#176b46]"><WalletCards size={31}/></div><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#718078]">Gasto Listo</p><h1 className="mt-2 text-3xl font-bold tracking-[-.03em]">{title}</h1><p className="mt-3 text-sm text-[#587067]">{description}</p></div>{children}</section></main>;
}

function ModeTabs({ mode, setMode }: { mode: AccessMode; setMode: (mode: AccessMode) => void }) {
  return <div className="mt-6 grid grid-cols-2 rounded-2xl bg-[#f1f4f2] p-1"><button onClick={() => setMode("signup")} className={`min-h-11 rounded-xl text-sm font-bold ${mode === "signup" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}>Crear cuenta</button><button onClick={() => setMode("login")} className={`min-h-11 rounded-xl text-sm font-bold ${mode === "login" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}>Iniciar sesión</button></div>;
}

function Credentials({ email, password, setEmail, setPassword }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void }) {
  return <><label htmlFor="access-email" className="block text-sm font-bold">Correo electrónico</label><input id="access-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/><label htmlFor="access-password" className="block text-sm font-bold">Contraseña</label><input id="access-password" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"/></>;
}

function friendlyError(message: string) {
  if (message.toLowerCase().includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (message.toLowerCase().includes("already registered")) return "Este correo ya está registrado. Usa Iniciar sesión.";
  return message;
}
