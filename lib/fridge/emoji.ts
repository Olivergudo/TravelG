export function foodEmoji(name: string, category = "") {
  const value = `${name} ${category}`.toLocaleLowerCase("es-CL");
  if (/leche|lácte|lacte|yogur|queso|cream/.test(value)) return "🥛";
  if (/huevo/.test(value)) return "🥚";
  if (/carne|pollo|cerdo|jamón|jamon/.test(value)) return "🥩";
  if (/tomate|verdura|vegetal|lechuga|cebolla|brócoli|brocoli/.test(value)) return "🥦";
  if (/fruta|manzana|plátano|platano|aguacate|palta/.test(value)) return "🍎";
  if (/bebida|jugo|zumo|agua|soda/.test(value)) return "🥤";
  return "🍴";
}
