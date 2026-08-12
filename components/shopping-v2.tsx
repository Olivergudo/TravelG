"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ReceiptText, Search, ShoppingBasket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { categoryEmoji, formatMoney } from "./expense-ui";
import type { AppData, Category, Purchase } from "@/lib/types";

type Update = (fn: (data: AppData) => AppData) => void;
const monthKey = (value: string) => new Date(value).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
const shortDate = (value: string) => new Date(value).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

export function ShoppingV2({ data, update }: { data: AppData; update: Update; showFinances: () => void }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = data.purchases.find((purchase) => purchase.id === selectedId);

  useEffect(() => {
    const missing = data.expenses.filter((expense) => expense.categoryId === "supermarket" && !expense.purchaseId);
    if (!missing.length) return;
    update((current) => {
      const ids = new Map(missing.map((expense) => [expense.id, `manual-${expense.id}`]));
      const purchases: Purchase[] = missing.map((expense) => ({
        id: ids.get(expense.id)!, supermarketName: expense.description,
        startedAt: expense.date, completedAt: expense.date, total: expense.amount,
        source: "manual", expenseId: expense.id, items: [],
      }));
      return {
        ...current,
        expenses: current.expenses.map((expense) => ids.has(expense.id) ? { ...expense, purchaseId: ids.get(expense.id) } : expense),
        purchases: [...purchases.filter((purchase) => !current.purchases.some((old) => old.id === purchase.id)), ...current.purchases],
      };
    });
  }, [data.expenses, update]);

  if (selected) return <PurchaseDetail purchase={selected} data={data} back={() => setSelectedId(undefined)} />;
  return <PurchaseHistory data={data} open={setSelectedId} />;
}

function PurchaseHistory({ data, open }: { data: AppData; open: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [showMore, setShowMore] = useState(false);
  const current = new Date();
  const thisMonth = data.purchases.filter((purchase) => {
    const date = new Date(purchase.completedAt);
    return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
  });
  const purchaseCategoryIds = [...new Set(data.purchases.map((purchase) =>
    data.expenses.find((expense) => expense.id === purchase.expenseId)?.categoryId,
  ).filter((id): id is string => Boolean(id)))];
  const purchaseCategories = purchaseCategoryIds.map((id) => data.categories.find((category) => category.id === id)).filter((category): category is Category => Boolean(category));
  const primaryCategories = purchaseCategories.slice(0, 3);
  const remainingCategories = purchaseCategories.slice(3);
  const filteredPurchases = data.purchases.filter((purchase) => {
    const expense = data.expenses.find((item) => item.id === purchase.expenseId);
    const search = query.trim().toLocaleLowerCase("es-CL");
    const matchesSearch = !search || [purchase.supermarketName, expense?.description || "", purchase.completedAt, new Date(purchase.completedAt).toLocaleDateString("es-CL")].some((value) => value.toLocaleLowerCase("es-CL").includes(search));
    return matchesSearch && (categoryId === "all" || expense?.categoryId === categoryId);
  });
  const groups = useMemo(() => {
    const map = new Map<string, Purchase[]>();
    [...filteredPurchases].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).forEach((purchase) => {
      const key = monthKey(purchase.completedAt);
      map.set(key, [...(map.get(key) || []), purchase]);
    });
    return [...map.entries()];
  }, [filteredPurchases]);
  const total = thisMonth.reduce((sum, purchase) => sum + purchase.total, 0);

  return <>
    <header className="px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]"><p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">Historial</p><h1 className="mt-1 text-[30px] font-bold leading-tight">Compras</h1></header>
    <div className="space-y-7 px-4 pb-28">
      <section className="rounded-[28px] bg-[#173d2d] p-5 text-white"><p className="text-sm text-white/65">Compras este mes</p><p className="mt-2 text-3xl font-bold">{formatMoney(total)}</p><p className="mt-3 text-sm text-white/65">{thisMonth.length} {thisMonth.length === 1 ? "compra" : "compras"}</p></section>
      <section className="space-y-3">
        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718078]" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar compras…" className="theme-card min-h-14 w-full rounded-2xl border border-black/[.04] bg-white py-3 pl-12 pr-4 outline-none"/></div>
        {purchaseCategories.length > 0 && <div className="grid grid-cols-4 gap-2">{primaryCategories.map((category) => <button key={category.id} onClick={() => setCategoryId((current) => current === category.id ? "all" : category.id)} aria-label={`Filtrar por ${category.name || categoryEmoji(category)}`} className={`min-h-12 rounded-2xl border text-xl ${categoryId === category.id ? "border-[#176b46] bg-[#e5f3ea]" : "theme-card border-black/[.04] bg-white"}`}>{categoryEmoji(category)}</button>)}{remainingCategories.length > 0 && <button onClick={() => setShowMore((current) => !current)} className="theme-card flex min-h-12 items-center justify-center rounded-2xl border border-black/[.04] bg-white text-xs font-bold">Otros <ChevronDown size={15} className={showMore ? "rotate-180" : ""}/></button>}{showMore && remainingCategories.map((category) => <button key={category.id} onClick={() => setCategoryId((current) => current === category.id ? "all" : category.id)} className={`min-h-12 rounded-2xl border text-xl ${categoryId === category.id ? "border-[#176b46] bg-[#e5f3ea]" : "theme-card border-black/[.04] bg-white"}`}>{categoryEmoji(category)}</button>)}</div>}
      </section>
      {!groups.length && <section className="theme-card rounded-[28px] bg-white p-8 text-center"><ShoppingBasket className="mx-auto mb-3 text-[#91a098]" size={32}/><h2 className="font-bold">Aún no hay compras</h2><p className="mt-1 text-sm text-[#718078]">Registra un gasto de supermercado desde Finanzas.</p></section>}
      {groups.map(([month, purchases]) => <section key={month}>
        <h2 className="mb-3 px-1 text-sm font-bold uppercase tracking-[.14em] text-[#718078]">{month}</h2>
        <div className="theme-card overflow-hidden rounded-[26px] border border-black/[.04] bg-white">{purchases.map((purchase) => <button key={purchase.id} onClick={() => open(purchase.id)} className="flex min-h-[82px] w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left last:border-0"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e5f3ea] text-xl">🛒</span><span className="min-w-0 flex-1"><b className="block truncate">{purchase.supermarketName}</b><small className="text-[#718078]">{shortDate(purchase.completedAt)} · {purchase.items.length ? `${purchase.items.length} productos` : "Registro manual"}</small></span><span className="text-right"><b className="block">{formatMoney(purchase.total)}</b><ChevronRight className="ml-auto mt-1 text-[#91a098]" size={17}/></span></button>)}</div>
      </section>)}
    </div>
  </>;
}

function PurchaseDetail({ purchase, data, back }: { purchase: Purchase; data: AppData; back: () => void }) {
  const expense = data.expenses.find((item) => item.id === purchase.expenseId);
  return <>
    <header className="sticky top-0 z-20 flex min-h-[68px] items-center border-b border-black/[.05] bg-white/95 px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur-xl"><button onClick={back} className="flex min-h-12 items-center gap-1 rounded-2xl px-3 font-bold text-[#176b46]"><ChevronLeft size={22}/> Volver</button><h1 className="min-w-0 flex-1 truncate pr-4 text-center text-lg font-bold">Detalle de compra</h1></header>
    <div className="px-4 py-5 pb-28"><section className="theme-card rounded-[28px] bg-white p-5"><div className="mb-6 text-center"><ReceiptText className="mx-auto mb-2 text-[#176b46]"/><h2 className="text-xl font-bold uppercase">{purchase.supermarketName}</h2><p className="text-sm text-[#718078]">{new Date(purchase.completedAt).toLocaleDateString("es-CL", { dateStyle: "long" })}</p></div>
      {purchase.items.length ? purchase.items.map((item) => <div key={item.id} className="flex border-b border-dashed border-black/10 py-3"><span className="flex-1"><b className="block">{item.productName}</b><small className="text-[#718078]">{item.quantity} × {formatMoney(item.unitPrice)}</small></span><b>{formatMoney(item.totalPrice)}</b></div>) : <div className="rounded-2xl bg-[#f3f6f3] p-4"><b className="block">Registro manual</b>{expense?.description && <p className="mt-1 text-sm text-[#718078]">{expense.description}</p>}</div>}
      <div className="mt-6 flex items-end border-t border-black/10 pt-4"><b className="flex-1 text-lg">TOTAL</b><b className="text-2xl">{formatMoney(purchase.total)}</b></div>
    </section></div>
  </>;
}
