"use client";

import {
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  ScanBarcode,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AppData, ShoppingListItem } from "@/lib/types";
import { BarcodeScanner } from "./barcode-scanner";
import { fridgeRepository } from "@/lib/fridge/repository";
import type { FridgeItem, FridgeItemInput } from "@/lib/fridge/types";
import { foodEmoji } from "@/lib/fridge/emoji";
import { lookupProduct, saveUnknownProduct } from "@/lib/products/service";
import { RecipeService } from "@/lib/recipes/service";
import type { RecipeSuggestion } from "@/lib/recipes/types";

type Update = (fn: (data: AppData) => AppData) => void;
const uid = () => crypto.randomUUID();

export function FridgeScreen({
  userId,
  data,
  update,
}: {
  userId: string;
  data: AppData;
  update: Update;
}) {
  const [items, setItems] = useState<FridgeItem[]>(() =>
    fridgeRepository.local(userId),
  );
  const [form, setForm] = useState<Partial<FridgeItem> | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [barcode, setBarcode] = useState<string>();
  const [unknownBarcode, setUnknownBarcode] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<{
    found: boolean;
    detail?: string;
  }>();
  const [looking, setLooking] = useState(false);
  const [recipes, setRecipes] = useState<RecipeSuggestion[] | null>(null);
  const [recipeSetup, setRecipeSetup] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fridgeRepository.load(userId).then(setItems);
  }, [userId]);
  const scanned = useCallback(async (code: string) => {
    setScanner(false);
    setLooking(true);
    setError("");
    setBarcode(code);
    try {
      const result = await lookupProduct(code);
      setUnknownBarcode(!result.found);
      setLookupInfo(
        result.found
          ? {
              found: true,
              detail: [result.product.brand, result.product.quantityText]
                .filter(Boolean)
                .join(" · "),
            }
          : { found: false },
      );
      setForm(
        result.found
          ? {
              barcode: code,
              name: result.product.name,
              quantity: 1,
              unit: result.product.quantityText || "unidad",
            }
          : { barcode: code, name: "", quantity: 1, unit: "unidad" },
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No pudimos buscar el producto.",
      );
    } finally {
      setLooking(false);
    }
  }, []);
  const save = async (input: FridgeItemInput, id?: string) => {
    setItems(
      id
        ? await fridgeRepository.update(userId, id, input, items)
        : await fridgeRepository.add(userId, input, items),
    );
    if (!id && input.barcode && unknownBarcode)
      saveUnknownProduct({
        barcode: input.barcode,
        name: input.name,
        quantityText: input.unit,
        source: "user",
      }).catch(() => undefined);
    setForm(null);
    setBarcode(undefined);
    setUnknownBarcode(false);
    setLookupInfo(undefined);
  };
  const addShopping = (name: string) => {
    const normalized = name.trim().toLocaleLowerCase("es-CL");
    if (
      data.shoppingListItems.some(
        (item) =>
          !item.completed &&
          item.name.trim().toLocaleLowerCase("es-CL") === normalized,
      )
    )
      return;
    const at = new Date().toISOString();
    const item: ShoppingListItem = {
      id: uid(),
      name: name.trim(),
      completed: false,
      createdAt: at,
      updatedAt: at,
    };
    update((current) => ({
      ...current,
      shoppingListItems: [...current.shoppingListItems, item],
    }));
  };
  const createRecipes = async (preference: string, craving: string) => {
    setRecipeSetup(false);
    setRecipeLoading(true);
    setError("");
    try {
      setRecipes(
        await RecipeService.generate(
          items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
          preference,
          craving,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No pudimos crear recetas.",
      );
    } finally {
      setRecipeLoading(false);
    }
  };
  return (
    <>
      <header className="px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <p className="text-[13px] font-bold uppercase tracking-[.18em] text-[#6f8278]">
          Inventario
        </p>
        <h1 className="mt-1 text-[30px] font-bold leading-tight">
          Refrigerador
        </h1>
        <p className="mt-1 text-sm text-[#718078]">
          {items.length} {items.length === 1 ? "producto" : "productos"}
        </p>
      </header>
      <div className="space-y-5 px-4 pb-32">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              setError("");
              setAddMenu(true);
            }}
            className="tap flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white"
          >
            <Plus />
            Agregar
          </button>
          <button
            disabled={recipeLoading}
            aria-disabled={!items.length}
            onClick={() => {
              if (!items.length) {
                setError(
                  "Agrega algunos alimentos primero para que podamos recomendarte qué cocinar.",
                );
                return;
              }
              setRecipeSetup(true);
            }}
            className={`theme-card tap flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-black/[.06] bg-white font-semibold text-[#176b46] disabled:opacity-60 ${!items.length ? "opacity-55" : ""}`}
          >
            {recipeLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Cocinar
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {looking && (
          <p className="flex items-center justify-center gap-2 py-5 text-[#718078]">
            <LoaderCircle className="animate-spin" />
            Buscando producto…
          </p>
        )}
        {!items.length && !looking ? (
          <div className="theme-card rounded-[26px] bg-white px-6 py-12 text-center">
            <PackageOpen className="mx-auto text-[#91a098]" size={42} />
            <h2 className="mt-3 text-lg font-bold">
              Tu refrigerador está vacío
            </h2>
            <p className="mt-1 text-sm text-[#718078]">
              Agrega productos manualmente o escanea su código.
            </p>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">
              Disponibles
            </h2>
            {items.map((item) => (
              <article
                key={item.id}
                className="theme-card flex min-h-[68px] items-center rounded-2xl bg-white px-4"
              >
                <span className="mr-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#e6f3ec] text-2xl">
                  {foodEmoji(item.name)}
                </span>
                <button
                  onClick={() => setForm(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <b className="block truncate">{item.name}</b>
                  <span className="text-sm text-[#718078]">
                    {item.quantity !== undefined || item.unit
                      ? `${item.quantity ?? ""} ${item.unit || ""}`.trim()
                      : "Sin cantidad"}
                  </span>
                </button>
                <button
                  onClick={() => setForm(item)}
                  aria-label={`Editar ${item.name}`}
                  className="grid h-10 w-10 place-items-center text-[#718078]"
                >
                  <Pencil size={17} />
                </button>
                <button
                  onClick={async () =>
                    setItems(
                      await fridgeRepository.remove(userId, item.id, items),
                    )
                  }
                  aria-label={`Eliminar ${item.name}`}
                  className="grid h-10 w-10 place-items-center text-[#718078]"
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </section>
        )}
      </div>
      {addMenu && (
        <AddProductMenu
          close={() => setAddMenu(false)}
          manual={() => {
            setAddMenu(false);
            setForm({ name: "", quantity: 1, unit: "unidad" });
          }}
          scan={() => {
            setAddMenu(false);
            setScanner(true);
          }}
        />
      )}
      {scanner && (
        <BarcodeScanner close={() => setScanner(false)} scanned={scanned} />
      )}
      {form && (
        <ItemForm
          initial={form}
          barcode={barcode}
          lookupInfo={lookupInfo}
          close={() => {
            setForm(null);
            setLookupInfo(undefined);
          }}
          save={(input) => save(input, form.id)}
        />
      )}
      {recipeSetup && (
        <RecipePrompt
          close={() => setRecipeSetup(false)}
          submit={createRecipes}
        />
      )}
      {recipes && (
        <RecipesSheet
          recipes={recipes}
          close={() => setRecipes(null)}
          addShopping={addShopping}
        />
      )}
    </>
  );
}

function AddProductMenu({
  close,
  manual,
  scan,
}: {
  close: () => void;
  manual: () => void;
  scan: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-product-title"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center">
          <h2 id="add-product-title" className="flex-1 text-2xl font-bold">
            Agregar producto
          </h2>
          <button
            onClick={close}
            aria-label="Cerrar"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
          >
            <X />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          <button
            onClick={manual}
            className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#176b46] px-4 text-left font-semibold text-white"
          >
            <Plus className="shrink-0" /> Agregar manualmente
          </button>
          <button
            onClick={scan}
            className="theme-card flex min-h-14 w-full items-center gap-3 rounded-2xl border border-black/[.06] bg-white px-4 text-left font-semibold text-[#176b46]"
          >
            <ScanBarcode className="shrink-0" /> Escanear código
          </button>
        </div>
      </section>
    </div>
  );
}

function RecipePrompt({
  close,
  submit,
}: {
  close: () => void;
  submit: (preference: string, craving: string) => void;
}) {
  const [preference, setPreference] = useState("Recomiéndame algo");
  const [craving, setCraving] = useState("");
  const options = [
    "⚡ Rápido",
    "🥗 Saludable",
    "💰 Económico",
    "🍽️ Recomiéndame algo",
  ];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">
              Recetas con IA
            </p>
            <h2 className="text-2xl font-bold">¿Qué prefieres?</h2>
          </div>
          <button
            onClick={close}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {options.map((option) => {
            const value = option.replace(/^\S+\s/, "");
            return (
              <button
                key={option}
                onClick={() => setPreference(value)}
                className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${preference === value ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        <input
          value={craving}
          onChange={(e) => setCraving(e.target.value)}
          placeholder="¿Qué se te antoja? (opcional)"
          className="mt-3 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3"
        />
        <button
          onClick={() => submit(preference, craving)}
          className="mt-4 min-h-14 w-full rounded-2xl bg-[#176b46] font-semibold text-white"
        >
          Crear sugerencias
        </button>
      </section>
    </div>
  );
}

function ItemForm({
  initial,
  barcode,
  lookupInfo,
  close,
  save,
}: {
  initial: Partial<FridgeItem>;
  barcode?: string;
  lookupInfo?: { found: boolean; detail?: string };
  close: () => void;
  save: (value: FridgeItemInput) => void;
}) {
  const [name, setName] = useState(initial.name || "");
  const [quantity, setQuantity] = useState(String(initial.quantity ?? ""));
  const [unit, setUnit] = useState(initial.unit || "");
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim())
            save({
              name: name.trim(),
              barcode: initial.barcode || barcode,
              quantity: quantity.trim()
                ? Number(quantity) || undefined
                : undefined,
              unit,
            });
        }}
        className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"
      >
        <div className="flex items-center">
          <h2 className="flex-1 text-2xl font-bold">
            {lookupInfo
              ? lookupInfo.found
                ? "Producto encontrado"
                : "Producto no encontrado"
              : initial.id
                ? "Editar producto"
                : "Agregar producto"}
          </h2>
          <button
            type="button"
            onClick={close}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        {initial.barcode && (
          <p className="mt-1 text-xs text-[#718078]">
            Código {initial.barcode}
          </p>
        )}
        {lookupInfo?.detail && (
          <p className="mt-1 text-sm text-[#718078]">{lookupInfo.detail}</p>
        )}
        <label className="mt-4 block text-sm font-semibold">
          Nombre
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3 outline-none focus:border-[#176b46]"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            Cantidad
            <span className="mt-1 flex min-h-12 overflow-hidden rounded-xl border border-black/10">
              <button
                type="button"
                onClick={() =>
                  setQuantity(String(Math.max(0, (Number(quantity) || 1) - 1)))
                }
                className="w-11 text-xl"
              >
                −
              </button>
              <input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-center"
              />
              <button
                type="button"
                onClick={() => setQuantity(String((Number(quantity) || 0) + 1))}
                className="w-11 text-xl"
              >
                +
              </button>
            </span>
          </label>
          <label className="text-sm font-semibold">
            Unidad
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3"
            />
          </label>
        </div>
        <button className="mt-5 min-h-14 w-full rounded-2xl bg-[#176b46] font-semibold text-white">
          Guardar
        </button>
      </form>
    </div>
  );
}

function RecipesSheet({
  recipes,
  close,
  addShopping,
}: {
  recipes: RecipeSuggestion[];
  close: () => void;
  addShopping: (name: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50">
      <section className="theme-card mx-auto mt-[max(5rem,env(safe-area-inset-top))] min-h-[calc(100dvh-5rem)] max-w-2xl rounded-t-[30px] bg-white p-5 safe-bottom">
        <div className="flex items-center">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">
              Ideas con lo que tienes
            </p>
            <h2 className="text-2xl font-bold">Recetas</h2>
          </div>
          <button
            onClick={close}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {recipes.map((recipe) => (
            <article
              key={recipe.title}
              className="rounded-2xl border border-black/[.06] p-4"
            >
              <div className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">{recipe.title}</h3>
                  <p className="text-sm text-[#718078]">{recipe.description}</p>
                </div>
                {recipe.estimatedMinutes && (
                  <span className="shrink-0 text-xs font-semibold text-[#718078]">
                    {recipe.estimatedMinutes} min
                  </span>
                )}
              </div>
              <p
                className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${recipe.missingIngredients.length ? "bg-amber-50 text-amber-800" : "bg-[#e6f3ec] text-[#176b46]"}`}
              >
                {recipe.missingIngredients.length
                  ? "Te falta poco"
                  : "Puedes cocinar ahora"}
              </p>
              {recipe.missingIngredients.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold">Faltan:</p>
                  {recipe.missingIngredients.map((name) => (
                    <button
                      key={name}
                      onClick={() => addShopping(name)}
                      className="mr-2 mt-2 rounded-full border border-[#176b46] px-3 py-1.5 text-sm font-semibold text-[#176b46]"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold text-[#176b46]">
                  Ver preparación
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {recipe.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
        {!recipes.length && (
          <p className="py-12 text-center text-[#718078]">
            No encontramos una receta adecuada. Prueba agregando más productos.
          </p>
        )}
      </section>
    </div>
  );
}
