import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { z } from "zod";
import { authenticatedSupabase } from "@/lib/server/authenticated-supabase";
import { parseRecipeGenerationResult } from "@/lib/recipes/types";

export const maxDuration = 30;

function getDeepSeekApiKey() {
  return [
    process.env.DEEPSEEK_API_KEY,
    process.env.DEEPSEEK_APIKEY,
    process.env["DeepSeek-apikey"],
  ].find((value) => value?.trim())?.trim();
}

const requestSchema = z.object({
  mealType: z.enum(["desayuno", "comida", "cena"]),
  preferences: z.array(z.enum(["rapido", "saludable", "economico", "sorprendeme"])).min(1).max(2),
  craving: z.string().trim().min(1).max(160).optional(),
  ingredientMode: z.enum(["available_only", "allow_extras"]),
  availableIngredients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        quantity: z.number().optional(),
        unit: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(80),
});

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "suggestions"],
  properties: {
    status: { type: "string", enum: ["ok", "insufficient_ingredients"] },
    suggestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "reason",
          "estimatedMinutes",
          "ingredients",
          "missingIngredients",
          "steps",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          reason: { type: "string" },
          estimatedMinutes: { anyOf: [{ type: "integer" }, { type: "null" }] },
          ingredients: { type: "array", items: { type: "string" } },
          missingIngredients: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
          },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export async function POST(request: Request) {
  const startedAt = performance.now();
  console.debug("[recipes-api] request received", { elapsedMs: 0 });
  const auth = await authenticatedSupabase(request);
  if (!auth)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  if (!auth.pro)
    return Response.json(
      { error: "Las recetas son una función Pro." },
      { status: 403 },
    );
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Los ingredientes no son válidos." },
      { status: 400 },
    );
  const deepSeekApiKey = getDeepSeekApiKey();
  if (!deepSeekApiKey)
    return Response.json(
      { error: "Falta configurar el servicio de recetas." },
      { status: 503 },
    );
  try {
    console.info("recipe_request_valid", {
      itemCount: parsed.data.availableIngredients.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    const client = new OpenAI({
      apiKey: deepSeekApiKey,
      baseURL: "https://api.deepseek.com",
      maxRetries: 0,
      timeout: 30_000,
    });
    console.debug("[recipes-api] AI request started", { elapsedMs: Math.round(performance.now() - startedAt) });
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_RECIPE_MODEL || "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: `Eres un asistente de cocina práctico basado en el inventario real del usuario. Responde en español de Chile y exclusivamente como JSON válido. Genera entre 1 y 3 recetas diferentes, realistas y fáciles, adecuadas al tipo de comida y preferencias solicitadas. Prioriza los ingredientes disponibles para reducir desperdicio y no afirmes que el usuario tiene algo que no aparece en availableIngredients. Si ingredientMode es available_only, usa estrictamente el inventario y solo puedes asumir agua, sal y aceite; missingIngredients debe estar vacío. Si no existe ninguna receta razonable, responde status="insufficient_ingredients" y suggestions=[]. En cualquier otro caso responde status="ok". Si ingredientMode es allow_extras, permite entre 1 y 3 ingredientes adicionales como máximo e identifícalos en missingIngredients. Si la preferencia es rapido, evita preparaciones complejas. Considera craving solo cuando esté presente. ingredients debe listar los ingredientes disponibles utilizados; reason debe explicar brevemente por qué recomiendas la receta. Usa exactamente esta estructura: ${JSON.stringify(schema)}`,
        },
        { role: "user", content: JSON.stringify(parsed.data) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2200,
      thinking: { type: "disabled" },
    } as ChatCompletionCreateParamsNonStreaming & {
      thinking: { type: "disabled" };
    });
    console.debug("[recipes-api] AI request completed", { elapsedMs: Math.round(performance.now() - startedAt), finishReason: response.choices[0]?.finish_reason });
    const content = response.choices[0]?.message.content;
    if (!content)
      throw new SyntaxError("DeepSeek devolvió una respuesta vacía.");
    console.debug("[recipes-api] parse started", { elapsedMs: Math.round(performance.now() - startedAt) });
    const result = parseRecipeGenerationResult(JSON.parse(content));
    console.info("recipe_generation_ok", {
      suggestionCount: result.suggestions.length,
      status: result.status,
      elapsedMs: Math.round(performance.now() - startedAt),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError)
      console.error("recipe_validation_failed", error.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })));
    else if (error instanceof SyntaxError)
      console.error("recipe_json_parse_failed", { message: error.message });
    const providerError = error as { status?: number; code?: string; message?: string };
    console.error("recipe_generation_failed", { status: providerError.status, code: providerError.code, message: providerError.message || "unknown", elapsedMs: Math.round(performance.now() - startedAt) });
    return Response.json(
      { error: "No pudimos crear recetas en este momento." },
      { status: 502 },
    );
  }
}
