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

### M3 first half: classes, loot and the map
- Contestant picker before each run (race and class, remembered between runs). Hexer with Hex (one enemy takes double damage for 5 turns, 6-turn cooldown) and 3 Hex Scrolls; Brawler starts with the Rusted Pipe and Velour Tracksuit equipped. Gutterfolk: +4 max HP, -1 Charm, immune to poison, eat remains to heal (Humans can try; it costs 2 HP).
- 30 items (`src/data/items.ts`): 7 weapons, 6 armour, 10 consumables, 4 junk, 3 cursed, 1 Host's Pick, written jokes-first, each with a plain help line. Weapons can cause statuses on hit; gear changes stats; cursed gear will not come off.
- Inventory screen (ESC or I, time paused): worn gear and pockets, equip, take off, use, drop, item details and stats. Carry limit 12.
- Status effects in battle: bleed, poison, burning, stunned, charmed, hexed, hasted; stacking by duration, ticking at the start of the holder's turn, with badges on the battle screen. Two enemy moves inflict them (Sludge Hopper poison, Pipe Leech bleed).
- Map: 3 to 5 chests (walk into one or press E), enemies drop loot 30% of the time, items on the floor are picked up by walking over them. Doors start closed and block movement and sight; walk into one or press E to open it; residents open them too.
- Hazards: sludge pools, floor spikes in corridors and gas vents that puff on and off. They hurt anyone standing on them; residents can die to them and their wounds carry into battle; smart residents (Feral Intern, Grudge Gator) route around them.
- Plain prompts in the bottom bar for what is underfoot or in front of you; short messages for pickups, equipping and hazard damage.
- Tests: 75, including a test file for all of the above and a bot that now plays both races and classes, uses items and presses E (last run: 20 deaths, 20 escapes, 84 battles, no crashes).

### M3 second half: the Improvise menu
- Props on the map (`src/data/props.ts`): Barrel, Vending Machine, Fire Extinguisher and Folding Chair are placed 6 to 10 per floor; Remains (from gore) and a Sludge Puddle (from sludge hazards) join too. Up to 4 props within 2 tiles of a fight make its arena, shown on the battle screen.
- Improvise in the battle menu, three channels, all costing your turn:
  - **Props:** shove, kick, throw, eat, hide in or ignite. Generic tag rules make every prop and verb work; 7 hand-written combos override them (tipping the Vending Machine onto someone, lighting the Sludge Puddle, the Folding Chair classic). Props wear out, and wrecked ones stay wrecked on the map.
  - **Item jank:** combine two pocket items, both used up. 10 named combos (Squeaky Shrapnel, Inferno Hoagie, Glitterpocalypse, ...), generic tag rules, a mild random fallback, and a 15% backfire onto you.
  - **Bad Idea button:** once per fight, 12 outcomes from disaster to legendary; Charm nudges the odds.
- One validator for every outcome, whatever its source: known effects and targets only, clamped damage, healing and durations, nothing that creates items or ends a fight, and self-harm never kills. Repeating the same trick in a run is 30% weaker each time.
- Plain help for every row of the Improvise menus; Chet narrates the results.
- Fixed while building it: (1) chests and props could block the only way to the stairs on some seeds (corridors sometimes join rooms through gaps rot.js does not mark as doors); every chest and prop is now only placed if the whole floor stays reachable, and a test checks 60 seeds. (2) Improvise commands were dropped by the game loop; a test now sends one through it.
- Tests: 91. The bot now also improvises (last run: 26 deaths, 14 escapes, 72 battles, no crashes, every run finished).
- Checked in the browser with real keys: shoved a barrel onto a Feral Intern (stunned it), then combined a Pipe Bomb and a Rubber Chicken into Squeaky Shrapnel to finish it.

### Ambush fix (after playtesting M3)
- Problem: being caught by a group could kill you before your first turn. When you were ambushed, every enemy in the fight got the first strike and +50% damage, not just the one that caught you. Measured over 200 seeds, a Hexer died before acting in 58% of 3-enemy ambushes (31% with 2 enemies).
- Fix: only the enemy that caught you strikes first with the bonus, as the GDD says; the rest act by Speed. Plus a new rule: you always get a first turn (nothing, damage over time included, can take you below 1 HP before you have acted). Now 0 deaths before acting for either class, even against four enemies.
- Tests for both rules (100 seeds, both classes, four enemies, starting at 3 HP). GDD updated.

### Prize cards (after playtesting)
- Problem: a 3-second corner message was the only sign of what you picked up, and the game kept moving.
- Fix: every new item (chest or floor) pauses the game on a prize card in the middle of the screen, showing the icon, name, rarity, what it does, the joke and how to use it. ENTER closes it; several pickups at once queue up. Other messages now stay up for 5 seconds.
- Test: the card pauses time, blocks other inventory commands, and closes back to roaming.

## Next

M4: Party and host. 3 recruitable allies with stances and loyalty, scripted host lines for routine events, the death screen with a full elimination report, XP and the level-up screen.

Not yet built from the prototype scope: the free-text Improvise channel's verb-and-noun parser (no milestone lists it; it needs a text box), and Findings and Credits for first-time discoveries (M5 with meta-progression). Improvisation already records discovery keys and raises an `improvised` event for them. Items and inventory (about 30), the Hexer and Hex, Human and Gutterfolk traits, the Improvise menu (props, item jank, Bad Idea), and map hazards. Closed doors that block movement and sight also need a home; they fit with props in M3.

## Decisions from the user

- Work is committed directly to `main` and pushed; no branches or pull requests.
- **Stairs:** in the one-floor prototype, taking the stairs (once the mini-boss is beaten) ends the run as a win.
- **M2 battle menu:** Attack, Ability (the class signature, Rampage for the Brawler), Item (one healing consumable), Defend and Flee. Improvise and the full item list come in M3.
- **Doors:** closed doors block both movement and sight.

- **Ambushes:** who moved decides. Sneaking into an unaware or sleeping enemy gives you the first round; a chasing enemy running into you gives it the first round; anything else is a normal fight. (GDD updated.)
- **Hazards** move to M3. (GDD build plan updated.)
- **Tile art:** the 0x72 pack for the map (user's pick). Characters and enemies stay hand-drawn so they are consistent with each other; we do not use the pack's monsters.
- **New theme (user decision, replaces the Auditor):** the game is now set on DESCEND & WIN!, a tacky 1970s-style underground game show hosted by Chet Valentine, an upbeat, empathy-free hologram. Policy notices became House Rules, the incident report became an elimination report with a "lovely parting gift", and the end screens and battle lines are Chet's. Credits, Achievements and the Bad Idea button keep their names. Floors and creatures follow each floor's own theme, so the sewer creatures stay. To keep it clearly distinct from Dungeon Crawler Carl there is no audience, viewer or sponsor system; Chet only talks to "the folks at home". GDD, CLAUDE.md and all game text updated; `src/auditor/` is now `src/host/`.
- **Plain interface, narrator on top** (written when the narrator was the Auditor; the rule still holds for Chet): after playing M2 the joke vocabulary hid basic information (what Rampage does, what "Dispute Resolved" means). Menus now have a plain help line for the highlighted choice (target choice shows HP, hit chance and damage), headings are plain with the Auditor's line as a subtitle ("VICTORY" / "Dispute resolved.", "YOU ESCAPED" / "Descent filed."), and map bubbles are labelled ("spotted you", "heard you", "asleep"). (CLAUDE.md and GDD updated.)

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
