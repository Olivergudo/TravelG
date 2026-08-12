import { NextResponse } from "next/server";
import {
  analyzeReceipt,
  ReceiptServiceError,
} from "@/lib/azure-receipt-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData(),
      file = form.get("image");
    if (!(file instanceof File) || !file.type.startsWith("image/"))
      return NextResponse.json(
        {
          success: false,
          stage: "input",
          status: 400,
          message: "Selecciona una imagen válida.",
          azureCode: "InvalidImage",
        },
        { status: 400 },
      );
    if (file.size > 12_000_000)
      return NextResponse.json(
        {
          success: false,
          stage: "input",
          status: 413,
          message: "La imagen es demasiado grande.",
          azureCode: "ImageTooLarge",
        },
        { status: 413 },
      );
    const receipt = await analyzeReceipt(await file.arrayBuffer(), file.type);
    if (!receipt.items.length && !receipt.merchantName && !receipt.total)
      return NextResponse.json(
        {
          success: false,
          stage: "normalization",
          status: 422,
          message:
            "Azure no detectó información útil. Intenta otra foto con buena iluminación.",
          azureCode: "InsufficientReceiptData",
        },
        { status: 422 },
      );
    return NextResponse.json(receipt);
  } catch (error) {
    if (error instanceof ReceiptServiceError)
      return NextResponse.json(
        process.env.NODE_ENV === "development"
          ? error.toResponse()
          : { success: false, message: error.message },
        {
          status:
            error.status >= 400 && error.status <= 599 ? error.status : 502,
        },
      );
    console.error("[receipt-scan] unexpected-error", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      process.env.NODE_ENV === "development"
        ? {
            success: false,
            stage: "server",
            status: 500,
            message: "No pudimos procesar la imagen.",
            azureCode: "UnexpectedError",
          }
        : { success: false, message: "No pudimos procesar la imagen." },
      { status: 500 },
    );
  }
}
