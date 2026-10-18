# Progress

## Done

### M1: Walk and see
- Scaffold: Vite, TypeScript (strict), rot.js, Vitest. `npm run dev`, `npm run build` (typecheck + bundle), `npm test`. Folder layout from CLAUDE.md; empty modules hold a `.gitkeep`.
- Deterministic core (`src/game`): seeded sfc32 RNG whose state is plain JSON in `GameState`; `GameState`, `Entity`, `Floor`, `Tile`, `Mode` shapes per the GDD; a `FixedStepLoop` at 60 updates per second that is handed the time and never reads a clock or the DOM; a small `EventBus`.
- Floor generator (`src/gen/floor.ts`): rot.js rooms and corridors, 8 to 12 rooms, start in a random room, stairs in the room farthest from the start by walking distance.
- Roaming (`src/world`): tile-smooth movement with arrow keys or WASD, wall collision, field of view (radius 8) with fog of war, interact (E, Space or Enter) on the stairs, pause (Esc or P).
- Renderer (`src/ui`): canvas with a camera that follows the player, placeholder tiles drawn in code, a HUD with floor name, seed and rotating policy notices.
- Tests (`tests/`, 17): stairs reachable for 200 fixed seeds, 8 to 12 rooms all reachable, stairs in the farthest room, same seed gives the same floor, roaming is deterministic for a seed plus input sequence, collision, smooth stepping, FOV, stairs, pause.
- Bigger, livelier player (asked for after M1): the canvas fills the window and the world draws at the largest whole-number zoom that still shows about 18 by 12 tiles (3x at 1080p, 2x at 720p), with the HUD at native resolution. The player is a larger outlined sprite that faces where it walks (front, back, profile), steps and bobs while walking, squashes slightly on stopping, and breathes, blinks and glances around when idle. 4 more tests.
- Checked in a real browser (headless Chromium, real key presses): walked a floor, paused, reached the stairs and descended, no console errors.

## Next

M2: Fight (see the GDD build plan). In progress.

## Decisions from the user

- Work is committed directly to `main` and pushed; no branches or pull requests.
- **Stairs:** in the one-floor prototype, taking the stairs (once the mini-boss is beaten) ends the run as a win.
- **M2 battle menu:** Attack, Ability (the class signature, Rampage for the Brawler), Item (one healing consumable), Defend and Flee. Improvise and the full item list come in M3.
- **Doors:** closed doors block both movement and sight.

## Decisions (no GDD change needed)

- `GDD.md` moved to `docs/GDD.md`, where CLAUDE.md and the build prompt expect it.
- **Movement** is grid-stepped and interpolated: each step glides one tile over 9 ticks (about 6.7 tiles per second), holding a key chains steps with no pause, and the most recently pressed direction wins. 4-way only. Position is fractional only mid-step, so collision is exact against the grid.
- **Generator** uses rot.js `Uniform` (separate rooms joined by corridors) rather than `Digger`, because it gives clean rooms for set pieces later. Settings live in `src/data/floors.ts`. If a layout misses the 8 to 12 room range, the generator retries with the next derived seed. rot.js has its own global RNG, so it is seeded from our RNG for the call and restored afterwards; its wall-clock time limit is set high enough to never fire, so output depends only on the seed.
- **Doors** are open archways (passable, see-through) for now. Closed doors and opening them with interact come when there is something behind them.
- **Stairs placeholder:** taking the stairs generates a fresh floor (index + 1) so you can keep walking. The real behaviour, guarded by the mini-boss, comes later.
- **Pause** uses the `menu` mode, so time freezes exactly as it will for real menus.
- **Events** are pushed onto `state.events` inside a step and drained onto the bus by the browser shell after it, so listeners never run inside game logic.
- **Seeds:** the shell picks a random seed at launch, or uses `?seed=123` from the URL to replay a floor.
- **Art:** placeholder tiles are drawn in code (`src/ui/atlas.ts`) until the tile art question is answered.
- **Player animation** is presentation only (`src/ui/animation.ts`): it reads `player.facing`, `player.motion` and `state.tick` and keeps no game state, so pausing freezes it too. This is basic readability rather than the "animation polish" the GDD puts out of scope; full walk cycles and hand-made frames still wait for real art.
- **Versions:** latest releases at install time: TypeScript 7, Vite 8, Vitest 5, rot.js 2.2.
