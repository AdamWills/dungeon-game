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

### Game-show look: Neon Nights (user's pick from six mock-ups)
- First tries (a smooth 70s showbiz kit, then the same pixelated) were rejected as "too clean". I mocked up six directions as pixel-art samples (70s studio, neon nights, quiz board, prize pyramid, TV set, curtain call); the user picked **Neon Nights**.
- `src/ui/neon.ts`: a night stage with dithered sky, twinkling stars and a rolling neon grid floor; black panels framed by two neon tubes; neon-sign badges; neon titles; confetti; pop-in. Every screen is drawn in art pixels on a small canvas at the map's pixel size and scaled up with hard edges. If a screen needs more height than that gives, its pixels shrink.
- `src/ui/pixelFont.ts`: a hand-made 5x7 pixel font (capitals, digits, punctuation) used for all text on these screens, body text included, so nothing is smooth. A test checks every character used by items, races, classes, abilities and these screens has a glyph.
- Used for the prize card (tube colours and badge sign by rarity; junk and cursed tubes flicker; special and Host's Pick rain confetti), the battle result banner (VICTORY, YOU GOT AWAY, YOU DIED), the end-of-run screens and the contestant picker with its DESCEND & WIN! sign. Headings stay plain; the corn is in the styling and badges. All original.
- Fixed earlier while checking: the elimination report read "with a lovely a long, relaxing soak" and "the the Sludge Pool"; hazard and status deaths now read cleanly.

### M4: Party and host
- **Allies** (`src/data/allies.ts`, `src/game/party.ts`): Marjorie "The Forklift" Pyle (bruiser, in a cell: press E), Dr. Ignatius Moss (healer, bribe of 15 Prize Tokens minus your Charm, never below half) and Skitch (coward with a nail gun, among the enemies; a Spare command recruits him once he is under 40% HP, Charm helps). Each has a passive, an ability on a cooldown and a stance (Aggressive, Defensive, Support) set on the pause screen. They follow you in a line, catch up at a run, and an enemy touching any of you starts a fight with the whole party. Allies hold off a beaten Skitch so you get the chance to spare him.
- **In battle** allies act on their own after you by stance; enemies pick targets among the party (Defensive allies draw fire, Skitch is only targeted when nobody else is standing). Healing items can go to an ally. Dead allies stay dead, leave gore and drop their item.
- **Loyalty** (hidden): up for giving a consumable (G on the pause screen), healing them in a fight and winning together; down for fleeing (they also take a parting hit), Bad Idea or combo disasters that land on them, and finishing a fight under 25% HP without your help. Chet hints when it gets low. At zero Marjorie turns on you (a chasing enemy that sees all around), Dr. Moss quits and Skitch steals an item and runs.
- **Prize Tokens**: dropped by enemies (per enemy type) and chests; shown in the HUD.
- **XP and levels 1 to 5** (`src/game/progress.ts`): XP from kills (+25% after a sneak attack) and recruiting. The level-up screen (neon) opens as soon as you are back on the map: 3 points to spend, every second point in a favored stat free, and a perk pick at level 3 from 6 perks (`src/data/perks.ts`). Allies scale with your level.
- **Chet on the map** (`src/host/host.ts`, `src/data/hostLines.ts`): listens to the event bus and plays a scripted line (5 per event, never the same twice in a row) in a neon strip with a hologram portrait of him; the pause screen shows his last lines. Captives get their contestant profile read out when you first see them.
- **Elimination report** (`src/game/report.ts`, `src/data/report.ts`): the death screen lists class, race and level, the killer and move, fights, Bad Ideas and allies, your last words (from your last action), a useless parting gift and Chet's sign-off.
- Tests: `tests/m4.test.ts` (placement and reachability, the three ways to recruit, following, fights started through an ally, allies acting and being targeted, ally death, flee costs, Second Opinion, loyalty and betrayals, XP thresholds, favored points, perks, Thick Skull, Bad Habits, spoils, the report, host lines). The bot now plays level-ups and tries sparing. 120 tests pass.

### Pacing and a first difficulty pass (after playtesting M4)
- User: "things move way too fast", "dead by the second enemy". Battles now play out one turn at a time: after your move, every other turn (enemy or ally) resolves a beat apart (50 fixed steps, about 0.8 s) and the result banner waits for the last hit to land. The menu says whose turn it is; Flee shows your actual chance and warns that a failed try lets them all hit you. Logic stays deterministic: the pause is counted in fixed steps (`battleTick`).
- Measured with a sensible-player bot (`tests/difficulty.test.ts`, run with `SIM=1`): before, Brawler runs died 58% of the time and Hexer runs 98% (usually in the 2nd fight). Changes: at most 3 enemies per fight and a smaller join radius; you and your allies regain 1 HP every 1.5 s while exploring; chasing enemies are a little slower than you; the Grudge Gator hits softer (Death Roll and Drink Deep too); the Hexer has 26 HP, 1 Armor, 3 Strength, a 3-damage clipboard and Hex every 4 turns. After: Brawler wins 80% and dies 5%; Hexer still dies 57% and needs more work.

### Read the Room (user request: enemy intents, "but as a skill that is developed")
- The first trainable skill (`src/data/skills.ts`, `src/game/skills.ts`). Enemies now pick their next move and target in advance (`intent`), and use exactly that. Watching an enemy act is practice; levels at 3, 15, 40 and 80. Level 1 shows above each enemy whether it is about to attack, hit hard or attack with a status; 2 adds the move's name; 3 a rough damage number; 4 who it is aimed at. Level-ups are announced in the battle log and by Chet; the pause screen shows the level.
- Tests: `tests/skills.test.ts`.

### Cursed items (user feedback)
- User: a cursed item that never comes off showed up far too early, +3 Strength meant nothing without knowing your current stats, and a lock that permanent is never worth it as they were. Decision: curses stay locked for the whole run, but:
- Cursed items only roll in the second half of the floor (by walking distance from the start towards the stairs), for chests and enemy drops (`depthOf`, `CURSED_FROM` in `src/game/loot.ts`).
- They are much stronger with a real cost: Chet's Spare Microphone +5 Strength, -3 Evasion, -2 Armor; Paper Crown +4 Charm, +3 Evasion, +2 Speed, -10 max HP; Lucky Handcuff +5 Armor, +6 max HP, -3 Speed.
- The prize card and inventory show what wearing any gear would change against what you have on ("Strength 4 -> 9", green for up, red for down), including weapon damage (`equipPreview`).
- Tests: `tests/loot.test.ts`.

### Floor 1 as a learning floor, Hexer fix, readable spikes (user feedback)
- User: "Level 1 should be more get to know the game and less dying." Residents now have a minimum depth (`minDepth` in `src/data/floors.ts`, 0 = start, 1 = stairs): Feral Interns from 0.2, Pipe Leeches from 0.4, Grudge Gators from 0.6. Rooms closer to the start than 0.35 hold at most one resident.
- Hexer: starts with the Velour Tracksuit too, and has 4 Evasion. Measured with the sensible-player bot (`SIM=1`, 60 runs each): Brawler wins 49, dies 0; Hexer wins 45, dies 6 (was 59 deaths out of 60 before the first pass).
- User: spikes were dull, always hurt, and you only noticed from the HP bar. Spikes now pop up and drop on a visible timer (down, a two-step warning twitch, up) and only hurt while up: when you step on them up, or when they pop up under you, once per pop. Any hazard hit on the map now flashes the victim red and floats the damage over their head.

### A big floor (user decision: 192x120)
- The floor is now 192 by 120 tiles with 60 to 100 rooms (about nine times the first version), with chests (20 to 30), props (30 to 45), hazards and Grudge Gators scaled to match. Props per floor moved from `PROP_RULES` into the floor theme.
- Speed: residents more than 30 tiles from you hold still; distance maps are shared by every resident heading for the same tile in a tick; the breadth-first search uses flat arrays; and placing chests and props checks the 8 tiles around a spot before falling back to a full reachability check. A floor generates in 25 to 75 ms and the game holds 60 updates a second.
- A minimap in the top right shows a window of what you have explored around you (you, stairs, unopened chests, residents in view, your party); M hides it.
- The HUD now has a second row with your stats (Strength, Speed, Evasion, Armor, Charm, weapon) always in view (user: "How can I view my character stats?").
- Tests: the generator tests use 60 seeds, the bot plays 16 runs, and the test timeout is 60 s.

### Plainer ambushes and prize badges (user feedback)
- "An enemy walks right into my face... how is that being ambushed?" An enemy now only ambushes you if it reaches you from behind (the side you are not facing); walking into your face is a normal fight. The battle banner says why in plain words ("SNEAK ATTACK: they had not noticed you..." / "AMBUSHED FROM BEHIND: it caught you with your back turned..."). GDD updated.
- "What the heck is Booby Prize?" Prize card badges now show the plain rarity, as in the inventory: JUNK, STANDARD, SPECIAL, CURSED!, HOST'S PICK!.

## Next

M5: Meta and polish. Credits, the Intake Desk with 5 unlocks, 20 achievements, local save, the mini-boss, the safe room (with the vendor that takes Prize Tokens) and a gore pass. Then balance.

Not yet built from the prototype scope: the free-text Improvise channel's verb-and-noun parser (no milestone lists it; it needs a text box), and Findings and Credits for first-time discoveries (M5 with meta-progression). The writing for the allies and Chet's lines is first-draft placeholder text (user: "not good, but ok"); it all lives in `src/data` for a rewrite pass.

## Decisions from the user

- Work is committed directly to `main` and pushed; no branches or pull requests.
- **Stairs:** in the one-floor prototype, taking the stairs (once the mini-boss is beaten) ends the run as a win.
- **M2 battle menu:** Attack, Ability (the class signature, Rampage for the Brawler), Item (one healing consumable), Defend and Flee. Improvise and the full item list come in M3.
- **Doors:** closed doors block both movement and sight.
- **M4 (user decisions, GDD updated):** Prize Tokens are the in-run money; one recruiting method per ally (cell, bribe, spare); the full loyalty version with in-character betrayals; Chet's map lines in a neon strip with a portrait; the perk pick ships in M4; enemies touching any party member start a fight. Build the writing now and rewrite it later.

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
