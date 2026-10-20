// Browser-side image helpers for generated art: decode a PNG into raw pixels
// (taking out a flat key colour if the model could not do transparency), and
// turn raw pixels back into a canvas.

import { KEY_COLOR } from '../ai/config';
import { type Pixels, removeKey } from './pixelize';

/** Decode an image, shrunk to `max` px at most (plenty for a sprite or icon). */
export async function decodePixels(src: string, keyed = false, max = 512): Promise<{ pixels: Pixels; canvas: HTMLCanvasElement }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  const data = g.getImageData(0, 0, c.width, c.height);
  if (keyed) {
    removeKey({ width: c.width, height: c.height, data: data.data }, KEY_COLOR.rgb);
    g.putImageData(data, 0, 0);
  }
  return { pixels: { width: c.width, height: c.height, data: data.data }, canvas: c };
}

export function toCanvas(p: Pixels): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.width;
  c.height = p.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}
