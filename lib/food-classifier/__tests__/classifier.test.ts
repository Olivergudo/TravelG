import assert from "node:assert/strict";
import test from "node:test";
import { classifyTicketProduct, extractTicketQuantity, normalizeTicketProductName } from "../index";
import { getFoodFilterCategory, getFoodVisual } from "../../fridge/emoji";
import { findPossibleDuplicateProduct, normalizeProductName } from "../../fridge/duplicates";
import { parseRecipeGenerationResult, parseRecipeResponse } from "../../recipes/types";
import { canUseFeature } from "../../features/plans";
import { recipeFingerprint } from "../../recipes/saved-types";
import { recipeAsText, recipePdf } from "../../recipes/share";
import { buildPurchaseHistory, cleanStoreName } from "../../../components/shopping-v2";
import type { AppData } from "../../types";
import { userDataCacheKey } from "../../repository";
import { formatCurrency } from "../../currency";
import { requiredPreferences } from "../../user-preferences";
import { movementAsText, movementPdf, movementPdfFilename } from "../../movements/share";

const food = ["Papa", "PAPA KG", "Cebolla", "CEBOLLA 1KG", "Tomate", "Jitomate", "Palta", "Aguacate", "Poroto", "Frijol", "Choclo", "Elote", "Leche", "LECHE ENT 1L", "Huevos 12U", "Pollo", "Vacuno", "Carne molida", "Salmón", "Merluza", "Pan", "Tortilla", "Arroz", "Pasta", "Mostaza", "Mayonesa", "Café", "Agua mineral", "Chocolate", "Coca Cola"];
const nonFood = ["Shampoo", "Dove Shampoo", "Detergente", "Papel higiénico", "PAP HIG 12R", "PAPEL HIG 12R", "Jabón", "Desodorante", "Pasta dental", "Cloro", "Suavizante", "Bolsa basura", "Comida perro", "Whiskas", "PANTENE SHAMPOO"];
const unknown = ["ADZ PAL CIL", "SUPR 500G", "ABC XYZ", "RESERVA XYZ", "TECLADO"];

test("clasifica alimentos frecuentes de México y Chile", () => {
  for (const value of food) assert.equal(classifyTicketProduct(value).classification, "food", value);
});
test("clasifica no alimentos y mascotas", () => {
  for (const value of nonFood) assert.equal(classifyTicketProduct(value).classification, "non_food", value);
});
test("mantiene abreviaturas ambiguas como unknown y respeta boundaries", () => {
  for (const value of unknown) assert.equal(classifyTicketProduct(value).classification, "unknown", value);
  assert.equal(classifyTicketProduct("SALCHICHA").suggestedDisplayName, "Salchicha");
});
test("normaliza sin destruir números y extrae cantidades seguras", () => {
  assert.equal(normalizeTicketProductName("  CEBOLLA   KG  "), "cebolla kg");
  assert.deepEqual(extractTicketQuantity("HUEVOS 12U"), { quantity: 12, unit: "unidad" });
  assert.deepEqual(extractTicketQuantity("LECHE 1L"), { quantity: 1, unit: "l" });
  assert.deepEqual(extractTicketQuantity("CARNE 0.735KG"), { quantity: 0.735, unit: "kg" });
});
test("la memoria aprendida tiene prioridad absoluta", () => {
  const result = classifyTicketProduct("ADZ PAL CIL", [{ rawNameNormalized: "adz pal cil", displayName: "Aderezo palta cilantro", classification: "food" }]);
  assert.equal(result.classification, "food"); assert.equal(result.confidence, 100); assert.equal(result.source, "learned");
});
test("clasifica 100 líneas en menos de 100 ms", () => {
  const start = performance.now();
  for (let index = 0; index < 100; index += 1) classifyTicketProduct(food[index % food.length]);
  assert.ok(performance.now() - start < 100);
});

test("asigna visuales locales con prioridad y fallback", () => {
  assert.equal(getFoodVisual("Trix").emoji, "🥣");
  assert.equal(getFoodVisual("Heinz Tomato Ketchup").emoji, "🍅");
  assert.equal(getFoodVisual("Mayonesa").emoji, "🫙");
  assert.equal(getFoodVisual("Mostaza").emoji, "🫙");
  assert.equal(getFoodVisual("Aceite vegetal").emoji, "🫒");
  assert.equal(getFoodVisual("Sal ajo").emoji, "🧂");
  assert.equal(getFoodVisual("Pimentón Paprika").emoji, "🧂");
  assert.equal(getFoodVisual("Aderezo Para Ensaladas Sabor Palta Cilantro").emoji, "🥗");
  assert.deepEqual(getFoodVisual("Producto misterioso 123"), { category: "other_food", emoji: "🍴" });
});

test("agrupa categorías visuales para filtros del refrigerador", () => {
  assert.equal(getFoodFilterCategory("Manzana"), "produce");
  assert.equal(getFoodFilterCategory("Pechuga de pollo"), "meat");
  assert.equal(getFoodFilterCategory("Huevos"), "dairy");
  assert.equal(getFoodFilterCategory("Arroz"), "bakery");
  assert.equal(getFoodFilterCategory("Mostaza"), "seasoning");
  assert.equal(getFoodFilterCategory("Coca Cola"), "drink");
  assert.equal(getFoodFilterCategory("Producto misterioso"), "other");
});

test("detecta solo duplicados claros del refrigerador", () => {
  const base = { id: "1", userId: "u", name: "Mayonesa", createdAt: "", updatedAt: "" };
  assert.equal(normalizeProductName("  ORÉGANO  "), "oregano");
  assert.equal(findPossibleDuplicateProduct(" mayonesa ", [base])?.product.id, "1");
  assert.equal(findPossibleDuplicateProduct("MAYONESA", [base])?.kind, "exact");
  assert.equal(findPossibleDuplicateProduct("Pan Hotdog", [{ ...base, name: "Pan Sandwich" }]), undefined);
  assert.equal(findPossibleDuplicateProduct("Aceite de oliva", [{ ...base, name: "Aceite vegetal" }]), undefined);
});

test("normaliza respuestas nuevas y anteriores de recetas", () => {
  const modern = parseRecipeResponse({ suggestions: [{ title: "Arroz", description: "Simple", reason: "Usa lo disponible", estimatedMinutes: 15, ingredients: ["Arroz"], missingIngredients: [], steps: ["Cocinar"] }] });
  assert.equal(modern.suggestions.length, 1);
  const compatible = parseRecipeResponse({ recipes: [{ name: "Huevos", description: "Rápido", estimatedTime: "10 min", ingredientsUsed: ["Huevos"], extraIngredients: [], steps: ["Batir"] }] });
  assert.equal(compatible.suggestions[0].title, "Huevos");
  assert.equal(compatible.suggestions[0].estimatedMinutes, 10);
  assert.throws(() => parseRecipeResponse({ recipes: [{ name: "Inválida" }] }));
  const recipe = { title: "Arroz", description: "Simple", estimatedMinutes: 10, ingredients: ["Arroz"], missingIngredients: [], steps: ["Cocinar"] };
  for (const count of [1, 2, 3]) assert.equal(parseRecipeResponse({ suggestions: Array.from({ length: count }, () => recipe) }).suggestions.length, count);
  assert.deepEqual(parseRecipeGenerationResult({ status: "insufficient_ingredients", suggestions: [] }), { status: "insufficient_ingredients", suggestions: [] });
});

test("Basic puede usar refrigerador pero no cocinar ni escanear", () => {
  const basic = { id: "basic-user", plan: "basic" as const, proExpiresAt: null };
  assert.equal(canUseFeature(basic, "fridge"), true);
  assert.equal(canUseFeature(basic, "aiRecipes"), false);
  assert.equal(canUseFeature(basic, "barcodeScanner"), false);
});

test("las recetas guardadas tienen identidad estable y texto compartible", () => {
  const recipe = { title: "Arroz verde", description: "Simple", reason: "Usa lo disponible", estimatedMinutes: 20, ingredients: ["Arroz", "Cilantro"], missingIngredients: ["Limón"], steps: ["Cocer", "Mezclar"] };
  assert.equal(recipeFingerprint(recipe), recipeFingerprint({ ...recipe }));
  assert.notEqual(recipeFingerprint(recipe), recipeFingerprint({ ...recipe, title: "Otro arroz" }));
  const text = recipeAsText(recipe);
  assert.match(text, /Arroz verde/);
  assert.match(text, /Necesitas comprar/);
  assert.match(text, /2\. Mezclar/);
});

test("genera un PDF real desde los datos de la receta", async () => {
  const blob = await recipePdf({ title: "Sopa", description: "Caliente", reason: "", estimatedMinutes: 25, ingredients: ["Agua"], missingIngredients: [], steps: ["Hervir"] });
  assert.equal(blob.type, "application/pdf");
  assert.ok(blob.size > 500);
});

test("unifica una compra vinculada sin duplicarla y limpia el nombre visible", () => {
  const now = "2026-08-13T12:00:00.000Z";
  const data: AppData = {
    schemaVersion: 3,
    categories: [{ id: "supermarket", name: "Supermercado", color: "#000", emoji: "🛒" }],
    shoppingListItems: [],
    expenses: [{ id: "expense-1", description: "Compra - RENDIC HERMANOS S.A.", amount: 1990, categoryId: "supermarket", date: now, purchaseId: "purchase-1", createdAt: now, updatedAt: now }],
    purchases: [{ id: "purchase-1", supermarketName: "RENDIC HERMANOS S.A.", startedAt: now, completedAt: now, total: 1990, expenseId: "expense-1", items: [{ id: "item-1", purchaseId: "purchase-1", productName: "Pan", normalizedName: "pan", quantity: 1, unitPrice: 1990, totalPrice: 1990, createdAt: now }] }],
  };
  const history = buildPurchaseHistory(data);
  assert.equal(history.length, 1);
  assert.equal(history[0].title, "RENDIC HERMANOS S.A.");
  assert.equal(history[0].products[0].productName, "Pan");
  assert.equal(cleanStoreName("Compra - Sin registrar"), "Compra sin registrar");
});

test("separa el caché principal por usuario", () => {
  assert.notEqual(userDataCacheKey("usuario-a"), userDataCacheKey("usuario-b"));
  assert.match(userDataCacheKey("usuario-a"), /usuario-a$/);
});

test("formatea la moneda sin convertir el importe", () => {
  assert.match(formatCurrency(13910, "CLP"), /13\.910/);
  assert.match(formatCurrency(13910, "USD"), /13,910/);
  assert.match(formatCurrency(13910, "EUR"), /13\.910/);
});

test("el onboarding solicita únicamente las preferencias faltantes", () => {
  assert.deepEqual(requiredPreferences({ full_name: "Oliver", currency: "CLP" }), { displayName: "Oliver", currency: "CLP", needsName: false, needsCurrency: false });
  assert.equal(requiredPreferences({ full_name: "Oliver" }).needsCurrency, true);
  assert.equal(requiredPreferences({ currency: "MXN" }).needsName, true);
  assert.deepEqual(requiredPreferences({}).needsName, true);
  assert.deepEqual(requiredPreferences({}).needsCurrency, true);
});

test("crea resumen y PDF de un ticket sin inventar precios", async () => {
  const ticket = { title: "Rendic Hermanos S.A.", amount: 13910, date: "2026-08-26T12:00:00.000Z", category: "Supermercado", products: [{ id: "p1", purchaseId: "t1", productName: "Pan", normalizedName: "pan", quantity: 1, unitPrice: 0, totalPrice: 0, createdAt: "2026-08-26T12:00:00.000Z" }], isTicket: true };
  const text = movementAsText(ticket, "CLP");
  assert.match(text, /Rendic Hermanos/);
  assert.match(text, /- Pan/);
  assert.doesNotMatch(text, /\$0/);
  assert.equal(movementPdfFilename(ticket), "ticket-rendic-hermanos-s-a-26-08-2026.pdf");
  const pdf = await movementPdf(ticket, "CLP");
  assert.equal(pdf.type, "application/pdf");
  assert.ok(pdf.size > 500);
});
