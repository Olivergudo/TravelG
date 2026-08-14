"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  Copy,
  Home,
  LoaderCircle,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  Send,
  ShoppingCart,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  createEvent,
  createHousehold,
  joinHousehold,
  loadRoomies,
  sendMessage,
  updateDebt,
} from "@/lib/roomies/repository";
import type { Household, HouseholdMember, ReplacementDebt, RoomieMessage } from "@/lib/roomies/types";
import { enableRoomieNotifications, notifyRoomieEvent } from "@/lib/roomies/push-client";

type RoomiesData = Awaited<ReturnType<typeof loadRoomies>>;
type Sheet = "create" | "join" | "actions" | "request" | "taken" | "purchased" | null;

export function RoomiesScreen({
  userId,
  onAttentionChange,
}: {
  userId: string;
  onAttentionChange: (count: number) => void;
}) {
  const [data, setData] = useState<RoomiesData>({ household: null, members: [], messages: [], debts: [] });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [view, setView] = useState<"chat" | "pending">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "pending" ? "pending" : "chat",
  );

  const reload = useCallback(async () => {
    try {
      const next = await loadRoomies();
      setData(next);
      setError("");
    } catch (loadError) {
      console.error("roomies_load_failed", loadError);
      setError("No pudimos abrir Roomies. Revisa que hayas ejecutado la migración SQL.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
  useEffect(() => {
    const attention = data.debts.filter((debt) =>
      (debt.debtor_user_id === userId && debt.status === "pending") ||
      (debt.owner_user_id === userId && debt.status === "awaiting_confirmation"),
    ).length;
    onAttentionChange(attention);
  }, [data.debts, onAttentionChange, userId]);
  useEffect(() => {
    if (!supabase || !data.household) return;
    const householdId = data.household.id;
    const channel = supabase
      .channel(`roomies:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_messages", filter: `household_id=eq.${householdId}` }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "replacement_debts", filter: `household_id=eq.${householdId}` }, () => void reload())
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [data.household, reload]);

  if (!ready) return <ScreenLoader />;
  if (!data.household) return <RoomiesWelcome error={error} open={setSheet} reload={reload} sheet={sheet} />;
  return (
    <section className="min-h-dvh pb-24">
      <RoomiesHeader household={data.household} members={data.members} />
      <div className="mx-4 grid grid-cols-2 rounded-2xl bg-black/[.045] p-1 dark:bg-white/[.045]">
        <button type="button" onClick={() => setView("chat")} className={`min-h-11 rounded-xl text-sm font-bold ${view === "chat" ? "theme-card bg-white text-[#176b46] shadow-sm" : "text-[#718078]"}`}>Chat</button>
        <button type="button" onClick={() => setView("pending")} className={`min-h-11 rounded-xl text-sm font-bold ${view === "pending" ? "theme-card bg-white text-[#176b46] shadow-sm" : "text-[#718078]"}`}>Pendientes</button>
      </div>
      {error && <p role="alert" className="mx-4 mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {view === "chat" ? (
        <ChatView userId={userId} data={data} openActions={() => setSheet("actions")} reload={reload} />
      ) : (
        <DebtsView userId={userId} data={data} reload={reload} />
      )}
      <NotificationPrompt />
      {sheet && (
        <RoomieSheet
          sheet={sheet}
          close={() => setSheet(null)}
          next={setSheet}
          household={data.household}
          members={data.members}
          debts={data.debts}
          userId={userId}
          completed={async () => { setSheet(null); await reload(); }}
        />
      )}
    </section>
  );
}

function ScreenLoader() {
  return <div className="grid min-h-[70dvh] place-items-center text-[#718078]"><LoaderCircle className="animate-spin" /></div>;
}

function RoomiesWelcome({ error, open, reload, sheet }: { error: string; open: (sheet: Sheet) => void; reload: () => Promise<void>; sheet: Sheet }) {
  return (
    <section className="grid min-h-[calc(100dvh-5rem)] place-items-center px-5 pb-20 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-[#e3f2e9] text-[#176b46]"><Home size={38}/></div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[.2em] text-[#6f8278]">Roomies</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-.03em]">Comparte y organiza las cosas de casa.</h1>
        {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => open("create")} className="mt-7 min-h-14 w-full rounded-2xl bg-[#176b46] px-4 font-bold text-white">Crear hogar</button>
        <button type="button" onClick={() => open("join")} className="theme-card mt-3 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 font-bold text-[#176b46]">Unirme a un hogar</button>
      </div>
      {sheet && <OnboardingSheet sheet={sheet} close={() => open(null)} completed={reload}/>} 
    </section>
  );
}

function OnboardingSheet({ sheet, close, completed }: { sheet: Sheet; close: () => void; completed: () => Promise<void> }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const create = sheet === "create";
  const submit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true); setError("");
    try {
      if (create) await createHousehold(value);
      else await joinHousehold(value);
      close(); await completed();
    } catch {
      setError(create ? "No pudimos crear el hogar." : "El código no existe o ya perteneces al hogar.");
    } finally { setSaving(false); }
  };
  return <SheetFrame close={close} title={create ? "Crear hogar" : "Unirme a un hogar"}>
    <label className="block text-sm font-bold">{create ? "Nombre del hogar" : "Código de invitación"}</label>
    <input autoFocus value={value} onChange={(event) => setValue(create ? event.target.value : event.target.value.toUpperCase())} maxLength={60} placeholder={create ? "Depto Viña" : "VINA-8421"} className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#176b46]"/>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" onClick={() => void submit()} disabled={!value.trim() || saving} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={19} className="animate-spin"/>}{create ? "Crear" : "Unirme"}</button>
  </SheetFrame>;
}

function RoomiesHeader({ household, members }: { household: Household; members: HouseholdMember[] }) {
  const [copied, setCopied] = useState(false);
  return <header className="px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
    <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#6f8278]">Roomies</p>
    <div className="mt-1 flex items-start justify-between gap-3">
      <div className="min-w-0"><h1 className="truncate text-[30px] font-bold tracking-[-.03em]">{household.name}</h1><p className="mt-1 line-clamp-2 text-sm text-[#718078]">{members.map((member) => member.display_name).join(" · ")}</p></div>
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(household.invite_code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="theme-card flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-black/[.07] bg-white px-3 text-xs font-bold text-[#176b46]" aria-label="Copiar código de invitación"><Copy size={16}/>{copied ? "Copiado" : household.invite_code}</button>
    </div>
  </header>;
}

function ChatView({ userId, data, openActions, reload }: { userId: string; data: RoomiesData; openActions: () => void; reload: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [data.messages.length]);
  const names = useMemo(() => new Map(data.members.map((member) => [member.user_id, member.display_name])), [data.members]);
  const submit = async () => {
    if (!message.trim() || sending || !data.household) return;
    setSending(true); setError("");
    try { await sendMessage(data.household.id, userId, message); setMessage(""); await reload(); }
    catch { setError("No pudimos enviar el mensaje. Revisa tu conexión."); }
    finally { setSending(false); }
  };
  return <div className="px-4 pb-5">
    <div className="mt-4 min-h-[36dvh] space-y-3">
      {data.messages.length === 0 && <Empty icon={<MessageCircle/>} title="El chat está listo" text="Envía un mensaje o registra una acción con el botón +."/>}
      {data.messages.map((item) => <MessageCard key={item.id} item={item} mine={item.user_id === userId} actor={names.get(item.user_id) || "Roomie"} names={names} userId={userId} householdId={data.household!.id} reload={reload}/>) }
      <div ref={endRef}/>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="theme-card sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex items-center gap-2 rounded-2xl border border-black/[.07] bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,.09)]">
      <button type="button" onClick={openActions} aria-label="Acciones especiales" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]"><Plus/></button>
      <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submit(); }} maxLength={1000} placeholder="Escribe un mensaje..." className="min-w-0 flex-1 bg-transparent px-1 text-base outline-none"/>
      <button type="button" onClick={() => void submit()} disabled={!message.trim() || sending} aria-label="Enviar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#176b46] text-white disabled:opacity-40">{sending ? <LoaderCircle className="animate-spin" size={19}/> : <Send size={19}/>}</button>
    </div>
  </div>;
}

function MessageCard({ item, mine, actor, names, userId, householdId, reload }: { item: RoomieMessage; mine: boolean; actor: string; names: Map<string, string>; userId: string; householdId: string; reload: () => Promise<void> }) {
  const metadata = item.metadata;
  const product = String(metadata.productName || "producto");
  const owner = names.get(String(metadata.ownerUserId || "")) || "otro roomie";
  const event = item.type !== "message";
  const [sending, setSending] = useState(false);
  let text = item.message || "";
  if (item.type === "product_request") text = `¿Alguien tiene ${product}?`;
  if (item.type === "product_available") text = `${actor} tiene ${product}`;
  if (item.type === "product_taken") text = `${actor} tomó ${product} de ${owner}. ${metadata.needsReplacement ? "Debe reponerlo." : "No requiere reposición."}`;
  if (item.type === "product_purchased") text = `${actor} compró ${product} · ${metadata.target === "all" ? "Para todos" : metadata.target === "self" ? "Para sí" : `Para ${names.get(String(metadata.targetUserId)) || "un roomie"}`}`;
  if (item.type === "replacement_reported") text = `${actor} dice que ya repuso ${product}.`;
  if (item.type === "replacement_confirmed") text = `${actor} confirmó la reposición de ${product}.`;
  if (item.type === "replacement_rejected") text = `La reposición de ${product} todavía está pendiente.`;
  const answer = async () => {
    setSending(true);
    try { const id = await createEvent(householdId, "product_available", { requestId: item.id, productName: product }); await notifyRoomieEvent(id); await reload(); }
    finally { setSending(false); }
  };
  return <article className={`${event ? "theme-card border border-[#176b46]/15 bg-white" : mine ? "ml-12 bg-[#176b46] text-white" : "theme-card mr-12 bg-white"} rounded-2xl px-4 py-3 shadow-sm`}>
    <p className={`text-xs font-bold ${mine && !event ? "text-white/70" : "text-[#176b46]"}`}>{event ? eventLabel(item.type, actor) : actor}</p>
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
    {item.type === "product_request" && item.user_id !== userId && <button type="button" disabled={sending} onClick={() => void answer()} className="mt-3 min-h-10 rounded-xl bg-[#e3f2e9] px-4 text-sm font-bold text-[#176b46] disabled:opacity-50">Yo tengo</button>}
    <time className={`mt-1 block text-[11px] ${mine && !event ? "text-white/55" : "text-[#839087]"}`}>{new Date(item.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</time>
  </article>;
}

function eventLabel(type: RoomieMessage["type"], actor: string) {
  if (type === "product_request") return `🔎 ${actor} pregunta`;
  if (type === "product_available") return "✅ Producto disponible";
  if (type === "product_taken") return "🥛 Producto tomado";
  if (type === "product_purchased") return "🛒 Compra compartida";
  if (type === "replacement_reported") return "⏳ Reposición reportada";
  if (type === "replacement_confirmed") return "✅ Reposición confirmada";
  return "Reposición pendiente";
}

function DebtsView({ userId, data, reload }: { userId: string; data: RoomiesData; reload: () => Promise<void> }) {
  const initialResolved = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "resolved";
  const [resolved, setResolved] = useState(initialResolved);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const names = new Map(data.members.map((member) => [member.user_id, member.display_name]));
  const debts = data.debts.filter((debt) => resolved ? debt.status === "resolved" : debt.status !== "resolved");
  const act = async (debt: ReplacementDebt, operation: "report" | "confirm" | "reject") => {
    setBusy(debt.id + operation); setError("");
    try { const messageId = await updateDebt(debt.id, operation); await notifyRoomieEvent(messageId); await reload(); }
    catch { setError("No pudimos actualizar la reposición. Revisa tu conexión."); }
    finally { setBusy(""); }
  };
  return <div className="px-4 pb-4">
    <div className="mt-4 flex gap-2"><button type="button" onClick={() => setResolved(false)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${!resolved ? "bg-[#176b46] text-white" : "theme-card bg-white text-[#718078]"}`}>Activos</button><button type="button" onClick={() => setResolved(true)} className={`min-h-10 rounded-full px-4 text-sm font-bold ${resolved ? "bg-[#176b46] text-white" : "theme-card bg-white text-[#718078]"}`}>Resueltos</button></div>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-4 space-y-3">
      {debts.length === 0 && <Empty icon={<PackageCheck/>} title={resolved ? "Sin reposiciones resueltas" : "Todo está al día"} text={resolved ? "Aquí aparecerá el historial confirmado." : "No hay productos pendientes de reposición."}/>} 
      {debts.map((debt) => <article key={debt.id} className="theme-card rounded-[22px] border border-black/[.06] bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e3f2e9] text-[#176b46]">🥛</div><div className="min-w-0 flex-1"><h3 className="font-bold">{debt.product_name}</h3><p className="text-sm text-[#718078]">{names.get(debt.debtor_user_id)} → {names.get(debt.owner_user_id)}</p></div></div>
        <p className="mt-3 text-sm font-semibold text-[#176b46]">{debt.status === "pending" ? "Pendiente de reposición" : debt.status === "awaiting_confirmation" ? `Esperando confirmación de ${names.get(debt.owner_user_id)}` : "Reposición confirmada"}</p>
        <p className="mt-1 text-xs text-[#839087]">{relativeDate(debt.resolved_at || debt.created_at)}</p>
        {debt.status === "pending" && debt.debtor_user_id === userId && <button type="button" disabled={busy !== ""} onClick={() => void act(debt, "report")} className="mt-4 min-h-11 w-full rounded-xl bg-[#176b46] font-bold text-white">Ya lo repuse</button>}
        {debt.status === "awaiting_confirmation" && debt.owner_user_id === userId && <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={busy !== ""} onClick={() => void act(debt, "confirm")} className="min-h-11 rounded-xl bg-[#176b46] px-2 text-sm font-bold text-white">Confirmar reposición</button><button type="button" disabled={busy !== ""} onClick={() => void act(debt, "reject")} className="theme-card min-h-11 rounded-xl border border-black/10 bg-white px-2 text-sm font-bold">Aún no</button></div>}
      </article>)}
    </div>
  </div>;
}

function RoomieSheet({ sheet, close, next, household, members, debts, userId, completed }: { sheet: Sheet; close: () => void; next: (sheet: Sheet) => void; household: Household; members: HouseholdMember[]; debts: ReplacementDebt[]; userId: string; completed: () => Promise<void> }) {
  if (sheet === "actions") return <SheetFrame title="¿Qué quieres hacer?" close={close}>
    <Action icon={<Search/>} label="Preguntar si alguien tiene" click={() => next("request")}/>
    <Action icon={<PackageCheck/>} label="Avisar que tomé algo" click={() => next("taken")}/>
    <Action icon={<ShoppingCart/>} label="Avisar que compré algo" click={() => next("purchased")}/>
  </SheetFrame>;
  return <EventForm kind={sheet as "request" | "taken" | "purchased"} close={close} household={household} members={members} debts={debts} userId={userId} completed={completed}/>;
}

function EventForm({ kind, close, household, members, debts, userId, completed }: { kind: "request" | "taken" | "purchased"; close: () => void; household: Household; members: HouseholdMember[]; debts: ReplacementDebt[]; userId: string; completed: () => Promise<void> }) {
  const [product, setProduct] = useState("");
  const others = members.filter((member) => member.user_id !== userId);
  const [target, setTarget] = useState(others[0]?.user_id || "");
  const [purchaseTarget, setPurchaseTarget] = useState<"all" | "member" | "self">("all");
  const [needsReplacement, setNeedsReplacement] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<ReplacementDebt | null>(null);
  const title = kind === "request" ? "¿Qué necesitas?" : kind === "taken" ? "Tomé algo" : "Compré algo";
  const submit = async () => {
    if (!product.trim() || saving || (kind === "taken" && !target)) return;
    setSaving(true); setError("");
    try {
      const payload = kind === "request" ? { productName: product } : kind === "taken" ? { productName: product, ownerUserId: target, needsReplacement } : { productName: product, target: purchaseTarget, targetUserId: purchaseTarget === "member" ? target : undefined };
      const id = await createEvent(household.id, kind === "request" ? "product_request" : kind === "taken" ? "product_taken" : "product_purchased", payload);
      await notifyRoomieEvent(id);
      if (kind === "purchased" && purchaseTarget === "member") {
        const match = debts.find((debt) => debt.debtor_user_id === userId && debt.owner_user_id === target && debt.status === "pending" && debt.product_name.trim().toLocaleLowerCase("es") === product.trim().toLocaleLowerCase("es"));
        if (match) { setSuggestion(match); setSaving(false); return; }
      }
      await completed();
    } catch { setError("No pudimos enviar la acción. Revisa tu conexión."); setSaving(false); }
  };
  if (suggestion) return <SheetFrame close={close} title="¿Marcar como repuesta?"><p className="text-sm text-[#587067]">Tienes una reposición pendiente de {suggestion.product_name}. El propietario todavía deberá confirmarla.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => void (async () => { const id = await updateDebt(suggestion.id, "report"); await notifyRoomieEvent(id); await completed(); })()} className="min-h-12 rounded-xl bg-[#176b46] font-bold text-white">Sí</button><button type="button" onClick={() => void completed()} className="theme-card min-h-12 rounded-xl border border-black/10 bg-white font-bold">No</button></div></SheetFrame>;
  return <SheetFrame close={close} title={title}>
    {kind === "taken" && <><label className="block text-sm font-bold">¿De quién?</label><select value={target} onChange={(event) => setTarget(event.target.value)} className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base">{others.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select></>}
    <label className={`${kind === "taken" ? "mt-4" : ""} block text-sm font-bold`}>{kind === "request" ? "Producto" : kind === "taken" ? "¿Qué tomaste?" : "¿Qué compraste?"}</label>
    <input autoFocus={kind !== "taken"} value={product} onChange={(event) => setProduct(event.target.value)} maxLength={100} placeholder="Leche" className="theme-card mt-2 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4 text-base outline-none focus:border-[#176b46]"/>
    {kind === "taken" && <><p className="mt-4 text-sm font-bold">¿Debes reponerlo?</p><div className="mt-2 grid grid-cols-2 gap-2"><Choice selected={needsReplacement} label="Sí" click={() => setNeedsReplacement(true)}/><Choice selected={!needsReplacement} label="No" click={() => setNeedsReplacement(false)}/></div></>}
    {kind === "purchased" && <><p className="mt-4 text-sm font-bold">¿Para quién?</p><div className="mt-2 grid grid-cols-3 gap-2"><Choice selected={purchaseTarget === "all"} label="Todos" click={() => setPurchaseTarget("all")}/><Choice selected={purchaseTarget === "member"} label="Roomie" click={() => setPurchaseTarget("member")}/><Choice selected={purchaseTarget === "self"} label="Para mí" click={() => setPurchaseTarget("self")}/></div>{purchaseTarget === "member" && <select value={target} onChange={(event) => setTarget(event.target.value)} className="theme-card mt-3 min-h-14 w-full rounded-2xl border border-black/10 bg-white px-4">{others.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select>}</>}
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    <button type="button" disabled={!product.trim() || saving || ((kind === "taken" || (kind === "purchased" && purchaseTarget === "member")) && !target)} onClick={() => void submit()} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-bold text-white disabled:opacity-50">{saving && <LoaderCircle size={18} className="animate-spin"/>}{kind === "request" ? "Preguntar" : "Avisar"}</button>
  </SheetFrame>;
}

function NotificationPrompt() {
  const [state, setState] = useState<"hidden" | "ready" | "saving" | "done" | "error">(() =>
    typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && localStorage.getItem("roomies-push-dismissed") !== "1" ? "ready" : "hidden",
  );
  if (state === "hidden" || state === "done") return null;
  return <aside className="theme-card mx-4 mb-5 rounded-[22px] border border-[#176b46]/15 bg-white p-4">
    <div className="flex gap-3"><Bell className="mt-0.5 shrink-0 text-[#176b46]"/><div><h3 className="font-bold">Recibe avisos de tus roomies</h3><p className="mt-1 text-sm text-[#718078]">Te avisaremos cuando alguien tome algo tuyo o necesite tu confirmación.</p></div></div>
    {state === "error" && <p className="mt-3 text-sm text-red-600">No pudimos activar las notificaciones.</p>}
    <div className="mt-4 flex gap-2"><button type="button" disabled={state === "saving"} onClick={() => void (async () => { setState("saving"); try { await enableRoomieNotifications(); setState("done"); } catch { setState("error"); } })()} className="min-h-11 flex-1 rounded-xl bg-[#176b46] px-3 text-sm font-bold text-white">Activar notificaciones</button><button type="button" onClick={() => { localStorage.setItem("roomies-push-dismissed", "1"); setState("hidden"); }} className="min-h-11 rounded-xl px-3 text-sm text-[#718078]">Ahora no</button></div>
  </aside>;
}

function SheetFrame({ close, title, children }: { close: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" className="theme-card max-h-[88dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[30px] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-2xl font-bold tracking-[-.025em]">{title}</h2><button type="button" onClick={close} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[.045]"><X/></button></div>{children}</section></div>;
}

function Action({ icon, label, click }: { icon: React.ReactNode; label: string; click: () => void }) { return <button type="button" onClick={click} className="theme-card mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-black/[.06] bg-white px-4 text-left font-bold"><span className="text-[#176b46]">{icon}</span>{label}</button>; }
function Choice({ selected, label, click }: { selected: boolean; label: string; click: () => void }) { return <button type="button" onClick={click} className={`min-h-12 rounded-xl border px-2 text-sm font-bold ${selected ? "border-[#176b46] bg-[#e3f2e9] text-[#176b46]" : "theme-card border-black/10 bg-white"}`}>{selected && <Check className="mr-1 inline" size={16}/>} {label}</button>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="theme-card rounded-[24px] bg-white px-5 py-10 text-center"><div className="mx-auto w-fit text-[#91a098]">{icon}</div><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm text-[#718078]">{text}</p></div>; }
function relativeDate(value: string) { const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000); return days <= 0 ? "Hoy" : days === 1 ? "Ayer" : `Hace ${days} días`; }
