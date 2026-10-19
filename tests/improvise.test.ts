import { describe, expect, it } from 'vitest';
import { gatherArena, resolveImprov, validateOutcome } from '../src/battle/improvise';
import { battleCommand, startBattle } from '../src/battle/turns';
import { BAD_IDEAS, IMPROV_LIMITS, JANK_COMBOS, PROP_COMBOS, type PropVerb, VERBS } from '../src/data/improv';
import { ITEMS } from '../src/data/items';
import { PROPS } from '../src/data/props';
import { createGameState } from '../src/game/state';
import { type GameState, type ImprovOutcome, NO_INPUT } from '../src/game/types';
import { step } from '../src/world/roam';
import { nearPlayer, spawn } from './helpers';

function cleanRun(seed = 11, race = 'human'): GameState {
  const s = createGameState(seed, race, 'brawler');
  s.floor.entities = [];
  s.floor.chests = [];
  s.floor.props = [];
  s.floor.items = [];
  for (const row of s.floor.tiles) for (const t of row) if (t.hazard) [t.terrain, t.hazard] = ['floor', undefined];
  s.events = [];
  return s;
}

function addProp(s: GameState, defId: string, dx: number, dy: number) {
  const pos = nearPlayer(s, dx, dy);
  const p = { id: `p-${defId}-${dx}-${dy}`, defId, pos, usesLeft: PROPS[defId].uses };
  s.floor.props.push(p);
  return p;
}

function fight(s: GameState, enemies: string[], spots = [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  const ids = enemies.map((d, i) => spawn(s, d, nearPlayer(s, spots[i][0], spots[i][1])).id);
  startBattle(s, { enemyIds: ids, start: 'normal', tile: { ...s.player.pos } });
  return s.battle!;
}

const give = (s: GameState, defId: string) => s.player.inventory.push({ defId, identified: true });

describe('the arena', () => {
  it('gathers nearby props, remains and one sludge puddle, up to four', () => {
    const s = cleanRun();
    addProp(s, 'barrel', 1, 1);
    addProp(s, 'vending_machine', -1, -1);
    const far = nearPlayer(s, 0, 0);
    s.floor.props.push({ id: 'far', defId: 'barrel', pos: { x: far.x + 10, y: far.y }, usesLeft: 2 });
    const g = nearPlayer(s, 1, 0);
    s.floor.tiles[g.y][g.x].gore.push({ kind: 'gibs' });
    for (const [dx, dy] of [[0, 1], [-1, 0]]) {
      const p = nearPlayer(s, dx, dy);
      s.floor.tiles[p.y][p.x].terrain = 'hazard';
      s.floor.tiles[p.y][p.x].hazard = 'sludge';
    }
    const arena = gatherArena(s, s.player.pos);
    expect(arena.map((p) => p.defId).sort()).toEqual(['barrel', 'corpse', 'sludge_puddle', 'vending_machine']);
  });
});

describe('the validator', () => {
  const base: ImprovOutcome = { grade: 'meh', effects: [], narration: 'x', source: 'llm', discoveryKey: 'k' };

  it('drops unknown effects, targets and statuses', () => {
    const o = validateOutcome({
      ...base,
      effects: [
        { kind: 'createItem', target: 'self' } as never,
        { kind: 'winBattle', target: 'all' } as never,
        { kind: 'damage', amount: 3, target: 'everyone' } as never,
        { kind: 'status', status: 'petrified', turns: 2, target: 'one' } as never,
        { kind: 'damage', amount: 3, target: 'one' },
      ],
    });
    expect(o.effects).toEqual([{ kind: 'damage', amount: 3, target: 'one' }]);
  });

  it('clamps magnitudes so nothing ends a fight outright', () => {
    const o = validateOutcome({
      ...base,
      grade: 'godlike' as never,
      effects: [
        { kind: 'damage', amount: 9999, target: 'all' },
        { kind: 'heal', amount: 500, target: 'self' },
        { kind: 'status', status: 'stunned', turns: 99, target: 'all', then: { status: 'stunned', turns: 99 } },
      ],
    });
    expect(o.grade).toBe('meh');
    expect(o.effects[0]).toMatchObject({ amount: IMPROV_LIMITS.maxDamage });
    expect(o.effects[1]).toMatchObject({ amount: IMPROV_LIMITS.maxHeal });
    expect(o.effects[2]).toMatchObject({ turns: IMPROV_LIMITS.maxTurns, then: undefined });
  });

  it('passes every hand-written outcome through unchanged (the data is within limits)', () => {
    const templates = [...Object.values(PROP_COMBOS), ...Object.values(JANK_COMBOS), ...BAD_IDEAS];
    for (const t of templates) {
      const o: ImprovOutcome = { ...base, grade: t.grade, effects: t.effects };
      expect(validateOutcome(o).effects).toEqual(t.effects.map((e) => ({ ...e, ...(e.kind === 'status' ? { then: undefined } : {}) })));
    }
  });

  it('only uses real items in the item combos', () => {
    for (const key of Object.keys(JANK_COMBOS)) for (const id of key.split('+')) expect(ITEMS[id], id).toBeDefined();
    expect(Object.keys(JANK_COMBOS)).toHaveLength(10);
    expect(BAD_IDEAS).toHaveLength(12);
  });
});

describe('props', () => {
  it('gives every prop and verb an outcome', () => {
    const s = cleanRun();
    const b = fight(s, ['pipe_leech']);
    for (const defId of Object.keys(PROPS))
      for (const verb of Object.keys(VERBS) as PropVerb[]) {
        b.props = [{ id: 'x', defId, usesLeft: 1, source: { kind: 'map', propId: 'x' } }];
        const res = resolveImprov(s, b, { kind: 'improvise', channel: 'prop', propId: 'x', verb });
        expect(res, `${verb} ${defId}`).not.toBeNull();
        expect(res!.narration.length).toBeGreaterThan(10);
      }
  });

  it('tips a vending machine onto an enemy and leaves it wrecked on the map', () => {
    const s = cleanRun(4);
    const vm = addProp(s, 'vending_machine', 1, 1);
    const b = fight(s, ['grudge_gator']);
    const gator = b.combatants[1];
    battleCommand(s, { kind: 'improvise', channel: 'prop', propId: vm.id, verb: 'shove' });
    expect(gator.stats.hp).toBe(22 - (10 - 3));
    expect(gator.statuses.some((x) => x.kind === 'stunned')).toBe(true);
    expect(s.events.some((e) => e.type === 'improvised' && e.grade === 'legendary')).toBe(true);
    b.result = 'won';
    battleCommand(s, { kind: 'continue' });
    expect(s.floor.props).not.toContain(vm);
  });

  it('never lets a disaster kill you', () => {
    const s = cleanRun(5);
    const vm = addProp(s, 'vending_machine', 1, 1);
    const b = fight(s, ['pipe_leech']);
    b.combatants[0].stats.hp = 2;
    b.combatants[1].statuses.push({ kind: 'stunned', turnsLeft: 3 }); // only the disaster can hurt you here
    battleCommand(s, { kind: 'improvise', channel: 'prop', propId: vm.id, verb: 'eat' }); // biting a vending machine is a disaster
    expect(b.combatants[0].stats.hp).toBeGreaterThanOrEqual(1);
    expect(b.combatants[0].alive).toBe(true);
  });

  it('burns everyone when you light a sludge puddle, which then burns away', () => {
    const s = cleanRun(6);
    const p = nearPlayer(s, 1, 1);
    s.floor.tiles[p.y][p.x].terrain = 'hazard';
    s.floor.tiles[p.y][p.x].hazard = 'sludge';
    const b = fight(s, ['pipe_leech', 'pipe_leech']);
    const puddle = b.props.find((x) => x.defId === 'sludge_puddle')!;
    battleCommand(s, { kind: 'improvise', channel: 'prop', propId: puddle.id, verb: 'ignite' });
    for (const c of b.combatants.slice(1)) expect(c.statuses.some((x) => x.kind === 'burning')).toBe(true);
    b.result = 'won';
    battleCommand(s, { kind: 'continue' });
    expect(s.floor.tiles[p.y][p.x].hazard).toBeUndefined();
  });

  it('gets weaker each time you repeat the same trick', () => {
    const s = cleanRun(7);
    const chair = addProp(s, 'folding_chair', 1, 1);
    const b = fight(s, ['grudge_gator']);
    const gator = b.combatants[1];
    gator.stats.maxHp = gator.stats.hp = 100;
    battleCommand(s, { kind: 'improvise', channel: 'prop', propId: chair.id, verb: 'throw' });
    const first = 100 - gator.stats.hp;
    gator.stats.hp = 100;
    gator.statuses = [];
    battleCommand(s, { kind: 'improvise', channel: 'prop', propId: chair.id, verb: 'throw' });
    const second = 100 - gator.stats.hp;
    expect(second).toBeLessThan(first);
  });
});

describe('item jank', () => {
  it('turns a Pipe Bomb and a Rubber Chicken into Squeaky Shrapnel, or blows up in your hands', () => {
    let legendary = 0;
    let backfires = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = cleanRun(seed);
      s.player.inventory = [];
      give(s, 'pipe_bomb');
      give(s, 'rubber_chicken');
      const b = fight(s, ['grudge_gator']);
      const hpBefore = b.combatants[0].stats.hp;
      battleCommand(s, { kind: 'improvise', channel: 'jank', slots: [0, 1] });
      expect(s.player.inventory).toHaveLength(0); // both used up
      const ev = s.events.find((e) => e.type === 'improvised');
      expect(ev).toMatchObject({ key: 'jank:pipe_bomb+rubber_chicken' });
      if (ev?.type === 'improvised' && ev.grade === 'legendary') legendary++;
      else {
        backfires++;
        expect(b.combatants[0].stats.hp).toBeLessThan(hpBefore + 1);
      }
    }
    expect(legendary + backfires).toBe(200);
    expect(backfires / 200).toBeGreaterThan(0.05);
    expect(backfires / 200).toBeLessThan(0.3);
  });

  it('falls back to tag rules for pairs with no combo', () => {
    const s = cleanRun(9);
    s.player.inventory = [];
    give(s, 'craft_services_sandwich');
    give(s, 'expired_energy_drink'); // edible + edible
    const b = fight(s, ['pipe_leech']);
    const res = resolveImprov(s, b, { kind: 'improvise', channel: 'jank', slots: [0, 1] });
    expect(res!.discoveryKey).toBe('jank:craft_services_sandwich+expired_energy_drink');
    expect(['brilliant', 'disaster']).toContain(res!.grade);
  });

  it('refuses to combine an item with itself', () => {
    const s = cleanRun();
    const b = fight(s, ['pipe_leech']);
    expect(resolveImprov(s, b, { kind: 'improvise', channel: 'jank', slots: [0, 0] })).toBeNull();
  });
});

describe('through the game loop', () => {
  it('delivers improvise commands from input to the battle', () => {
    const s = cleanRun(3);
    const b = fight(s, ['pipe_leech']);
    step(s, { ...NO_INPUT, command: { kind: 'improvise', channel: 'badIdea' } });
    expect(b.badIdeas).toBe(1);
  });
});

describe('the Bad Idea button', () => {
  it('works once per fight and refuses a second press without spending the turn', () => {
    const s = cleanRun(3);
    const b = fight(s, ['pipe_leech']);
    battleCommand(s, { kind: 'improvise', channel: 'badIdea' });
    expect(b.badIdeas).toBe(1);
    if (b.result || b.order[b.turn] !== 'player') return;
    const turn = [b.round, b.turn];
    battleCommand(s, { kind: 'improvise', channel: 'badIdea' });
    expect([b.round, b.turn]).toEqual(turn);
  });

  it('draws better ideas for charming contestants', () => {
    const good = (charm: number) => {
      const s = cleanRun(1);
      const b = fight(s, ['pipe_leech']);
      b.combatants[0].stats.charm = charm;
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        b.badIdeas = 0;
        const r = resolveImprov(s, b, { kind: 'improvise', channel: 'badIdea' })!;
        if (r.grade === 'brilliant' || r.grade === 'legendary') n++;
      }
      return n;
    };
    expect(good(10)).toBeGreaterThan(good(0));
  });
});
