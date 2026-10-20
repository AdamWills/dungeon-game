// Asking the AI what a typed action does. Runs in the browser shell, never in
// the game core: the answer is handed back to the core as a recorded command.

import { ACTION_CAPS, ACTION_SCHEMA, ACTION_SYSTEM } from '../data/aiPrompts';
import { actionScene, type TypedAnswer } from '../battle/typed';
import type { GameState } from '../game/types';
import { type AiResult, type Client, structured } from './openai';

export async function askAction(client: Client, state: GameState, text: string): Promise<AiResult<TypedAnswer>> {
  const battle = state.battle;
  if (!battle) return { ok: false, error: { kind: 'bad_output', message: 'not in a fight' } };
  // The scene and the player's words travel as data, never as instructions.
  const user = JSON.stringify({ scene: actionScene(state, battle), playerAction: text.slice(0, ACTION_CAPS.textChars) });
  return structured<TypedAnswer>(client, { system: ACTION_SYSTEM, user, schemaName: 'typed_action', schema: ACTION_SCHEMA, maxOutputTokens: 500, purpose: `typed action: "${text.slice(0, 60)}"` });
}
