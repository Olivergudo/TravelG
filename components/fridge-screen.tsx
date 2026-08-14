"use client";

import {
  BookHeart,
  Clipboard,
  FileText,
  Heart,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  ScanBarcode,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData, ShoppingListItem } from "@/lib/types";
import { BarcodeScanner } from "./barcode-scanner";
import { fridgeRepository } from "@/lib/fridge/repository";
import type { FridgeItem, FridgeItemInput } from "@/lib/fridge/types";
import { findPossibleDuplicateProduct } from "@/lib/fridge/duplicates";
import { getFoodFilterCategory, getFoodVisual, type FoodFilterCategory } from "@/lib/fridge/emoji";
import { lookupProduct, saveUnknownProduct } from "@/lib/products/service";
import { RecipeService } from "@/lib/recipes/service";
import type { RecipeSuggestion } from "@/lib/recipes/types";
import { savedRecipeRepository } from "@/lib/recipes/saved-repository";
import { recipeFingerprint, type SavedRecipe } from "@/lib/recipes/saved-types";
import { recipeAsText, recipePdf } from "@/lib/recipes/share";
import { shareOrDownloadPdf } from "@/lib/pdf/share";

type Update = (fn: (data: AppData) => AppData) => void;
const uid = () => crypto.randomUUID();

export function FridgeScreen({
  userId,
  data,
  update,
  canScanProducts,
  canCook,
}: {
  userId: string;
  data: AppData;
  update: Update;
  canScanProducts: boolean;
  canCook: boolean;
}) {
  const [items, setItems] = useState<FridgeItem[]>(() =>
    fridgeRepository.local(userId),
  );
  const [form, setForm] = useState<Partial<FridgeItem> | null>(null);
  const [captureMode, setCaptureMode] = useState<"scanner" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const quickInput = useRef<HTMLInputElement>(null);
  const [addedFeedback, setAddedFeedback] = useState("");
  const feedbackTimer = useRef<number | undefined>(undefined);
  const lastScan = useRef<{ code: string; at: number } | undefined>(undefined);
  const [scanner, setScanner] = useState(false);
  const [barcode, setBarcode] = useState<string>();
  const [unknownBarcode, setUnknownBarcode] = useState(false);
  const [lookupInfo, setLookupInfo] = useState<{
    found: boolean;
    detail?: string;
  }>();
  const [looking, setLooking] = useState(false);
  const [recipes, setRecipes] = useState<RecipeSuggestion[] | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>(() =>
    savedRecipeRepository.local(userId),
  );
  const [savedRecipesOpen, setSavedRecipesOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<SavedRecipe | null>(null);
  const [recipeToShare, setRecipeToShare] = useState<RecipeSuggestion | null>(null);
  const [recipeSetup, setRecipeSetup] = useState(false);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const recipeRequestInFlight = useRef(false);
  const [recipeFlowError, setRecipeFlowError] = useState("");
  const [recipeInsufficient, setRecipeInsufficient] = useState(false);
  const [error, setError] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventorySearchFocused, setInventorySearchFocused] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<"all" | FoodFilterCategory>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{ input: FridgeItemInput; existing: FridgeItem; source: "quick" | "form" } | null>(null);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FridgeItem | null>(null);
  useEffect(() => {
    fridgeRepository.load(userId).then(setItems);
    savedRecipeRepository.load(userId).then(setSavedRecipes);
  }, [userId]);
  const scanned = useCallback(async (code: string) => {
    setScanner(false);
    const now = Date.now();
    if (lastScan.current?.code === code && now - lastScan.current.at < 2500) {
      window.setTimeout(() => setScanner(true), 800);
      return;
    }
    lastScan.current = { code, at: now };
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
      window.setTimeout(() => setScanner(true), 800);
    } finally {
      setLooking(false);
    }
  }, []);
  const showAdded = (name: string) => {
    setAddedFeedback(`✓ ${name} agregado`);
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setAddedFeedback(""), 1800);
  };
  const finishCapture = () => {
    setScanner(false);
    setForm(null);
    setCaptureMode(null);
    setBarcode(undefined);
    setLookupInfo(undefined);
    setUnknownBarcode(false);
  };
  const save = async (input: FridgeItemInput, id?: string) => {
    const next = id
      ? await fridgeRepository.update(userId, id, input, items)
      : await fridgeRepository.add(userId, input, items);
    setItems(next);
    if (!id && input.barcode && unknownBarcode)
      saveUnknownProduct({
        barcode: input.barcode,
        name: input.name,
        quantityText: input.unit,
        source: "user",
      }).catch(() => undefined);
    if (!id && input.barcode)
      lastScan.current = { code: input.barcode, at: Date.now() };
    if (!id) showAdded(input.name);
    setBarcode(undefined);
    setUnknownBarcode(false);
    setLookupInfo(undefined);
    if (id || !captureMode) setForm(null);
    else {
      setForm(null);
      window.setTimeout(() => setScanner(true), 650);
    }
  };
  const createWithDuplicateCheck = async (input: FridgeItemInput, source: "quick" | "form") => {
    const duplicate = findPossibleDuplicateProduct(input.name, items);
    if (duplicate) {
      setPendingDuplicate({ input, existing: duplicate.product, source });
      return;
    }
    await save(input);
  };
  const quickAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = quickName.trim();
    if (!name || quickSaving) return quickInput.current?.focus();
    setQuickSaving(true);
    await createWithDuplicateCheck({ name, quantity: 1, unit: "unidad" }, "quick");
    if (!findPossibleDuplicateProduct(name, items)) setQuickName("");
    setQuickSaving(false);
    requestAnimationFrame(() => quickInput.current?.focus());
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
  const createRecipes = async (options: {
    mealType: "desayuno" | "comida" | "cena";
    preferences: string[];
    craving?: string;
    ingredientMode: "available_only" | "allow_extras";
  }) => {
    if (recipeRequestInFlight.current) return;
    recipeRequestInFlight.current = true;
    setRecipeLoading(true);
    setRecipeFlowError("");
    setRecipeInsufficient(false);
    try {
      const generated = await RecipeService.generate({
          ...options,
          availableIngredients: items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
        });
      if (generated.status === "insufficient_ingredients") {
        setRecipes(null);
        setRecipeInsufficient(true);
        return;
      }
      setRecipes(generated.suggestions);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No pudimos crear recetas.";
      console.error("[recipes] generation failed", message);
      setRecipeFlowError(message);
      return;
    } finally {
      recipeRequestInFlight.current = false;
      setRecipeLoading(false);
    }
  };
  const visibleItems = items
    .filter((item) => inventoryFilter === "all" || getFoodFilterCategory(item.name) === inventoryFilter)
    .filter((item) => item.name.toLocaleLowerCase("es-CL").includes(inventorySearch.trim().toLocaleLowerCase("es-CL")));
  return (
    <>
      <header className={`${inventorySearchFocused ? "max-sm:hidden" : ""} px-5 pb-5 pt-[max(2rem,env(safe-area-inset-top))]`}>
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
      <div className={`space-y-5 px-4 pb-32 ${inventorySearchFocused ? "max-sm:pt-[max(1rem,env(safe-area-inset-top))]" : ""}`}>
        <form
          onSubmit={quickAdd}
          className={`${inventorySearchFocused ? "max-sm:hidden" : ""} theme-card flex min-w-0 gap-2 rounded-2xl border border-black/[.04] bg-white p-2 shadow-sm`}
        >
          <input
            ref={quickInput}
            value={quickName}
            onChange={(event) => setQuickName(event.target.value)}
            enterKeyHint="done"
            placeholder="Agregar producto..."
            aria-label="Nombre del producto"
            className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-base outline-none"
          />
          <button
            disabled={quickSaving}
            type="submit"
            aria-label="Agregar producto"
            className="tap grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#176b46] text-white disabled:opacity-60"
          >
            {quickSaving ? (
              <LoaderCircle className="animate-spin" size={22} />
            ) : (
              <Plus size={23} />
            )}
          </button>
        </form>
        {(canScanProducts || canCook) && <div className={`grid gap-3 ${inventorySearchFocused ? "max-sm:hidden" : ""} ${canScanProducts && canCook ? "grid-cols-2" : "grid-cols-1"}`}>
          {canScanProducts && (
          <button
            onClick={() => {
              setError("");
              setCaptureMode("scanner");
              setScanner(true);
            }}
            className="theme-card tap flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-black/[.06] bg-white px-2 font-semibold text-[#176b46]"
          >
            <ScanBarcode className="shrink-0" size={20} />
            <span className="truncate">Escanear código</span>
          </button>
          )}
          {canCook && (
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
            className={`theme-card tap flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-2xl border border-black/[.06] bg-white px-2 font-semibold text-[#176b46] disabled:opacity-60 ${!items.length ? "opacity-55" : ""}`}
          >
            {recipeLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Cocinar
          </button>
          )}
        </div>}
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
              Agrega productos o escanea su código.
            </p>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="px-1 text-xs font-bold uppercase tracking-[.14em] text-[#718078]">
              Disponibles
            </h2>
            <div className="flex w-full min-w-0 gap-2">
              <label className="theme-card flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-black/[.04] bg-white px-3">
                <Search className="shrink-0 text-[#718078]" size={18} />
                <input type="search" value={inventorySearch} onFocus={() => { setInventorySearchFocused(true); window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 80); }} onBlur={() => window.setTimeout(() => setInventorySearchFocused(false), 120)} onChange={(event) => setInventorySearch(event.target.value)} placeholder="Buscar alimento..." aria-label="Buscar alimento" className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
              </label>
              <button type="button" onClick={() => setFilterOpen(true)} aria-label="Filtrar alimentos" className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-xl font-bold leading-none ${inventoryFilter === "all" ? "theme-card border-black/[.06] bg-white" : "border-[#4fc187] bg-[#173c2b] text-[#62d196]"}`}>
                ⋯
                {inventoryFilter !== "all" && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#62d196]" />}
              </button>
            </div>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="tap flex min-h-[82px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#10291f] px-2 py-3 text-center text-white shadow-sm transition-transform active:scale-[.97]"
              >
                <span aria-hidden="true" className="mb-1 text-[25px] leading-none">{getFoodVisual(item.name).emoji}</span>
                <span className="line-clamp-2 min-w-0 break-words text-sm font-semibold leading-snug">
                  {item.name}
                </span>
              </button>
            ))}
            </div>
            {!visibleItems.length && (
              <p className="py-6 text-center text-sm text-[#718078]">
                {inventorySearch.trim() ? "No encontramos alimentos con esos filtros." : "No tienes alimentos en esta categoría."}
              </p>
            )}
          </section>
        )}
      </div>
      {scanner && (
        <BarcodeScanner close={finishCapture} scanned={scanned} continuous />
      )}
      {form && (
        <ItemForm
          initial={form}
          barcode={barcode}
          lookupInfo={lookupInfo}
          close={
            captureMode
              ? finishCapture
              : () => {
                  setForm(null);
                  setLookupInfo(undefined);
                }
          }
          continuous={Boolean(captureMode && !form.id)}
          save={(input) => form.id ? save(input, form.id) : createWithDuplicateCheck(input, "form")}
        />
      )}
      {pendingDuplicate && (
        <DuplicateProductSheet
          productName={pendingDuplicate.existing.name}
          saving={duplicateSaving}
          cancel={() => setPendingDuplicate(null)}
          confirm={async () => {
            if (duplicateSaving) return;
            setDuplicateSaving(true);
            await save(pendingDuplicate.input);
            if (pendingDuplicate.source === "quick") setQuickName("");
            setPendingDuplicate(null);
            setDuplicateSaving(false);
          }}
        />
      )}
      {selectedItem && (
        <InventoryItemSheet
          item={selectedItem}
          close={() => setSelectedItem(null)}
          rename={async (name) => {
            await save({ name }, selectedItem.id);
            setSelectedItem(null);
          }}
          remove={async () => {
            setItems(await fridgeRepository.remove(userId, selectedItem.id, items));
            setSelectedItem(null);
          }}
        />
      )}
      {filterOpen && (
        <InventoryFilterSheet
          selected={inventoryFilter}
          close={() => setFilterOpen(false)}
          select={(value) => {
            setInventoryFilter(value);
            setFilterOpen(false);
          }}
        />
      )}
      {recipeSetup && (
        <RecipePrompt
          close={() => {
            setRecipeSetup(false);
            setRecipes(null);
            setSelectedRecipe(null);
            setRecipeFlowError("");
            setRecipeInsufficient(false);
          }}
          submit={createRecipes}
          loading={recipeLoading}
          recipes={recipes}
          selectedRecipe={selectedRecipe}
          view={setSelectedRecipe}
          backFromRecipe={() => setSelectedRecipe(null)}
          changePreferences={() => {
            setRecipes(null);
            setSelectedRecipe(null);
            setRecipeFlowError("");
            setRecipeInsufficient(false);
          }}
          error={recipeFlowError}
          insufficient={recipeInsufficient}
          clearInsufficient={() => setRecipeInsufficient(false)}
          addShopping={addShopping}
          savedRecipes={savedRecipes}
          openSaved={() => setSavedRecipesOpen(true)}
          saveRecipe={async (recipe) => {
            const result = await savedRecipeRepository.save(userId, recipe, savedRecipes);
            setSavedRecipes(result.recipes);
          }}
          shareRecipe={setRecipeToShare}
        />
      )}
      {savedRecipesOpen && (
        <SavedRecipesSheet
          recipes={savedRecipes}
          close={() => setSavedRecipesOpen(false)}
          generate={() => {
            setSavedRecipesOpen(false);
            setRecipeSetup(true);
          }}
          view={(recipe) => {
            setSelectedRecipe(recipe);
            setRecipeSetup(true);
            setSavedRecipesOpen(false);
          }}
          share={setRecipeToShare}
          requestDelete={setRecipeToDelete}
        />
      )}
      {recipeToDelete && (
        <DeleteSavedRecipeDialog
          recipe={recipeToDelete}
          cancel={() => setRecipeToDelete(null)}
          confirm={async () => {
            setSavedRecipes(await savedRecipeRepository.remove(userId, recipeToDelete.id, savedRecipes));
            setRecipeToDelete(null);
          }}
        />
      )}
      {recipeToShare && (
        <RecipeShareSheet recipe={recipeToShare} close={() => setRecipeToShare(null)} />
      )}
      {addedFeedback && (
        <div
          role="status"
          className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-1/2 z-[100] max-w-[calc(100%-2rem)] -translate-x-1/2 whitespace-nowrap rounded-full bg-[#173d2d] px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {addedFeedback}
        </div>
      )}
    </>
  );
}

function DuplicateProductSheet({
  productName,
  saving,
  cancel,
  confirm,
}: {
  productName: string;
  saving: boolean;
  cancel: () => void;
  confirm: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <h2 className="text-xl font-bold">Producto posiblemente duplicado</h2>
        <p className="mt-2 text-sm text-[#718078]"><b>{productName}</b> ya está en tu refrigerador.</p>
        <p className="mt-4 font-semibold">¿Qué quieres hacer?</p>
        <button disabled={saving} onClick={confirm} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/10 font-semibold disabled:opacity-50">
          {saving && <LoaderCircle className="animate-spin" size={18} />}
          Agregar de todas formas
        </button>
        <button disabled={saving} onClick={cancel} className="mt-2 min-h-12 w-full rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-50">No agregar</button>
      </section>
    </div>
  );
}

function InventoryFilterSheet({
  selected,
  close,
  select,
}: {
  selected: "all" | FoodFilterCategory;
  close: () => void;
  select: (value: "all" | FoodFilterCategory) => void;
}) {
  const options: Array<{ value: "all" | FoodFilterCategory; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "produce", label: "🥬 Frutas y verduras" },
    { value: "meat", label: "🥩 Carnes" },
    { value: "dairy", label: "🧀 Lácteos" },
    { value: "bakery", label: "🍞 Pan y cereales" },
    { value: "seasoning", label: "🧂 Condimentos" },
    { value: "drink", label: "🥤 Bebidas" },
    { value: "other", label: "🍴 Otros" },
  ];
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-xl font-bold">Filtrar alimentos</h2>
          <button onClick={close} aria-label="Cerrar filtros" className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"><X /></button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-1">
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => select(option.value)} className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold ${selected === option.value ? "bg-[#e6f3ec] text-[#176b46]" : "hover:bg-black/[.04]"}`}>
              <span className="w-7 shrink-0">{selected === option.value ? "✓" : ""}</span>
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function InventoryItemSheet({
  item,
  close,
  rename,
  remove,
}: {
  item: FridgeItem;
  close: () => void;
  rename: (name: string) => Promise<void>;
  remove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [saving, setSaving] = useState(false);
  if (editing) {
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim() || saving) return;
            setSaving(true);
            await rename(name.trim());
          }}
          className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]"
        >
          <h2 className="text-xl font-bold">Editar nombre</h2>
          <label className="mt-4 block text-sm font-semibold">
            Nombre
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3 text-base outline-none focus:border-[#176b46]"
            />
          </label>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setEditing(false)} className="min-h-12 rounded-2xl border border-black/10 font-semibold">
              Cancelar
            </button>
            <button disabled={saving} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-60">
              {saving && <LoaderCircle className="animate-spin" size={18} />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Nombre del producto</p>
            <h2 className="mt-1 break-words text-xl font-bold">{item.name}</h2>
          </div>
          <button onClick={close} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#edf2ee]">
            <X />
          </button>
        </div>
        <div className="mt-5 space-y-2">
          <button onClick={() => setEditing(true)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-[#edf2ee] px-4 font-semibold">
            <Pencil size={19} /> Editar nombre
          </button>
          <button onClick={remove} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-red-50 px-4 font-semibold text-red-700">
            <Trash2 size={19} /> Eliminar producto
          </button>
          <button onClick={close} className="min-h-12 w-full rounded-2xl font-semibold text-[#718078]">
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}

function RecipeFlowFrame({ close, children }: { close: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/50 sm:items-center">
      <section className="theme-card max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex justify-end"><button onClick={close} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"><X /></button></div>
        {children}
      </section>
    </div>
  );
}

function RecipePrompt({
  close,
  submit,
  loading,
  recipes,
  selectedRecipe,
  view,
  backFromRecipe,
  changePreferences,
  error,
  insufficient,
  clearInsufficient,
  addShopping,
  savedRecipes,
  openSaved,
  saveRecipe,
  shareRecipe,
}: {
  close: () => void;
  submit: (options: {
    mealType: "desayuno" | "comida" | "cena";
    preferences: string[];
    craving?: string;
    ingredientMode: "available_only" | "allow_extras";
  }) => Promise<void>;
  loading: boolean;
  recipes: RecipeSuggestion[] | null;
  selectedRecipe: RecipeSuggestion | null;
  view: (recipe: RecipeSuggestion) => void;
  backFromRecipe: () => void;
  changePreferences: () => void;
  error: string;
  insufficient: boolean;
  clearInsufficient: () => void;
  addShopping: (name: string) => void;
  savedRecipes: SavedRecipe[];
  openSaved: () => void;
  saveRecipe: (recipe: RecipeSuggestion) => Promise<void>;
  shareRecipe: (recipe: RecipeSuggestion) => void;
}) {
  const [mealType, setMealType] = useState<"desayuno" | "comida" | "cena" | null>(null);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [craving, setCraving] = useState("");
  const [ingredientMode, setIngredientMode] = useState<"available_only" | "allow_extras">("available_only");
  const [savingRecipe, setSavingRecipe] = useState(false);
  const options = [
    ["rapido", "⚡ Rápido"],
    ["saludable", "🥗 Saludable"],
    ["economico", "💰 Económico"],
    ["sorprendeme", "🎲 Sorpréndeme"],
  ];
  const togglePreference = (value: string) => {
    if (value === "sorprendeme") return setPreferences([value]);
    setPreferences((current) => {
      const withoutSurprise = current.filter((item) => item !== "sorprendeme");
      if (withoutSurprise.includes(value)) return withoutSurprise.filter((item) => item !== value);
      return [...withoutSurprise, value].slice(-2);
    });
  };
  const request = () => mealType && preferences.length
    ? submit({ mealType, preferences, ...(craving.trim() ? { craving: craving.trim() } : {}), ingredientMode })
    : Promise.resolve();
  if (loading) return (
    <RecipeFlowFrame close={close}>
      <div className="grid min-h-64 place-items-center text-center">
        <div><LoaderCircle className="mx-auto animate-spin text-[#62d196]" size={34} /><h2 className="mt-4 text-xl font-bold">Generando recetas...</h2><p className="mt-1 text-sm text-[#718078]">Estamos combinando lo que tienes.</p></div>
      </div>
    </RecipeFlowFrame>
  );
  if (selectedRecipe) return (
    <RecipeFlowFrame close={close}>
      <button onClick={backFromRecipe} className="mb-4 min-h-11 font-semibold text-[#176b46]">← Volver</button>
      <h2 className="text-2xl font-bold">{selectedRecipe.title}</h2>
      {selectedRecipe.estimatedMinutes && <p className="mt-1 text-sm font-semibold text-[#176b46]">{selectedRecipe.estimatedMinutes} min</p>}
      <h3 className="mt-5 font-bold">Ingredientes que tienes</h3>
      <ul className="mt-2 space-y-1 text-sm">{selectedRecipe.ingredients.map((ingredient) => <li key={ingredient}>✓ {ingredient}</li>)}</ul>
      {selectedRecipe.missingIngredients.length > 0 && <><h3 className="mt-5 font-bold">Necesitas comprar</h3><div className="mt-2 flex flex-wrap gap-2">{selectedRecipe.missingIngredients.map((ingredient) => <button key={ingredient} onClick={() => addShopping(ingredient)} className="rounded-full border border-[#176b46] px-3 py-1.5 text-sm font-semibold text-[#176b46]">+ {ingredient}</button>)}</div></>}
      <h3 className="mt-5 font-bold">Preparación</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">{selectedRecipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          disabled={savingRecipe || savedRecipes.some((recipe) => recipe.fingerprint === recipeFingerprint(selectedRecipe))}
          onClick={async () => {
            setSavingRecipe(true);
            await saveRecipe(selectedRecipe);
            setSavingRecipe(false);
          }}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#e6f3ec] px-3 font-semibold text-[#176b46] disabled:opacity-70"
        >
          <Heart size={19} fill={savedRecipes.some((recipe) => recipe.fingerprint === recipeFingerprint(selectedRecipe)) ? "currentColor" : "none"} />
          {savedRecipes.some((recipe) => recipe.fingerprint === recipeFingerprint(selectedRecipe)) ? "Guardada" : savingRecipe ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={() => shareRecipe(selectedRecipe)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#176b46] px-3 font-semibold text-[#176b46]">
          <Share2 size={19} /> Compartir
        </button>
      </div>
      <button onClick={backFromRecipe} className="mt-6 min-h-12 w-full rounded-2xl bg-[#176b46] font-semibold text-white">Volver a opciones</button>
    </RecipeFlowFrame>
  );
  if (recipes?.length) return (
    <RecipeFlowFrame close={close}>
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">Recetas con IA</p><button onClick={openSaved} className="flex min-h-10 items-center gap-2 rounded-full bg-[#e6f3ec] px-3 text-sm font-semibold text-[#176b46]"><BookHeart size={17} /> Mis recetas</button></div>
      <h2 className="mt-1 text-2xl font-bold">{recipes.length} {recipes.length === 1 ? "idea" : "ideas"} para tu {mealType}</h2>
      <div className="mt-4 space-y-3">{recipes.map((recipe) => <article key={recipe.title} className="rounded-2xl border border-black/10 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-bold">{recipe.title}</h3><p className="mt-1 text-sm text-[#718078]">{recipe.reason || recipe.description}</p></div>{recipe.estimatedMinutes && <span className="shrink-0 text-xs font-semibold text-[#176b46]">{recipe.estimatedMinutes} min</span>}</div><button onClick={() => view(recipe)} className="mt-3 min-h-11 w-full rounded-xl border border-[#176b46] font-semibold text-[#176b46]">Ver receta</button></article>)}</div>
      <button onClick={changePreferences} className="mt-4 min-h-12 w-full font-semibold text-[#176b46]">← Cambiar preferencias</button>
    </RecipeFlowFrame>
  );
  if (insufficient) return (
    <RecipeFlowFrame close={close}>
      <div className="py-8 text-center"><h2 className="text-xl font-bold">Necesitas algunos ingredientes más</h2><p className="mt-2 text-sm text-[#718078]">No encontramos una receta razonable usando únicamente lo que tienes.</p></div>
      <button onClick={() => { setIngredientMode("allow_extras"); clearInsufficient(); }} className="min-h-12 w-full rounded-2xl bg-[#176b46] font-semibold text-white">Permitir ingredientes extra</button>
      <button onClick={clearInsufficient} className="mt-2 min-h-12 w-full font-semibold text-[#176b46]">Volver</button>
    </RecipeFlowFrame>
  );
  if (error) return (
    <RecipeFlowFrame close={close}>
      <div className="py-8 text-center"><h2 className="text-xl font-bold">No pudimos generar las recetas</h2><p className="mt-2 text-sm text-[#718078]">{error || "Intenta nuevamente."}</p></div>
      <button onClick={request} className="min-h-12 w-full rounded-2xl bg-[#176b46] font-semibold text-white">Intentar nuevamente</button>
      <button onClick={changePreferences} className="mt-2 min-h-12 w-full font-semibold text-[#176b46]">Cambiar preferencias</button>
    </RecipeFlowFrame>
  );
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/50 sm:items-center">
      <section className="theme-card max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-start">
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">
              Recetas con IA
            </p>
          </div>
          <button
            onClick={close}
            disabled={loading}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        <button onClick={openSaved} className="mt-2 flex min-h-11 items-center gap-2 rounded-full bg-[#e6f3ec] px-4 text-sm font-semibold text-[#176b46]">
          <BookHeart size={18} /> Mis recetas {savedRecipes.length ? `(${savedRecipes.length})` : ""}
        </button>
        <fieldset className="mt-3">
          <legend className="font-bold">¿Qué quieres preparar?</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["desayuno", "comida", "cena"] as const).map((value) => <button key={value} type="button" onClick={() => setMealType(value)} className={`min-h-11 min-w-0 rounded-xl border px-1 text-sm font-semibold capitalize ${mealType === value ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}>{value}</button>)}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="font-bold">¿Qué prefieres?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {options.map(([value, label]) => <button key={value} type="button" onClick={() => togglePreference(value)} className={`min-h-11 min-w-0 rounded-xl border px-2 text-sm font-semibold ${preferences.includes(value) ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}>{label}</button>)}
          </div>
          <p className="mt-1 text-xs text-[#718078]">Elige una o hasta dos opciones.</p>
        </fieldset>
        <label className="mt-5 block font-bold">
          ¿Qué se te antoja? <span className="font-normal text-[#718078]">(opcional)</span>
          <input value={craving} onChange={(e) => setCraving(e.target.value)} placeholder="Ej. algo con pollo, pasta cremosa, algo fresco..." className="mt-2 min-h-12 w-full rounded-xl border border-black/10 bg-transparent px-3 text-base font-normal outline-none focus:border-[#176b46]" />
        </label>
        <fieldset className="mt-5">
          <legend className="font-bold">¿Qué ingredientes puedo usar?</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setIngredientMode("available_only")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${ingredientMode === "available_only" ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}>✅ Solo lo que tengo</button>
            <button type="button" onClick={() => setIngredientMode("allow_extras")} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${ingredientMode === "allow_extras" ? "border-[#176b46] bg-[#e6f3ec] text-[#176b46]" : "border-black/10"}`}>➕ Puedo comprar algo extra</button>
          </div>
        </fieldset>
        <button
          disabled={!mealType || !preferences.length || loading}
          onClick={request}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-40"
        >
          {loading && <LoaderCircle className="animate-spin" size={19} />}
          {loading ? "Generando recetas..." : "Generar recetas"}
        </button>
      </section>
    </div>
  );
}

function SavedRecipesSheet({
  recipes,
  close,
  generate,
  view,
  share,
  requestDelete,
}: {
  recipes: SavedRecipe[];
  close: () => void;
  generate: () => void;
  view: (recipe: SavedRecipe) => void;
  share: (recipe: SavedRecipe) => void;
  requestDelete: (recipe: SavedRecipe) => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card max-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-lg overflow-y-auto rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">Tu recetario</p>
            <h2 className="mt-1 text-2xl font-bold">Mis recetas</h2>
          </div>
          <button onClick={close} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"><X /></button>
        </div>
        {!recipes.length ? (
          <div className="py-10 text-center">
            <BookHeart className="mx-auto text-[#83a094]" size={40} />
            <h3 className="mt-4 text-xl font-bold">Aún no tienes recetas guardadas</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-[#718078]">Genera una receta y guárdala para consultarla después sin volver a usar la IA.</p>
            <button onClick={generate} className="mt-6 min-h-12 w-full rounded-2xl bg-[#176b46] font-semibold text-white">Generar recetas</button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {recipes.map((recipe) => (
              <article key={recipe.id} className="rounded-2xl border border-black/10 p-4">
                <button onClick={() => view(recipe)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold">{recipe.title}</h3>
                    {recipe.estimatedMinutes && <span className="shrink-0 text-xs font-semibold text-[#176b46]">{recipe.estimatedMinutes} min</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[#718078]">{recipe.description}</p>
                </button>
                <div className="mt-3 flex gap-2 border-t border-black/[.06] pt-3">
                  <button onClick={() => share(recipe)} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e6f3ec] text-sm font-semibold text-[#176b46]"><Share2 size={17} /> Compartir</button>
                  <button onClick={() => requestDelete(recipe)} aria-label={`Eliminar ${recipe.title}`} className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-700"><Trash2 size={18} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DeleteSavedRecipeDialog({ recipe, cancel, confirm }: { recipe: SavedRecipe; cancel: () => void; confirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-5">
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-recipe-title" className="theme-card w-full max-w-sm rounded-[26px] bg-white p-5 text-center">
        <h2 id="delete-recipe-title" className="text-xl font-bold">¿Eliminar receta?</h2>
        <p className="mt-2 text-sm text-[#718078]">“{recipe.title}” desaparecerá de Mis recetas. Esta acción no se puede deshacer.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button disabled={deleting} onClick={cancel} className="min-h-12 rounded-2xl border border-black/10 font-semibold">Cancelar</button>
          <button disabled={deleting} onClick={async () => { setDeleting(true); await confirm(); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 font-semibold text-white disabled:opacity-60">{deleting && <LoaderCircle className="animate-spin" size={18} />} Eliminar</button>
        </div>
      </section>
    </div>
  );
}

function RecipeShareSheet({ recipe, close }: { recipe: RecipeSuggestion; close: () => void }) {
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(recipeAsText(recipe));
    setStatus("Receta copiada");
  };
  const pdf = async () => {
    setWorking(true);
    try {
      const blob = await recipePdf(recipe);
      const filename = `${recipe.title.replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "receta"}.pdf`;
      const result = await shareOrDownloadPdf(blob, filename, recipe.title);
      setStatus(result === "shared" ? "PDF compartido" : "PDF descargado");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setStatus("No pudimos crear el PDF");
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">
      <section className="theme-card w-full max-w-lg rounded-t-[30px] bg-white p-5 safe-bottom sm:rounded-[30px]">
        <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#176b46]">Compartir</p><h2 className="mt-1 truncate text-xl font-bold">{recipe.title}</h2></div><button onClick={close} aria-label="Cerrar" className="grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"><X /></button></div>
        <div className="mt-5 space-y-2">
          <button disabled={working} onClick={pdf} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#176b46] px-4 font-semibold text-white disabled:opacity-60">{working ? <LoaderCircle className="animate-spin" size={20} /> : <FileText size={20} />} Compartir o descargar PDF</button>
          <button onClick={copy} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-[#e6f3ec] px-4 font-semibold text-[#176b46]"><Clipboard size={20} /> Copiar receta</button>
        </div>
        {status && <p role="status" className="mt-3 text-center text-sm font-semibold text-[#176b46]">{status}</p>}
      </section>
    </div>
  );
}

function ItemForm({
  initial,
  barcode,
  lookupInfo,
  close,
  continuous,
  save,
}: {
  initial: Partial<FridgeItem>;
  barcode?: string;
  lookupInfo?: { found: boolean; detail?: string };
  close: () => void;
  continuous?: boolean;
  save: (value: FridgeItemInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name || "");
  const [quantity, setQuantity] = useState(String(initial.quantity ?? ""));
  const [unit, setUnit] = useState(initial.unit || "");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim() && !saving) {
            setSaving(true);
            await save({
              name: name.trim(),
              barcode: initial.barcode || barcode,
              quantity: quantity.trim()
                ? Number(quantity) || undefined
                : undefined,
              unit,
            });
            setSaving(false);
          }
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
            className={`${continuous ? "min-h-11 px-3 font-bold text-[#176b46]" : "grid h-11 w-11 place-items-center rounded-full bg-[#edf2ee]"}`}
            aria-label={continuous ? "Terminar de agregar productos" : "Cerrar"}
          >
            {continuous ? "Listo" : <X />}
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
        <button
          disabled={saving}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#176b46] font-semibold text-white disabled:opacity-60"
        >
          {saving && <LoaderCircle className="animate-spin" size={19} />}
          {continuous ? "Agregar" : "Guardar"}
        </button>
      </form>
    </div>
  );
}
