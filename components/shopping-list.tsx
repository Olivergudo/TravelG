"use client";

import { Check, ChevronLeft, Circle, ListChecks, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import type { AppData, ShoppingListItem } from "@/lib/types";

type Update = (fn: (data: AppData) => AppData) => void;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ShoppingList({ data, update, showFridge }: { data: AppData; update: Update; showFridge: () => void }) {
  const [name, setName] = useState("");
  const [editingItem, setEditingItem] = useState<ShoppingListItem>();
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
  const rename = (id: string, nextName: string) => update((current) => ({
    ...current,
    shoppingListItems: current.shoppingListItems.map((item) => item.id === id
      ? { ...item, name: nextName.trim(), updatedAt: new Date().toISOString() }
      : item),
  }));
  const clearCompleted = () => {
    if (completed.length > 1 && !window.confirm(`¿Eliminar ${completed.length} productos completados?`)) return;
    update((current) => ({ ...current, shoppingListItems: current.shoppingListItems.filter((item) => !item.completed) }));
  };

  return <>
    <header className="flex items-start gap-3 px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
      <button type="button" onClick={showFridge} aria-label="Volver al Refrigerador" className="theme-card mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/[.06] bg-white"><ChevronLeft size={21}/></button>
      <div><p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">Checklist</p>
      <h1 className="mt-1 text-[30px] font-bold leading-tight">Lista</h1>
      <p className="mt-1 text-sm text-[#718078]">{pending.length} {pending.length === 1 ? "pendiente" : "pendientes"}</p></div>
    </header>
    <div className="space-y-7 px-4">
      <form onSubmit={add} className="theme-card flex min-w-0 gap-2 rounded-2xl border border-black/[.04] bg-white p-2 shadow-sm">
        <input ref={input} value={name} onChange={(event) => setName(event.target.value)} enterKeyHint="done" placeholder="Agregar producto…" aria-label="Nombre del producto" className="min-h-12 min-w-0 flex-1 bg-transparent px-3 outline-none" />
        <button type="submit" aria-label="Agregar producto" className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#176b46] text-white"><Plus size={23}/></button>
      </form>
      {!data.shoppingListItems.length && (
        <section className="theme-card rounded-[28px] border border-black/[.04] bg-white px-6 py-10 text-center">
          <ListChecks className="mx-auto text-[#91a098]" size={38}/>
          <h2 className="mt-4 text-xl font-bold">Tu lista está vacía</h2>
          <p className="mt-2 text-sm text-[#718078]">
            Agrega productos para recordar lo que necesitas comprar.
          </p>
        </section>
      )}
      {pending.length > 0 && <ItemGroup title="Pendientes">{pending.map((item) => <SwipeItem key={item.id} item={item} toggle={() => toggle(item.id)} edit={() => setEditingItem(item)} remove={() => remove(item.id)}/>)}</ItemGroup>}
      {completed.length > 0 && <section>
        <div className="mb-2 flex min-h-9 items-center px-1"><h2 className="flex-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Completados</h2><button onClick={clearCompleted} className="min-h-9 px-2 text-xs font-semibold text-[#176b46]">Limpiar completados</button></div>
        <div className="space-y-3">{completed.map((item) => <SwipeItem key={item.id} item={item} toggle={() => toggle(item.id)} edit={() => setEditingItem(item)} remove={() => remove(item.id)}/>)}</div>
      </section>}
      {data.shoppingListItems.length > 0 && <p className="text-center text-xs text-[#718078]">Toca para marcar · Desliza para eliminar</p>}
    </div>
    {editingItem && <EditListItem item={editingItem} close={() => setEditingItem(undefined)} save={(nextName) => { rename(editingItem.id, nextName); setEditingItem(undefined); }} />}
  </>;
}

function ItemGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">{title}</h2><div className="space-y-3">{children}</div></section>;
}

function SwipeItem({ item, toggle, edit, remove }: { item: ShoppingListItem; toggle: () => void; edit: () => void; remove: () => void }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(0);
  const offsetRef = useRef(0);
  const currentOffset = useRef(0);
  const dragged = useRef(false);
  const down = (event: React.PointerEvent<HTMLDivElement>) => { start.current = event.clientX; offsetRef.current = offset; currentOffset.current = offset; dragged.current = false; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const distance = Math.max(0, Math.min(180, offsetRef.current + event.clientX - start.current));
    if (distance > 8) dragged.current = true;
    currentOffset.current = distance;
    setOffset(distance);
  };
  const up = () => {
    setDragging(false);
    if (currentOffset.current >= 110) { setOffset(220); window.setTimeout(remove, 170); return; }
    currentOffset.current = 0;
    setOffset(0);
  };
  return <div className={`theme-card relative overflow-hidden rounded-2xl border border-black/[.04] ${offset > 0 ? "bg-red-600" : "bg-white"}`}>
    <div aria-hidden="true" className="absolute inset-y-0 left-0 flex w-[76px] items-center justify-center text-white"><Trash2 size={19}/></div>
    <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { setDragging(false); setOffset(0); }} style={{ transform: `translate3d(${offset}px,0,0)` }} className={`relative flex min-h-[58px] touch-pan-y items-center rounded-2xl bg-white will-change-transform ${dragging ? "" : "transition-transform duration-200 ease-out"}`}>
      <button onClick={() => { if (!dragged.current) toggle(); }} className={`flex min-h-[58px] min-w-0 flex-1 items-center gap-3 px-4 text-left ${item.completed ? "opacity-55" : ""}`}>
        {item.completed ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#176b46] text-white"><Check size={15}/></span> : <Circle className="shrink-0 text-[#a5b2ab]" size={24}/>}<span className={`min-w-0 flex-1 truncate font-semibold ${item.completed ? "line-through" : ""}`}>{item.name}</span>
      </button>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          edit();
        }}
        aria-label={`Editar ${item.name}`}
        className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[#91a098]"
      >
        <Pencil size={18}/>
      </button>
    </div>
  </div>;
}

function EditListItem({ item, close, save }: { item: ShoppingListItem; close: () => void; save: (name: string) => void }) {
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
    <form onSubmit={(event) => { event.preventDefault(); if (!name.trim() || saving) return; setSaving(true); save(name); }} className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
      <div className="flex items-center gap-3"><h2 className="flex-1 text-xl font-bold">Editar producto</h2><button type="button" onClick={close} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"><X /></button></div>
      <label className="mt-4 block text-sm font-semibold">Nombre<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3 text-base outline-none focus:border-[#176b46]" /></label>
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={close} className="min-h-12 rounded-2xl border border-black/10 font-semibold">Cancelar</button><button disabled={saving} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle className="animate-spin" size={18}/>}Guardar</button></div>
    </form>
  </div>;
}
