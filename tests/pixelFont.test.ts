import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { CLASSES } from '../src/data/classes';
import { ITEMS } from '../src/data/items';
import { NOTICES } from '../src/data/notices';
import { RACES } from '../src/data/races';
import { UI_TEXT } from '../src/data/uiText';
import { GLYPHS, textWidth, wrapPixel } from '../src/ui/pixelFont';

describe('pixel font', () => {
  it('every glyph is 5 by 7', () => {
    for (const [ch, g] of Object.entries(GLYPHS)) expect(g.length, ch).toBe(35);
  });

  it('can draw every character the game-show screens use', () => {
    const texts: string[] = [
      ...Object.values(ITEMS).flatMap((i) => [i.name, i.help, `"${i.description}"`]),
      ...Object.values(RACES).flatMap((r) => [r.name, r.help, `"${r.blurb}"`]),
      ...Object.values(CLASSES).flatMap((c) => [c.name, c.help, `"${c.blurb}"`]),
      ...Object.values(ABILITIES).flatMap((a) => [a.name, a.help]),
      JSON.stringify(UI_TEXT.prize),
      JSON.stringify(UI_TEXT.result),
      JSON.stringify(UI_TEXT.picker),
      JSON.stringify(NOTICES.died),
      JSON.stringify(NOTICES.escaped),
    ];
    const missing = new Set<string>();
    for (const t of texts) for (const ch of t.toUpperCase()) if (!GLYPHS[ch] && !'{}\\'.includes(ch)) missing.add(ch);
    expect([...missing]).toEqual([]);
  });

  it('wraps to the width it is given', () => {
    const lines = wrapPixel('Everyone gets one. Not everyone gets one in the neck.', 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l)).toBeLessThanOrEqual(120);
  });
});
