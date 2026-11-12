/**
 * Minimal OpenAI Chat Completions client with strict JSON-schema output.
 * Plain fetch: one endpoint doesn't justify the SDK, and it keeps tests easy to mock.
 */

export type OpenAIErrorKind =
  | "auth"
  | "quota"
  | "rate_limit"
  | "model"
  | "bad_request"
  | "timeout"
  | "unavailable"
  | "refusal"
  | "truncated"
  | "invalid_output";

export class OpenAIError extends Error {
  constructor(
    public readonly kind: OpenAIErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OpenAIError";
  }
}

export type ChatMessage = { role: "system" | "user"; content: string };

export type ChatJsonOptions = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxCompletionTokens?: number;
  /** Only sent to reasoning models (gpt-5, o-series). Lower = faster, fewer hidden tokens. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

type OpenAIErrorBody = { error?: { message?: string; code?: string | null; type?: string } };

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelayMs(res: Response | null, attempt: number): number {
  const header = res?.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 20_000);
  return Math.min(1000 * 2 ** attempt, 8000);
}

async function errorFromResponse(res: Response, model: string): Promise<OpenAIError> {
  let body: OpenAIErrorBody = {};
  try {
    body = (await res.json()) as OpenAIErrorBody;
  } catch {
    /* non-JSON error body */
  }
  const code = body.error?.code ?? "";
  const message = body.error?.message ?? "";

  switch (res.status) {
    case 401:
      return new OpenAIError("auth", "OpenAI rejected your API key. Check it in Settings.", 401);
    case 403:
      return new OpenAIError("auth", "Your OpenAI key isn't allowed to use this model or region.", 403);
    case 404:
      return new OpenAIError("model", `Model "${model}" was not found or isn't available to your key. Pick another model in Settings.`, 404);
    case 429:
      return code === "insufficient_quota"
        ? new OpenAIError("quota", "Your OpenAI account has no remaining credit. Check billing at platform.openai.com.", 429)
        : new OpenAIError("rate_limit", "OpenAI is rate limiting your key. Wait a moment and retry.", 429);
    case 400:
      if (code === "model_not_found" || /model/i.test(message) || /response_format|json_schema/i.test(message)) {
        return new OpenAIError("model", `Model "${model}" can't be used for this (it must support structured outputs). ${message}`.trim(), 400);
      }
      return new OpenAIError("bad_request", `OpenAI rejected the request: ${message || "bad request"}`, 400);
    default:
      return new OpenAIError("unavailable", `OpenAI is unavailable right now (HTTP ${res.status}). Please retry.`, res.status);
  }
}

const isRetryable = (e: OpenAIError) => e.kind === "rate_limit" || e.kind === "unavailable";

/** gpt-5*, o1/o3/o4…: models that spend hidden reasoning tokens (except the chat variants). */
export const isReasoningModel = (model: string) => /^(gpt-5|o\d)/i.test(model) && !/chat/i.test(model);

export async function chatCompletionJson(opts: ChatJsonOptions): Promise<{ data: unknown; model: string }> {
  const {
    apiKey,
    model,
    messages,
    schemaName,
    schema,
    baseUrl = "https://api.openai.com/v1",
    // Reasoning models often need 1–3 minutes for a full resume.
    timeoutMs = 300_000,
    maxRetries = 2,
    // Includes a reasoning model's hidden reasoning tokens, so leave plenty of room.
    maxCompletionTokens = 20_000,
    reasoningEffort = "low",
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = opts;

  const body = JSON.stringify({
    model,
    messages,
    // No temperature: reasoning models (gpt-5, o-series) reject non-default values.
    max_completion_tokens: maxCompletionTokens,
    ...(isReasoningModel(model) ? { reasoning_effort: reasoningEffort } : {}),
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
  });

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new OpenAIError("timeout", `OpenAI didn't answer within ${Math.round(timeoutMs / 1000)}s. Please retry.`);
      }
      if (attempt < maxRetries) {
        await sleep(retryDelayMs(null, attempt));
        continue;
      }
      // fetch hides the network error in `cause` (e.g. ETIMEDOUT, ENOTFOUND, ECONNREFUSED).
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      throw new OpenAIError(
        "unavailable",
        `Couldn't reach OpenAI${code ? ` (${code})` : ""}. Check the server's internet connection.`,
      );
    }

    if (!res.ok) {
      const error = await errorFromResponse(res, model);
      if (isRetryable(error) && attempt < maxRetries) {
        await sleep(retryDelayMs(res, attempt));
        continue;
      }
      throw error;
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
    };
    const choice = json.choices?.[0];
    if (choice?.message?.refusal) throw new OpenAIError("refusal", `The model declined: ${choice.message.refusal}`);
    if (choice?.finish_reason === "length") {
      throw new OpenAIError("truncated", "The answer was cut off (too long). Try a shorter job description or fewer companies.");
    }
    const content = choice?.message?.content;
    if (!content) throw new OpenAIError("invalid_output", "OpenAI returned an empty answer. Please retry.");
    try {
      return { data: JSON.parse(content), model: json.model ?? model };
    } catch {
      throw new OpenAIError("invalid_output", "OpenAI returned malformed JSON. Please retry.");
    }
  }
}

/** Cheap key check: lists models. Returns "invalid" only when OpenAI says so. */
export async function verifyApiKey(
  apiKey: string,
  { baseUrl = "https://api.openai.com/v1", fetchImpl = fetch }: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return "valid";
    if (res.status === 401) return "invalid";
    return "unknown";
  } catch {
    return "unknown";
  }
}
