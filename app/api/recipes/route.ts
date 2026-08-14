import OpenAI from "openai";
import { z } from "zod";
import { authenticatedSupabase } from "@/lib/server/authenticated-supabase";
import { recipeResponseSchema } from "@/lib/recipes/types";

const requestSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        quantity: z.number().optional(),
        unit: z.string().max(40).optional(),
      }),
    )
    .min(1)
    .max(80),
  preference: z.string().max(100).optional(),
  craving: z.string().max(160).optional(),
});

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "estimatedMinutes",
          "ingredients",
          "missingIngredients",
          "steps",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          estimatedMinutes: { anyOf: [{ type: "integer" }, { type: "null" }] },
          ingredients: { type: "array", items: { type: "string" } },
          missingIngredients: {
            type: "array",
            maxItems: 1,
            items: { type: "string" },
          },
          steps: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export async function POST(request: Request) {
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
  if (!process.env.DEEPSEEK_API_KEY)
    return Response.json(
      { error: "Falta configurar el servicio de recetas." },
      { status: 503 },
    );
  try {
    console.info("recipe_request_valid", {
      itemCount: parsed.data.items.length,
    });
    const client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
    const response = await client.chat.completions.create({
      model: process.env.DEEPSEEK_RECIPE_MODEL || "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content: `Eres un ayudante de cocina práctico. Responde en español de Chile y exclusivamente como JSON válido. Propón hasta 3 recetas realistas usando principalmente lo disponible. Incluye como máximo 1 ingrediente faltante por receta y pasos breves. No inventes que el usuario posee ingredientes. Usa exactamente esta estructura: ${JSON.stringify(schema)}`,
        },
        { role: "user", content: JSON.stringify(parsed.data) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 2200,
    });
    const content = response.choices[0]?.message.content;
    if (!content)
      throw new SyntaxError("DeepSeek devolvió una respuesta vacía.");
    const result = recipeResponseSchema.parse(JSON.parse(content));
    console.info("recipe_generation_ok", {
      suggestionCount: result.suggestions.length,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      console.error("recipe_validation_failed");
    console.error(
      "recipe_generation_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { error: "No pudimos crear recetas en este momento." },
      { status: 502 },
    );
  }
}
