// Battle effects, so you can follow a fight without reading the log (user
// request: "more visual action"). Impacts by damage type, a death burst, heal
// sparkles, and the look of each status while it lasts. Presentation only:
// randomness comes from each effect's sequence number, so frames are stable.

import type { StatusKind } from '../data/statuses';

/** A stable pseudo-random number in [0, 1) for effect `seed`, particle `i`. */
function rand(seed: number, i: number): number {
  let h = Math.imul(seed ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2f);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const ease = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * The impact of a hit at (cx, cy), t from 0 to 1. `dtype` picks the look:
 * slashes, a puncture, a starburst, flames, ice, a bolt, acid, poison;
 * untyped hits (enemy attacks) get a red starburst.
 */
export function drawImpact(g: CanvasRenderingContext2D, dtype: string | undefined, cx: number, cy: number, size: number, t: number, seed: number): void {
  if (t >= 1) return;
  const r = size * 0.45;
  g.save();
  g.globalAlpha = 1 - t;
  switch (dtype) {
    case 'slashing': {
      g.strokeStyle = '#e8f6ff';
      g.lineWidth = Math.max(2, size / 24);
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * r * 0.35;
        const p = ease(Math.min(1, t * 2.5));
        g.beginPath();
        g.moveTo(cx - r + off, cy - r);
        g.lineTo(cx - r + off + 2 * r * p, cy - r + 2 * r * p);
        g.stroke();
      }
      break;
    }
    case 'piercing': {
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(1.5, size / 36);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + rand(seed, k) * 0.4;
        const d0 = r * 0.15 + r * ease(t) * 0.5;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
        g.lineTo(cx + Math.cos(a) * (d0 + r * 0.35), cy + Math.sin(a) * (d0 + r * 0.35));
        g.stroke();
      }
      break;
    }
    case 'fire':
      for (let k = 0; k < 14; k++) {
        const x = cx + (rand(seed, k) - 0.5) * r * 1.6;
        const y = cy + r * 0.5 - ease(t) * r * (1 + rand(seed, k + 50));
        const s = size * (0.06 + 0.06 * rand(seed, k + 99)) * (1 - t * 0.6);
        g.fillStyle = k % 3 ? '#ff8a2a' : '#ffe05a';
        g.fillRect(x - s / 2, y - s / 2, s, s * 1.4);
      }
      break;
    case 'cold':
      g.fillStyle = 'rgba(160, 220, 255, 0.35)';
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      g.strokeStyle = '#d8f4ff';
      g.lineWidth = Math.max(2, size / 28);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const d = r * (0.3 + ease(t) * 0.7);
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
        g.stroke();
      }
      break;
    case 'lightning': {
      g.strokeStyle = t < 0.5 && Math.floor(t * 20) % 2 ? '#ffffff' : '#fff070';
      g.lineWidth = Math.max(2, size / 20);
      g.beginPath();
      let x = cx + (rand(seed, 0) - 0.5) * r;
      let y = cy - r * 2.5;
      g.moveTo(x, y);
      for (let k = 1; k <= 6; k++) {
        x = cx + (rand(seed, k) - 0.5) * r * 0.9;
        y = cy - r * 2.5 + (k / 6) * r * 3;
        g.lineTo(x, y);
      }
      g.stroke();
      break;
    }
    case 'acid':
      for (let k = 0; k < 12; k++) {
        const x = cx + (rand(seed, k) - 0.5) * r * 1.8;
        const y = cy - r * 0.6 + ease(t) * r * (0.8 + rand(seed, k + 7));
        const s = size * 0.06;
        g.fillStyle = k % 2 ? '#9ad050' : '#c8f070';
        g.fillRect(x, y, s, s * 1.6);
      }
      break;
    case 'poison':
      for (let k = 0; k < 10; k++) {
        const x = cx + (rand(seed, k) - 0.5) * r * 1.6;
        const y = cy + r * 0.4 - ease(t) * r * 1.4 * (0.6 + rand(seed, k + 3));
        g.strokeStyle = '#c080f0';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, size * (0.03 + 0.03 * rand(seed, k + 11)), 0, Math.PI * 2);
        g.stroke();
      }
      break;
    default: {
      // Bludgeoning and untyped hits: a starburst that pops and fades.
      const s = r * (0.5 + ease(Math.min(1, t * 2)) * 0.6);
      g.fillStyle = dtype === 'bludgeoning' ? '#fff3b0' : '#ff7a5a';
      g.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const d = k % 2 ? s * 0.45 : s;
        g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

/** Gibs flying out from a death, falling under gravity. */
export function drawDeathBurst(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number, seed: number): void {
  if (t >= 1) return;
  g.save();
  g.globalAlpha = 1 - t * t;
  for (let k = 0; k < 18; k++) {
    const a = rand(seed, k) * Math.PI * 2;
    const v = size * (0.4 + rand(seed, k + 40));
    const x = cx + Math.cos(a) * v * t;
    const y = cy + Math.sin(a) * v * t * 0.7 + size * 1.2 * t * t;
    const s = size * (0.04 + 0.05 * rand(seed, k + 80));
    g.fillStyle = k % 4 === 0 ? '#e8c0a0' : k % 3 ? '#a8121a' : '#d82a2a';
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  g.restore();
}

/** Green plus signs drifting up from a heal. */
export function drawHealSparkle(g: CanvasRenderingContext2D, cx: number, cy: number, size: number, t: number, seed: number): void {
  if (t >= 1) return;
  g.save();
  g.globalAlpha = 1 - t;
  g.fillStyle = '#8af07a';
  for (let k = 0; k < 7; k++) {
    const x = cx + (rand(seed, k) - 0.5) * size * 0.8;
    const y = cy + size * 0.2 - t * size * (0.5 + rand(seed, k + 5) * 0.5);
    const s = Math.max(2, size / 22);
    g.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
    g.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
  }
  g.restore();
}

/** What a status looks like while it lasts, around a combatant whose sprite spans top..top+size. */
export function drawStatusLooks(g: CanvasRenderingContext2D, kinds: StatusKind[], cx: number, top: number, size: number, now: number, defending: boolean): void {
  const s = Math.max(2, size / 20);
  for (const kind of kinds) {
    switch (kind) {
      case 'stunned':
        // Stars circling the head.
        for (let k = 0; k < 3; k++) {
          const a = now / 300 + (k * Math.PI * 2) / 3;
          const x = cx + Math.cos(a) * size * 0.28;
          const y = top + size * 0.12 + Math.sin(a) * size * 0.06;
          g.fillStyle = '#ffe05a';
          g.fillRect(x - s, y - s / 2, s * 2, s);
          g.fillRect(x - s / 2, y - s, s, s * 2);
        }
        break;
      case 'burning':
        for (let k = 0; k < 6; k++) {
          const x = cx + (k - 2.5) * size * 0.1;
          const fl = Math.sin(now / 90 + k * 1.7) * 0.5 + 0.5;
          g.fillStyle = k % 2 ? '#ff8a2a' : '#ffd23a';
          g.fillRect(x - s / 2, top + size * (0.7 - 0.15 * fl), s, s * (2 + fl * 2));
        }
        break;
      case 'poison':
        for (let k = 0; k < 3; k++) {
          const p = ((now / 900 + k / 3) % 1);
          g.strokeStyle = `rgba(190, 120, 240, ${1 - p})`;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(cx + (k - 1) * size * 0.18, top + size * (0.6 - p * 0.5), s * 1.2, 0, Math.PI * 2);
          g.stroke();
        }
        break;
      case 'bleed':
        for (let k = 0; k < 2; k++) {
          const p = (now / 700 + k / 2) % 1;
          g.fillStyle = `rgba(200, 20, 30, ${1 - p})`;
          g.fillRect(cx + (k ? 0.15 : -0.1) * size, top + size * (0.4 + p * 0.5), s, s * 1.5);
        }
        break;
      case 'charmed': {
        const y = top - s * 2 + Math.sin(now / 250) * s;
        g.fillStyle = '#ff6ab0';
        g.fillRect(cx - s * 1.5, y, s, s);
        g.fillRect(cx + s * 0.5, y, s, s);
        g.fillRect(cx - s * 2, y + s * 0.6, s * 4, s);
        g.fillRect(cx - s, y + s * 1.6, s * 2, s);
        break;
      }
      case 'hexed':
        g.strokeStyle = `rgba(170, 90, 255, ${0.5 + 0.3 * Math.sin(now / 200)})`;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(cx, top + size * 0.95, size * 0.36, size * 0.08, 0, 0, Math.PI * 2);
        g.stroke();
        break;
      case 'hasted':
        g.fillStyle = 'rgba(140, 220, 255, 0.7)';
        for (let k = 0; k < 3; k++) g.fillRect(cx - size * 0.5 - ((now / 40 + k * 9) % (size * 0.2)), top + size * (0.3 + k * 0.2), size * 0.15, 2);
        break;
    }
  }
  if (defending) {
    // A shield in front of them while they brace.
    const x = cx - size * 0.05;
    const y = top + size * 0.35;
    g.fillStyle = 'rgba(120, 180, 255, 0.55)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + size * 0.22, y + size * 0.06);
    g.lineTo(x + size * 0.18, y + size * 0.32);
    g.lineTo(x + size * 0.02, y + size * 0.42);
    g.closePath();
    g.fill();
  }
}

/** How far a lunging combatant is pushed toward its target, t from 0 to 1. */
export function lungeAmount(t: number): number {
  return t < 0.4 ? Math.sin((t / 0.4) * Math.PI) : 0;
}
