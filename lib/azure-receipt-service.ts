import { normalizeAzureReceipt } from "./receipt-normalizer";

const safeLog = (event: string, details: Record<string, unknown>) => {
  console.info(`[receipt-scan] ${event}`, details);
};

type AzureErrorBody = {
  error?: { code?: string; message?: string; innererror?: { code?: string } };
};

export async function analyzeReceipt(image: ArrayBuffer, contentType: string) {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.replace(
    /\/$/,
    "",
  );
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  safeLog("configuration", {
    endpointConfigured: Boolean(endpoint),
    keyConfigured: Boolean(key),
  });
  safeLog("input", { mimeType: contentType, sizeBytes: image.byteLength });
  if (!endpoint || !key)
    throw new ReceiptServiceError(
      "configuration",
      503,
      "El escáner de tickets todavía no está configurado.",
      "NotConfigured",
    );

  const url = `${endpoint}/documentintelligence/documentModels/prebuilt-receipt:analyze?_overload=analyzeDocument&api-version=2024-11-30`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      base64Source: Buffer.from(image).toString("base64"),
    }),
  });
  safeLog("azure-analyze-response", { status: response.status });
  if (response.status !== 202) {
    const bodyText = await response.text();
    let parsed: AzureErrorBody = {};
    try {
      parsed = JSON.parse(bodyText) as AzureErrorBody;
    } catch {}
    const azureCode =
      parsed.error?.innererror?.code ||
      parsed.error?.code ||
      "AzureAnalyzeError";
    safeLog("azure-analyze-error", {
      status: response.status,
      azureCode,
      body: bodyText.slice(0, 4000),
    });
    throw new ReceiptServiceError(
      "Azure analyze",
      response.status,
      parsed.error?.message || "Azure rechazó el ticket.",
      azureCode,
    );
  }

  const operation = response.headers.get("operation-location");
  safeLog("operation-location", { present: Boolean(operation) });
  if (!operation)
    throw new ReceiptServiceError(
      "Azure analyze",
      502,
      "Azure no devolvió Operation-Location.",
      "MissingOperationLocation",
    );

  for (let attempt = 1; attempt <= 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const poll = await fetch(operation, {
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    if (!poll.ok) {
      const bodyText = await poll.text();
      let parsed: AzureErrorBody = {};
      try {
        parsed = JSON.parse(bodyText) as AzureErrorBody;
      } catch {}
      const azureCode =
        parsed.error?.innererror?.code ||
        parsed.error?.code ||
        "AzurePollingError";
      safeLog("azure-poll-error", {
        attempt,
        status: poll.status,
        azureCode,
        body: bodyText.slice(0, 4000),
      });
      throw new ReceiptServiceError(
        "Azure polling",
        poll.status,
        parsed.error?.message || "No pudimos consultar el análisis.",
        azureCode,
      );
    }
    const json = await poll.json();
    safeLog("azure-poll", { attempt, status: json.status });
    if (json.status === "failed") {
      const azureCode =
        json.error?.innererror?.code || json.error?.code || "AnalysisFailed";
      safeLog("azure-final-error", { azureCode, error: json.error || null });
      throw new ReceiptServiceError(
        "Azure polling",
        502,
        json.error?.message || "Azure no pudo analizar el ticket.",
        azureCode,
      );
    }
    if (json.status === "succeeded") {
      const receipt = normalizeAzureReceipt(json);
      const documents = json.analyzeResult?.documents?.length || 0;
      safeLog("azure-result", {
        documents,
        merchantName: receipt.merchantName || null,
        items: receipt.items.length,
        total: receipt.total || null,
      });
      return receipt;
    }
  }
  throw new ReceiptServiceError(
    "Azure polling",
    504,
    "El análisis tardó demasiado.",
    "PollingTimeout",
  );
}

export class ReceiptServiceError extends Error {
  constructor(
    public stage: string,
    public status: number,
    message: string,
    public azureCode?: string,
  ) {
    super(message);
  }
  toResponse() {
    return {
      success: false as const,
      stage: this.stage,
      status: this.status,
      message: this.message,
      azureCode: this.azureCode,
    };
  }
}
