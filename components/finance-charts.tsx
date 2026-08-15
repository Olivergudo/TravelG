"use client";

import { useMemo, useState } from "react";
import { Settings } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { categoryEmoji, categoryName } from "./expense-ui";
import type { Category, Expense } from "@/lib/types";
import { getCategoryColor } from "@/lib/category-colors";
import { formatCurrency, type Currency } from "@/lib/currency";
import { useI18n } from "@/lib/i18n";

const degreesToRadians = Math.PI / 180;

function CategoryEmojiLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx);
  const cy = Number(props.cy);
  const angle = -Number(props.midAngle) * degreesToRadians;
  const radius = Number(props.middleRadius || 0);
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  const emoji = String(props.payload?.emoji || "");

  return (
    <g className="pointer-events-none" aria-hidden="true">
      <text x={x} y={y} dy=".35em" textAnchor="middle" fontSize="11">
        {emoji}
      </text>
    </g>
  );
}

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

export function FinanceCharts({ expenses, categories, total, currency, manageCategories }: { expenses: Expense[]; categories: Category[]; total: number; currency: Currency; manageCategories: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const distribution = useMemo(
    () => buildCategoryDistribution(expenses, categories, total),
    [categories, expenses, total],
  );
  const chartData = distribution.map((item) => ({ ...item, name: categoryName(item.category, t) }));
  const activeItem = active === null ? undefined : chartData[active];

  if (!distribution.length) return (
    <section className="theme-card rounded-[28px] border border-black/[.04] bg-white p-5">
      <div className="flex justify-end"><button type="button" onClick={manageCategories} aria-label={t("finance.manageCategories")} className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf2ee] text-[#176b46]"><Settings size={19} /></button></div>
      <div className="px-3 pb-3 text-center"><h2 className="font-bold">{t("finance.noExpenses")}</h2><p className="mt-1 text-sm text-[#718078]">{t("finance.noExpensesHint")}</p></div>
    </section>
  );

  return (
    <section className="theme-card min-w-0 max-w-full overflow-hidden rounded-[28px] border border-black/[.04] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#718078]">{t("finance.distribution")}</p><h2 className="text-xl font-bold">{t("finance.byCategory")}</h2></div><button type="button" onClick={manageCategories} aria-label={t("finance.manageCategories")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf2ee] text-[#176b46]"><Settings size={19} /></button></div>
      <div className="grid min-w-0 grid-cols-1 items-center gap-6 pt-4 md:grid-cols-[minmax(280px,1.6fr)_minmax(220px,1fr)] md:gap-8 lg:grid-cols-[minmax(310px,1.7fr)_minmax(240px,1fr)]">
        <div className="finance-donut-enter relative mx-auto aspect-square w-[min(76vw,280px)] max-w-full md:w-[min(38vw,290px)]" aria-label={t("finance.byCategory")}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={chartData} dataKey="amount" nameKey="name" innerRadius="62%" outerRadius="87%" paddingAngle={2} stroke="none" label={CategoryEmojiLabel} labelLine={false} isAnimationActive={false} onMouseEnter={(_, index) => setActive(index)} onMouseLeave={() => setActive(null)} onClick={(_, index) => setActive(index)}>
                {distribution.map((item, index) => <Cell key={item.id} fill={item.color} opacity={active === null || active === index ? 1 : .55} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [formatCurrency(Number(value), currency), String(name)]} contentStyle={{ borderRadius: 14, border: "none", background: "#17201b", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <small className="max-w-28 truncate text-[10px] font-bold uppercase tracking-[.12em] text-[#718078]">{activeItem?.name || t("finance.total")}</small>
            <b className="mt-1 text-lg leading-tight sm:text-xl">{formatCurrency(activeItem?.amount ?? total, currency)}</b>
          </div>
        </div>
        <div className="min-w-0 divide-y divide-black/5 md:max-h-[320px] md:overflow-y-auto md:pr-1">
          {distribution.map((item, index) => (
            <button key={item.id} type="button" onClick={() => setActive(index)} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} className="flex min-h-[54px] w-full min-w-0 items-center gap-2 py-2 text-left">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="shrink-0 text-lg">{item.emoji}</span>
              <b className="min-w-0 flex-1 truncate text-sm">{categoryName(item.category, t)}</b>
              <span className="shrink-0 pl-2 text-right"><b className="block whitespace-nowrap text-sm tabular-nums">{formatCurrency(item.amount, currency)}</b><small className="text-xs text-[#718078]">{item.percentage}%</small></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
