import { describe, expect, it } from 'vitest';
import { FLOOR_THEMES } from '../src/data/floors';
import { generateFloor } from '../src/gen/floor';
import { bfsDistances, enclosable } from '../src/gen/reach';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);

describe('floor generator', () => {
  it('always produces stairs reachable from the start', () => {
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 1);
      expect(floor.tiles[floor.stairs.y][floor.stairs.x].terrain).toBe('stairs');
      const dist = bfsDistances(floor, floor.start);
      expect(dist[floor.stairs.y * floor.width + floor.stairs.x], `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('has the theme\'s number of rooms, every one reachable', () => {
    const { min, max } = FLOOR_THEMES.intake_sewers.rooms;
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 1);
      expect(floor.rooms.length).toBeGreaterThanOrEqual(min);
      expect(floor.rooms.length).toBeLessThanOrEqual(max);
      const dist = bfsDistances(floor, floor.start);
      for (const room of floor.rooms) {
        expect(dist[room.center.y * floor.width + room.center.x], `seed ${seed} room ${room.id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('places the stairs in the farthest room that can be sealed for its boss', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const floor = generateFloor(seed, 1);
      const dist = bfsDistances(floor, floor.start);
      const at = (p: { x: number; y: number }) => dist[p.y * floor.width + p.x];
      const sealable = floor.rooms.filter((r) => enclosable(floor, r));
      const farthest = Math.max(...(sealable.length ? sealable : floor.rooms).map((r) => at(r.center)));
      expect(at(floor.stairs)).toBe(farthest);
    }
  });

  it('gives the same floor for the same seed', () => {
    for (const seed of [1, 42, 1337, 987654321]) {
      expect(JSON.stringify(generateFloor(seed, 1))).toBe(JSON.stringify(generateFloor(seed, 1)));
    }
  });

  it('gives different floors for different seeds', () => {
    const a = JSON.stringify(generateFloor(1, 1).tiles);
    const b = JSON.stringify(generateFloor(2, 1).tiles);
    expect(a).not.toBe(b);
  });
});
