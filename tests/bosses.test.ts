import { describe, expect, it } from 'vitest';

import { ELITE, ELITES } from '../src/data/bosses';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS } from '../src/data/items';
import { createGameState } from '../src/game/state';
import { type GameState, NO_INPUT } from '../src/game/types';
import { generateFloor } from '../src/gen/floor';
import { makeElite } from '../src/gen/populate';
import { isWalkable } from '../src/gen/reach';
import { lairBoss, lairRoom } from '../src/world/lair';
import { step } from '../src/world/roam';
import { battleCommand, nearPlayer, settle, spawn, startBattle } from './helpers';

const inRoom = (r: { x1: number; y1: number; x2: number; y2: number }, p: { x: number; y: number }) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;

/** Stand on a walkable tile just outside the lair, next to its door. */
function outsideLair(s: GameState) {
  const room = lairRoom(s)!;
  for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      if (inRoom(room, { x, y }) || !isWalkable(s.floor, x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (inRoom(room, { x: x + dx, y: y + dy }) && isWalkable(s.floor, x + dx, y + dy)) return { at: { x, y }, into: { x: x + dx, y: y + dy } };
    }
  throw new Error('no way into the lair');
}

describe('placing bosses and elites', () => {
  it('puts the floor boss beside the stairs, room bosses alone in their rooms, and a few elites', () => {
    for (let seed = 1; seed < 25; seed++) {
      const floor = generateFloor(seed * 7919, 1);
      const lair = floor.rooms.find((r) => r.id === floor.lair!.room)!;
      expect(inRoom(lair, floor.stairs)).toBe(true);
      const boss = floor.entities.find((e) => e.id === floor.lair!.bossId)!;
      expect(boss.defId).toBe('fatberg');
      expect(Math.abs(boss.pos.x - floor.stairs.x) + Math.abs(boss.pos.y - floor.stairs.y)).toBeLessThanOrEqual(4);
      // Nobody else lives in the lair.
      expect(floor.entities.filter((e) => e !== boss && inRoom(lair, e.pos))).toHaveLength(0);

      const roomBosses = floor.entities.filter((e) => e.kind === 'enemy' && ENEMIES[e.defId].tier === 'room');
      expect(roomBosses.length).toBeGreaterThanOrEqual(2);
      expect(roomBosses.length).toBeLessThanOrEqual(3);
      expect(new Set(roomBosses.map((e) => e.defId)).size).toBe(roomBosses.length);
      for (const b of roomBosses) {
        const room = floor.rooms.find((r) => inRoom(r, b.pos))!;
        expect(floor.entities.filter((e) => e !== b && e.kind === 'enemy' && inRoom(room, e.pos))).toHaveLength(0);
      }

      const elites = floor.entities.filter((e) => e.elite);
      expect(elites.length).toBeGreaterThanOrEqual(4);
      expect(elites.length).toBeLessThanOrEqual(6);
      for (const e of elites) {
        expect(ELITES[e.elite!]).toBeDefined();
        expect(e.stats.maxHp).toBeGreaterThan(ENEMIES[e.defId].stats.hp);
      }
    }
  });
});

describe('the lair', () => {
  it('roars when you get close, and the lair shows on the map', () => {
    const s = createGameState(11);
    const room = lairRoom(s)!;
    expect(s.floor.lair!.found).toBe(false);
    expect(s.floor.tiles[room.center.y][room.center.x].explored).toBe(false);
    s.player.pos = { ...outsideLair(s).at };
    for (let i = 0; i < 40 && !s.floor.lair!.found; i++) step(s, NO_INPUT);
    expect(s.floor.lair!.found).toBe(true);
    expect(s.events.some((e) => e.type === 'bossRoared')).toBe(true);
    expect(s.floor.tiles[room.center.y][room.center.x].explored).toBe(true);
  });

  it('walking in starts the boss fight; fleeing puts you outside and it heals up', () => {
    const s = createGameState(11);
    s.floor.entities = s.floor.entities.filter((e) => e.id === s.floor.lair!.bossId);
    const { at, into } = outsideLair(s);
    s.player.pos = { ...into };
    step(s, NO_INPUT);
    expect(s.mode).toBe('battle');
    expect(s.battle!.encounter.enemyIds).toEqual([s.floor.lair!.bossId]);
    expect(s.battle!.log.some((l) => l.text.includes('FLOOR BOSS'))).toBe(true);
    settle(s);
    const boss = s.battle!.combatants.find((c) => c.defId === 'fatberg')!;
    boss.stats.hp = 10;
    s.player.stats.speed = 30; // a sure escape
    for (let i = 0; i < 20 && s.battle && !s.battle.result; i++) battleCommand(s, { kind: 'flee' });
    expect(s.battle!.result).toBe('fled');
    battleCommand(s, { kind: 'continue' });
    expect(s.mode).toBe('roaming');
    expect(inRoom(lairRoom(s)!, s.player.pos)).toBe(false);
    expect(Math.abs(s.player.pos.x - at.x) + Math.abs(s.player.pos.y - at.y)).toBeLessThanOrEqual(12);
    expect(lairBoss(s)!.stats.hp).toBe(lairBoss(s)!.stats.maxHp);
    // It stays home.
    const home = { ...lairBoss(s)!.pos };
    for (let i = 0; i < 60; i++) step(s, NO_INPUT);
    expect(lairBoss(s)!.pos).toEqual(home);
  });

  it('beating the floor boss opens the stairs and drops its prize', () => {
    const s = createGameState(11);
    s.floor.entities = s.floor.entities.filter((e) => e.id === s.floor.lair!.bossId);
    const boss = lairBoss(s)!;
    startBattle(s, { enemyIds: [boss.id], start: 'normal', tile: { ...s.player.pos } });
    s.battle!.combatants.find((c) => c.id === boss.id)!.stats.hp = 1;
    s.player.stats.str = 50;
    for (let i = 0; i < 30 && !s.battle!.result; i++) {
      const foe = s.battle!.combatants.find((c) => c.side === 'enemy' && c.alive)!;
      battleCommand(s, { kind: 'attack', targetId: foe.id });
    }
    expect(s.battle!.result).toBe('won');
    battleCommand(s, { kind: 'continue' });
    expect(s.floor.lair!.beaten).toBe(true);
    expect(s.events.some((e) => e.type === 'bossDefeated' && e.tier === 'floor')).toBe(true);
    const prize = s.floor.items.find((i) => i.id === `loot-${boss.id}`)!;
    expect(ITEMS[prize.item.defId].rarity).toBe('hosts_pick');
    s.levelUp = null;
    s.reveals = [];
    s.mode = 'roaming';
    s.player.pos = { ...s.floor.stairs };
    s.player.motion = undefined;
    step(s, { ...NO_INPUT, interact: true });
    expect(s.mode).toBe('won');
  });
});

describe('boss moves', () => {
  function bossFight(defId: string) {
    const s = createGameState(11);
    s.floor.entities = [];
    s.floor.lair = undefined;
    const e = spawn(s, defId, nearPlayer(s, 1, 0));
    startBattle(s, { enemyIds: [e.id], start: 'normal', tile: { ...s.player.pos } });
    return { s, boss: s.battle!.combatants.find((c) => c.id === e.id)! };
  }

  it('the Fatberg sheds Grease Blobs, but never more than two at once', () => {
    const { s, boss } = bossFight('fatberg');
    s.player.stats.hp = s.player.stats.maxHp = 999;
    let most = 0;
    for (let i = 0; i < 40 && !s.battle!.result; i++) {
      boss.intent = { moveId: 'shed', targetId: 'player' };
      battleCommand(s, { kind: 'defend' });
      most = Math.max(most, s.battle!.combatants.filter((c) => c.defId === 'grease_blob' && c.alive).length);
    }
    expect(most).toBe(2);
    expect(s.battle!.log.some((l) => l.text.includes('Grease Blobs slop off'))).toBe(true);
  });

  it('a wind-up is announced a turn ahead and hits hard', () => {
    const { s, boss } = bossFight('sump_crab');
    s.player.stats.hp = s.player.stats.maxHp = 999;
    s.player.stats.evasion = -50;
    for (let i = 0; i < 60 && boss.intent!.moveId !== 'claw_clap'; i++) battleCommand(s, { kind: 'defend' });
    expect(boss.intent!.moveId).toBe('claw_clap');
    expect(s.battle!.log.slice(-3).some((l) => l.text.includes('winding up Claw Clap'))).toBe(true);
    const before = s.battle!.log.length;
    battleCommand(s, { kind: 'defend' });
    expect(s.battle!.log.slice(before).some((l) => l.text.includes('claps both claws'))).toBe(true);
  });

  it('hit-everyone moves hit each of you', () => {
    const { s, boss } = bossFight('old_flushy');
    s.player.stats.hp = s.player.stats.maxHp = 999;
    s.player.stats.evasion = -50;
    boss.intent = { moveId: 'thrash', targetId: 'player' };
    const before = s.battle!.log.length;
    battleCommand(s, { kind: 'defend' });
    expect(s.battle!.log.slice(before).some((l) => l.text.includes('thrashes around the room'))).toBe(true);
  });
});

describe('elites', () => {
  it('are named, tougher, worth more, and always drop something', () => {
    const s = createGameState(11);
    s.floor.entities = [];
    s.floor.lair = undefined;
    s.floor.items = [];
    const e = spawn(s, 'intake_rat', nearPlayer(s, 1, 0));
    makeElite(e, 'rabid');
    expect(e.stats.str).toBe(ENEMIES.intake_rat.stats.str + 2);
    expect(e.stats.maxHp).toBe(Math.round(ENEMIES.intake_rat.stats.hp * ELITE.hpMult));
    startBattle(s, { enemyIds: [e.id], start: 'normal', tile: { ...s.player.pos } });
    const foe = s.battle!.combatants.find((c) => c.id === e.id)!;
    expect(foe.name).toBe('Rabid Intake Rat');
    foe.stats.hp = 1;
    s.player.stats.str = 50;
    const xp = s.xp;
    for (let i = 0; i < 30 && !s.battle!.result; i++) battleCommand(s, { kind: 'attack', targetId: foe.id });
    battleCommand(s, { kind: 'continue' });
    expect(s.xp - xp).toBe(Math.round(ENEMIES.intake_rat.xp * ELITE.xpMult));
    expect(s.floor.items.some((i) => i.id === `loot-${e.id}`)).toBe(true);
    expect(s.events.some((ev) => ev.type === 'bossDefeated' && ev.tier === 'elite')).toBe(true);
  });
});
