"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { categoryEmoji, formatMoney } from "./expense-ui";
import type { Category, Expense } from "@/lib/types";
import { getCategoryColor } from "@/lib/category-colors";

export function buildCategoryDistribution(expenses: Expense[], categories: Category[], total: number) {
  return categories.map((category) => {
    const amount = expenses.filter((expense) => expense.categoryId === category.id)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      id: category.id,
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      emoji: categoryEmoji(category),
      color: getCategoryColor(category),
    };
  }).filter((item) => item.amount > 0).sort((left, right) => right.amount - left.amount);
}

export function FinanceCharts({ expenses, categories, total }: { expenses: Expense[]; categories: Category[]; total: number }) {
  const [active, setActive] = useState<number | null>(null);
  const distribution = useMemo(
    () => buildCategoryDistribution(expenses, categories, total),
    [categories, expenses, total],
  );

  if (!distribution.length) return (
    <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-8 text-center">
      <h2 className="font-bold">Aún no hay gastos para mostrar</h2>
      <p className="mt-1 text-sm text-[#718078]">Agrega tu primer gasto para ver la distribución.</p>
    </section>
  );

  return (
    <section className="theme-card min-w-0 max-w-full overflow-hidden rounded-[28px] border border-black/[.04] bg-white p-5">
      <div><p className="text-sm font-semibold text-[#718078]">Distribución</p><h2 className="text-xl font-bold">Por categoría</h2></div>
      <div className="grid min-w-0 grid-cols-1 items-center gap-5 pt-3 sm:grid-cols-[210px_minmax(0,1fr)]">
        <div className="relative mx-auto aspect-square w-[min(56vw,210px)] max-w-full" aria-label="Distribución de gastos por categoría">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={distribution} dataKey="amount" innerRadius="62%" outerRadius="87%" paddingAngle={2} stroke="none" onMouseEnter={(_, index) => setActive(index)} onMouseLeave={() => setActive(null)} onClick={(_, index) => setActive(index)}>
                {distribution.map((item, index) => <Cell key={item.id} fill={item.color} opacity={active === null || active === index ? 1 : .55} />)}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 14, border: "none", background: "#17201b", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <small className="text-[9px] font-bold uppercase tracking-[.14em] text-[#718078]">Total</small>
            <b className="mt-1 text-sm sm:text-base">{formatMoney(total)}</b>
          </div>
        </div>
        <div className="min-w-0 divide-y divide-black/5">
          {distribution.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setActive(index)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} className="flex min-h-[58px] w-full min-w-0 items-center gap-2 py-2 text-left">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="shrink-0 text-xl">{item.emoji}</span>
              <b className="min-w-0 flex-1 truncate text-sm">{item.category.name || "Categoría"}</b>
              <span className="shrink-0 text-right"><b className="block whitespace-nowrap text-sm">{formatMoney(item.amount)}</b><small className="text-[#718078]">{item.percentage}%</small></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
