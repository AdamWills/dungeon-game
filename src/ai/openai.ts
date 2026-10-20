// The OpenAI client: plain fetch, straight from the browser with the player's
// key (OpenAI allows cross-origin calls). Every text call asks for a strict
// JSON schema; every call is priced from its reported usage and charged to the
// run's budget. Errors come back as values, never thrown at the game.

import { API_BASE, IMAGE_FALLBACK_COST, IMAGE_PRICES, MODELS, TEXT_PRICES, TIMEOUT_MS } from './config';
import type { Budget } from './budget';

export type AiError =
  | { kind: 'no_key' }
  | { kind: 'budget'; left: number }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'timeout' }
  | { kind: 'network'; message: string }
  | { kind: 'refused'; message: string }
  | { kind: 'bad_output'; message: string };

export type AiResult<T> = { ok: true; value: T; cost: number } | { ok: false; error: AiError };

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type Client = { apiKey: string; budget: Budget; fetch?: Fetch };

type Usage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number; text_tokens?: number; image_tokens?: number } };

/** Price a text call from its usage. Reasoning tokens are already in output_tokens. */
export function textCost(model: string, usage: Usage | undefined): number {
  const p = TEXT_PRICES[model];
  if (!p || !usage) return 0;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const fresh = Math.max(0, (usage.input_tokens ?? 0) - cached);
  return (fresh * p.input + cached * p.cachedInput + (usage.output_tokens ?? 0) * p.output) / 1e6;
}

/** Price an image call; without usage, fall back to a cautious per-image guess. */
export function imageCost(model: string, usage: Usage | undefined, quality: string): number {
  const p = IMAGE_PRICES[model];
  if (!p || !usage?.output_tokens) return IMAGE_FALLBACK_COST[quality] ?? IMAGE_FALLBACK_COST.high;
  const d = usage.input_tokens_details;
  const imageIn = d?.image_tokens ?? 0;
  const textIn = d?.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - imageIn);
  return (textIn * p.textInput + imageIn * p.imageInput + usage.output_tokens * p.imageOutput) / 1e6;
}

async function post(client: Client, path: string, body: unknown, timeout: number): Promise<{ ok: true; json: any } | { ok: false; error: AiError }> {
  if (!client.apiKey) return { ok: false, error: { kind: 'no_key' } };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await (client.fetch ?? fetch)(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${client.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: { kind: 'http', status: res.status, message: json?.error?.message ?? res.statusText } };
    return { ok: true, json };
  } catch (e) {
    if (ctrl.signal.aborted) return { ok: false, error: { kind: 'timeout' } };
    return { ok: false, error: { kind: 'network', message: String(e) } };
  } finally {
    clearTimeout(timer);
  }
}

export type StructuredRequest = {
  /** Our instructions. Never contains player text. */
  system: string;
  /** The scene and the player's text, as data. */
  user: string;
  schemaName: string;
  schema: object;
  maxOutputTokens: number;
};

/**
 * A text call that must return JSON matching the schema (structured outputs).
 * The worst-case cost (all input fresh, all output used) must fit the budget.
 */
export async function structured<T>(client: Client, req: StructuredRequest, model = MODELS.text): Promise<AiResult<T>> {
  const price = TEXT_PRICES[model];
  const worst = price ? ((req.system.length + req.user.length) / 2 * price.input + req.maxOutputTokens * price.output) / 1e6 : 0;
  if (!client.budget.canAfford(worst)) return { ok: false, error: { kind: 'budget', left: client.budget.left } };
  const res = await post(
    client,
    '/responses',
    {
      model,
      input: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      text: { format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true } },
      max_output_tokens: req.maxOutputTokens,
      store: false,
    },
    TIMEOUT_MS.text,
  );
  if (!res.ok) return res;
  const cost = textCost(model, res.json?.usage);
  client.budget.charge(cost);
  const content = (res.json?.output ?? []).flatMap((o: any) => (o?.type === 'message' ? (o.content ?? []) : []));
  const refusal = content.find((c: any) => c?.type === 'refusal');
  if (refusal) return { ok: false, error: { kind: 'refused', message: String(refusal.refusal ?? '') } };
  if (res.json?.status === 'incomplete') return { ok: false, error: { kind: 'bad_output', message: `incomplete: ${res.json?.incomplete_details?.reason ?? 'unknown'}` } };
  const text = content.filter((c: any) => c?.type === 'output_text').map((c: any) => c.text).join('');
  try {
    return { ok: true, value: JSON.parse(text) as T, cost };
  } catch {
    return { ok: false, error: { kind: 'bad_output', message: 'not JSON' } };
  }
}

export type ImageRequest = { prompt: string; size?: string; quality?: 'low' | 'medium' | 'high'; transparent?: boolean };

/** Generate one image; returns PNG data as base64. */
export async function image(client: Client, req: ImageRequest, model = MODELS.image): Promise<AiResult<string>> {
  const quality = req.quality ?? 'low';
  const worst = IMAGE_FALLBACK_COST[quality] ?? IMAGE_FALLBACK_COST.high;
  if (!client.budget.canAfford(worst)) return { ok: false, error: { kind: 'budget', left: client.budget.left } };
  const res = await post(
    client,
    '/images/generations',
    { model, prompt: req.prompt, size: req.size ?? '1024x1024', quality, background: req.transparent === false ? 'opaque' : 'transparent', output_format: 'png', n: 1 },
    TIMEOUT_MS.image,
  );
  if (!res.ok) return res;
  const cost = imageCost(model, res.json?.usage, quality);
  client.budget.charge(cost);
  const b64 = res.json?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') return { ok: false, error: { kind: 'bad_output', message: 'no image' } };
  return { ok: true, value: b64, cost };
}

/** Check a key without spending anything (lists models). */
export async function checkKey(apiKey: string, fetchFn: Fetch = fetch): Promise<{ ok: true } | { ok: false; error: AiError }> {
  if (!apiKey) return { ok: false, error: { kind: 'no_key' } };
  try {
    const res = await fetchFn(`${API_BASE}/models`, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => null);
    return { ok: false, error: { kind: 'http', status: res.status, message: json?.error?.message ?? res.statusText } };
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: String(e) } };
  }
}

/** One plain line for the player. */
export function describeError(e: AiError): string {
  switch (e.kind) {
    case 'no_key':
      return 'No OpenAI key set. Press K to add one.';
    case 'budget':
      return `This run's AI spending limit is reached (left: $${e.left.toFixed(2)}). Press K (title or pause screen) to raise it, or end the run.`;
    case 'http':
      return e.status === 401 ? 'OpenAI rejected the key (401). Press K to check it.' : e.status === 429 ? 'OpenAI says slow down or top up (429). Try again in a moment.' : `OpenAI error ${e.status}: ${e.message}`;
    case 'timeout':
      return 'OpenAI took too long. Try again.';
    case 'network':
      return 'Could not reach OpenAI. Check your connection.';
    case 'refused':
      return 'The AI would not do that one. Try something else.';
    case 'bad_output':
      return 'The AI answer came back garbled. Try again.';
  }
}
