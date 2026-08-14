"use client";

import { Check, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { AppData, ShoppingListItem } from "@/lib/types";

type Update = (fn: (data: AppData) => AppData) => void;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ShoppingList({ data, update }: { data: AppData; update: Update }) {
  const [name, setName] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const pending = data.shoppingListItems.filter((item) => !item.completed);
  const completed = data.shoppingListItems.filter((item) => item.completed);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return input.current?.focus();
    const at = new Date().toISOString();
    const item: ShoppingListItem = { id: uid(), name: clean, completed: false, createdAt: at, updatedAt: at };
    update((current) => ({ ...current, shoppingListItems: [...current.shoppingListItems, item] }));
    setName("");
    requestAnimationFrame(() => input.current?.focus());
  };
  const toggle = (id: string) => update((current) => ({
    ...current,
    shoppingListItems: current.shoppingListItems.map((item) => item.id === id
      ? { ...item, completed: !item.completed, updatedAt: new Date().toISOString() }
      : item),
  }));
  const remove = (id: string) => update((current) => ({
    ...current,
    shoppingListItems: current.shoppingListItems.filter((item) => item.id !== id),
  }));
  const clearCompleted = () => {
    if (completed.length > 1 && !window.confirm(`¿Eliminar ${completed.length} productos completados?`)) return;
    update((current) => ({ ...current, shoppingListItems: current.shoppingListItems.filter((item) => !item.completed) }));
  };

  return <>
    <header className="px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
      <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">Checklist</p>
      <h1 className="mt-1 text-[30px] font-bold leading-tight">Lista</h1>
      <p className="mt-1 text-sm text-[#718078]">{pending.length} {pending.length === 1 ? "pendiente" : "pendientes"}</p>
    </header>
    <div className="space-y-7 px-4">
      <form onSubmit={add} className="theme-card flex min-w-0 gap-2 rounded-2xl border border-black/[.04] bg-white p-2 shadow-sm">
        <input ref={input} value={name} onChange={(event) => setName(event.target.value)} enterKeyHint="done" placeholder="Agregar producto…" aria-label="Nombre del producto" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 outline-none" />
        <button type="submit" aria-label="Agregar producto" className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#176b46] text-white"><Plus size={23}/></button>
      </form>
      {!data.shoppingListItems.length && <div className="px-2 py-3 text-center"><ListChecks className="mx-auto mb-2 text-[#91a098]"/><p className="text-sm text-[#718078]">Todavía no tienes productos pendientes.</p></div>}
      {pending.length > 0 && <ItemGroup title="Pendientes">{pending.map((item) => <SwipeItem key={item.id} item={item} toggle={() => toggle(item.id)} remove={() => remove(item.id)}/>)}</ItemGroup>}
      {completed.length > 0 && <section>
        <div className="mb-2 flex min-h-9 items-center px-1"><h2 className="flex-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Completados</h2><button onClick={clearCompleted} className="min-h-9 px-2 text-xs font-semibold text-[#176b46]">Limpiar completados</button></div>
        <div className="space-y-3">{completed.map((item) => <SwipeItem key={item.id} item={item} toggle={() => toggle(item.id)} remove={() => remove(item.id)}/>)}</div>
      </section>}
      {data.shoppingListItems.length > 0 && <p className="text-center text-xs text-[#718078]">Toca para marcar · Desliza para eliminar</p>}
    </div>
  </>;
}

function ItemGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">{title}</h2><div className="space-y-3">{children}</div></section>;
}

function SwipeItem({ item, toggle, remove }: { item: ShoppingListItem; toggle: () => void; remove: () => void }) {
  const [offset, setOffset] = useState(0);
  const start = useRef(0);
  const dragged = useRef(false);
  const down = (event: React.PointerEvent<HTMLDivElement>) => { start.current = event.clientX; dragged.current = false; event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const distance = Math.max(0, Math.min(150, event.clientX - start.current));
    if (distance > 8) dragged.current = true;
    setOffset(distance);
  };
  const up = () => {
    if (offset >= 130) { remove(); setOffset(0); return; }
    setOffset(offset >= 55 ? 76 : 0);
  };
  return <div className={`theme-card relative overflow-hidden rounded-2xl border border-black/[.04] ${offset > 0 ? "bg-red-600" : "bg-white"}`}>
    <button onClick={remove} aria-label={`Eliminar ${item.name}`} className="absolute inset-y-0 left-0 flex w-[76px] items-center justify-center text-white"><Trash2 size={19}/></button>
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setOffset(0)} style={{ transform: `translateX(${offset}px)` }} className="relative flex min-h-[58px] touch-pan-y items-center rounded-2xl bg-white transition-transform duration-150">
      <button onClick={() => { if (!dragged.current) toggle(); }} className={`flex min-h-[58px] min-w-0 flex-1 items-center gap-3 px-4 text-left ${item.completed ? "opacity-55" : ""}`}>
        {item.completed ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#176b46] text-white"><Check size={15}/></span> : <Circle className="shrink-0 text-[#a5b2ab]" size={24}/>}<span className={`min-w-0 flex-1 truncate font-semibold ${item.completed ? "line-through" : ""}`}>{item.name}</span>
      </button>
      <button onClick={remove} aria-label={`Eliminar ${item.name}`} className="hidden h-11 w-11 shrink-0 place-items-center text-[#91a098] sm:grid"><Trash2 size={17}/></button>
    </div>
  </div>;
}
