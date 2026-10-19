// Chet Valentine on the map: listens to the event bus and picks a scripted
// line for routine events (GDD "Hybrid narrator spec"). Never repeats the
// same line twice in a row for an event. The game never waits on him; the
// renderer shows his current line in the neon strip.

import { ALLIES } from '../data/allies';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { HAZARDS } from '../data/hazards';
import { HOST_CHANCE, HOST_LINE_MS, HOST_LINES, type HostEvent } from '../data/hostLines';
import { ITEMS } from '../data/items';
import { PERKS } from '../data/perks';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { fill } from '../data/battleText';
import type { EventBus } from '../game/events';
import type { GameState } from '../game/types';

export type HostLine = { text: string; at: number; until: number };

/** How long to keep quiet after a line before a low-priority one may replace it. */
const MIN_GAP_MS = 2500;

export class Host {
  current: HostLine | null = null;
  history: string[] = [];
  private last: Partial<Record<HostEvent, number>> = {};
  private count = 0;

  constructor(
    bus: EventBus,
    private getState: () => GameState | null,
    private now: () => number,
  ) {
    const ally = (id: string) => ALLIES[id]?.short ?? id;
    const item = (id: string | null) => (id ? (ITEMS[id]?.name ?? id) : 'nothing');
    bus.on('floorEntered', () => {
      const s = this.getState();
      if (s) this.say('runStart', { class: CLASSES[s.cls].name, race: RACES[s.race].name }, true);
    });
    bus.on('enemyAlerted', (e) => this.say('enemyAlerted', { enemy: ENEMIES[e.defId]?.name ?? e.defId }));
    bus.on('itemPicked', (e) => this.say('itemPicked', { item: item(e.defId) }));
    bus.on('tokensGained', (e) => this.say('tokensGained', { amount: e.amount }));
    bus.on('hazardHurt', (e) => e.id === 'player' && this.say('hazardHurt', { hazard: HAZARDS[e.kind].name }));
    bus.on('lowHp', (e) => this.say('lowHp', { hp: e.hp }, true));
    bus.on('battleEnded', (e) => e.result !== 'lost' && this.say(e.result === 'won' ? 'fightWon' : 'fightFled', {}));
    bus.on('captiveSpotted', (e) => this.say('captiveSpotted', { profile: ALLIES[e.allyId].profile }, true));
    bus.on('allyRecruited', (e) => this.say('allyRecruited', { ally: ally(e.allyId) }, true));
    bus.on('allyDied', (e) => this.say('allyDied', { ally: ally(e.allyId), item: item(e.item) }, true));
    bus.on('allyLeft', (e) => {
      const kind = e.how === 'quit' ? 'allyQuit' : e.how === 'steal' ? 'allyStole' : 'allyTurned';
      this.say(kind, { ally: ally(e.allyId), item: item(e.item) }, true);
    });
    bus.on('loyaltyLow', (e) => this.say('loyaltyLow', { ally: ally(e.allyId) }, true));
    bus.on('levelUp', (e) => this.say('levelUp', { level: e.level }, true));
    bus.on('perkTaken', (e) => this.show(PERKS[e.id].line, true));
    bus.on('bribeShort', (e) => this.say('bribeShort', { ally: ally(e.allyId), price: e.price, tokens: e.tokens }, true));
    bus.on('corpseEaten', (e) => this.say(e.hp > 0 ? 'ateGood' : 'ateBad', {}));
    bus.on('doorOpened', () => this.say('doorOpened', {}));
    const enemy = (id: string) => ENEMIES[id]?.name ?? id;
    bus.on('bossRoared', (e) => this.say('bossRoared', { boss: enemy(e.defId) }, true));
    bus.on('stairsSealed', (e) => this.say('stairsSealed', { boss: enemy(e.defId) }, true));
    bus.on('bossDefeated', (e) => this.say(e.tier === 'floor' ? 'floorBossDown' : e.tier === 'room' ? 'roomBossDown' : 'eliteDown', { name: e.name }, true));
    bus.on('skillUp', (e) => this.say('skillUp', { skill: SKILLS[e.id].name, level: e.level }, true));
  }

  /** Pick a line for an event, never the same as last time. */
  say(event: HostEvent, vars: Record<string, string | number>, important = false): void {
    const chance = HOST_CHANCE[event];
    this.count++;
    if (chance !== undefined && hash(this.count, 7) % 1000 >= chance * 1000) return;
    const lines = HOST_LINES[event];
    let i = hash(this.count, event.length) % lines.length;
    if (i === this.last[event] && lines.length > 1) i = (i + 1) % lines.length;
    this.last[event] = i;
    this.show(fill(lines[i], vars), important);
  }

  private show(text: string, important: boolean): void {
    const t = this.now();
    // Routine chatter waits its turn; big news talks over it.
    if (!important && this.current && t - this.current.at < MIN_GAP_MS) return;
    this.current = { text, at: t, until: t + HOST_LINE_MS };
    this.history.push(text);
    if (this.history.length > 20) this.history.shift();
  }

  /** The line to show now, if any. */
  line(now: number): HostLine | null {
    return this.current && this.current.until > now ? this.current : null;
  }

  reset(): void {
    this.current = null;
    this.history = [];
  }
}

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  return h >>> 0;
}
