// A tiny event bus. Logic pushes events onto state.events; the shell drains
// them here so listeners (Auditor, achievements, UI) never run inside a step.

import type { GameEvent } from './types';

type Handler<T extends GameEvent['type']> = (event: Extract<GameEvent, { type: T }>) => void;

export class EventBus {
  private handlers = new Map<string, Array<(e: GameEvent) => void>>();
  private any: Array<(e: GameEvent) => void> = [];

  on<T extends GameEvent['type']>(type: T, handler: Handler<T>): () => void {
    const list = this.handlers.get(type) ?? [];
    const h = handler as (e: GameEvent) => void;
    list.push(h);
    this.handlers.set(type, list);
    return () => list.splice(list.indexOf(h), 1);
  }

  onAny(handler: (e: GameEvent) => void): void {
    this.any.push(handler);
  }

  emit(event: GameEvent): void {
    for (const h of this.handlers.get(event.type) ?? []) h(event);
    for (const h of this.any) h(event);
  }

  drain(events: GameEvent[]): void {
    for (const e of events.splice(0)) this.emit(e);
  }
}
