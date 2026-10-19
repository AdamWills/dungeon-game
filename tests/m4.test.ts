import { describe, expect, it } from 'vitest';

import { ALLIES, bribePrice, LOYALTY } from '../src/data/allies';
import { HOST_LINES } from '../src/data/hostLines';
import { PERKS } from '../src/data/perks';
import { TUNING } from '../src/data/tuning';
import { EventBus } from '../src/game/events';
import { inventoryCommand } from '../src/game/equipment';
import { makeAlly, recruit, settleLoyalty } from '../src/game/party';
import { gainXp } from '../src/game/progress';
import { talkView } from '../src/game/talk';
import { createGameState } from '../src/game/state';
import { type Entity, type GameState, NO_INPUT } from '../src/game/types';
import { generateFloor } from '../src/gen/floor';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { Host } from '../src/host/host';
import { step } from '../src/world/roam';
import { battleCommand, nearPlayer, spawn, startBattle } from './helpers';

/** A run with nothing on the floor but you, so tests can stage things. */
function cleanRun(seed = 11, cls = 'brawler'): GameState {
  const s = createGameState(seed, 'human', cls);
  s.floor.entities = [];
  s.floor.chests = [];
  s.floor.props = [];
  s.floor.items = [];
  for (const row of s.floor.tiles) for (const t of row) if (t.hazard) [t.terrain, t.hazard] = ['floor', undefined];
  s.events = [];
  return s;
}

function withAlly(s: GameState, defId: string): Entity {
  const a = makeAlly(defId, s.player.pos, s.level, false);
  recruit(s, a);
  s.mode = 'roaming';
  s.levelUp = null;
  return a;
}

function fight(s: GameState, enemies: string[], spots = [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  const ids = enemies.map((d, i) => spawn(s, d, nearPlayer(s, spots[i][0], spots[i][1])).id);
  startBattle(s, { enemyIds: ids, start: 'normal', tile: { ...s.player.pos } });
  return s.battle!;
}

const ATTACK = (s: GameState) => ({ kind: 'attack' as const, targetId: s.battle!.combatants.find((c) => c.side === 'enemy' && c.alive)?.id ?? '' });

/** Stand next to a captive, facing it. */
function faceCaptive(s: GameState, defId: string): Entity {
  const c = s.floor.entities.find((e) => e.defId === defId)!;
  for (const [dx, dy, facing] of [[-1, 0, 0], [1, 0, Math.PI], [0, -1, Math.PI / 2], [0, 1, -Math.PI / 2]]) {
    const x = c.pos.x + dx;
    const y = c.pos.y + dy;
    if (isWalkable(s.floor, x, y) && !s.floor.entities.some((e) => e !== c && e.pos.x === x && e.pos.y === y)) {
      s.player.pos = { x, y };
      s.player.facing = facing;
      return c;
    }
  }
  throw new Error('no room next to the captive');
}

/** Pick the reply that starts with this text (fails if it is not offered). */
function say(s: GameState, text: string): void {
  const i = talkView(s)!.choices.findIndex((c) => c.text.startsWith(text));
  if (i < 0) throw new Error(`no reply "${text}" in: ${talkView(s)!.choices.map((c) => c.text).join(' | ')}`);
  inventoryCommand(s, { kind: 'say', choice: i });
}

describe('placing allies', () => {
  it('puts both captives and Skitch on every floor without cutting anything off', () => {
    for (let seed = 1; seed < 40; seed++) {
      const floor = generateFloor(seed * 7919, 1);
      const captives = floor.entities.filter((e) => e.kind === 'ally');
      expect(captives.map((c) => c.defId).sort()).toEqual(['marjorie', 'moss']);
      expect(floor.entities.filter((e) => e.defId === 'skitch')).toHaveLength(1);
      // Captives block their tile; everything else must still be reachable.
      const blocked = new Set([...captives.map((c) => c.pos), ...floor.chests.map((c) => c.pos), ...floor.props.map((p) => p.pos)].map((p) => `${p.x},${p.y}`));
      const dist = bfsDistances(floor, floor.start, (x, y) => blocked.has(`${x},${y}`));
      for (let y = 0; y < floor.height; y++)
        for (let x = 0; x < floor.width; x++) if (isWalkable(floor, x, y) && !blocked.has(`${x},${y}`)) expect(dist[y * floor.width + x]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('recruiting', () => {
  it('talks to a captive first, and frees her from the conversation, for XP', () => {
    const s = createGameState(11);
    s.floor.entities = s.floor.entities.filter((e) => e.kind === 'ally');
    faceCaptive(s, 'marjorie');
    step(s, { ...NO_INPUT, interact: true });
    expect(s.mode).toBe('menu');
    expect(s.talk?.allyId).toBe('marjorie');
    expect(s.party).toHaveLength(0);
    say(s, 'Why are you locked up?');
    say(s, 'Something else.');
    say(s, 'Never mind.');
    expect(s.talk).toBeNull();
    expect(s.mode).toBe('roaming');
    expect(s.party).toHaveLength(0);
    // Walk back up and let her out, with a promise.
    step(s, { ...NO_INPUT, interact: true });
    say(s, 'Want out?');
    say(s, 'Promise her');
    expect(s.party.map((a) => a.defId)).toEqual(['marjorie']);
    expect(s.party[0].ally!.loyalty).toBe(LOYALTY.start + 15);
    expect(s.party[0].ally!.known).toEqual(['You promised her a share of the prize.']);
    expect(s.xp).toBe(TUNING.progression.recruitXp);
    expect(s.floor.entities.some((e) => e.defId === 'marjorie')).toBe(false);
    expect(s.events.some((e) => e.type === 'allyRecruited')).toBe(true);
  });

  it('wants the bribe paid, and Charm brings the price down', () => {
    const s = createGameState(11);
    s.floor.entities = s.floor.entities.filter((e) => e.kind === 'ally');
    faceCaptive(s, 'moss');
    s.tokens = 3;
    step(s, { ...NO_INPUT, interact: true });
    say(s, 'What do you charge?');
    expect(talkView(s)!.choices.some((c) => c.text.startsWith('Pay'))).toBe(false); // can't afford it
    say(s, "I'll come back.");
    expect(s.party).toHaveLength(0);
    const price = bribePrice(15, s.player.stats.charm);
    expect(price).toBe(14); // Charm 1 knocks one token off
    expect(bribePrice(15, 20)).toBe(8); // but never below half
    s.tokens = 20;
    step(s, { ...NO_INPUT, interact: true });
    say(s, 'Are you a real doctor?');
    say(s, 'Something else.');
    say(s, 'What do you charge?');
    say(s, 'Pay');
    expect(s.party.map((a) => a.defId)).toEqual(['moss']);
    expect(s.tokens).toBe(20 - price);
    expect(s.party[0].ally!.known).toHaveLength(1);
  });

  it('haggling moves the price once: down on a win, up on a loss', () => {
    const results = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const s = createGameState(seed);
      s.floor.entities = s.floor.entities.filter((e) => e.kind === 'ally');
      faceCaptive(s, 'moss');
      s.tokens = 50;
      step(s, { ...NO_INPUT, interact: true });
      say(s, 'What do you charge?');
      const before = s.talk!.price;
      say(s, 'Haggle');
      const after = s.talk!.price;
      results.add(s.talk!.node);
      expect(after).toBe(s.talk!.node === 'haggleWin' ? before - 4 : before + 3);
      expect(talkView(s)!.choices.some((c) => c.text.startsWith('Haggle'))).toBe(false);
      say(s, 'Pay');
      expect(s.tokens).toBe(50 - after);
    }
    expect(results).toEqual(new Set(['haggleWin', 'haggleLose']));
  });

  it('spares Skitch once he is beaten down, and he asks to join after the fight', () => {
    const s = cleanRun();
    s.player.stats.charm = 10; // make the roll a sure thing
    const b = fight(s, ['skitch', 'intake_rat']);
    const skitch = b.combatants.find((c) => c.defId === 'skitch')!;
    battleCommand(s, { kind: 'spare', targetId: skitch.id });
    expect(skitch.side).toBe('enemy'); // still at full HP: refused, turn not spent
    skitch.stats.hp = 2;
    battleCommand(s, { kind: 'spare', targetId: skitch.id });
    expect(skitch.side).toBe('player');
    for (let i = 0; i < 100 && !b.result; i++) battleCommand(s, ATTACK(s));
    expect(b.result).toBe('won');
    battleCommand(s, { kind: 'continue' });
    s.levelUp = null;
    expect(s.talk?.allyId).toBe('skitch');
    say(s, "What's with the nail gun?");
    say(s, 'Something else.');
    say(s, 'Welcome aboard.');
    expect(s.party.map((a) => a.defId)).toEqual(['skitch']);
    expect(s.party[0].stats.hp).toBe(2); // keeps the beating he took
    expect(s.party[0].ally!.known).toHaveLength(1);
  });

  it('can send a spared Skitch away for good', () => {
    const s = cleanRun();
    s.player.stats.charm = 10;
    const b = fight(s, ['skitch', 'intake_rat']);
    const skitch = b.combatants.find((c) => c.defId === 'skitch')!;
    skitch.stats.hp = 2;
    battleCommand(s, { kind: 'spare', targetId: skitch.id });
    for (let i = 0; i < 100 && !b.result; i++) battleCommand(s, ATTACK(s));
    battleCommand(s, { kind: 'continue' });
    s.levelUp = null;
    say(s, 'Get lost, rat.');
    expect(s.party).toHaveLength(0);
    expect(s.floor.entities.some((e) => e.defId === 'skitch')).toBe(false);
    expect(s.events.some((e) => e.type === 'allyDismissed')).toBe(true);
  });

  it('chatting from the pause screen: a kind word helps, but only every couple of fights', () => {
    const s = cleanRun();
    const a = withAlly(s, 'marjorie');
    s.mode = 'menu';
    const start = a.ally!.loyalty;
    inventoryCommand(s, { kind: 'talk', allyId: a.id });
    expect(s.talk?.kind).toBe('chat');
    say(s, 'Any advice?');
    say(s, "Glad you're with me.");
    expect(s.talk).toBeNull();
    expect(s.mode).toBe('menu'); // back to the pause screen
    expect(a.ally!.loyalty).toBe(start + 4);
    inventoryCommand(s, { kind: 'talk', allyId: a.id });
    say(s, "Glad you're with me.");
    expect(a.ally!.loyalty).toBe(start + 4);
    s.record.fights += 2;
    inventoryCommand(s, { kind: 'talk', allyId: a.id });
    say(s, "Glad you're with me.");
    expect(a.ally!.loyalty).toBe(start + 8);
  });

  it('allies hold off a beaten deserter so you can spare him', () => {
    const s = cleanRun();
    withAlly(s, 'marjorie');
    const b = fight(s, ['skitch']);
    const skitch = b.combatants.find((c) => c.defId === 'skitch')!;
    skitch.stats.hp = 1;
    skitch.stats.evasion = -50;
    battleCommand(s, { kind: 'defend' });
    expect(skitch.alive).toBe(true);
    expect(b.log.some((l) => l.text.includes('holds back'))).toBe(true);
  });
});

describe('the party on the map', () => {
  it('follows you in a line', () => {
    const s = cleanRun();
    const a = withAlly(s, 'marjorie');
    const dir = (['right', 'left', 'down', 'up'] as const).find((d) => {
      const [dx, dy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[d];
      return isWalkable(s.floor, s.player.pos.x + dx, s.player.pos.y + dy) && isWalkable(s.floor, s.player.pos.x + 2 * dx, s.player.pos.y + 2 * dy);
    })!;
    const start = { ...s.player.pos };
    for (let i = 0; i < 40; i++) step(s, { ...NO_INPUT, move: i < 18 ? dir : null });
    expect(a.pos).not.toEqual(s.player.pos);
    expect(Math.abs(a.pos.x - s.player.pos.x) + Math.abs(a.pos.y - s.player.pos.y)).toBe(1);
    expect(a.pos).not.toEqual(start);
  });

  it('starts a fight when an enemy touches an ally instead of you', () => {
    const s = cleanRun();
    const a = withAlly(s, 'marjorie');
    a.pos = nearPlayer(s, 1, 0);
    s.trail = [a.pos];
    const e = spawn(s, 'intake_rat', { x: a.pos.x, y: a.pos.y }, { alert: 'idle' });
    e.pos = { x: a.pos.x + 0.3, y: a.pos.y };
    step(s, NO_INPUT);
    expect(s.mode).toBe('battle');
  });
});

describe('allies in battle', () => {
  it('act on their own and can be the target of attacks', () => {
    const s = cleanRun();
    withAlly(s, 'marjorie');
    const b = fight(s, ['grudge_gator']);
    b.combatants.find((c) => c.defId === 'grudge_gator')!.stats.hp = 500;
    for (let i = 0; i < 30 && !b.result; i++) battleCommand(s, { kind: 'defend' });
    expect(b.log.some((l) => l.text.startsWith('Marjorie'))).toBe(true);
    expect(b.combatants.find((c) => c.ally)!.stats.hp).toBeLessThan(b.combatants.find((c) => c.ally)!.stats.maxHp);
  });

  it('die for good and drop their item', () => {
    const s = cleanRun();
    withAlly(s, 'moss');
    const b = fight(s, ['intake_rat']);
    const doc = b.combatants.find((c) => c.ally)!;
    doc.stats.hp = 1;
    doc.stats.evasion = -100;
    b.allyCooldowns[doc.id] = 999; // no healing himself out of this one
    b.combatants.find((c) => c.side === 'enemy')!.stats.hp = 999;
    for (let i = 0; i < 60 && doc.alive && !b.result; i++) battleCommand(s, { kind: 'defend' });
    expect(doc.alive).toBe(false);
    b.combatants.filter((c) => c.side === 'enemy').forEach((c) => (c.alive = false));
    b.result = 'won';
    battleCommand(s, { kind: 'continue' });
    expect(s.party).toHaveLength(0);
    expect(s.record.alliesLost).toBe(1);
    expect(s.floor.items.some((i) => i.item.defId === ALLIES.moss.item)).toBe(true);
    expect(s.events.some((e) => e.type === 'allyDied')).toBe(true);
  });

  it('take a parting hit and lose loyalty when you flee', () => {
    const s = cleanRun();
    const a = withAlly(s, 'marjorie');
    const before = a.ally!.loyalty;
    const b = fight(s, ['intake_rat']);
    b.combatants[0].stats.speed = 50; // the flee always works
    battleCommand(s, { kind: 'flee' });
    expect(b.result).toBe('fled');
    expect(b.log.some((l) => l.text.includes('parting shot'))).toBe(true);
    expect(a.ally!.loyalty).toBe(before + LOYALTY.fled);
  });

  it('heals the party after a win with Second Opinion', () => {
    const s = cleanRun();
    withAlly(s, 'moss');
    s.player.stats.hp = 10;
    const b = fight(s, ['intake_rat']);
    b.combatants[0].stats.hp = 10;
    for (let i = 0; i < 100 && !b.result; i++) battleCommand(s, ATTACK(s));
    expect(b.result).toBe('won');
    const hp = b.combatants[0].stats.hp;
    battleCommand(s, { kind: 'continue' });
    expect(s.player.stats.hp).toBe(Math.min(s.player.stats.maxHp, hp + 3));
  });
});

describe('loyalty', () => {
  it('rises when you give an ally a consumable', () => {
    const s = cleanRun();
    const a = withAlly(s, 'marjorie');
    a.stats.hp = 5;
    s.player.inventory = [{ defId: 'suspicious_bandage', identified: true }];
    s.mode = 'menu';
    inventoryCommand(s, { kind: 'give', slot: 0, allyId: a.id });
    expect(a.ally!.loyalty).toBe(LOYALTY.start + LOYALTY.give);
    expect(a.stats.hp).toBeGreaterThan(5);
    expect(s.player.inventory).toHaveLength(0);
  });

  it('at zero, each ally leaves in their own way', () => {
    const s = cleanRun();
    const m = withAlly(s, 'marjorie');
    const d = withAlly(s, 'moss');
    const k = withAlly(s, 'skitch');
    s.player.inventory = [{ defId: 'pipe_bomb', identified: true }];
    for (const a of [m, d, k]) a.ally!.loyalty = 0;
    settleLoyalty(s);
    expect(s.party).toHaveLength(0);
    const left = s.events.filter((e) => e.type === 'allyLeft');
    expect(left.map((e) => e.type === 'allyLeft' && e.how)).toEqual(['turn', 'quit', 'steal']);
    expect(s.player.inventory).toHaveLength(0); // Skitch took it
    const turncoat = s.floor.entities.find((e) => e.defId === 'marjorie_grievance')!;
    expect(turncoat.kind).toBe('enemy');
    expect(turncoat.patrol!.alert).toBe('chasing');
  });
});

describe('levels and perks', () => {
  it('levels up at the GDD thresholds and opens the level-up screen', () => {
    const s = cleanRun();
    gainXp(s, 29);
    expect(s.level).toBe(1);
    gainXp(s, 1);
    expect(s.level).toBe(2);
    expect(s.mode).toBe('menu');
    expect(s.levelUp).toEqual({ points: 3, perkChoices: null });
    gainXp(s, 1000);
    expect(s.level).toBe(TUNING.progression.maxLevel);
  });

  it('spends points, with every second point in a favored stat free', () => {
    const s = cleanRun();
    const hp = s.player.stats.maxHp;
    const speed = s.player.stats.speed;
    gainXp(s, 30);
    inventoryCommand(s, { kind: 'train', stat: 'maxHp' });
    inventoryCommand(s, { kind: 'train', stat: 'maxHp' }); // favored for Brawlers: this one brings a free one
    inventoryCommand(s, { kind: 'train', stat: 'speed' });
    expect(s.player.stats.maxHp).toBe(hp + 3 * TUNING.pointValue.maxHp);
    expect(s.player.stats.speed).toBe(speed + 1);
    expect(s.levelUp).toBeNull();
    expect(s.mode).toBe('roaming');
  });

  it('offers 3 perks at level 3 from your class pool and the general pool', () => {
    const s = cleanRun(11, 'hexer');
    gainXp(s, 80);
    expect(s.level).toBe(3);
    const choices = s.levelUp!.perkChoices!;
    expect(choices).toHaveLength(3);
    for (const id of choices) expect([null, 'hexer']).toContain(PERKS[id].cls);
    for (let i = 0; i < 6; i++) inventoryCommand(s, { kind: 'train', stat: 'charm' });
    inventoryCommand(s, { kind: 'dismiss' }); // nothing else works until the perk is picked
    expect(s.levelUp).not.toBeNull();
    inventoryCommand(s, { kind: 'perk', id: choices[0] });
    expect(s.perks).toEqual([choices[0]]);
    expect(s.levelUp).toBeNull();
  });

  it('Thick Skull halves the first hit of each fight', () => {
    const s = cleanRun();
    s.perks = ['thick_skull'];
    const b = fight(s, ['grudge_gator']);
    const me = b.combatants[0];
    me.stats.evasion = -100;
    const before = me.stats.hp;
    battleCommand(s, { kind: 'defend' });
    expect(b.skullUsed).toBe(true);
    expect(me.stats.hp).toBeGreaterThan(before - 6);
  });

  it('Bad Habits allows two Bad Ideas per fight', () => {
    const s = cleanRun();
    s.perks = ['bad_habits'];
    const b = fight(s, ['grudge_gator']);
    b.combatants[1].stats.hp = 999;
    b.combatants[1].stats.maxHp = 999;
    battleCommand(s, { kind: 'improvise', channel: 'badIdea' });
    battleCommand(s, { kind: 'improvise', channel: 'badIdea' });
    expect(b.badIdeas).toBe(2);
  });

  it('winning a fight pays XP and Prize Tokens', () => {
    const s = cleanRun();
    const b = fight(s, ['intake_rat']);
    for (let i = 0; i < 100 && !b.result; i++) battleCommand(s, ATTACK(s));
    battleCommand(s, { kind: 'continue' });
    expect(s.xp).toBe(4);
    expect(s.tokens).toBeGreaterThanOrEqual(1);
  });
});

describe('the elimination report', () => {
  it('names the killer, the run so far, your last words and a parting gift', () => {
    const s = cleanRun();
    const b = fight(s, ['grudge_gator']);
    b.combatants[0].stats.hp = 1;
    b.playerHasActed = true;
    b.combatants[0].stats.evasion = -100;
    battleCommand(s, { kind: 'defend' });
    battleCommand(s, { kind: 'continue' });
    expect(s.mode).toBe('dead');
    const end = s.runEnd!;
    if (end.kind !== 'died') throw new Error('expected a death');
    expect(end.report.enemy).toBe('Grudge Gator');
    expect(end.report.fights).toBe(1);
    expect(end.report.lastWords).toMatch(/Brace|wait/);
    expect(end.report.partingGift.length).toBeGreaterThan(0);
    expect(end.report.hostLine).not.toMatch(/\{/);
  });
});

describe('Chet on the map', () => {
  it('has at least 5 lines for every routine event', () => {
    for (const [event, lines] of Object.entries(HOST_LINES)) expect(lines.length, event).toBeGreaterThanOrEqual(5);
  });

  it('never says the same line twice in a row, and fills in the details', () => {
    const bus = new EventBus();
    const s = createGameState(11);
    let t = 0;
    const host = new Host(bus, () => s, () => (t += 10_000));
    let last = '';
    for (let i = 0; i < 30; i++) {
      bus.emit({ type: 'itemPicked', defId: 'rubber_chicken', from: 'chest' });
      const line = host.current!.text;
      expect(line).not.toBe(last);
      expect(line).not.toMatch(/\{/);
      expect(line).toContain('Rubber Chicken');
      last = line;
    }
  });
});
