import { describe, expect, it, vi } from "vitest";
import { chatCompletionJson, OpenAIError, verifyApiKey } from "@/server/ai/openai";

const ok = (content: unknown, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ model: "gpt-x-2026", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content), ...extra } }] }), { status: 200 });
const err = (status: number, code = "", message = "", headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message } }), { status, headers });

const base = { apiKey: "sk-test", model: "gpt-4.1-mini", messages: [{ role: "user" as const, content: "hi" }], schemaName: "s", schema: {} };
const noSleep = vi.fn(async () => {});

async function expectKind(p: Promise<unknown>, kind: string) {
  await expect(p).rejects.toBeInstanceOf(OpenAIError);
  await p.catch((e: OpenAIError) => expect(e.kind).toBe(kind));
}

describe("chatCompletionJson", () => {
  it("sends a strict json_schema request and parses the answer", async () => {
    const fetchImpl = vi.fn(async () => ok({ a: 1 }));
    const r = await chatCompletionJson({ ...base, fetchImpl, baseUrl: "https://example.test/v1/" });
    expect(r).toEqual({ data: { a: 1 }, model: "gpt-x-2026" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { name: "s", strict: true } });
    expect(body).not.toHaveProperty("temperature");
  });

  it("retries 5xx and rate limits, honouring retry-after", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(err(503))
      .mockResolvedValueOnce(err(429, "rate_limit_exceeded", "", { "retry-after": "3" }))
      .mockResolvedValueOnce(ok({ done: true }));
    const r = await chatCompletionJson({ ...base, fetchImpl, sleep });
    expect(r.data).toEqual({ done: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenLastCalledWith(3000);
  });

  it("gives up after maxRetries", async () => {
    const fetchImpl = vi.fn(async () => err(500));
    await expectKind(chatCompletionJson({ ...base, fetchImpl, sleep: noSleep, maxRetries: 1 }), "unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "", "", "auth"],
    [404, "", "", "model"],
    [400, "model_not_found", "The model does not exist", "model"],
    [400, "", "Invalid parameter: response_format json_schema not supported", "model"],
    [400, "", "Something else", "bad_request"],
    [429, "insufficient_quota", "", "quota"],
  ])("maps HTTP %i %s to %s without retrying", async (status, code, message, kind) => {
    const fetchImpl = vi.fn(async () => err(status, code, message));
    await expectKind(chatCompletionJson({ ...base, fetchImpl, sleep: noSleep }), kind);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never echoes OpenAI's 401 message (it can contain part of the key)", async () => {
    const fetchImpl = vi.fn(async () => err(401, "invalid_api_key", "Incorrect API key provided: sk-abc***xyz"));
    await chatCompletionJson({ ...base, fetchImpl }).catch((e: Error) => expect(e.message).not.toContain("sk-"));
  });

  it("handles refusals, truncation, empty and malformed output", async () => {
    await expectKind(chatCompletionJson({ ...base, fetchImpl: async () => ok(null, { content: null, refusal: "no" }) }), "refusal");
    const truncated = new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{" } }] }));
    await expectKind(chatCompletionJson({ ...base, fetchImpl: async () => truncated }), "truncated");
    const empty = new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "" } }] }));
    await expectKind(chatCompletionJson({ ...base, fetchImpl: async () => empty }), "invalid_output");
    const bad = new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{oops" } }] }));
    await expectKind(chatCompletionJson({ ...base, fetchImpl: async () => bad }), "invalid_output");
  });

  it("reports timeouts without retrying", async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error("t"), { name: "TimeoutError" });
    });
    await expectKind(chatCompletionJson({ ...base, fetchImpl, sleep: noSleep }), "timeout");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries network errors, then reports unavailable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expectKind(chatCompletionJson({ ...base, fetchImpl, sleep: noSleep, maxRetries: 2 }), "unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("verifyApiKey", () => {
  it.each([
    [200, "valid"],
    [401, "invalid"],
    [500, "unknown"],
  ] as const)("HTTP %i → %s", async (status, expected) => {
    expect(await verifyApiKey("sk-x", { fetchImpl: async () => new Response("{}", { status }) })).toBe(expected);
  });

  it("network failure → unknown", async () => {
    expect(await verifyApiKey("sk-x", { fetchImpl: async () => Promise.reject(new Error("down")) })).toBe("unknown");
  });
});
