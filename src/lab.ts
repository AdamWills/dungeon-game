// The sprite lab (/lab.html): a dev page for the 32 to 48 px art trial (user
// decision: "let's try 32-48px and see what that looks like"). Generates a
// creature with the image model (or loads a PNG), runs it through the same
// pixelize step the game will use, and shows it on the real map tiles next to
// today's hand-drawn sprites. Results are kept in this browser.

import { pixelize, type Pixels, removeKey } from './art/pixelize';
import { Budget, formatUsd } from './ai/budget';
import { KEY_COLOR, MODELS } from './ai/config';
import { describeError, image } from './ai/openai';
import { loadSettings, maskKey } from './ai/settings';
import { spritePrompt } from './data/aiPrompts';
import { type Atlas, loadAtlas, TILE } from './ui/atlas';
import { buildEnemySprites } from './ui/enemySprites';
import { buildPlayerSprites } from './ui/playerSprite';
import { floorVariant } from './ui/tileset';

const SIZES = [32, 40, 48];
const ZOOM = 3; // the map's zoom at 720p-1080p is 2 to 4
const STORE = 'subpar-dungeon:sprite-lab';
const KEEP = 8;

type Saved = { desc: string; png: string; at: number };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const settings = loadSettings();
const budget = new Budget(settings.limitUsd);

function meter(): void {
  $('meter').textContent = `${formatUsd(budget.spent)} / ${formatUsd(budget.limit)}`;
  $('keyinfo').textContent = settings.apiKey ? `(key ${maskKey(settings.apiKey)})` : '(no OpenAI key yet: set it in the game first, press K)';
}

function status(text: string, error = false): void {
  const el = $('status');
  el.textContent = text;
  el.className = error ? 'status err' : 'status';
}

/** Decode an image into raw pixels, shrunk to 512 px at most (plenty for a 48 px sprite). */
async function toPixels(src: string, keyed = false): Promise<{ pixels: Pixels; thumb: string }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 512 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height);
  if (keyed) {
    // The model could not do transparency: take out the flat key colour.
    removeKey({ width: c.width, height: c.height, data: data.data }, KEY_COLOR.rgb);
    g.putImageData(data, 0, 0);
  }
  return { pixels: { width: c.width, height: c.height, data: data.data }, thumb: c.toDataURL('image/png') };
}

function toCanvas(p: Pixels): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.width;
  c.height = p.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}

/** A strip of real floor tiles with today's sprites and the new ones standing on it. */
function mapScene(atlas: Atlas, sprites: HTMLCanvasElement[], old: HTMLCanvasElement[]): HTMLCanvasElement {
  const step = (s: HTMLCanvasElement) => Math.max(TILE * 1.5, s.width + TILE / 2);
  const cols = Math.ceil((TILE * 2 + [...old, ...sprites].reduce((n, s) => n + step(s), 0)) / TILE);
  const c = document.createElement('canvas');
  c.width = cols * TILE * ZOOM;
  c.height = 5 * TILE * ZOOM;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.scale(ZOOM, ZOOM);
  for (let y = 0; y < 5; y++) for (let x = 0; x < cols; x++) atlas.draw(g, floorVariant(x + 11, y + 7), x * TILE, y * TILE);
  // Feet on the third row of tiles, like the game draws them.
  const ground = 3 * TILE;
  let x = TILE;
  for (const s of [...old, ...sprites]) {
    g.drawImage(s, Math.round(x + TILE / 2 - s.width / 2), ground - s.height);
    x += step(s);
  }
  return c;
}

function bigView(sprites: HTMLCanvasElement[]): HTMLCanvasElement {
  const z = 6; // roughly the battle screen's size
  const c = document.createElement('canvas');
  c.width = sprites.reduce((n, s) => n + s.width * z + 24, 24);
  c.height = 48 * z + 24;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1a1220';
  g.fillRect(0, 0, c.width, c.height);
  let x = 24;
  for (const s of sprites) {
    g.drawImage(s, x, c.height - 12 - s.height * z, s.width * z, s.height * z);
    x += s.width * z + 24;
  }
  return c;
}

async function show(atlas: Atlas, saved: Saved, top: boolean): Promise<void> {
  const colors = Math.max(4, Math.min(32, Number(($('colors') as HTMLInputElement).value) || 16));
  const { pixels, thumb } = await toPixels(saved.png);
  const made = SIZES.map((n) => pixelize({ ...pixels, data: new Uint8ClampedArray(pixels.data) }, n, colors)).filter((p): p is Pixels => !!p).map(toCanvas);
  const enemies = buildEnemySprites();
  const player = buildPlayerSprites();
  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h2');
  h.textContent = saved.desc;
  card.append(h);
  const raw = new Image();
  raw.src = thumb;
  raw.className = 'raw';
  const label = (t: string) => Object.assign(document.createElement('div'), { className: 'label', textContent: t });
  card.append(label('What the image model made (shrunk):'), raw);
  card.append(label(`On the map at zoom ${ZOOM}: today's player and Intake Rat (24 px), then the new sprite at ${SIZES.join(', ')} px:`), mapScene(atlas, made, [player('side', 'stand', false), enemies('intake_rat')]));
  card.append(label('Battle-screen size:'), bigView(made));
  const results = $('results');
  if (top) results.prepend(card);
  else results.append(card);
}

function load(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]');
  } catch {
    return [];
  }
}

function remember(s: Saved): void {
  const all = [s, ...load()].slice(0, KEEP);
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    // Too big for storage: it still shows this session.
  }
}

async function main(): Promise<void> {
  $('model').textContent = MODELS.image;
  meter();
  const atlas = await loadAtlas();
  for (const s of load()) await show(atlas, s, false);

  for (const b of document.querySelectorAll<HTMLButtonElement>('.preset'))
    b.addEventListener('click', () => (($('desc') as HTMLTextAreaElement).value = b.textContent ?? ''));

  $('go').addEventListener('click', async () => {
    const desc = ($('desc') as HTMLTextAreaElement).value.trim();
    if (!desc) return;
    const go = $('go') as HTMLButtonElement;
    go.disabled = true;
    status('Generating... (this can take 10 to 60 seconds)');
    const quality = ($('quality') as HTMLSelectElement).value as 'low' | 'medium';
    const res = await image({ apiKey: settings.apiKey, budget }, { prompt: spritePrompt(desc), quality, transparent: true, purpose: 'sprite lab' });
    go.disabled = false;
    meter();
    if (!res.ok) return status(describeError(res.error), true);
    status(`Done. That cost ${formatUsd(res.cost)}.`);
    const saved = { desc, png: (await toPixels(`data:image/png;base64,${res.value.b64}`, res.value.keyed)).thumb, at: Date.now() };
    remember(saved);
    await show(atlas, saved, true);
  });

  $('file').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = await new Promise<string>((ok) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.readAsDataURL(file);
    });
    const saved = { desc: `Loaded: ${file.name}`, png: (await toPixels(url)).thumb, at: Date.now() };
    await show(atlas, saved, true);
    status('Loaded (free). Generated images work best: they have a transparent background.');
  });
}

main();
