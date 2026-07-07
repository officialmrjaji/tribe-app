const openAIResponsesUrl = "https://api.openai.com/v1/responses";

type OpenAIResponsePayload = {
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
    type?: string;
  }>;
  output_text?: string;
};

export class OpenAIServiceError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "OpenAIServiceError";
    this.status = status;
  }
}

export async function createStructuredAIResponse<T>({
  schema,
  schemaName,
  system,
  user,
}: {
  schema: Record<string, unknown>;
  schemaName: string;
  system: string;
  user: string;
}) {
  const model = getOpenAIModel();
  const response = await fetch(openAIResponsesUrl, {
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: system,
              type: "input_text",
            },
          ],
          role: "system",
        },
        {
          content: [
            {
              text: user,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      model,
      text: {
        format: {
          name: schemaName,
          schema,
          strict: true,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${getOpenAIAPIKey()}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      getOpenAIErrorMessage(payload) ??
      "The AI assistant could not generate a response.";

    throw new OpenAIServiceError(message, response.status || 502);
  }

  const text = extractResponseText(payload as OpenAIResponsePayload | null);

  if (!text) {
    throw new OpenAIServiceError("The AI assistant returned an empty response.");
  }

  try {
    return {
      model,
      output: JSON.parse(text) as T,
    };
  } catch {
    throw new OpenAIServiceError(
      "The AI assistant returned a response we could not read.",
    );
  }
}

function getOpenAIAPIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();

  if (!key) {
    throw new OpenAIServiceError(
      "AI service configuration is required before AI Companion can run.",
      500,
    );
  }

  return key;
}

function getOpenAIModel() {
  const model = process.env.OPENAI_MODEL?.trim();

  if (!model) {
    throw new OpenAIServiceError(
      "AI service configuration is required before AI Companion can run.",
      500,
    );
  }

  return model;
}

function extractResponseText(payload: OpenAIResponsePayload | null) {
  if (!payload) {
    return null;
  }

  if (payload.output_text) {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function getOpenAIErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeError = (payload as { error?: { message?: unknown } }).error;

  return typeof maybeError?.message === "string" ? maybeError.message : null;
}
