"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { categoryEmoji, formatMoney } from "./expense-ui";
import type { Category, Expense } from "@/lib/types";

const palette = ["#176b46", "#2f8a70", "#55a58a", "#78aa91", "#527568", "#91a99e", "#34594b"];

export function FinanceHeroDonut({ expenses, categories, total }: { expenses: Expense[]; categories: Category[]; total: number }) {
  const data = categories.map((category, index) => ({
    id: category.id,
    value: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
    color: ["#66d49a", "#a9e8c5", "#3fae77", "#d5f4e2", "#79bfa0", "#b7d7c7"][index % 6],
  })).filter((item) => item.value > 0);
  const chartData = data.length ? data : [{ id: "empty", value: 1, color: "rgba(255,255,255,.14)" }];
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[112px] w-[112px] shrink-0" aria-label="Distribución mensual por categorías">
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius={35} outerRadius={52} paddingAngle={data.length ? 2 : 0} stroke="none">{chartData.map((item) => <Cell key={item.id} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer>
        <div className="absolute inset-0 grid place-content-center text-center"><span className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Categorías</span><b className="text-lg">{data.length}</b></div>
      </div>
      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-white/65">Gastado este mes</p><p className="mt-2 truncate text-[36px] font-bold leading-none tracking-[-.04em]">{formatMoney(total)}</p><p className="mt-3 text-xs text-white/55">Distribución de tus gastos</p></div>
    </div>
  );
}

export function FinanceCharts({ expenses, categories, total, dark, showDistribution = true }: { expenses: Expense[]; categories: Category[]; total: number; dark: boolean; showDistribution?: boolean }) {
  const [active, setActive] = useState(0);
  const distribution = useMemo(() => categories.map((category, index) => ({
    id: category.id,
    category,
    value: expenses.filter((expense) => expense.categoryId === category.id).reduce((sum, expense) => sum + expense.amount, 0),
    color: palette[index % palette.length],
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

  if (!expenses.length) return (
    <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-6 text-center">
      <div className="mx-auto mb-4 h-28 w-28 rounded-full border-[14px] border-[#dfe8e2]" />
      <h2 className="font-bold">Todavía no hay gastos para mostrar</h2>
      <p className="mt-1 text-sm text-[#718078]">Agrega tu primer gasto para ver tendencias y distribución.</p>
    </section>
  );

  return <div className="space-y-5">
    {showDistribution && <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-5">
      <div className="mb-2"><p className="text-sm font-semibold text-[#718078]">Tendencia diaria</p><h2 className="text-xl font-bold">Gasto este mes</h2></div>
      <div className="h-44 w-full" aria-label="Gráfica de gasto diario">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
            <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f9d68" stopOpacity={0.34}/><stop offset="100%" stopColor="#2f9d68" stopOpacity={0}/></linearGradient></defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} interval={6} tick={{ fill: dark ? "#91a098" : "#718078", fontSize: 11 }} />
            <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(day) => `Día ${day}`} contentStyle={{ borderRadius: 14, border: "none", background: dark ? "#17201b" : "#fff", color: dark ? "#fff" : "#17231d", boxShadow: "0 8px 24px rgba(0,0,0,.12)" }} />
            <Area type="monotone" dataKey="amount" stroke="#2f9d68" strokeWidth={3} fill="url(#trendFill)" activeDot={{ r: 5, fill: "#2f9d68", strokeWidth: 3, stroke: dark ? "#0a0d0b" : "#fff" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>}

    <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-5">
      <div><p className="text-sm font-semibold text-[#718078]">Distribución</p><h2 className="text-xl font-bold">Por categoría</h2></div>
      <div className="grid items-center gap-4 min-[390px]:grid-cols-[170px_1fr]">
        <div className="relative mx-auto h-[170px] w-[170px]">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" innerRadius={57} outerRadius={78} paddingAngle={2} stroke="none" onClick={(_, index) => setActive(index)}>{distribution.map((item, index) => <Cell key={item.id} fill={item.color || palette[index % palette.length]} opacity={index === active ? 1 : .64} />)}</Pie></PieChart></ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center"><span className="text-2xl">{categoryEmoji(selected?.category)}</span><b className="mt-1 text-sm">{selected ? formatMoney(selected.value) : formatMoney(total)}</b></div>
        </div>
        <div className="space-y-2.5">{distribution.slice(0, 5).map((item, index) => <button key={item.id} onClick={() => setActive(index)} className="flex min-h-10 w-full items-center gap-2 text-left"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} /><span className="text-xl">{categoryEmoji(item.category)}</span><span className="min-w-0 flex-1 truncate text-xs text-[#718078]">{item.category.name || `${Math.round(item.value / total * 100)}%`}</span><b className="text-xs">{formatMoney(item.value)}</b></button>)}</div>
      </div>
    </section>
  </div>;
}
