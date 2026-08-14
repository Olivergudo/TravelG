"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { categoryEmoji, formatMoney } from "./expense-ui";
import type { Category, Expense } from "@/lib/types";
import { getCategoryColor, getCategorySoftColor } from "@/lib/category-colors";

export function FinanceHeroDonut({ expenses, categories, total }: { expenses: Expense[]; categories: Category[]; total: number }) {
  const [active, setActive] = useState(0);
  const [selectedByUser, setSelectedByUser] = useState(false);
  const data = categories.map((category) => ({
    id: category.id,
    category,
    value: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
    color: getCategoryColor(category),
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const selected = data[Math.min(active, Math.max(0, data.length - 1))];
  const chartData = data.length ? data : [{ id: "empty", value: 1, color: "rgba(255,255,255,.14)" }];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(106px,132px)_minmax(0,1fr)] items-center gap-4">
      <div className="relative aspect-square w-full max-w-[132px] shrink-0" aria-label="Distribución mensual por categorías">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={chartData} dataKey="value" innerRadius="61%" outerRadius="87%" paddingAngle={data.length ? 2 : 0} stroke="none" onClick={(_, index) => { if (data.length) { setActive(index); setSelectedByUser(true); } }}>{chartData.map((item, index) => <Cell key={item.id} fill={item.color} opacity={!data.length || index === active ? 1 : .7} />)}</Pie></PieChart></ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {!data.length ? <><small className="text-[8px] font-bold uppercase tracking-[.12em] text-white/55">Sin gastos</small><b className="mt-1 text-sm">0%</b></> : <>
            {!selectedByUser && <small className="text-[7px] font-bold uppercase tracking-[.1em] text-white/55">Mayor gasto</small>}
            <span className="mt-0.5 text-xl">{categoryEmoji(selected?.category)}</span>
            {selectedByUser && selected?.category.name && <span className="max-w-[72px] truncate text-[8px] font-semibold text-white/80">{selected.category.name}</span>}
            {selectedByUser && selected ? <><b className="text-[10px]">{formatMoney(selected.value)}</b><small className="text-[8px] text-white/60">{Math.round(selected.value / total * 100)}%</small></> : <b className="text-xs">{selected ? Math.round(selected.value / total * 100) : 0}%</b>}
          </>}
        </div>
      </div>
      <div className="min-w-0"><p className="text-[13px] font-medium text-white/65">Gastado este mes</p><p className="mt-2 truncate text-[clamp(1.75rem,8vw,2.5rem)] font-bold leading-none tracking-[-.04em]">{formatMoney(total)}</p><p className="mt-3 text-xs text-white/55">{data.length ? "Distribución de tus gastos" : "Aún no hay movimientos"}</p></div>
    </div>
  );
}

export function FinanceCharts({ expenses, categories, total, dark, showDistribution = true }: { expenses: Expense[]; categories: Category[]; total: number; dark: boolean; showDistribution?: boolean }) {
  const [active, setActive] = useState(0);
  const [selectedByUser, setSelectedByUser] = useState(false);
  const distribution = useMemo(() => categories.map((category) => ({
    id: category.id,
    category,
    value: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
    color: getCategoryColor(category),
  })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value), [categories, expenses]);
  const trend = useMemo(() => {
    const today = new Date();
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const amounts = new Map<number, number>();
    expenses.forEach((expense) => {
      const day = new Date(expense.date).getDate();
      amounts.set(day, (amounts.get(day) || 0) + expense.amount);
    });
    return Array.from({ length: days }, (_, index) => ({ day: index + 1, amount: amounts.get(index + 1) || 0 }));
  }, [expenses]);
  const selected = distribution[Math.min(active, Math.max(0, distribution.length - 1))];

  if (!expenses.length && showDistribution) return (
    <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-6 text-center">
      <div className="mx-auto mb-4 h-28 w-28 rounded-full border-[14px] border-[#dfe8e2]" />
      <h2 className="font-bold">Todavía no hay gastos para mostrar</h2>
      <p className="mt-1 text-sm text-[#718078]">Agrega tu primer gasto para ver tendencias y distribución.</p>
    </section>
  );
  if (!expenses.length) return null;

  return <div className="min-w-0 max-w-full space-y-5">
    {showDistribution && <section className="theme-card min-w-0 max-w-full rounded-[28px] border border-black/[.04] bg-white p-5">
      <div className="mb-2"><p className="text-sm font-semibold text-[#718078]">Tendencia diaria</p><h2 className="text-xl font-bold">Gasto este mes</h2></div>
      <div className="h-44 min-w-0 max-w-full" aria-label="Gráfica de gasto diario">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={trend} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
            <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f9d68" stopOpacity={0.34}/><stop offset="100%" stopColor="#2f9d68" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} interval={6} tick={{ fill: dark ? "#91a098" : "#718078", fontSize: 11 }} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(day) => `Día ${day}`} contentStyle={{ borderRadius: 14, border: "none", background: dark ? "#17201b" : "#fff", color: dark ? "#fff" : "#17231d", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }} />
            <Area type="monotone" dataKey="amount" stroke="#2f9d68" strokeWidth={3} fill="url(#trendFill)" activeDot={{ r: 5, fill: "#2f9d68", strokeWidth: 3, stroke: dark ? "#0a0d0b" : "#fff" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>}

    <section className="theme-card min-w-0 max-w-full overflow-hidden rounded-[28px] border border-black/[.04] bg-white p-5">
      <div><p className="text-sm font-semibold text-[#718078]">Distribución</p><h2 className="text-xl font-bold">Por categoría</h2></div>
      <div className="grid min-w-0 max-w-full grid-cols-1 items-center gap-3 pt-2 sm:grid-cols-[190px_minmax(0,1fr)]">
        <div className="relative mx-auto aspect-square w-[min(52vw,190px)] max-w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={distribution} dataKey="value" innerRadius="62%" outerRadius="86%" paddingAngle={2} stroke="none" onClick={(_, index) => { setActive(index); setSelectedByUser(true); }}>{distribution.map((item, index) => <Cell key={item.id} fill={item.color} opacity={index === active ? 1 : .66} />)}</Pie></PieChart></ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">{!selectedByUser && <small className="text-[8px] font-bold uppercase tracking-[.12em] text-[#718078]">Mayor gasto</small>}<span className="mt-0.5 text-2xl">{categoryEmoji(selected?.category)}</span>{selectedByUser && selected?.category.name && <span className="max-w-24 truncate text-[9px] font-semibold">{selected.category.name}</span>}<b className="mt-0.5 text-xs" style={{ color: selected?.color }}>{selectedByUser && selected ? formatMoney(selected.value) : `${selected ? Math.round(selected.value / total * 100) : 0}%`}</b>{selectedByUser && selected && <small className="text-[9px] text-[#718078]">{Math.round(selected.value / total * 100)}%</small>}</div>
        </div>
        {selected && <button onClick={() => { setActive(distribution.indexOf(selected)); setSelectedByUser(true); }} style={{ backgroundColor: getCategorySoftColor(selected.category) }} className="mx-auto flex min-h-16 w-full min-w-0 max-w-full flex-col items-stretch gap-1 overflow-hidden rounded-2xl px-4 py-3 text-left sm:mx-0 sm:flex-row sm:items-center sm:gap-3">
          <span className="flex min-w-0 items-center gap-2"><span className="shrink-0 text-2xl">{categoryEmoji(selected.category)}</span><b className="min-w-0 flex-1 truncate text-sm">{selected.category.name || "Categoría"}</b></span>
          <span className="min-w-0 text-sm sm:ml-auto sm:shrink-0 sm:text-right"><b className="whitespace-nowrap">{formatMoney(selected.value)}</b><small className="text-[#718078]"> · {Math.round(selected.value / total * 100)}%</small></span>
        </button>}
      </div>
    </section>
  </div>;
}
