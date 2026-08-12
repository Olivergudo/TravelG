"use client";
import { useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  Plus,
  ReceiptText,
  ShoppingBasket,
  X,
} from "lucide-react";
import { ReceiptScanner } from "./receipt-scanner";
import { CategoryPicker, QuickExpenseForm } from "./expense-ui";
import type {
  ActivePurchase,
  AppData,
  DraftItem,
  PendingProduct,
  Purchase,
  PurchaseItem,
} from "@/lib/types";
type Update = (fn: (data: AppData) => AppData) => void;
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const normalize = (name: string) =>
  name
    .trim()
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const number = (value: string) => Number(value.replace(/\D/g, "")) || 0;
const money = (value = 0) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
const date = (value: string, detail = false) =>
  new Date(value).toLocaleDateString(
    "es-CL",
    detail ? { dateStyle: "long" } : { day: "numeric", month: "short" },
  );
export function ShoppingV2({
  data,
  update,
}: {
  data: AppData;
  update: Update;
}) {
  const [ticketId, setTicketId] = useState<string>();
  const ticket = data.purchases.find((p) => p.id === ticketId);
  if (ticket)
    return (
      <Ticket
        purchase={ticket}
        update={update}
        back={() => setTicketId(undefined)}
      />
    );
  if (data.activePurchase) return <ShoppingMode data={data} update={update} />;
  return <Home data={data} update={update} openTicket={setTicketId} />;
}
function Home({
  data,
  update,
  openTicket,
}: {
  data: AppData;
  update: Update;
  openTicket: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [scanner, setScanner] = useState(false);
  const [expenseForm, setExpenseForm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim(),
      key = normalize(clean);
    if (!clean) {
      input.current?.focus();
      return;
    }
    if (data.pendingProducts.some((p) => p.normalizedName === key)) {
      setName("");
      input.current?.focus();
      return;
    }
    const at = now(),
      product: PendingProduct = {
        id: uid(),
        name: clean,
        normalizedName: key,
        defaultQuantity: 1,
        createdAt: at,
        updatedAt: at,
      };
    update((d) => ({ ...d, pendingProducts: [...d.pendingProducts, product] }));
    setName("");
    requestAnimationFrame(() => input.current?.focus());
  };
  const start = () => {
    const draft: ActivePurchase = { id: uid(), startedAt: now(), items: [] };
    update((d) => ({ ...d, activePurchase: draft }));
  };
  return (
    <>
      <Header
        title="Compras"
        caption={`${data.pendingProducts.length} pendientes`}
      />
      <div className="space-y-5 px-4">
        <form onSubmit={add} className="flex gap-2 rounded-2xl bg-white p-2">
          <input
            ref={input}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 outline-none"
            placeholder="Agregar producto…"
          />
          <button
            type="submit"
            aria-label="Agregar producto"
            className="rounded-xl bg-[#176b46] p-3 text-white"
          >
            <Plus />
          </button>
        </form>
        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#718078]">
            Pendientes
          </h2>
          <div className="overflow-hidden rounded-3xl bg-white">
            {data.pendingProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center border-b border-black/5 p-4 last:border-0"
              >
                <span className="mr-3 h-5 w-5 rounded-full border-2 border-[#b9c2bd]" />
                <b>{p.name}</b>
              </div>
            ))}
            {!data.pendingProducts.length && (
              <Empty text="Agrega lo que todavía necesitas comprar." />
            )}
          </div>
        </section>
        <button
          disabled={!data.pendingProducts.length}
          onClick={start}
          className="w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white disabled:opacity-40"
        >
          Iniciar compra
        </button>
        <button
          onClick={() => setScanner(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-[#176b46]"
        >
          <Camera size={20} /> Escanear ticket
        </button>
        <button
          onClick={() => setExpenseForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-[#176b46]"
        >
          <Plus size={20} /> Registrar gasto
        </button>
        {data.purchases.length > 0 && (
          <section>
            <h2 className="mb-3 mt-7 text-lg font-bold">Historial</h2>
            <div className="overflow-hidden rounded-3xl bg-white">
              {[...data.purchases]
                .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openTicket(p.id)}
                    className="flex w-full items-center gap-3 border-b border-black/5 p-4 text-left last:border-0"
                  >
                    <ReceiptText className="text-[#176b46]" />
                    <span className="flex-1">
                      <b className="block">{p.supermarketName}</b>
                      <small className="text-[#809087]">
                        {date(p.completedAt)} · {p.items.length} productos
                      </small>
                    </span>
                    <b>{money(p.total)}</b>
                    <ChevronLeft
                      className="rotate-180 text-[#91a098]"
                      size={18}
                    />
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
      {scanner && (
        <ReceiptScanner
          data={data}
          update={update}
          close={() => setScanner(false)}
        />
      )}
      {expenseForm && (
        <QuickExpenseForm
          categories={data.categories}
          close={() => setExpenseForm(false)}
          save={(expense) => {
            update((d) => ({ ...d, expenses: [expense, ...d.expenses] }));
            setExpenseForm(false);
          }}
        />
      )}
    </>
  );
}
function ShoppingMode({ data, update }: { data: AppData; update: Update }) {
  const draft = data.activePurchase!;
  const [selected, setSelected] = useState<PendingProduct>();
  const [extra, setExtra] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const total = draft.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
  const pending = data.pendingProducts.filter(
    (p) => !draft.items.some((i) => i.sourcePendingProductId === p.id),
  );
  const saveDraftItem = (item: DraftItem) =>
    update((d) => ({
      ...d,
      activePurchase: d.activePurchase
        ? {
            ...d.activePurchase,
            items: [
              ...d.activePurchase.items.filter((i) =>
                item.sourcePendingProductId
                  ? i.sourcePendingProductId !== item.sourcePendingProductId
                  : i.productName !== item.productName,
              ),
              item,
            ],
          }
        : d.activePurchase,
    }));
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-[#eef3ef] pb-28">
      <div className="sticky top-0 z-20 bg-[#173d2d] px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <p className="text-sm text-white/65">Compra actual</p>
        <p className="mt-1 text-4xl font-bold">{money(total)}</p>
        <p className="mt-2 text-sm text-white/75">
          {draft.items.length} productos en carrito
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div className="flex justify-end">
          <button
            onClick={() => setExtra(true)}
            className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#176b46]"
          >
            + Agregar producto
          </button>
        </div>
        {draft.items.length > 0 && (
          <Group title="En carrito">
            {draft.items.map((item) => (
              <button
                key={item.sourcePendingProductId || item.productName}
                onClick={() => {
                  const source = data.pendingProducts.find(
                    (p) => p.id === item.sourcePendingProductId,
                  );
                  if (source) setSelected(source);
                }}
                className="flex w-full border-b border-black/5 p-4 text-left last:border-0"
              >
                <Check className="mr-3 text-[#176b46]" />
                <span className="flex-1">
                  <b className="block">
                    {item.productName}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                  </b>
                  <small className="text-[#809087]">
                    {item.quantity} × {money(item.unitPrice)}
                  </small>
                </span>
                <b>{money(item.quantity * item.unitPrice)}</b>
              </button>
            ))}
          </Group>
        )}
        <div className="flex px-3 font-bold">
          <span className="flex-1">Subtotal</span>
          {money(total)}
        </div>
        <Group title="Todavía pendientes">
          {pending.map((product) => (
            <button
              key={product.id}
              onClick={() => setSelected(product)}
              className="w-full border-b border-black/5 p-5 text-left text-lg font-semibold last:border-0"
            >
              {product.name}
            </button>
          ))}
          {!pending.length && (
            <Empty text="Todo lo pendiente está en el carrito." />
          )}
        </Group>
        <button
          disabled={!draft.items.length}
          onClick={() => setFinishing(true)}
          className="fixed bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 rounded-2xl bg-[#176b46] py-4 font-bold text-white shadow-xl disabled:opacity-40"
        >
          Finalizar compra
        </button>
      </div>
      {selected && (
        <ProductEditor
          product={selected}
          current={draft.items.find(
            (i) => i.sourcePendingProductId === selected.id,
          )}
          close={() => setSelected(undefined)}
          save={(item) => {
            saveDraftItem(item);
            setSelected(undefined);
          }}
        />
      )}
      {extra && (
        <ExtraEditor
          close={() => setExtra(false)}
          save={(item) => {
            saveDraftItem(item);
            setExtra(false);
          }}
        />
      )}
      {finishing && (
        <Finalize
          data={data}
          total={total}
          pendingCount={pending.length}
          close={() => setFinishing(false)}
          save={(market, toFinances, categoryId) =>
            finishPurchase(data, update, market, toFinances, categoryId)
          }
        />
      )}
    </main>
  );
}
function finishPurchase(
  data: AppData,
  update: Update,
  market: string,
  toFinances: boolean,
  categoryId: string,
) {
  const draft = data.activePurchase;
  if (!draft) return;
  const completedAt = now(),
    purchaseId = uid(),
    expenseId = toFinances ? uid() : undefined;
  const items: PurchaseItem[] = draft.items.map((i) => ({
    id: uid(),
    purchaseId,
    sourcePendingProductId: i.sourcePendingProductId,
    productName: i.productName,
    normalizedName: normalize(i.productName),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    totalPrice: i.quantity * i.unitPrice,
    createdAt: completedAt,
  }));
  const purchase: Purchase = {
    id: purchaseId,
    supermarketName: market,
    startedAt: draft.startedAt,
    completedAt,
    total: items.reduce((sum, i) => sum + i.totalPrice, 0),
    source: "manual",
    expenseId,
    items,
  };
  update((d) => {
    if (!d.activePurchase) return d;
    const boughtIds = new Set(
      d.activePurchase.items
        .map((i) => i.sourcePendingProductId)
        .filter(Boolean),
    );
    const future = d.activePurchase.items
      .filter((i) => i.addedDuringShopping && i.addToPending)
      .map((i) => ({
        id: uid(),
        name: i.productName,
        normalizedName: normalize(i.productName),
        defaultQuantity: i.quantity,
        createdAt: completedAt,
        updatedAt: completedAt,
      }));
    const expense = expenseId
      ? {
          id: expenseId,
          description: `Compra - ${market}`,
          amount: purchase.total,
          categoryId,
          date: completedAt,
          time: new Date(completedAt).toTimeString().slice(0, 8),
          source: "purchase" as const,
          purchaseId,
          createdAt: completedAt,
          updatedAt: completedAt,
        }
      : undefined;
    return {
      ...d,
      pendingProducts: [
        ...d.pendingProducts.filter((p) => !boughtIds.has(p.id)),
        ...future.filter(
          (p) =>
            !d.pendingProducts.some(
              (old) => old.normalizedName === p.normalizedName,
            ),
        ),
      ],
      purchases: [purchase, ...d.purchases],
      expenses: expense ? [expense, ...d.expenses] : d.expenses,
      activePurchase: undefined,
    };
  });
}
function ProductEditor({
  product,
  current,
  close,
  save,
}: {
  product: PendingProduct;
  current?: DraftItem;
  close: () => void;
  save: (item: DraftItem) => void;
}) {
  const [quantity, setQuantity] = useState(
    current?.quantity || product.defaultQuantity,
  );
  const [price, setPrice] = useState(current ? String(current.unitPrice) : "");
  return (
    <Sheet title={product.name} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (number(price))
            save({
              sourcePendingProductId: product.id,
              productName: product.name,
              quantity,
              unitPrice: number(price),
              addedDuringShopping: false,
              addToPending: false,
            });
        }}
        className="space-y-5"
      >
        <Counter value={quantity} set={setQuantity} />
        <Input label="Precio unitario">
          <input
            autoFocus
            inputMode="numeric"
            enterKeyHint="done"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$ 0"
          />
        </Input>
        <p className="text-right">
          Total del producto: <b>{money(quantity * number(price))}</b>
        </p>
        <button className="w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white">
          Agregar
        </button>
      </form>
    </Sheet>
  );
}
function ExtraEditor({
  close,
  save,
}: {
  close: () => void;
  save: (item: DraftItem) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [future, setFuture] = useState(false);
  return (
    <Sheet title="Producto imprevisto" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && number(price))
            save({
              productName: name.trim(),
              quantity,
              unitPrice: number(price),
              addedDuringShopping: true,
              addToPending: future,
            });
        }}
        className="space-y-5"
      >
        <Input label="Producto">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Chocolate"
          />
        </Input>
        <Counter value={quantity} set={setQuantity} />
        <Input label="Precio unitario">
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$ 0"
          />
        </Input>
        <label className="flex gap-3 text-sm">
          <input
            type="checkbox"
            checked={future}
            onChange={(e) => setFuture(e.target.checked)}
          />{" "}
          Agregar también a pendientes futuras
        </label>
        <button className="w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white">
          Agregar a la compra
        </button>
      </form>
    </Sheet>
  );
}
function Finalize({
  data,
  total,
  pendingCount,
  close,
  save,
}: {
  data: AppData;
  total: number;
  pendingCount: number;
  close: () => void;
  save: (market: string, finance: boolean, categoryId: string) => void;
}) {
  const recent = useMemo(
    () =>
      [...new Set(data.purchases.map((p) => p.supermarketName))].slice(0, 4),
    [data.purchases],
  );
  const [market, setMarket] = useState(recent[0] || "");
  const [categoryId, setCategoryId] = useState("supermarket");
  const saving = useRef(false);
  const submit = (finance: boolean) => {
    if (!market.trim() || saving.current) return;
    saving.current = true;
    save(market.trim(), finance, categoryId);
  };
  return (
    <Sheet title="¿Dónde compraste?" close={close}>
      <div className="space-y-5">
        {recent.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {recent.map((name) => (
              <button
                key={name}
                onClick={() => setMarket(name)}
                className={
                  "rounded-full px-4 py-2 text-sm " +
                  (market === name ? "bg-[#176b46] text-white" : "bg-[#edf3ef]")
                }
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <Input label="Supermercado">
          <input
            autoFocus={!recent.length}
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="Jumbo, Lider, Unimarc…"
          />
        </Input>
        <div className="rounded-2xl bg-[#f3f6f3] p-4">
          <div className="flex">
            <span className="flex-1">Total</span>
            <b>{money(total)}</b>
          </div>
          <p className="mt-2 text-sm text-[#718078]">
            Quedarán {pendingCount} pendientes
          </p>
        </div>
        <div>
          <b className="mb-2 block text-sm">Categoría en Finanzas</b>
          <CategoryPicker
            categories={data.categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <button
          disabled={!market.trim()}
          onClick={() => submit(false)}
          className="w-full rounded-2xl bg-[#173d2d] py-4 font-bold text-white disabled:opacity-40"
        >
          Guardar ticket
        </button>
        <button
          disabled={!market.trim()}
          onClick={() => submit(true)}
          className="w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white disabled:opacity-40"
        >
          Guardar también en Finanzas
        </button>
      </div>
    </Sheet>
  );
}
function Ticket({
  purchase,
  update,
  back,
}: {
  purchase: Purchase;
  update: Update;
  back: () => void;
}) {
  const sendToFinances = () => {
    const expenseId = uid();
    const createdAt = now();
    update((data) => {
      const current = data.purchases.find((item) => item.id === purchase.id);
      if (!current || current.expenseId) return data;
      const expense = {
        id: expenseId,
        description: `Compra - ${current.supermarketName}`,
        amount: current.total,
        categoryId: "supermarket",
        date: current.completedAt,
        time: new Date(current.completedAt).toTimeString().slice(0, 8),
        source:
          current.source === "receipt"
            ? ("receipt" as const)
            : ("purchase" as const),
        purchaseId: current.id,
        createdAt,
        updatedAt: createdAt,
      };
      return {
        ...data,
        purchases: data.purchases.map((item) =>
          item.id === current.id ? { ...item, expenseId } : item,
        ),
        expenses: [expense, ...data.expenses],
      };
    });
  };
  return (
    <>
      <Header
        title={purchase.supermarketName}
        caption="Ticket de compra"
        back={back}
      />
      <div className="px-4">
        <section className="rounded-[28px] bg-white p-5">
          <div className="mb-6 text-center">
            <ReceiptText className="mx-auto mb-2 text-[#176b46]" />
            <h2 className="text-xl font-bold uppercase">
              {purchase.supermarketName}
            </h2>
            <p className="text-sm text-[#718078]">
              {date(purchase.completedAt, true)} ·{" "}
              {new Date(purchase.completedAt).toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {purchase.items.map((i) => (
            <div
              key={i.id}
              className="flex border-b border-dashed border-black/10 py-3"
            >
              <span className="flex-1">
                <b className="block">{i.productName}</b>
                <small className="text-[#718078]">
                  {i.quantity} × {money(i.unitPrice)}
                </small>
              </span>
              <b>{money(i.totalPrice)}</b>
            </div>
          ))}
          <div className="mt-5 flex items-end">
            <b className="flex-1 text-lg">TOTAL</b>
            <b className="text-2xl">{money(purchase.total)}</b>
          </div>
          {purchase.expenseId && (
            <p className="mt-4 text-center text-xs text-[#176b46]">
              Guardado también en Finanzas
            </p>
          )}
          {!purchase.expenseId && (
            <button
              onClick={sendToFinances}
              className="mt-5 w-full rounded-2xl bg-[#176b46] py-4 font-bold text-white"
            >
              Enviar esta compra a Finanzas
            </button>
          )}
        </section>
      </div>
    </>
  );
}
function Header({
  title,
  caption,
  back,
}: {
  title: string;
  caption: string;
  back?: () => void;
}) {
  return (
    <header className="px-5 pb-4 pt-7">
      {back && (
        <button
          onClick={back}
          className="mb-4 flex items-center text-sm text-[#587067]"
        >
          <ChevronLeft size={18} /> Compras
        </button>
      )}
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#789087]">
        {caption}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
    </header>
  );
}
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#718078]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-3xl bg-white">{children}</div>
    </section>
  );
}
function Counter({ value, set }: { value: number; set: (n: number) => void }) {
  return (
    <div>
      <b className="mb-2 block text-sm">Cantidad</b>
      <div className="flex items-center justify-center gap-7 rounded-2xl bg-[#f3f6f3] p-3">
        <button
          type="button"
          onClick={() => set(Math.max(1, value - 1))}
          className="h-10 w-10 rounded-full bg-white text-xl"
        >
          −
        </button>
        <b className="text-xl">{value}</b>
        <button
          type="button"
          onClick={() => set(value + 1)}
          className="h-10 w-10 rounded-full bg-white text-xl"
        >
          +
        </button>
      </div>
    </div>
  );
}
function Sheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
      <section className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-t-[30px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[30px]">
        <div className="mb-5 flex">
          <h2 className="flex-1 text-xl font-bold">{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Input({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <label className="block">
      <b className="mb-2 block text-sm">{label}</b>
      <span className="block [&>input]:w-full [&>input]:rounded-2xl [&>input]:bg-[#f3f6f3] [&>input]:p-4 [&>input]:outline-none">
        {children}
      </span>
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="p-8 text-center text-sm text-[#718078]">
      <ShoppingBasket className="mx-auto mb-2 text-[#9bb0a5]" />
      {text}
    </div>
  );
}
