import { describe, expect, it } from 'vitest';

import { ITEMS } from '../src/data/items';
import { FLOOR_THEMES } from '../src/data/floors';
import { SET_PIECES, SHOP } from '../src/data/setPieces';
import { chooseScene, priceOf, sceneView, startScene, stationAt } from '../src/game/setPieces';
import { createGameState } from '../src/game/state';
import type { GameState, Room, SetPiece } from '../src/game/types';
import { generateFloor } from '../src/gen/floor';
import { bfsDistances } from '../src/gen/reach';
import { inRoom } from '../src/gen/features';
import { NO_INPUT } from '../src/game/types';
import { step } from '../src/world/roam';

const KINDS = FLOOR_THEMES.intake_sewers.setPieces.map((p) => p.kind);

function piece(s: GameState, kind: string): SetPiece {
  return s.floor.setPieces!.find((p) => p.kind === kind)!;
}

/** Pick the choice whose text starts with this. */
function pickText(s: GameState, start: string): void {
  const i = sceneView(s)!.choices.findIndex((c) => c.text.startsWith(start));
  expect(i, `no choice "${start}" in ${sceneView(s)!.choices.map((c) => c.text).join(' | ')}`).toBeGreaterThanOrEqual(0);
  chooseScene(s, i);
}

function open(s: GameState, kind: string): SetPiece {
  const p = piece(s, kind);
  startScene(s, p);
  return p;
}

describe('placing set pieces', () => {
  it('every floor gets one of each, in a room of its own, kept clear of everything else', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const floor = generateFloor(seed * 104729, 1);
      const pieces = floor.setPieces!;
      expect(pieces.map((p) => p.kind).sort()).toEqual([...KINDS].sort());
      expect(new Set(pieces.map((p) => p.room)).size).toBe(pieces.length);
      const dist = bfsDistances(floor, floor.start);
      for (const p of pieces) {
        const room = floor.rooms.find((r) => r.id === p.room)!;
        expect(inRoom(room, floor.start)).toBe(false);
        expect(inRoom(room, floor.stairs)).toBe(false);
        expect((floor.bossRooms ?? []).some((b) => b.room === p.room)).toBe(false);
        // No residents, captives or props move in; only the gauntlet has a chest (its prize).
        expect(floor.entities.some((e) => inRoom(room, { x: Math.round(e.pos.x), y: Math.round(e.pos.y) }))).toBe(false);
        expect(floor.props.some((pr) => inRoom(room, pr.pos))).toBe(false);
        const chests = floor.chests.filter((c) => inRoom(room, c.pos));
        expect(chests.length).toBe(p.kind === 'drain_gauntlet' ? 1 : 0);
        // You can walk up to the station (or into the gauntlet).
        const at = p.station ?? room.center;
        const around = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => dist[(at.y + dy) * floor.width + at.x + dx] > 0);
        expect(around, `${p.kind} unreachable on seed ${seed}`).toBe(true);
        expect(SET_PIECES[p.kind].station === null).toBe(p.station === null);
      }
    }
  });

  it('the gauntlet is rings of spikes around a prize chest', () => {
    const floor = generateFloor(7 * 104729, 1);
    const g = floor.setPieces!.find((p) => p.kind === 'drain_gauntlet')!;
    const room = floor.rooms.find((r: Room) => r.id === g.room)!;
    const c = room.center;
    expect(floor.chests.find((ch) => ch.pos.x === c.x && ch.pos.y === c.y)?.prize).toBe('special');
    expect(floor.tiles[c.y][c.x + 1].hazard).toBe('spikes');
  });

  it('the same seed gives the same set pieces', () => {
    const a = generateFloor(42, 1);
    const b = generateFloor(42, 1);
    expect(JSON.stringify(a.setPieces)).toBe(JSON.stringify(b.setPieces));
  });
});

describe('scenes', () => {
  it('bumping a station opens its scene and pauses time; walking away resumes', () => {
    const s = createGameState(11);
    const p = piece(s, 'clog_shrine');
    expect(stationAt(s, p.station!.x, p.station!.y)).toBe(p);
    startScene(s, p);
    expect(s.mode).toBe('menu');
    const tick = s.tick;
    step(s, { ...NO_INPUT, move: 'up' });
    expect(s.tick).toBe(tick);
    pickText(s, 'Back away');
    expect(s.scene).toBeNull();
    expect(s.mode).toBe('roaming');
  });

  it('Gutter Mart: buying costs tokens and hands over the item; too poor is a polite no; haggling moves prices', () => {
    const s = createGameState(11);
    const p = open(s, 'gutter_mart');
    expect(p.stock!.map((x) => ITEMS[x.defId].rarity)).toEqual(SHOP.shelves);
    s.tokens = 1;
    chooseScene(s, 0);
    expect(s.scene!.node).toBe('broke');
    expect(sceneView(s)!.line).toContain(`${priceOf(p, 0) - 1} tokens short`);
    s.tokens = 100;
    pickText(s, 'Something else');
    const price = priceOf(p, 0);
    chooseScene(s, 0);
    expect(s.tokens).toBe(100 - price);
    expect(s.reveals[0].item.defId).toBe(p.stock![0].defId);
    expect(p.stock![0].sold).toBe(true);
    pickText(s, 'Something else');
    expect(sceneView(s)!.choices.some((c) => c.text.startsWith(ITEMS[p.stock![0].defId].name))).toBe(false);
    const before = priceOf(p, 2);
    pickText(s, 'Haggle');
    expect(['haggleWin', 'haggleLose']).toContain(s.scene!.node);
    expect(priceOf(p, 2)).not.toBe(before);
    pickText(s, 'Let me see');
    expect(sceneView(s)!.choices.some((c) => c.text.startsWith('Haggle'))).toBe(false);
  });

  it('Pick-a-Pipe: Chet never peeks at the prize or your pipe; stick and switch get what is behind them', () => {
    for (let seed = 1; seed <= 12; seed++) {
      for (const sw of [false, true]) {
        const s = createGameState(seed);
        const p = open(s, 'pick_a_pipe');
        const pick = seed % 3;
        pickText(s, `Pipe number ${pick + 1}`);
        expect(s.scene!.node).toBe('offer');
        expect(p.revealed).not.toBe(pick);
        expect(p.pipes![p.revealed!]).not.toBe('prize');
        pickText(s, sw ? 'Switch' : 'Stick');
        const final = sw ? [0, 1, 2].find((i) => i !== pick && i !== p.revealed)! : pick;
        expect(s.scene!.node).toBe(`won_${p.pipes![final]}`);
        expect(p.done).toBe(true);
        if (p.pipes![final] === 'prize') expect(s.reveals.length).toBe(1);
        if (p.pipes![final] === 'monster') {
          chooseScene(s, 0);
          expect(s.mode).toBe('battle');
          expect(s.battle!.combatants.filter((c) => c.side === 'enemy').length).toBe(3);
        }
      }
    }
  });

  it('the Shrine: an offering never takes anything; praying for free sometimes does; once only', () => {
    let tithes = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGameState(seed);
      const p = open(s, 'clog_shrine');
      s.tokens = 10;
      pickText(s, 'Leave an offering');
      expect(['blessed', 'healed']).toContain(s.scene!.node);
      expect(s.tokens).toBe(0);
      expect(Object.values(s.boons).every((v) => v! >= 0)).toBe(true);
      expect(p.done).toBe(true);
      const t = createGameState(seed);
      open(t, 'clog_shrine');
      pickText(t, 'Pray');
      if (t.scene!.node === 'tithe') {
        tithes++;
        expect(Object.values(t.boons).some((v) => v! < 0)).toBe(true);
      }
    }
    expect(tithes).toBeGreaterThan(0);
  });

  it('a blessing changes your stats for good and says which', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGameState(seed);
      open(s, 'clog_shrine');
      const before = { ...s.player.stats };
      s.tokens = 10;
      pickText(s, 'Leave an offering');
      if (s.scene!.node !== 'blessed') continue;
      const [stat, n] = Object.entries(s.boons)[0] as [keyof typeof before, number];
      expect(s.player.stats[stat]).toBe(before[stat] + n);
      expect(sceneView(s)!.line).toMatch(/\+\d+ (Max HP|Strength|Speed|Evasion|Armor|Charm), for good/);
      return;
    }
    throw new Error('no blessing in 20 seeds');
  });

  it('the Valve Room: the right valve opens the stash; two wrong ones lock it, and it never kills you', () => {
    const s = createGameState(11);
    const p = open(s, 'valve_room');
    expect(sceneView(s)!.line).toContain(['the colour of what comes out', 'everything down here', 'projector flickers', "host's teeth"][p.answer!]);
    chooseScene(s, p.answer!);
    expect(s.scene!.node).toBe('right');
    expect(s.reveals.length).toBe(1);
    expect(p.done).toBe(true);

    const t = createGameState(11);
    const q = open(t, 'valve_room');
    t.player.stats.hp = 3;
    const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
    chooseScene(t, wrong[0]);
    expect(t.scene!.node).toBe('wrong');
    expect(t.player.stats.hp).toBe(1);
    pickText(t, 'Read the plaque');
    chooseScene(t, wrong[1]);
    expect(t.scene!.node).toBe('flooded');
    expect(q.done).toBe(true);
    expect(t.player.stats.hp).toBe(1);
  });

  it('the Fella: a bit of you for a Rare; a secret marks the lair; then he is gone', () => {
    const s = createGameState(11);
    const p = open(s, 'overflow_fella');
    const maxHp = s.player.stats.maxHp;
    pickText(s, 'What kind of deals');
    pickText(s, 'Tell me a secret');
    expect(s.floor.lair!.found).toBe(true);
    pickText(s, 'About those other deals');
    expect(sceneView(s)!.choices.some((c) => c.text.startsWith('Tell me a secret'))).toBe(false);
    pickText(s, 'A bit of me');
    expect(s.player.stats.maxHp).toBe(maxHp - 5);
    expect(ITEMS[s.reveals[0].item.defId].rarity).toBe('special');
    expect(p.done).toBe(true);
    chooseScene(s, 0);
    startScene(s, p);
    expect(s.scene!.node).toBe('done');
  });

  it('walking into a set piece room announces it once', () => {
    const s = createGameState(11);
    const p = piece(s, 'gutter_mart');
    const room = s.floor.rooms.find((r) => r.id === p.room)!;
    s.player.pos = { x: room.center.x, y: room.center.y + 1 };
    step(s, NO_INPUT);
    step(s, NO_INPUT);
    expect(s.events.filter((e) => e.type === 'setPieceFound').length).toBe(1);
    expect(p.found).toBe(true);
  });
});

describe('creature encounters (user idea: weird creatures you talk your way past)', () => {
  const choicesOf = (s: GameState) => sceneView(s)!.choices.map((c) => c.text);

  it('Mother Mildew: good manners get her blessing and a Rare', () => {
    const s = createGameState(11);
    s.player.stats.hp = 5;
    const p = open(s, 'mother_mildew');
    expect(sceneView(s)!.patience).toBe(4);
    pickText(s, "Thank you, that's very kind");
    pickText(s, 'Eat one polite spoonful');
    pickText(s, "I'd love to, but the show needs me");
    expect(s.scene!.node).toBe('blessing');
    expect(s.player.stats.hp).toBe(s.player.stats.maxHp);
    expect(ITEMS[s.reveals[0].item.defId].rarity).toBe('special');
    expect(p.done).toBe(true);
    expect(p.station).not.toBeNull();
  });

  it('Mother Mildew: rudeness runs out her patience and she fights; she leaves her spot', () => {
    const s = createGameState(11);
    const p = open(s, 'mother_mildew');
    pickText(s, 'Get away from me');
    pickText(s, 'A fungus colony');
    expect(s.scene!.node).toBe('snap');
    expect(p.station).toBeNull();
    chooseScene(s, 0);
    expect(s.mode).toBe('battle');
    expect(s.battle!.combatants.find((c) => c.side === 'enemy')!.defId).toBe('mother_mildew');
  });

  it('only Gutterfolk can slurp her soup; only a Hexer can hex the Duke', () => {
    const human = createGameState(11, 'human', 'brawler');
    open(human, 'mother_mildew');
    pickText(human, 'What are you');
    pickText(human, 'Soup sounds lovely');
    expect(choicesOf(human).some((t) => t.startsWith('Slurp'))).toBe(false);
    open(human, 'sir_reginald');
    expect(choicesOf(human).some((t) => t.startsWith('Put a hex'))).toBe(false);
    const gut = createGameState(11, 'gutterfolk', 'hexer');
    open(gut, 'mother_mildew');
    pickText(gut, 'What are you');
    pickText(gut, 'Soup sounds lovely');
    expect(choicesOf(gut).some((t) => t.startsWith('Slurp'))).toBe(true);
    open(gut, 'sir_reginald');
    expect(choicesOf(gut).some((t) => t.startsWith('Put a hex'))).toBe(true);
  });

  it('Bartholomew Squeak: paying the levy gets a loyalty gift; bartering costs your least valuable item', () => {
    const s = createGameState(11);
    s.tokens = 20;
    const p = open(s, 'bartholomew_squeak');
    pickText(s, 'Pay the levy');
    expect(s.tokens).toBe(5);
    expect(s.reveals.length).toBe(1);
    expect(p.done && p.station === null).toBe(true);

    const t = createGameState(11);
    const rare = Object.values(ITEMS).find((d) => d.rarity === 'special' && !d.invented)!.id;
    const junk = Object.values(ITEMS).find((d) => d.rarity === 'junk' && !d.invented)!.id;
    t.player.inventory = [{ defId: rare, identified: true }, { defId: junk, identified: true }];
    open(t, 'bartholomew_squeak');
    pickText(t, 'Offer him something');
    expect(t.player.inventory.map((i) => i.defId)).toEqual([rare]);
    expect(sceneView(t)!.line).toContain('Accepted');
  });

  it('Bartholomew Squeak: refusing twice sends in the cousins', () => {
    const s = createGameState(11);
    open(s, 'bartholomew_squeak');
    pickText(s, "I'm not paying a rat");
    expect(sceneView(s)!.patience).toBe(1);
    pickText(s, 'Still not paying');
    expect(s.scene!.node).toBe('snap');
    chooseScene(s, 0);
    expect(s.battle!.combatants.filter((c) => c.side === 'enemy').map((c) => c.defId)).toEqual(['intake_rat', 'intake_rat', 'intake_rat', 'intake_rat']);
  });

  it('Sir Reginald: a worthy answer gets you knighted (+1 Strength and the lair on your map); insults get a duel', () => {
    const s = createGameState(11);
    const str = s.player.stats.str;
    open(s, 'sir_reginald');
    pickText(s, 'Kneel');
    pickText(s, 'Not especially');
    pickText(s, 'Running away');
    pickText(s, 'Await his verdict');
    expect(s.scene!.node).toBe('knighted');
    expect(s.player.stats.str).toBe(str + 1);
    expect(s.floor.lair!.found).toBe(true);

    const t = createGameState(11);
    open(t, 'sir_reginald');
    pickText(t, "You're a frog");
    pickText(t, 'A frog in a paper hat');
    expect(t.scene!.node).toBe('duel');
    chooseScene(t, 0);
    expect(t.battle!.combatants.find((c) => c.side === 'enemy')!.defId).toBe('sir_reginald');
  });
});

