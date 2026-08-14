import { foods } from "./helpers";
export const proteinDictionary = [
  ...foods("meat", [
    ["Pollo", "pollo|pollos|pollo entero"], ["Pechuga de pollo", "pechuga|pechugas|pechuga pollo|pechuga de pollo"],
    ["Muslo de pollo", "muslo pollo|muslo de pollo|muslos pollo|trutro|trutros|trutro corto|trutro largo"], ["Ala de pollo", "ala pollo|alas pollo|ala de pollo"],
    ["Carne", "carne|carnes"], ["Vacuno", "vacuno|carne vacuno|carne de vacuno|res|carne res|carne de res"],
    ["Bistec", "bistec|bisteces|bife|bifes"], ["Filete", "filete|filetes"], ["Lomo", "lomo|lomos|lomo vetado|lomo liso"],
    ["Carne molida", "carne molida|molida vacuno|molida res"], ["Hamburguesa", "hamburguesa|hamburguesas"],
    ["Cerdo", "cerdo|carne cerdo|carne de cerdo|chancho"], ["Chuleta", "chuleta|chuletas|chuleta cerdo"],
    ["Costilla", "costilla|costillas|costillar"], ["Tocino", "tocino|panceta|bacon"], ["Jamón", "jamon|jamón|jamones"],
    ["Pavo", "pavo|pavos|pechuga pavo"], ["Salchicha", "salchicha|salchichas|vienesa|vienesas"],
    ["Chorizo", "chorizo|chorizos"], ["Longaniza", "longaniza|longanizas"], ["Mortadela", "mortadela"],
    ["Cordero", "cordero|carne cordero"], ["Conejo", "conejo|carne conejo"], ["Prosciutto", "prosciutto"],
  ]),
  ...foods("seafood", [
    ["Salmón", "salmon|salmón|filete salmon|filete salmón"], ["Atún", "atun|atún|atun lata|atún lata"],
    ["Merluza", "merluza|merluzas"], ["Reineta", "reineta"], ["Tilapia", "tilapia"], ["Bacalao", "bacalao"],
    ["Sardina", "sardina|sardinas"], ["Jurel", "jurel|jureles"], ["Camarón", "camaron|camarón|camarones"],
    ["Langostino", "langostino|langostinos"], ["Mejillón", "mejillon|mejillón|mejillones|chorito|choritos"],
    ["Pulpo", "pulpo|pulpos"], ["Calamar", "calamar|calamares"], ["Ostión", "ostion|ostión|ostiones"],
    ["Pescado", "pescado|pescados|filete pescado"], ["Mariscos", "marisco|mariscos"], ["Surimi", "surimi"],
  ]),
  ...foods("dairy", [
    ["Leche", "leche|leches|leche ent|leche entera|leche descremada|leche semidescremada|leche sin lactosa|leche deslactosada"],
    ["Leche vegetal", "leche vegetal|leche almendra|leche avena|leche soya|bebida almendra|bebida avena|bebida soya"],
    ["Queso", "queso|quesos|quesillo|queso crema|mozzarella|parmesano|cheddar|gouda|manchego|queso fresco|queso panela"],
    ["Mantequilla", "mantequilla|mantequillas"], ["Margarina", "margarina|margarinas"], ["Crema", "crema leche|crema de leche|nata"],
    ["Yogur", "yogur|yogurt|yoghurt|yogures|yogurts"], ["Kéfir", "kefir|kéfir"], ["Leche condensada", "leche condensada"],
    ["Leche evaporada", "leche evaporada"], ["Dulce de leche", "dulce leche|dulce de leche|manjar"],
  ]),
  ...foods("egg", [["Huevos", "huevo|huevos|huevo blanco|huevo color|huevos blancos|huevos color"]]),
];
