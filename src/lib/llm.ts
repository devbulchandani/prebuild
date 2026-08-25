import { PROVIDER_META, useSettings, type ProviderId } from "../store/settings";

export type LLMImage = string; // data URL

/* ---------- readiness ---------- */

function envGeminiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY || undefined;
}

function providerReady(p: Exclude<ProviderId, "auto">): boolean {
  const s = useSettings.getState();
  switch (p) {
    case "gemini":
      return Boolean(s.keys.gemini || envGeminiKey());
    case "openai":
      return Boolean(s.keys.openai);
    case "anthropic":
      return Boolean(s.keys.anthropic);
    case "claude-code":
      return Boolean(s.cliAvailable.claude);
    case "opencode":
      return Boolean(s.cliAvailable.opencode);
    case "local":
      return true;
  }
}

/** Resolve which engine will actually serve the next request. */
export function resolveActive(): { provider: Exclude<ProviderId, "auto">; ready: boolean } {
  const preferred = useSettings.getState().provider;
  if (preferred !== "auto") {
    return { provider: preferred, ready: providerReady(preferred) };
  }
  const order: Exclude<ProviderId, "auto">[] = [
    "gemini",
    "openai",
    "anthropic",
    "claude-code",
    "opencode",
    "local",
  ];
  for (const p of order) if (providerReady(p)) return { provider: p, ready: true };
  return { provider: "local", ready: true };
}

function visionOrder(): Exclude<ProviderId, "auto" | "local">[] {
  const preferred = useSettings.getState().provider;
  const all: Exclude<ProviderId, "auto" | "local">[] = [
    "gemini",
    "openai",
    "anthropic",
    "claude-code",
    "opencode",
  ];
  const ready = all.filter((p) => providerReady(p));
  if (preferred !== "auto" && ready.includes(preferred as never)) {
    return [
      preferred as Exclude<ProviderId, "auto" | "local">,
      ...ready.filter((p) => p !== preferred),
    ];
  }
  return ready;
}

/** Any configured engine that can look at images. CLI agents read saved image files. */
export function hasVisionEngine(): boolean {
  return visionOrder().length > 0;
}

export function activeLabel(): string {
  return PROVIDER_META[resolveActive().provider].short;
}

/* ---------- JSON extraction from arbitrary model text ---------- */

function extractJSON(text: string): unknown {
  let cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* keep trying */
  }
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = cleaned.indexOf(open);
    const end = cleaned.lastIndexOf(close);
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* keep trying */
      }
    }
  }
  throw new Error("NO_JSON_IN_RESPONSE");
}

/* ---------- provider calls ---------- */

const TIMEOUT_MS = 180_000;

function parseDataUrl(dataUrl: LLMImage): { mimeType: string; data: string } | null {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

async function uploadImageForCli(dataUrl: LLMImage): Promise<string | null> {
  try {
    const res = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const data = await res.json();
    return data?.ok ? String(data.path) : null;
  } catch {
    return null;
  }
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

async function callGemini(prompt: string, image?: LLMImage): Promise<string> {
  const s = useSettings.getState();
  const key = s.keys.gemini || envGeminiKey();
  if (!key) throw new Error("NO_KEY");
  const model = s.models.gemini || PROVIDER_META.gemini.defaultModel;
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  const parsed = image ? parseDataUrl(image) : null;
  if (parsed) parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } });

  const { signal, done } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.35, responseMimeType: "application/json" },
        }),
        signal,
      },
    );
    if (!res.ok) throw new Error(`GEMINI_${res.status}`);
    const data = await res.json();
    const text: string = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) throw new Error("EMPTY_RESPONSE");
    return text;
  } finally {
    done();
  }
}

async function callOpenAI(prompt: string, image?: LLMImage): Promise<string> {
  const s = useSettings.getState();
  const key = s.keys.openai;
  if (!key) throw new Error("NO_KEY");
  const model = s.models.openai || PROVIDER_META.openai.defaultModel;

  const content: Record<string, unknown>[] = [{ type: "text", text: prompt }];
  if (image) content.push({ type: "image_url", image_url: { url: image } });

  const { signal, done } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`OPENAI_${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("EMPTY_RESPONSE");
    return text;
  } finally {
    done();
  }
}

async function callAnthropic(prompt: string, image?: LLMImage): Promise<string> {
  const s = useSettings.getState();
  const key = s.keys.anthropic;
  if (!key) throw new Error("NO_KEY");
  const model = s.models.anthropic || PROVIDER_META.anthropic.defaultModel;

  const content: Record<string, unknown>[] = [];
  const parsed = image ? parseDataUrl(image) : null;
  if (parsed)
    content.push({
      type: "image",
      source: { type: "base64", media_type: parsed.mimeType, data: parsed.data },
    });
  content.push({ type: "text", text: prompt });

  const { signal, done } = withTimeout(TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.35,
        messages: [{ role: "user", content }],
      }),
      signal,
    });
    if (!res.ok) throw new Error(`ANTHROPIC_${res.status}`);
    const data = await res.json();
    const text: string = (data.content ?? [])
      .map((b: { text?: string }) => b.text ?? "")
      .join("");
    if (!text) throw new Error("EMPTY_RESPONSE");
    return text;
  } finally {
    done();
  }
}

async function callCli(agent: "claude" | "opencode", prompt: string): Promise<string> {
  // CLI agents can be slow on heavy tasks — give them up to 5 minutes,
  // matching the bridge's own kill timer.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 320_000);
  try {
    const res = await fetch("/api/cli-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent,
        prompt:
          prompt +
          "\n\nOUTPUT RULES: Respond with ONLY the raw JSON object. No markdown fences, no commentary, no explanation before or after.",
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) throw new Error(data?.error ? String(data.error).slice(0, 160) : "CLI_FAILED");
    const text = String(data.text ?? "");
    if (!text.trim()) throw new Error("EMPTY_RESPONSE");
    return text;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error("TIMED_OUT_AFTER_5MIN");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- public entry point ---------- */

/**
 * Send a prompt (+ optional plan image as a data URL) to an AI engine and
 * parse a JSON response. Image requests try vision-capable engines in
 * order — CLI agents receive images as temp files on disk.
 */
export async function llmJSON(prompt: string, image?: LLMImage): Promise<unknown> {
  if (image) {
    const candidates = visionOrder();
    const errors: string[] = [];
    for (const provider of candidates) {
      try {
        let effectivePrompt = prompt;
        if (provider === "claude-code" || provider === "opencode") {
          const filePath = await uploadImageForCli(image);
          if (filePath)
            effectivePrompt += `\n\nAn image file is saved at: ${filePath}\nRead and analyze this image file first before answering.`;
        }
        switch (provider) {
          case "gemini":
            return extractJSON(await callGemini(effectivePrompt, image));
          case "openai":
            return extractJSON(await callOpenAI(effectivePrompt, image));
          case "anthropic":
            return extractJSON(await callAnthropic(effectivePrompt, image));
          case "claude-code":
            return extractJSON(await callCli("claude", effectivePrompt));
          case "opencode":
            return extractJSON(await callCli("opencode", effectivePrompt));
        }
      } catch (e) {
        errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
      }
    }
    throw new Error(errors[0] ?? "ALL_ENGINES_FAILED");
  }

  const { provider, ready } = resolveActive();
  if (!ready || provider === "local") throw new Error("LOCAL_HAS_NO_LLM");
  switch (provider) {
    case "gemini":
      return extractJSON(await callGemini(prompt));
    case "openai":
      return extractJSON(await callOpenAI(prompt));
    case "anthropic":
      return extractJSON(await callAnthropic(prompt));
    case "claude-code":
      return extractJSON(await callCli("claude", prompt));
    case "opencode":
      return extractJSON(await callCli("opencode", prompt));
    default:
      throw new Error("LOCAL_HAS_NO_LLM");
  }
}
