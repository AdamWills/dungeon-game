// The player's AI settings: their own OpenAI key and the spending limit per
// run. Kept only in this browser's localStorage (GDD: bring your own key).

import { DEFAULT_LIMIT_USD } from './config';

const KEY = 'subpar-dungeon:ai-settings';

export type AiSettings = { apiKey: string; limitUsd: number };

export function loadSettings(): AiSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw.apiKey === 'string')
      return { apiKey: raw.apiKey, limitUsd: validLimit(raw.limitUsd) ? raw.limitUsd : DEFAULT_LIMIT_USD };
  } catch {
    // Unavailable or corrupt storage: start fresh.
  }
  return { apiKey: '', limitUsd: DEFAULT_LIMIT_USD };
}

export function saveSettings(s: AiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not remembering means asking again next time; the run still works.
  }
}

export function validLimit(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0.1 && n <= 1000;
}

/** "sk-...wxyz": enough to recognise the key, not enough to use it. */
export function maskKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 3)}...${key.slice(-4)}` : key ? '****' : '';
}
