import { describe, expect, it } from 'vitest';

import { Budget, formatUsd } from '../src/ai/budget';
import { checkKey, type Fetch, image, imageCost, structured, textCost } from '../src/ai/openai';
import { maskKey } from '../src/ai/settings';

/** A fake fetch that records requests and answers with the given JSON. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn: Fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { fn, calls };
}

const REQ = { system: 'Rules.', user: 'Scene.', schemaName: 'outcome', schema: { type: 'object' }, maxOutputTokens: 400 };

function reply(text: string, usage = { input_tokens: 2000, output_tokens: 300 }) {
  return { status: 'completed', usage, output: [{ type: 'message', content: [{ type: 'output_text', text }] }] };
}

describe('pricing', () => {
  it('prices text calls from usage, with cached input cheaper', () => {
    expect(textCost('gpt-6-luna', { input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(0.6);
    expect(textCost('gpt-6-luna', { input_tokens: 1_000_000, output_tokens: 0, input_tokens_details: { cached_tokens: 1_000_000 } })).toBeCloseTo(0.01);
  });

  it('prices image calls from usage, or guesses cautiously without it', () => {
    expect(imageCost('gpt-image-2', { input_tokens: 100, output_tokens: 200, input_tokens_details: { text_tokens: 100 } }, 'low')).toBeCloseTo((100 * 5 + 200 * 30) / 1e6);
    expect(imageCost('gpt-image-2', undefined, 'low')).toBeGreaterThan(0.006);
  });

  it('formats money for the meter', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(0.004)).toBe('<$0.01');
    expect(formatUsd(1.234)).toBe('$1.23');
  });
});

describe('structured calls', () => {
  it('sends a strict JSON schema request with the key, parses the answer and charges the budget', async () => {
    const f = fakeFetch(200, reply('{"grade":"meh"}'));
    const budget = new Budget(5);
    const res = await structured<{ grade: string }>({ apiKey: 'sk-test', budget, fetch: f.fn }, REQ);
    expect(res).toMatchObject({ ok: true, value: { grade: 'meh' } });
    const sent = JSON.parse(String(f.calls[0].init.body));
    expect(f.calls[0].url).toBe('https://api.openai.com/v1/responses');
    expect((f.calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(sent.model).toBe('gpt-6-luna');
    expect(sent.text.format).toMatchObject({ type: 'json_schema', name: 'outcome', strict: true });
    expect(sent.input[0]).toEqual({ role: 'system', content: 'Rules.' });
    expect(budget.spent).toBeCloseTo((2000 * 0.1 + 300 * 0.5) / 1e6);
    expect(budget.calls).toBe(1);
  });

  it('never calls when the budget cannot cover the worst case', async () => {
    const f = fakeFetch(200, reply('{}'));
    const budget = new Budget(5);
    budget.spent = 5;
    const res = await structured({ apiKey: 'sk-test', budget, fetch: f.fn }, REQ);
    expect(res).toMatchObject({ ok: false, error: { kind: 'budget' } });
    expect(f.calls).toHaveLength(0);
  });

  it('needs a key', async () => {
    const res = await structured({ apiKey: '', budget: new Budget(5) }, REQ);
    expect(res).toMatchObject({ ok: false, error: { kind: 'no_key' } });
  });

  it('reports HTTP errors, refusals and garbage as values', async () => {
    const budget = new Budget(5);
    expect(await structured({ apiKey: 'k', budget, fetch: fakeFetch(401, { error: { message: 'bad key' } }).fn }, REQ)).toMatchObject({ ok: false, error: { kind: 'http', status: 401 } });
    const refusal = { status: 'completed', usage: { input_tokens: 10, output_tokens: 5 }, output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] };
    expect(await structured({ apiKey: 'k', budget, fetch: fakeFetch(200, refusal).fn }, REQ)).toMatchObject({ ok: false, error: { kind: 'refused' } });
    expect(await structured({ apiKey: 'k', budget, fetch: fakeFetch(200, reply('not json')).fn }, REQ)).toMatchObject({ ok: false, error: { kind: 'bad_output' } });
    const thrower: Fetch = async () => {
      throw new Error('offline');
    };
    expect(await structured({ apiKey: 'k', budget, fetch: thrower }, REQ)).toMatchObject({ ok: false, error: { kind: 'network' } });
  });
});

describe('images and keys', () => {
  it('asks for a transparent PNG and returns its data', async () => {
    const f = fakeFetch(200, { data: [{ b64_json: 'AAAA' }], usage: { input_tokens: 50, output_tokens: 272, input_tokens_details: { text_tokens: 50 } } });
    const budget = new Budget(5);
    const res = await image({ apiKey: 'k', budget, fetch: f.fn }, { prompt: 'a rat' });
    expect(res).toMatchObject({ ok: true, value: { b64: 'AAAA', keyed: false } });
    const sent = JSON.parse(String(f.calls[0].init.body));
    expect(sent).toMatchObject({ model: 'gpt-image-2.5-flare', background: 'transparent', output_format: 'png', quality: 'low' });
    expect(budget.spent).toBeGreaterThan(0);
  });

  it('asks for a flat key colour when the model cannot do transparency, or turns it down', async () => {
    // A model known to lack it: no transparent request at all.
    const f = fakeFetch(200, { data: [{ b64_json: 'BBBB' }] });
    const res = await image({ apiKey: 'k', budget: new Budget(5), fetch: f.fn }, { prompt: 'a rat' }, 'gpt-image-2');
    expect(res).toMatchObject({ ok: true, value: { keyed: true } });
    const sent = JSON.parse(String(f.calls[0].init.body));
    expect(sent.background).toBe('opaque');
    expect(sent.prompt).toContain('magenta');
    // A model that answers 400 "Transparent background is not supported": one retry, keyed.
    const calls: string[] = [];
    const flaky: Fetch = async (_url, init) => {
      const body = JSON.parse(String(init.body));
      calls.push(body.background);
      if (body.background === 'transparent') return new Response(JSON.stringify({ error: { message: 'Transparent background is not supported for this model.' } }), { status: 400 });
      return new Response(JSON.stringify({ data: [{ b64_json: 'CCCC' }] }), { status: 200 });
    };
    const again = await image({ apiKey: 'k', budget: new Budget(5), fetch: flaky }, { prompt: 'a rat' }, 'some-new-model');
    expect(again).toMatchObject({ ok: true, value: { b64: 'CCCC', keyed: true } });
    expect(calls).toEqual(['transparent', 'opaque']);
  });

  it('checks a key for free and masks it for display', async () => {
    expect(await checkKey('k', fakeFetch(200, { data: [] }).fn)).toEqual({ ok: true });
    expect(await checkKey('k', fakeFetch(401, { error: { message: 'nope' } }).fn)).toMatchObject({ ok: false });
    expect(maskKey('sk-proj-abcdefgh1234')).toBe('sk-...1234');
  });
});

describe('the AI log', () => {
  it('records each call with timing, tokens, cost, prompt and response, and keeps lifetime totals', async () => {
    const store: Record<string, string> = {};
    const fake = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
    (globalThis as { localStorage?: unknown }).localStorage = fake;
    const { readLog, readTotals, clearLog } = await import('../src/ai/log');
    const f = fakeFetch(200, reply('{"grade":"meh"}', { input_tokens: 1000, output_tokens: 200 }));
    await structured({ apiKey: 'k', budget: new Budget(5), fetch: f.fn }, { ...REQ, purpose: 'typed action: "x"' });
    await structured({ apiKey: 'k', budget: new Budget(5), fetch: fakeFetch(500, { error: { message: 'boom' } }).fn }, REQ);
    const log = readLog();
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ purpose: 'typed action: "x"', model: 'gpt-6-luna', ok: true, inputTokens: 1000, outputTokens: 200, request: { system: 'Rules.' }, response: { grade: 'meh' } });
    expect(log[1].ms).toBeGreaterThanOrEqual(0);
    expect(log[0]).toMatchObject({ ok: false, status: 500 });
    expect(readTotals()).toMatchObject({ calls: 2, inputTokens: 1000, outputTokens: 200 });
    clearLog();
    expect(readLog()).toHaveLength(0);
    expect(readTotals().calls).toBe(2); // lifetime totals never reset
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
