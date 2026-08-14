# Clasificador de productos de ticket

`classifyTicketProduct(rawName, learnedAliases)` clasifica localmente como `food`, `non_food` o `unknown`. No llama APIs ni modelos generativos.

- Para agregar alimentos, edita `dictionaries/produce.ts`, `proteins.ts` o `pantry.ts` y añade `["Nombre visible", "alias|otro alias"]` dentro de su categoría.
- Para agregar productos no alimenticios, edita `dictionaries/non-food.ts`.
- Los aliases se normalizan automáticamente; no hace falta duplicarlos solo por mayúsculas o acentos.
- Evita abreviaturas ambiguas. Si una regla no es suficientemente evidente, el resultado correcto es `unknown`.
- Las correcciones personales no pertenecen al diccionario: se guardan en `ticket_product_aliases` y tienen prioridad con confianza 100.
