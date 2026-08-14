"use client";

import type { User } from "@supabase/supabase-js";
import {
  CheckCircle2,
  ChevronRight,
  Coins,
  LoaderCircle,
  LogIn,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserCog,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isCurrency, type Currency } from "@/lib/currency";

export function AccountAccess({
  onAccountChanged,
  admin = false,
  displayName,
  currency,
  theme,
  onPreferencesChanged,
}: {
  onAccountChanged: () => void;
  admin?: boolean;
  displayName: string;
  currency: Currency;
  theme: "light" | "dark";
  onPreferencesChanged: (user: User) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"link" | "login">("link");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [preference, setPreference] = useState<"name" | "currency" | "theme">();
  const modalOpen = open || Boolean(preference);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const scrollY = window.scrollY;
    const previous = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [modalOpen]);

  const isAnonymous = user?.is_anonymous !== false;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;
    setSending(true);
    setError("");
    setSent(false);

    const redirectTo = window.location.origin;
    const result =
      mode === "link"
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
      const manualLinking = result.error.message
        .toLowerCase()
        .includes("manual")
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

  async function updatePreference(values: Record<string, string | boolean>) {
    if (!supabase) throw new Error("Supabase no está configurado");
    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { ...user?.user_metadata, ...values },
    });
    if (updateError || !data.user) throw updateError || new Error("No pudimos guardar la preferencia");
    setUser(data.user);
    if (typeof values.theme === "string") {
      localStorage.setItem("gasto-listo-theme-last", values.theme);
      localStorage.setItem(`gasto-listo-theme:${data.user.id}`, values.theme);
    }
    onPreferencesChanged(data.user);
    return data.user;
  }

  if (!supabase) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Cuenta y sincronización"
        className="theme-card grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#176b46] shadow-sm"
      >
        {isAnonymous ? <ShieldCheck size={21} /> : <UserRound size={21} />}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] grid items-end overscroll-none bg-black/45 p-0 sm:items-center sm:p-5"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpen(false)
          }
        >
          <section className="theme-card sheet mx-auto max-h-[92dvh] w-full max-w-md overscroll-contain overflow-y-auto rounded-t-[30px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[30px]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">
                  Tu cuenta
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  Perfil y preferencias
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]"
              >
                <X size={20} />
              </button>
            </div>

            {!isAnonymous ? (
              <div>
                <div className="rounded-2xl bg-[#e5f3ea] p-4">
                  <div className="flex items-center gap-2 font-bold text-[#176b46]">
                    <CheckCircle2 size={20} /> Cuenta protegida
                  </div>
                  <p className="mt-2 break-all text-sm">{user?.email}</p>
                </div>
                <p className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Preferencias</p>
                <div className="overflow-hidden rounded-2xl border border-black/[.06]">
                  <PreferenceRow icon={<UserRound size={19}/>} label="Nombre" value={displayName || "Usuario"} action={() => setPreference("name")}/>
                  <PreferenceRow icon={<Coins size={19}/>} label="Moneda principal" value={currency} action={() => setPreference("currency")}/>
                  <PreferenceRow icon={theme === "dark" ? <Moon size={19}/> : <Sun size={19}/>} label="Apariencia" value={theme === "dark" ? "Oscuro" : "Claro"} action={() => setPreference("theme")}/>
                </div>
                {admin && (
                  <><p className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Administración</p><div className="overflow-hidden rounded-2xl border border-black/[.06]"><PreferenceRow icon={<UserCog size={19}/>} label="Administración" action={() => router.push("/admin")}/></div></>
                )}
                <p className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Sesión</p>
                <button
                  onClick={signOut}
                  className="min-h-12 w-full rounded-2xl border border-black/10 font-semibold text-[#718078]"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#f1f4f2] p-1">
                  <button
                    onClick={() => {
                      setMode("link");
                      setSent(false);
                      setError("");
                    }}
                    className={`min-h-11 rounded-xl px-2 text-sm font-bold ${mode === "link" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}
                  >
                    Vincular mis datos
                  </button>
                  <button
                    onClick={() => {
                      setMode("login");
                      setSent(false);
                      setError("");
                    }}
                    className={`min-h-11 rounded-xl px-2 text-sm font-bold ${mode === "login" ? "theme-card bg-white shadow-sm" : "text-[#718078]"}`}
                  >
                    Ya tengo cuenta
                  </button>
                </div>
                <p className="mb-4 text-sm text-[#587067]">
                  {mode === "link"
                    ? "Conservaremos toda la información de este dispositivo y la vincularemos a tu correo."
                    : "Te enviaremos un enlace para abrir la información que ya vinculaste a este correo."}
                </p>
                {sent ? (
                  <div className="rounded-2xl bg-[#e5f3ea] p-4 text-sm">
                    <div className="flex items-center gap-2 font-bold text-[#176b46]">
                      <Mail size={19} /> Revisa tu correo
                    </div>
                    <p className="mt-2">
                      Abre el enlace que enviamos a <b>{email}</b>. Puedes
                      volver a esta pantalla después de confirmarlo.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-3">
                    <label
                      className="block text-sm font-bold"
                      htmlFor="account-email"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="account-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="tu@correo.com"
                      className="theme-card min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none"
                    />
                    {error && (
                      <p
                        role="alert"
                        className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                      >
                        {error}
                      </p>
                    )}
                    <button
                      disabled={sending}
                      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] px-4 font-bold text-white disabled:opacity-60"
                    >
                      {sending ? (
                        <LoaderCircle className="animate-spin" size={20} />
                      ) : mode === "link" ? (
                        <ShieldCheck size={20} />
                      ) : (
                        <LogIn size={20} />
                      )}{" "}
                      {sending
                        ? "Enviando…"
                        : mode === "link"
                          ? "Proteger mis datos"
                          : "Enviar enlace de acceso"}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {preference === "name" && <NameEditor current={displayName} close={() => setPreference(undefined)} save={async (name) => { await updatePreference({ full_name: name, name }); setPreference(undefined); }}/>}
      {preference === "currency" && <CurrencyPicker current={currency} close={() => setPreference(undefined)} select={async (next) => { if (!isCurrency(next)) return; await updatePreference({ currency: next }); setPreference(undefined); }}/>}
      {preference === "theme" && <ThemePicker current={theme} close={() => setPreference(undefined)} select={async (next) => { await updatePreference({ theme: next }); setPreference(undefined); }}/>}
    </>
  );
}

function PreferenceRow({ icon, label, value, action }: { icon: React.ReactNode; label: string; value?: string; action: () => void }) {
  return <button onClick={action} className="flex min-h-14 w-full items-center gap-3 border-b border-black/[.06] px-4 text-left last:border-0"><span className="text-[#176b46]">{icon}</span><span className="min-w-0 flex-1 font-semibold">{label}</span>{value && <span className="max-w-[42%] truncate text-sm text-[#718078]">{value}</span>}<ChevronRight className="shrink-0 text-[#91a098]" size={18}/></button>;
}

function PreferenceSheet({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[100] flex items-end justify-center overscroll-none bg-black/55 sm:items-center" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="theme-card max-h-[92dvh] w-full max-w-md overscroll-contain overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"><div className="flex items-center"><h2 className="flex-1 text-xl font-bold">{title}</h2><button onClick={close} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#f1f4f2]"><X size={20}/></button></div>{children}</section></div>;
}

function NameEditor({ current, close, save }: { current: string; close: () => void; save: (name: string) => Promise<void> }) {
  const [name, setName] = useState(current); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  return <PreferenceSheet title="Editar nombre" close={close}><form onSubmit={async (event) => { event.preventDefault(); const clean = name.trim().replace(/\s+/g, " "); if (!clean || saving) return; setSaving(true); setError(""); try { await save(clean); } catch { setError("No pudimos guardar tu nombre."); setSaving(false); } }} className="mt-5"><label htmlFor="profile-name" className="text-sm font-bold">Nombre</label><input id="profile-name" autoFocus required maxLength={50} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-transparent px-4 text-base outline-none focus:border-[#176b46]"/>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={close} className="min-h-12 rounded-2xl border border-black/10 font-semibold">Cancelar</button><button disabled={!name.trim() || saving} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle className="animate-spin" size={18}/>} Guardar</button></div></form></PreferenceSheet>;
}

const currencyOptions: Array<[Currency, string, string]> = [["CLP", "🇨🇱", "Peso chileno"], ["MXN", "🇲🇽", "Peso mexicano"], ["USD", "🇺🇸", "Dólar estadounidense"], ["EUR", "🇪🇺", "Euro"]];
function CurrencyPicker({ current, close, select }: { current: Currency; close: () => void; select: (currency: Currency) => Promise<void> }) {
  const [saving, setSaving] = useState<Currency>();
  return <PreferenceSheet title="Moneda principal" close={close}><div className="mt-5 overflow-hidden rounded-2xl border border-black/[.06]">{currencyOptions.map(([code, flag, name]) => <button key={code} disabled={Boolean(saving)} onClick={async () => { setSaving(code); try { await select(code); } catch { setSaving(undefined); } }} className="flex min-h-16 w-full items-center gap-3 border-b border-black/[.06] px-4 text-left last:border-0"><span className="text-2xl">{flag}</span><span className="min-w-0 flex-1"><b>{code}</b><small className="ml-2 text-[#718078]">— {name}</small></span>{saving === code ? <LoaderCircle className="animate-spin" size={18}/> : current === code ? <CheckCircle2 className="text-[#176b46]" size={20}/> : null}</button>)}</div><p className="mt-4 text-xs text-[#718078]">Cambiar la moneda modifica el formato, no convierte tus importes anteriores.</p></PreferenceSheet>;
}
function ThemePicker({ current, close, select }: { current: "light" | "dark"; close: () => void; select: (theme: "light" | "dark") => Promise<void> }) {
  const [saving, setSaving] = useState<string>();
  const options = [["dark", "Oscuro", <Moon key="dark" size={20}/>], ["light", "Claro", <Sun key="light" size={20}/>]] as const;
  return <PreferenceSheet title="Apariencia" close={close}><div className="mt-5 overflow-hidden rounded-2xl border border-black/[.06]">{options.map(([value, label, icon]) => <button key={value} disabled={Boolean(saving)} onClick={async () => { setSaving(value); try { await select(value); } catch { setSaving(undefined); } }} className="flex min-h-16 w-full items-center gap-3 border-b border-black/[.06] px-4 text-left last:border-0"><span className="text-[#176b46]">{icon}</span><b className="flex-1">{label}</b>{saving === value ? <LoaderCircle className="animate-spin" size={18}/> : current === value ? <CheckCircle2 className="text-[#176b46]" size={20}/> : null}</button>)}</div></PreferenceSheet>;
}
