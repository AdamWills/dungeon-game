import { hazardActive } from '../src/world/hazards';
import { describe, expect, it } from 'vitest';
import { applyStatus } from '../src/battle/turns';
import { ITEMS } from '../src/data/items';
import { inventoryCommand } from '../src/game/equipment';
import { rollItem } from '../src/game/loot';
import { createRng } from '../src/game/rng';
import { createGameState } from '../src/game/state';
import { type GameState, NO_INPUT } from '../src/game/types';
import { generateFloor } from '../src/gen/floor';
import { inRoom } from '../src/gen/features';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { step } from '../src/world/roam';
import { updateFov } from '../src/world/fov';
import { battleCommand, nearPlayer, spawn, startBattle } from './helpers';

/** A run with the floor emptied of enemies, chests, hazards and closed doors. */
function cleanRun(seed = 11, race = 'human', cls = 'brawler'): GameState {
  const state = createGameState(seed, race, cls);
  state.floor.entities = [];
  state.floor.chests = [];
  state.floor.items = [];
  for (const row of state.floor.tiles)
    for (const t of row) {
      if (t.hazard) {
        t.terrain = 'floor';
        t.hazard = undefined;
      }
      if (t.door) t.door.open = true;
    }
  state.events = [];
  return state;
}

/** Exactly one tile: hold the direction for the step, then let go on arrival. */
function walk(state: GameState, dir: 'left' | 'right') {
  step(state, { ...NO_INPUT, move: dir });
  for (let i = 0; i < 9; i++) step(state, NO_INPUT);
}

const give = (state: GameState, defId: string) => state.player.inventory.push({ defId, identified: true });
const slotOf = (state: GameState, defId: string) => state.player.inventory.findIndex((i) => i.defId === defId);

function fight(state: GameState, enemies: string[]) {
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ids = enemies.map((d, i) => spawn(state, d, nearPlayer(state, spots[i][0], spots[i][1])).id);
  startBattle(state, { enemyIds: ids, start: 'normal', tile: { ...state.player.pos } });
  return state.battle!;
}

describe('races and classes', () => {
  it('builds a Gutterfolk Hexer from class, race and kit', () => {
    const s = createGameState(3, 'gutterfolk', 'hexer');
    expect(s.player.stats.maxHp).toBe(30); // 26 + 4
    expect(s.player.stats.charm).toBe(3); // 3 - 1 + 1 (clipboard)
    expect(s.player.equipment?.weapon?.defId).toBe('cursed_clipboard');
    expect(s.player.inventory.filter((i) => i.defId === 'hex_scroll')).toHaveLength(3);
  });

  it('gives the Brawler pipe and tracksuit', () => {
    const s = createGameState(3, 'human', 'brawler');
    expect(s.player.stats.armor).toBe(3); // 2 + tracksuit
    expect(s.player.equipment?.body?.defId).toBe('velour_tracksuit');
  });
});

describe('inventory', () => {
  it('equips, swaps and takes off gear, updating stats', () => {
    const s = cleanRun();
    give(s, 'chainless_chainsaw');
    inventoryCommand(s, { kind: 'equip', slot: slotOf(s, 'chainless_chainsaw') });
    expect(s.player.equipment?.weapon?.defId).toBe('chainless_chainsaw');
    expect(s.player.stats.speed).toBe(2);
    expect(slotOf(s, 'rusted_pipe')).toBeGreaterThanOrEqual(0); // the old weapon went back to the pockets
    inventoryCommand(s, { kind: 'unequip', slot: 'weapon' });
    expect(s.player.equipment?.weapon).toBeUndefined();
    expect(s.player.stats.speed).toBe(3);
  });

  it('will not take off cursed gear', () => {
    const s = cleanRun();
    give(s, 'paper_crown');
    inventoryCommand(s, { kind: 'equip', slot: slotOf(s, 'paper_crown') });
    expect(s.player.stats.maxHp).toBe(18); // 28 - 10
    inventoryCommand(s, { kind: 'unequip', slot: 'head' });
    expect(s.player.equipment?.head?.defId).toBe('paper_crown');
    expect(s.events.some((e) => e.type === 'itemRefused' && e.reason === 'cursed')).toBe(true);
  });

  it('uses healing items on the map but keeps fight items for fights', () => {
    const s = cleanRun();
    s.player.stats.hp = 5;
    inventoryCommand(s, { kind: 'use', slot: slotOf(s, 'suspicious_bandage') });
    expect(s.player.stats.hp).toBe(15);
    give(s, 'pipe_bomb');
    inventoryCommand(s, { kind: 'use', slot: slotOf(s, 'pipe_bomb') });
    expect(slotOf(s, 'pipe_bomb')).toBeGreaterThanOrEqual(0);
  });

  it('drops items, and picks them up again with E', () => {
    const s = cleanRun();
    const n = s.player.inventory.length;
    inventoryCommand(s, { kind: 'drop', slot: 0 });
    expect(s.player.inventory.length).toBe(n - 1);
    expect(s.floor.items).toHaveLength(1);
    const dir = isWalkable(s.floor, s.player.pos.x + 1, s.player.pos.y) ? 'right' : 'left';
    const back = dir === 'right' ? 'left' : 'right';
    walk(s, dir);
    walk(s, back);
    expect(s.reveals).toHaveLength(0); // walking over it does not pop it up again
    step(s, { ...NO_INPUT, interact: true });
    expect(s.reveals).toHaveLength(1);
    step(s, { ...NO_INPUT, command: { kind: 'dismiss' } });
    expect(s.player.inventory.length).toBe(n);
    expect(s.floor.items).toHaveLength(0);
  });

  it('lets you leave a new item where it was found, and come back for it', () => {
    const s = cleanRun();
    const n = s.player.inventory.length;
    s.floor.chests.push({ id: 'c', pos: nearPlayer(s, 1, 0), opened: false });
    step(s, { ...NO_INPUT, move: 'right' });
    const offered = s.reveals[0].item.defId;
    step(s, { ...NO_INPUT, command: { kind: 'leave' } });
    expect(s.mode).toBe('roaming');
    expect(s.player.inventory.length).toBe(n);
    const left = s.floor.items.find((i) => i.item.defId === offered)!;
    expect(left.left).toBe(true);
    expect(left.pos).toEqual(s.player.pos); // at your feet, not on the chest
    step(s, { ...NO_INPUT, interact: true });
    step(s, { ...NO_INPUT, command: { kind: 'dismiss' } });
    expect(s.player.inventory.map((i) => i.defId)).toContain(offered);
  });

  it('caps what you can carry', () => {
    const s = cleanRun();
    for (let i = 0; i < 20; i++) give(s, 'rubber_chicken');
    s.player.inventory.length = 10; // full pockets (worn gear does not count)
    s.floor.items.push({ id: 'x', pos: { ...s.player.pos }, item: { defId: 'pipe_bomb', identified: true } });
    const p = s.player.pos;
    const dir = isWalkable(s.floor, p.x + 1, p.y) ? 'right' : 'left';
    const back = dir === 'right' ? 'left' : 'right';
    walk(s, dir);
    walk(s, back);
    expect(s.floor.items).toHaveLength(1);
    expect(s.events.some((e) => e.type === 'inventoryFull')).toBe(true);
  });
});

describe('chests, doors and remains', () => {
  it('opens a chest you walk into and hands over an item', () => {
    const s = cleanRun();
    const pos = nearPlayer(s, 1, 0);
    s.floor.chests.push({ id: 'c', pos, opened: false });
    const n = s.player.inventory.length;
    step(s, { ...NO_INPUT, move: 'right' });
    expect(s.floor.chests[0].opened).toBe(true);
    step(s, { ...NO_INPUT, command: { kind: 'dismiss' } }); // take it
    expect(s.player.inventory.length).toBe(n + 1);
  });

  it('pauses on a prize card for each new item until you close it', () => {
    const s = cleanRun();
    s.floor.chests.push({ id: 'c', pos: nearPlayer(s, 1, 0), opened: false });
    step(s, { ...NO_INPUT, move: 'right' });
    expect(s.mode).toBe('menu');
    expect(s.reveals).toHaveLength(1);
    const tick = s.tick;
    for (let i = 0; i < 30; i++) step(s, { ...NO_INPUT, move: 'left' });
    expect(s.tick).toBe(tick); // time stands still behind the card
    step(s, { ...NO_INPUT, command: { kind: 'equip', slot: 0 } }); // ignored while the card is up
    expect(s.reveals).toHaveLength(1);
    step(s, { ...NO_INPUT, command: { kind: 'dismiss' } });
    expect(s.mode).toBe('roaming');
    expect(s.reveals).toHaveLength(0);
  });

  it('blocks movement and sight with a closed door until opened', () => {
    const s = cleanRun();
    const d = nearPlayer(s, 1, 0);
    const t = s.floor.tiles[d.y][d.x];
    t.terrain = 'door';
    t.door = { open: false };
    const beyond = { x: d.x + 1, y: d.y };
    updateFov(s.floor, s.player.pos, 8);
    const idx = beyond.y * s.floor.width + beyond.x;
    if (isWalkable(s.floor, beyond.x, beyond.y)) expect(s.floor.visible[idx]).toBe(0);
    step(s, { ...NO_INPUT, move: 'right' }); // bump: opens, does not move
    expect(t.door.open).toBe(true);
    expect(s.player.motion).toBeUndefined();
    step(s, { ...NO_INPUT, move: 'right' });
    expect(s.player.motion?.to).toEqual(d);
  });

  it('lets Gutterfolk eat remains to heal, and makes Humans regret it', () => {
    for (const [race, delta] of [['gutterfolk', 5], ['human', -2]] as const) {
      const s = cleanRun(11, race);
      s.player.stats.hp = 10;
      const p = s.player.pos;
      s.floor.tiles[p.y][p.x].gore.push({ kind: 'gibs' });
      step(s, { ...NO_INPUT, interact: true });
      expect(s.player.stats.hp).toBe(10 + delta);
      expect(s.floor.tiles[p.y][p.x].gore).toHaveLength(0);
    }
  });
});

describe('hazards', () => {
  function hazardAt(s: GameState, dx: number, dy: number, kind: 'sludge' | 'spikes' | 'gas_vent') {
    const p = nearPlayer(s, dx, dy);
    s.floor.tiles[p.y][p.x].terrain = 'hazard';
    s.floor.tiles[p.y][p.x].hazard = kind;
    return p;
  }

  it('hurts the player standing in sludge, and on stepping onto spikes', () => {
    const s = cleanRun();
    hazardAt(s, 0, 0, 'sludge');
    const hp = s.player.stats.hp;
    for (let i = 0; i < 100; i++) step(s, NO_INPUT);
    expect(s.player.stats.hp).toBeLessThan(hp);

    const t = cleanRun();
    hazardAt(t, 1, 0, 'spikes');
    const hp2 = t.player.stats.hp;
    // Arrive while they are up (they pop up and drop on a timer).
    const sp = nearPlayer(t, 1, 0);
    while (!hazardActive('spikes', sp.x, sp.y, t.tick + 9) || !hazardActive('spikes', sp.x, sp.y, t.tick)) t.tick++;
    for (let i = 0; i < 9; i++) step(t, { ...NO_INPUT, move: 'right' });
    expect(t.player.stats.hp).toBe(hp2 - 3);
  });

  it('can kill a resident, and wounds carry into battle', () => {
    const s = cleanRun();
    const at = hazardAt(s, 2, 0, 'sludge');
    s.player.pos = { ...s.floor.stairs }; // out of the way
    const rat = spawn(s, 'intake_rat', at, { asleep: true });
    for (let i = 0; i < 45 * 3 + 2; i++) step(s, NO_INPUT);
    expect(rat.stats.hp).toBe(8 - 3);

    rat.stats.hp = 1;
    for (let i = 0; i < 50; i++) step(s, NO_INPUT);
    expect(s.floor.entities).not.toContain(rat);
    expect(s.floor.tiles[at.y][at.x].gore.length).toBeGreaterThan(0);

    const t = cleanRun();
    const e = spawn(t, 'grudge_gator', nearPlayer(t, 1, 0), { asleep: true });
    e.stats.hp = 9;
    startBattle(t, { enemyIds: [e.id], start: 'normal', tile: { ...t.player.pos } });
    expect(t.battle!.combatants[1].stats.hp).toBe(9);
  });

  it('kills the player too, with a hazard in the report', () => {
    const s = cleanRun();
    hazardAt(s, 0, 0, 'sludge');
    s.player.stats.hp = 1;
    for (let i = 0; i < 100 && s.mode === 'roaming'; i++) step(s, NO_INPUT);
    expect(s.mode).toBe('dead');
    expect(s.runEnd).toMatchObject({ kind: 'died', enemy: 'Sludge Pool' });
  });
});

describe('statuses, Hex and items in battle', () => {
  it('doubles damage against a hexed enemy', () => {
    const s = cleanRun(5, 'human', 'hexer');
    const b = fight(s, ['grudge_gator']);
    const gator = b.combatants[1];
    battleCommand(s, { kind: 'ability', abilityId: 'hex', targetId: gator.id });
    expect(gator.statuses.some((x) => x.kind === 'hexed')).toBe(true);
    // Scroll: 6 piercing damage, doubled.
    for (let i = 0; i < 10 && s.battle && !s.battle.result; i++) {
      if (s.battle.order[s.battle.turn] !== 'player') break;
      battleCommand(s, { kind: 'item', slot: slotOf(s, 'hex_scroll'), targetId: gator.id });
      break;
    }
    expect(gator.stats.hp).toBe(22 - 12);
  });

  it('ticks poison, and Gutterfolk shrug it off', () => {
    const s = cleanRun(5, 'human');
    const b = fight(s, ['pipe_leech']);
    const me = b.combatants[0];
    applyStatus(s, b, me, 'poison', 3);
    const hp = me.stats.hp;
    battleCommand(s, { kind: 'defend' }); // a round passes; your next turn ticks poison
    expect(me.stats.hp).toBeLessThan(hp);

    const g = cleanRun(5, 'gutterfolk');
    const gb = fight(g, ['pipe_leech']);
    expect(applyStatus(g, gb, gb.combatants[0], 'poison', 3)).toBe(false);
  });

  it('stuns every enemy with a Glitter Bomb and burns all with a Pipe Bomb', () => {
    const s = cleanRun(6);
    give(s, 'glitter_bomb');
    give(s, 'pipe_bomb');
    const b = fight(s, ['pipe_leech', 'pipe_leech']);
    battleCommand(s, { kind: 'item', slot: slotOf(s, 'glitter_bomb') });
    // Both leeches lost their turn, so it is your turn again with your HP untouched.
    expect(b.log.filter((l) => l.text.includes('stunned and just stands there'))).toHaveLength(2);
    const before = b.combatants.slice(1).map((c) => c.stats.hp);
    battleCommand(s, { kind: 'item', slot: slotOf(s, 'pipe_bomb') });
    b.combatants.slice(1).forEach((c, i) => expect(c.stats.hp).toBe(before[i] - Math.round((8 - 2) * 1.5))); // fire: a leech's weak spot
  });

  it('turns an Expired Energy Drink into two turns a round, then a stun', () => {
    const s = cleanRun(7);
    give(s, 'expired_energy_drink');
    const b = fight(s, ['pipe_leech']);
    battleCommand(s, { kind: 'item', slot: slotOf(s, 'expired_energy_drink') });
    battleCommand(s, { kind: 'defend' });
    expect(b.order.filter((id) => id === 'player')).toHaveLength(2);
    for (let i = 0; i < 12 && !b.result; i++) battleCommand(s, { kind: 'defend' });
    expect(b.log.some((l) => l.text === 'You are now stunned!')).toBe(true);
  });

  it('refuses items with no use in a fight without spending the turn', () => {
    const s = cleanRun(8);
    give(s, 'sequin_jacket');
    const b = fight(s, ['pipe_leech']);
    const turn = [b.round, b.turn];
    battleCommand(s, { kind: 'item', slot: slotOf(s, 'sequin_jacket') });
    expect([b.round, b.turn]).toEqual(turn);
  });
});

describe('generation and loot', () => {
  it('places chests, hazards and closed doors, keeping the start room clear', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const f = generateFloor(seed * 131, 1);
      const start = f.rooms.find((r) => inRoom(r, f.start))!;
      expect(f.chests.length).toBeGreaterThanOrEqual(1);
      for (const c of f.chests) {
        expect(inRoom(start, c.pos)).toBe(false);
        expect(f.tiles[c.pos.y][c.pos.x].terrain).toBe('floor');
      }
      let hazards = 0;
      f.tiles.forEach((row, y) =>
        row.forEach((t, x) => {
          if (t.terrain === 'door') expect(t.door).toEqual({ open: false });
          if (t.hazard) {
            hazards++;
            expect(inRoom(start, { x, y })).toBe(false);
          }
        }),
      );
      expect(hazards).toBeGreaterThan(0);
      // Chests and props block movement, but never the way to the stairs or any room.
      const blocked = new Set([...f.chests, ...f.props].map((c) => `${c.pos.x},${c.pos.y}`));
      const dist = bfsDistances(f, f.start, (x, y) => blocked.has(`${x},${y}`));
      expect(dist[f.stairs.y * f.width + f.stairs.x]).toBeGreaterThan(0);
      for (const r of f.rooms) expect(dist[r.center.y * f.width + r.center.x], `seed ${seed} room ${r.id}`).toBeGreaterThanOrEqual(0);
      expect(f.props.length).toBeGreaterThan(0);
    }
  });

  it('never rolls class kit pieces as loot', () => {
    const rng = createRng(1);
    for (let i = 0; i < 2000; i++) expect(ITEMS[rollItem(rng).defId].noLoot).toBeFalsy();
  });
});

describe('spikes on a timer', () => {
  it('only hurt while up, and catch you if they pop up under you', async () => {
    const { hazardActive, hazardPhase, updateHazards } = await import('../src/world/hazards');
    const s = cleanRun();
    const p = s.player.pos;
    s.floor.tiles[p.y][p.x].terrain = 'hazard';
    s.floor.tiles[p.y][p.x].hazard = 'spikes';
    // Find a tick where they are down, stand there, and wait for them to rise.
    while (hazardActive('spikes', p.x, p.y, s.tick)) s.tick++;
    const hp = s.player.stats.hp;
    updateHazards(s);
    expect(s.player.stats.hp).toBe(hp); // down: stepping on is safe
    while (!hazardActive('spikes', p.x, p.y, s.tick)) {
      s.tick++;
      updateHazards(s);
    }
    expect(s.player.stats.hp).toBe(hp - 3); // they popped up under you
    for (let i = 0; i < 30; i++) {
      s.tick++;
      updateHazards(s);
    }
    expect(s.player.stats.hp).toBe(hp - 3); // once per pop, not every tick
    expect(hazardPhase('spikes', p.x, p.y, s.tick)).toBeGreaterThanOrEqual(0);
  });
});

describe('the paper doll', () => {
  it('fills both ring slots before swapping, and every wearable has a slot that exists', async () => {
    const { SLOTS, slotsFor } = await import('../src/game/equipment');
    const { ITEMS } = await import('../src/data/items');
    for (const def of Object.values(ITEMS)) if (def.slot) for (const sl of slotsFor(def.slot)) expect(SLOTS).toContain(sl);
    const s = cleanRun();
    give(s, 'mood_ring');
    give(s, 'ring_pull');
    inventoryCommand(s, { kind: 'equip', slot: slotOf(s, 'mood_ring') });
    inventoryCommand(s, { kind: 'equip', slot: slotOf(s, 'ring_pull') });
    expect(s.player.equipment?.ring1?.defId).toBe('mood_ring');
    expect(s.player.equipment?.ring2?.defId).toBe('ring_pull');
  });

  it('does not let you take something off into full pockets', () => {
    const s = cleanRun();
    while (s.player.inventory.length < 10) give(s, 'rubber_chicken');
    inventoryCommand(s, { kind: 'unequip', slot: 'body' });
    expect(s.player.equipment?.body?.defId).toBe('velour_tracksuit');
    expect(s.events.some((e) => e.type === 'inventoryFull')).toBe(true);
  });
});
