// A record of every AI call (user request: "log how long the API responses
// take and what they are"), plus lifetime totals that never reset (user
// request: a running total of every token spent on the game). Both live in
// this browser's localStorage. Image data is never stored, only the prompt.

const LOG_KEY = 'subpar-dungeon:ai-log';
const TOTALS_KEY = 'subpar-dungeon:ai-lifetime';
/** Keep the newest calls; prompts are a few KB each. */
const KEEP = 150;

export type AiLogEntry = {
  at: number;
  /** What it was for: "typed action", "sprite", "item", ... */
  purpose: string;
  model: string;
  ms: number;
  ok: boolean;
  status?: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  /** What we sent (system prompt, user message, or image prompt). */
  request: unknown;
  /** What came back (parsed JSON or text; images as a note), or the error. */
  response: unknown;
};

export type AiTotals = { calls: number; inputTokens: number; outputTokens: number; usd: number; since: number };

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readLog(): AiLogEntry[] {
  try {
    return JSON.parse(storage()?.getItem(LOG_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function readTotals(): AiTotals {
  try {
    const t = JSON.parse(storage()?.getItem(TOTALS_KEY) ?? 'null');
    if (t && typeof t.calls === 'number') return t;
  } catch {
    // Start fresh below.
  }
  return { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, since: Date.now() };
}

/** Totals for this browser tab, for the HUD without re-reading storage every frame. */
let cached: AiTotals | null = null;
export function lifetime(): AiTotals {
  return (cached ??= readTotals());
}

export function record(entry: AiLogEntry): void {
  const s = storage();
  const t = readTotals();
  t.calls++;
  t.inputTokens += entry.inputTokens;
  t.outputTokens += entry.outputTokens;
  t.usd += entry.cost;
  cached = t;
  if (!s) return;
  try {
    s.setItem(TOTALS_KEY, JSON.stringify(t));
  } catch {
    // Storage full or blocked: the totals for this tab still count.
  }
  let log = [entry, ...readLog()].slice(0, KEEP);
  // If storage is full, drop the oldest calls until it fits.
  while (log.length) {
    try {
      s.setItem(LOG_KEY, JSON.stringify(log));
      return;
    } catch {
      log = log.slice(0, Math.floor(log.length / 2));
    }
  }
}

/** Empty the call log (the lifetime totals stay). */
export function clearLog(): void {
  try {
    storage()?.removeItem(LOG_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** "12.3k" for token counts. */
export function shortCount(n: number): string {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}
