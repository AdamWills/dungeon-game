// Which OpenAI models the game uses, and what they cost. One place to change
// either (GDD "Direction change: AI-first"). Prices are USD per million tokens,
// from OpenAI's pricing page (checked Oct 20, 2026).

export const MODELS = {
  /** Small, fast and cheap: typed actions, quick reactions. */
  text: 'gpt-6-luna',
  /** Sprites and showpieces. Fast everyday model; it supports transparent backgrounds (gpt-image-2 does not). */
  image: 'gpt-image-2.5-flare',
};

export const API_BASE = 'https://api.openai.com/v1';

export type TextPrice = { input: number; cachedInput: number; output: number };
export type ImagePrice = { textInput: number; imageInput: number; imageOutput: number };

export const TEXT_PRICES: Record<string, TextPrice> = {
  'gpt-6-luna': { input: 0.1, cachedInput: 0.01, output: 0.5 },
};

export const IMAGE_PRICES: Record<string, ImagePrice> = {
  'gpt-image-2.5-flare': { textInput: 5, imageInput: 8, imageOutput: 30 },
  'gpt-image-2.5-sunburst': { textInput: 5, imageInput: 8, imageOutput: 30 },
  'gpt-image-2': { textInput: 5, imageInput: 8, imageOutput: 30 },
};

/** Models that cannot draw on transparency: we ask for a flat key colour and remove it ourselves. */
export const NO_TRANSPARENCY = new Set(['gpt-image-2']);

/** The flat background colour asked for when a model cannot do transparency. */
export const KEY_COLOR = { rgb: [255, 0, 255] as [number, number, number], name: 'pure magenta (#FF00FF)' };

/** When an image response reports no usage: a cautious per-image guess by quality (1024 px square). */
export const IMAGE_FALLBACK_COST: Record<string, number> = { low: 0.01, medium: 0.06, high: 0.22 };

/** Spending limit per run unless the player sets another (user decision). */
export const DEFAULT_LIMIT_USD = 5;

/** Give up on a call after this long; the turn is not spent. */
export const TIMEOUT_MS = { text: 20_000, image: 90_000 };
