// The AI call log page (/ailog.html): every call from this browser, with its
// timing, tokens, cost, prompt and response, and the lifetime totals.

import { formatUsd } from './ai/budget';
import { type AiLogEntry, clearLog, readLog, readTotals, shortCount } from './ai/log';

const $ = (id: string) => document.getElementById(id)!;
const purposeKind = (p: string) => p.split(':')[0];

function el(tag: string, cls: string, text: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = text;
  return e;
}

function render(): void {
  const t = readTotals();
  const log = readLog();
  const avg = log.filter((e) => e.ok).reduce((n, e, _, a) => n + e.ms / a.length, 0);
  $('totals').replaceChildren(
    ...[
      ['All-time tokens', `${shortCount(t.inputTokens + t.outputTokens)} (${shortCount(t.inputTokens)} in, ${shortCount(t.outputTokens)} out)`],
      ['All-time cost', formatUsd(t.usd)],
      ['All-time calls', String(t.calls)],
      ['Counting since', new Date(t.since).toLocaleDateString()],
      ['Average response (logged calls)', log.length ? `${(avg / 1000).toFixed(1)} s` : '-'],
    ].map(([k, v]) => {
      const d = el('div', 'dim', k);
      d.append(el('b', '', v));
      return d;
    }),
  );

  const filter = $('filter') as HTMLSelectElement;
  const kinds = [...new Set(log.map((e) => purposeKind(e.purpose)))];
  const chosen = filter.value;
  filter.replaceChildren(el('option', '', 'All calls'), ...kinds.map((k) => Object.assign(el('option', '', k), { value: k })));
  (filter.firstChild as HTMLOptionElement).value = '';
  filter.value = kinds.includes(chosen) ? chosen : '';

  const shown = log.filter((e) => !filter.value || purposeKind(e.purpose) === filter.value);
  $('calls').replaceChildren(...(shown.length ? shown.map(entry) : [el('p', 'dim', 'No calls logged yet. Play a fight and use "Type anything", or generate a sprite in the lab.')]));
}

function entry(e: AiLogEntry): HTMLElement {
  const d = document.createElement('details');
  const s = document.createElement('summary');
  s.append(
    el('span', 'dim', new Date(e.at).toLocaleTimeString()),
    el('span', 'what', e.purpose),
    el('span', e.ms > 8000 ? 'slow' : '', `${(e.ms / 1000).toFixed(2)} s`),
    el('span', '', formatUsd(e.cost)),
    el('span', 'dim', `${e.inputTokens} in / ${e.outputTokens} out`),
    el('span', e.ok ? 'dim' : 'bad', e.ok ? 'ok' : `error ${e.status ?? ''}`),
  );
  d.append(s, el('h3', '', `Model: ${e.model}`));
  d.append(el('h3', '', 'Sent'), el('pre', '', pretty(e.request)));
  d.append(el('h3', '', e.ok ? 'Received' : 'Error'), el('pre', e.ok ? '' : 'bad', pretty(e.response)));
  return d;
}

function pretty(v: unknown): string {
  if (typeof v === 'string') return v;
  // System prompts read better as text than as one escaped JSON string.
  if (v && typeof v === 'object' && 'system' in v) {
    const { system, ...rest } = v as { system: string };
    return `SYSTEM PROMPT:\n${system}\n\nUSER MESSAGE:\n${JSON.stringify((rest as { user?: unknown }).user ?? rest, null, 2)}`;
  }
  return JSON.stringify(v, null, 2);
}

$('refresh').addEventListener('click', render);
$('filter').addEventListener('change', render);
$('clear').addEventListener('click', () => {
  if (confirm('Clear the call log? The lifetime totals are kept.')) {
    clearLog();
    render();
  }
});
$('download').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ totals: readTotals(), calls: readLog() }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `subpar-ai-log-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
});
// Refresh when the game (another tab) logs a new call.
window.addEventListener('storage', (e) => e.key?.startsWith('subpar-dungeon:ai-') && render());
render();
