import assert from "node:assert/strict";
import test from "node:test";
import { de } from "../locales/de";
import { en } from "../locales/en";
import { es } from "../locales/es";
import { fr } from "../locales/fr";
import { pluralKey, translate } from "../index";

test("todos los idiomas contienen exactamente las mismas claves", () => {
  const expected = Object.keys(es).sort();
  for (const dictionary of [en, fr, de]) assert.deepEqual(Object.keys(dictionary).sort(), expected);
});

test("interpola variables y selecciona plurales", () => {
  assert.equal(translate("en", "finance.greeting", { name: "Oliver" }), "Hi, Oliver");
  assert.equal(translate("fr", pluralKey("fr", "fridge.product", 1), { count: 1 }), "1 produit");
  assert.equal(translate("de", pluralKey("de", "fridge.product", 3), { count: 3 }), "3 Produkte");
});

test("los nombres de productos permanecen sin traducir dentro de eventos", () => {
  assert.equal(translate("en", "roomies.event.request", { product: "Leche" }), "Does anyone have Leche?");
});
