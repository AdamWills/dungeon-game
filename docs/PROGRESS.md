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

### M2: Fight
- Five Sewers enemies (`src/data/enemies.ts`), written funny-first: Intake Rat, Feral Intern, Sludge Hopper, Pipe Leech, Grudge Gator, each with two named moves and their own hit lines.
- Spawning (`src/gen/populate.ts`): 0 to 2 per room, none in the start room, at most 2 gators. Patrol routes loop around the room and sometimes out to a neighbouring room; some enemies start asleep.
- Roaming AI (`src/game/ai.ts`): patrol, vision cone plus line of sight, hearing (halved while asleep), a "?" when suspicious, a "!" and a chase when spotted, giving up after losing sight for a while.
- Encounters (`src/world/encounter.ts`): contact starts a battle and pulls in up to 3 more enemies within 3 tiles. Ambush rule: who moved decides (see the GDD).
- Battles (`src/battle/turns.ts`): Speed turn order (the ambushing side takes the whole first round, +50% damage), Attack with target choice, Rampage (hits all, 8-turn cooldown), Item (Suspicious Bandage, heals 10, 2 to start), Defend (halves incoming damage until your next turn), Flee. Winning removes the dead and leaves gore on the map; fleeing writes HP back and sets the survivors chasing; dying ends the run.
- Dash (Shift): a short sprint that passes through enemies, 2-second cooldown.
- Battle screen with turn bar, HP bars, hit flashes and damage numbers, command menu and log; map shows enemies, their vision cones, "!", "?" and "z" bubbles; HUD shows HP and dash; a preliminary incident report on death and a "descent filed" screen on the stairs.
- Tests: 45 in total, including combat maths, battle turns, AI senses, the ambush rules, spawning over 59 seeds, and a bot that plays 40 full runs with random choices (last run: 21 deaths, 19 escapes, 108 battles, no crashes).
- Checked in a real browser with real key presses: walked to an enemy, won a fight through the menu, carried on, then died to an Intake Rat's Gnaw. No console errors.

### Tile art
- The map now uses the 0x72 16x16 DungeonTileset II (CC0, v1.7, from the author's itch.io page), stored with a licence note in `src/assets/0x72/`. Floors with stable random cracks, brick wall faces with caps, stone rims along room sides and bottoms, sewer goo dripping down some walls, and the pack's stairs. The battle screen floor uses it too.
- Map tiles are 16 px; our hand-drawn characters keep their 24 px box and stand a little taller than a tile, like the pack's own heroes. The view zoom aims for about 22 by 13 tiles (4x at 1080p).
- A test checks that every sprite name the map uses exists in the pack's tile list.

### Sneaking fix (after playtesting M2)
- Problem: enemies heard footsteps 3 to 5 tiles away and turned instantly, so they always saw you before you could touch them from behind; rats also out-ran a walking player. A new test confirmed no enemy could be snuck up on.
- Fix: a hearing enemy shows "?" for 0.75 seconds before turning toward the sound; walking is quieter (hearing 2 to 3 tiles) and dashing doubles it; chasers are now no faster than a walking player (the rat matches you, the rest are slower), so dash or distance can lose them.
- Tests: walking up behind each of the five enemies opens with your ambush; a heard enemy does turn round if you dawdle; a dash is heard from further away than a walk. Bot check: 11 deaths and 29 escapes in 40 runs, so enemies still kill.
- Checked in the browser with real keys: walked up behind a Feral Intern, it showed "heard you" while still facing away, and the fight opened as your ambush.

## Next

M3: Loot and classes. Items and inventory (about 30), the Hexer and Hex, Human and Gutterfolk traits, the Improvise menu (props, item jank, Bad Idea), and map hazards. Closed doors that block movement and sight also need a home; they fit with props in M3.

## Decisions from the user

- Work is committed directly to `main` and pushed; no branches or pull requests.
- **Stairs:** in the one-floor prototype, taking the stairs (once the mini-boss is beaten) ends the run as a win.
- **M2 battle menu:** Attack, Ability (the class signature, Rampage for the Brawler), Item (one healing consumable), Defend and Flee. Improvise and the full item list come in M3.
- **Doors:** closed doors block both movement and sight.

- **Ambushes:** who moved decides. Sneaking into an unaware or sleeping enemy gives you the first round; a chasing enemy running into you gives it the first round; anything else is a normal fight. (GDD updated.)
- **Hazards** move to M3. (GDD build plan updated.)
- **Tile art:** the 0x72 pack for the map (user's pick). Characters and enemies stay hand-drawn so they are consistent with each other; we do not use the pack's monsters.
- **Plain interface, Auditor on top:** after playing M2 the joke vocabulary hid basic information (what Rampage does, what "Dispute Resolved" means). Menus now have a plain help line for the highlighted choice (target choice shows HP, hit chance and damage), headings are plain with the Auditor's line as a subtitle ("VICTORY" / "Dispute resolved.", "YOU ESCAPED" / "Descent filed."), and map bubbles are labelled ("spotted you", "heard you", "asleep"). (CLAUDE.md and GDD updated.)

## Decisions (no GDD change needed)

- **Hit chance** is 90% minus 6% per point of the target's Evasion, clamped to 20 to 95%. **Flee chance** is 50% plus 10% per point of Speed over the fastest enemy, minus 10% per extra enemy, clamped to 10 to 90%. Both are placeholders until M5.
- **Defend** halves incoming damage (rounded up) until your next turn.
- **After a successful flee** the survivors chase you, but stand dazed for 1 second and you get 1.5 seconds without new fights, so you are not dragged straight back in.
- **Dash** passes through enemies (the GDD's "slip past patrols").
- **Vision cones are drawn on the map** for enemies you can see, so sneaking is a readable choice rather than a guess.
- **A `won` mode** joins the GDD's four modes for the stairs ending; `dead` stays for deaths.
- **Battle text variants** are picked by a stable hash, not the game RNG, so adding a line never changes how a fight plays out.
- Enemy XP values are in the data but unused until levelling in M4.

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
