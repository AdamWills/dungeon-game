# Subpar Dungeon — Game Design Document

Oct 17, 2026 · Adam Wills

A browser-playable roguelike with real-time roaming and turn-based battles, where ordinary people are dragged onto a tacky underground game show and must descend a deadly dungeon while a hologram host cheers every death, with gleeful gore, absurd loot and a strong achievement system. Working title; scope is a weekend prototype.

## Pillars and tone

The game is a tight tactical roguelike wrapped in a mean, funny narrator. Four pillars guide every decision:

1. **Roam live, fight by the book.** Movement, dodging and ambushes are real-time; every battle is a turn-based, menu-driven decision.
2. **Death is the joke and the engine.** Runs end often, deaths are narrated, and each death pays out something.
3. **The dungeon talks back.** The host reacts to what you do, and the writing is a feature, not flavor.
4. **Bad ideas get rewarded.** Achievements and loot favor weird, reckless play over optimal play.

**Tone:** gleefully gory, gallows humor, sarcastic. Violence is cartoonishly over the top (limbs, gibs, absurd death causes), played for laughs rather than realism. Humor comes from the host's voice, item text and achievement names, not from random-quirky filler.

## Premise and the host

People are pulled out of their ordinary lives (mid-commute, mid-nap, mid-argument) and dropped onto the set of **DESCEND & WIN!**, a cheap 1970s-style daytime game show built in the tunnels under the city, a hundred floors deep. Nobody remembers applying. The sets are cardboard and duct tape, the prizes are terrible, and the only way out is down.

The show is hosted by **Chet Valentine**, a too-tanned hologram in a velvet suit, all catchphrases and dazzling teeth, with no empathy whatsoever. Every death is great television to Chet. Nobody knows who produces the show.

**Host voice rules**

- Relentlessly upbeat and specific. Chet cites your actual action, item or room, never generic insults.
- His digs are earned: he ribs bad choices more than bad luck, always with a smile.
- He announces deaths as eliminations, with the cause, a useless "lovely parting gift" and a cheery sign-off.
- He is never helpful by accident. Hints are disguised as showmanship.
- He never breaks character or explains game mechanics in plain language; tutorials come as "House Rules".
- He talks to an unseen "folks at home", but there is no audience, viewer count or sponsor system. That keeps the show its own thing and inside v1 scope.
- The interface itself is plain: menus, help lines, headings and map labels say clearly what things do, and Chet's lines sit alongside them as flavour rather than replacing them.

Floors and their creatures follow each floor's own theme, not the show: the first floor is the Intake Sewers, so its residents are sewer things.

The tone is inspired by dark comic fiction about deadly dungeons, but everything here is original: names, characters, the show and the dungeon's rules are new, to keep the game its own thing.

## Core loop, roaming and battles

A run is a descent through floors; each floor is a map of rooms explored in real time, and every fight switches to a turn-based battle screen.

**The run loop**

1. Pick a race and class (plus any unlocked perks) at the Intake Desk.
2. Enter a floor, explore rooms, fight, loot, and recruit allies.
3. Find the stairs (guarded on boss floors) and descend.
4. Die, or clear the final floor of the current build.
5. Receive the elimination report, spend meta currency, start a new run.

**Roaming (real time)**

- Top-down, tile-smooth movement: hold the arrow keys or WASD to move continuously, with collisions snapped to the tile grid.
- Time only runs while you roam; opening the inventory, party or any menu pauses the game.
- Enemies are visible on the map, patrol set routes, and notice you through a vision cone and a short hearing radius. Once alerted they chase in real time at their own speed.
- You cannot attack while roaming. A short dash (about 2 seconds of cooldown) lets you slip past patrols and dodge chasers.
- Field of view and fog of war: unexplored tiles are hidden, seen-but-not-visible tiles are dimmed.
- One interact key opens doors and chests, frees captives and takes the stairs. Allies trail behind you in a line.

**Battles (turn-based, menu-driven)**

- Touching an enemy switches to a separate battle screen. Every enemy within a short radius joins the fight, up to 4.
- Turn order follows Speed and is shown as a bar at the top of the screen.
- On your turn, choose Attack, Ability, Item, Defend, Flee or Improvise. Allies act automatically after you, following their stance.
- Abilities have cooldowns measured in turns, not mana; items are consumed or have charges.
- Fleeing succeeds based on Speed and party size; a failed attempt costs the turn, and enemies keep chasing after a successful one.
- Victory returns you to the map where you stood, with gore and loot left on the tile.

**Ambushes**

- **Player ambush:** touching an enemy that has not noticed you (from behind, outside its vision cone, or while it sleeps) starts the battle with you acting first for the whole opening round and dealing +50% damage that round.
- **Enemy ambush:** if a chasing enemy runs into you from behind (it moved into the contact, you did not move toward it, and it came from the side you are not facing), it acts first and deals +50% damage for the opening round. Enemies that spot you flash a "!" over their head.
- Walking into an alerted enemy, or one walking into your face, is a normal battle, ordered by Speed (user feedback: being "ambushed" by something walking straight at you made no sense).
- Only the enemy that caught you gets the first strike and the bonus; any others pulled into the fight act in normal Speed order.
- **You always get a first turn.** Until you have acted, nothing (hits or damage over time) can take you below 1 HP, so an ambush can hurt badly but never kills before you can respond.

**Hazard pre-damage**

- Sludge pools, spikes, gas vents and falling props damage any unit standing on them in real time, you included.
- Lure chasing enemies through hazards to start the battle with them already wounded. Their HP carries into the fight.
- Simple enemies path straight through hazards; smart ones route around the ones they have seen trigger.

## Classes and races

A character is one race plus one class. Races give passive traits and stat shifts; classes give a starting kit, a signature active ability and a perk tree. The prototype ships 2 races and 2 classes; the full game targets 4 and 6.

**Races**

| Race | Stat lean | Passive | Prototype |
| --- | --- | --- | --- |
| Human | Balanced | Gains bonus meta currency on death ("adaptable") | Yes |
| Gutterfolk (sewer-dwelling mutants) | +HP, −Charm | Resists poison and disease; eats corpses to heal | Yes |
| Plated Ones (armored insectoids) | +Armor, −Speed | Natural armor that regrows each floor | Later |
| Hollow (half-ghost) | +Evasion, −HP | Walks through one wall per floor | Later |

**Classes**

| Class | Playstyle | Starting kit | Signature ability | Prototype |
| --- | --- | --- | --- | --- |
| Brawler | Melee tank | Rusted pipe, tracksuit (light armor) | Rampage: hit every enemy in the battle, cooldown 8 turns | Yes |
| Hexer | Ranged caster | Cursed clipboard, 3 hex scrolls | Hex: mark an enemy so it takes double damage for 5 turns, cooldown 6 turns | Yes |
| Scrapper | Traps and gadgets | Duct tape, 2 pipe bombs | Rig: turn any item into a single-use trap you place on the map; enemies that run over it take damage | Later |
| Medic | Support | Defibrillator, bandages | Revive an ally once per floor | Later |
| Grifter | Stealth and theft | Lockpicks, forged badge | Pickpocket: steal an item from one enemy in battle | Later |
| Berserker | Risk and reward | Hatchet, no armor | Blood Debt: spend HP to boost damage | Later |

## Stats and levelling

You earn XP in battle, level up, and spend stat points yourself. Levels reset on death; only Credits and unlocks carry over.

**Stats**

| Stat | What it does | Per point spent |
| --- | --- | --- |
| HP | How much damage you survive | +4 max HP |
| Strength | Damage dealt | +1 |
| Speed | Turn order and flee chance | +1 |
| Evasion | Chance to dodge attacks | +1 |
| Armor | Flat damage reduction | +1 |
| Charm | Recruiting, vendor prices, Bad Idea odds | +1 |

**Starting stats (level 1)**

| Class | HP | Strength | Speed | Evasion | Armor | Charm | Favored stats |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Brawler | 28 | 4 | 3 | 2 | 2 | 1 | HP, Strength |
| Hexer | 18 | 2 | 4 | 3 | 0 | 3 | Speed, Charm |

Races adjust these: Human has no change; Gutterfolk gets +4 HP and −1 Charm. Every second point put into a favored stat grants a free bonus point of that stat, so classes stay distinct as they grow.

**Levelling**

- **XP sources:** winning battles (each enemy has an XP value, +25% for a player ambush), recruiting an ally, earning an achievement, and a first-time improvisation discovery.
- **Curve:** total XP to reach levels 2, 3, 4 and 5 is 30, 80, 160 and 280; the full game extends this to level 10.
- **Each level-up:** 3 stat points to spend, with the level-up screen shown right after the battle.
- **Perks:** at levels 3, 6 and 9 you also pick 1 of 3 random perks from your class pool and a general pool. Examples: Thick Skull (Brawler: the first hit each battle is halved), Overdue Invoice (Hexer: Hex also deals 3 damage each turn), Scavenger (an extra junk item each floor), Bad Habits (use the Bad Idea button twice per battle).
- **Allies** scale with your level automatically; they do not get points or perks.
- **No respec** within a run. Chet will, however, sell you a "makeover" at a safe room, at a price and with commentary.

**Prototype:** levels 1 to 5, 3 points per level, one perk pick at level 3 from a pool of 6.

## Recruitable party

You start alone and can recruit up to 3 allies per run, found as captives, deserters or bribable monsters on each floor. Allies are what make the show's cruelty personal.

- **Recruiting:** each potential ally has a condition: free them from a cell, pay a bribe, win a dumb contest, or spare them in a fight. Conditions are shown as a one-line "contestant profile" from Chet.
- **Control:** on the map allies trail behind you; in battle they act automatically after you, following a stance you set per ally: Aggressive, Defensive or Support. No direct control in the prototype.
- **Stats and abilities:** each ally has a simple stat block, one passive and one ability on a cooldown.
- **Loyalty:** a hidden loyalty value rises when you share loot and falls when you leave them to die or use them as bait. At zero they quit, steal an item, or turn on you.
- **Death:** allies die permanently within the run. Chet announces each one's elimination, and a small share of their gear drops.
- **Cap:** the party is capped at 4 including you; recruiting a fifth means dismissing someone, which Chet announces with relish.

The prototype includes 3 hand-written allies, one per archetype: a bruiser, a healer and a coward with a gun.

**Prototype details (user decisions)**

- **Recruiting, one way each:** the bruiser is locked in a cell (open it with the interact key); the healer wants a bribe in Prize Tokens (Charm lowers the price); the coward turns up on the enemy side of a fight, and a Spare command works on him once he is low on HP (Charm raises the odds). The dumb contest waits for later.
- **Meeting is a conversation (user request):** walking up to a captive, or the spared coward after the fight, opens a short scripted conversation instead of an instant join. You can ask about them (what you learn is kept on their card), and your answers matter: promising the bruiser a share raises her loyalty, the healer's price can be haggled once on a Charm roll (cheaper on a win, dearer and a little resentful on a loss), and the coward can be sent away for good. Party members can be chatted with from the pause screen (T): a kind word adds a little loyalty, at most once every two fights.
- **Loyalty up:** giving an ally a consumable, healing them, winning a fight together.
- **Loyalty down:** fleeing a fight (allies take a parting hit covering you), hurting them with a Bad Idea or a backfired combo, leaving them under 25% HP without helping.
- **At zero:** each ally leaves in character: the bruiser turns on you (an enemy in the next fight), the healer quits, the coward steals an item and runs.
- **On the map:** allies follow in a line, and an enemy touching any party member starts a fight with the whole party.
- **Stances** are set per ally on the pause screen.

## Floors

Floors are hybrid: procedural room layouts with hand-authored set pieces and bosses slotted in. Each floor has a theme that sets its enemies, hazards, loot table and host commentary.

**Structure of a floor**

- A procedural layout of roughly 60 to 100 rooms (192 by 120 tiles; user decision, up from 8 to 12) connected by corridors, with enemies patrolling set routes and map hazards (sludge, spikes, gas vents).
- 1 stairwell down, always guarded or locked behind a simple condition.
- **Boss tiers (user decision):**
  - **Elites:** a few ordinary residents per floor carry a trait (Rabid, Unionized, Overcaffeinated, Enormous). They are tougher, worth 2.5 times the XP and twice the tokens, always drop an item, and glow gold.
  - **Room bosses:** 2 to 3 per floor, deeper in, each alone in its own room. They never leave it, so the fight is optional, and each drops a Rare or Legendary prize.
  - **Floor boss:** waits in the stairs room (its lair). It roars when you get near, or once you have seen half the rooms, which marks the lair on your map. Walking in starts the fight. You can flee, but you land outside the door and it heals back up. The stairs stay sealed until it dies.
  - Bosses telegraph a big wind-up move a turn ahead (always shown, whatever your Read the Room), and some hit the whole party or call in help.
- 1 to 2 hand-authored set pieces (a vault, a rigged game show, a fountain with a catch) placed in random rooms.
- A "safe room" with a vendor and a recruitable ally, once per floor.
- Every 5th floor ends with a hand-authored boss.

**Themed floors (full game)**

| Floor range | Theme | Signature hazard |
| --- | --- | --- |
| 1 to 4 | The Intake Sewers | Sludge pools, rats the size of dogs |
| 5 to 9 | The Commissary | Roaming vending machines, spoiled food buffs and debuffs |
| 10 to 14 | The Backlot | Falling scenery, runaway spotlights |

**Prototype floor:** one themed floor, The Intake Sewers, with a procedural layout, 5 enemy types, 2 set pieces, 1 safe room, elites, 3 room bosses (the Sump Crab, Old Flushy, the Hairball Hydra) and a floor boss, the Fatberg, guarding the stairs.

**Generation notes:** layouts use a rooms-and-corridors generator with a fixed seed per run so a run can be replayed. Set pieces are authored as small tile templates that the generator stamps into eligible rooms.

## Combat, gore and loot

**Combat**

- Battles are menu-driven: turn order follows Speed, and on your turn you pick Attack, Ability, Item, Defend, Flee or Improvise.
- Every attack rolls to hit against the target's Evasion (hit chance stays between 20% and 95%). Damage is weapon damage plus Strength, minus the target's Armor, with a minimum of 1.
- Stats: HP, Strength, Speed, Evasion, Armor, Charm (affects recruiting and vendors). Keep numbers small so the player can do the math in their head.
- Status effects (bleed, poison, burning, stunned, charmed) last a fixed number of turns and stack by duration, not intensity.
- **Weak spots (user decision):** every hit has a damage type: Blunt, Sharp, Fire or Gross. Each creature is weak to some types (×1.5, and it is knocked off balance, so you act again, once per turn) and shrugs off others (×0.5). You learn which by trying; what you learn is shown when you pick a target. Swapping weapons in a fight is free.

**Gore**

- Kills and big hits play out on the battle screen, then leave persistent blood, gibs and body parts on the map tiles where the fight happened; they stay for the floor and some are usable (a severed arm can be thrown or eaten by a Gutterfolk).
- Overkill damage triggers a gib death with an extra description line and a small bonus drop.
- Everything is cartoonish and sprite-based; there is no realistic depiction, and gore intensity is a setting that can be turned down.

**Loot**

| Rarity | Frequency | Rule |
| --- | --- | --- |
| Poor | Common | Funny, mostly useless, occasionally secretly great |
| Common | Common | Plain stat upgrades |
| Rare | Uncommon | One strong effect with a catch |
| Cursed | Uncommon | Powerful, with a downside that changes how you play |
| Legendary | Rare | Run-defining item with a mean description |

**Prize Tokens** are the in-run money (user decision): enemies and chests drop them, bribes, the safe-room vendor and Chet's makeover take them, and they are lost on death. Credits stay the between-runs currency.

**Equipment (user decision):** a full paper doll of twelve slots: Head, Neck, Shoulders, Body, Belt, Legs, Weapon, Off-hand, Hands, two Rings and Feet. Worn gear does not count against the 10 pocket slots. The pause screen shows your character with the slots around them. Gear drawn on the character sprite itself comes later.

**Absurd items (examples)**

- *Motivational Poster:* hang it in a room; allies in it gain +1 Strength, enemies gain +1 morale.
- *Expired Energy Drink:* double actions for 3 turns, then stunned for 5.
- *Lanyard of Authority:* neutral monsters stop attacking until you attack first, but vendors double their prices.

The prototype ships around 30 items: 12 weapons and armor, 10 consumables, 8 junk and cursed items.

## Improvisation: the bad ideas system

Menus cover the sensible options; improvisation covers everything else. Every battle menu has an **Improvise** command that costs your turn and opens four ways to do something unwise. All four resolve into the same outcome format, so scripted tables, the parser and the LLM can stand in for each other.

| Channel | What you do | How it resolves | Prototype size |
| --- | --- | --- | --- |
| Props | Shove, kick, throw, eat, hide in or ignite an object from the battle arena | Verb and prop-tag table | 6 props, 8 verbs |
| Item jank | Combine two inventory items | Tag-pair table with a generic fallback, 15% backfire | 10 combos |
| Bad Idea | Press one button and commit | Weighted random draw, once per battle | 12 outcomes |
| Free text | Type what you want to do | LLM adjudication, parser fallback | Behind the narrator flag |

**Props**

- The arena is built from the props within 2 tiles of where the battle starts, up to 4 per battle: barrels, vending machines, corpses, sludge puddles, fire extinguishers.
- Each prop has tags (heavy, flammable, edible, explosive, conductive, slippery, container, sharp) and limited uses.
- Examples: shove a vending machine onto a rat; eat a corpse (heals a Gutterfolk, poisons a Human); ignite a sludge puddle; hide in a barrel to skip an enemy turn.
- Props destroyed in battle stay destroyed on the map; unused ones stay where they were.

**Item jank**

- Pick any two items and the game looks up their tag pair. Known combos give strong, specific effects (a pipe bomb plus a vending machine becomes a shrapnel snack dispenser that hits every enemy). Unknown pairs fall back to a generic tag result with a mild random effect.
- 15% of the time it backfires on you or an ally, and a backfire always gets a host line.
- Combos are logged in a Findings page across runs; discovering a new one pays bonus Credits.

**Bad Idea button**

- Once per battle, draw from a weighted table of absurd actions ("do a backflip", "negotiate", "pretend to be management"). Each outcome has a grade (disaster, meh, brilliant or legendary) and a host line.
- Charm nudges the weights slightly. Brilliant and legendary outcomes pay bonus Credits, and each outcome unlocks an achievement the first time it appears.
- Disasters cost HP, a turn or ally loyalty, never an instant death.

**Free-text improv**

- Type any action. With the live narrator on, the serverless function sends the text plus context (props, inventory, enemies, class) to the model and gets back a structured outcome: a verb, targets, effects chosen from the game's own effect list with capped magnitudes, and a narration line.
- The game validates everything: effects must exist, damage and healing are clamped, nothing can create items or end a battle outright, and the player's text is treated as untrusted (instructions hidden in it are ignored).
- With the LLM off, offline, rate-limited or slower than 3 seconds, a verb-and-noun parser matches known verbs against props, items and enemies. If nothing matches, it rolls on the Bad Idea table and Chet scores the attempt as "creative".
- Limit: 2 free-text improvs per battle and about 8 per run, sharing the narrator's rate limit.

**Balance rules**

- Improvising costs your turn, and its average outcome is slightly worse than Attack. The draw is a high ceiling with real variance.
- Repeating the same improvisation in a run gets weaker each time, which pushes players to try new ones.
- Discovery is the reward: the first time a verb-and-prop pair, item combo or Bad Idea outcome appears across all runs, it pays Credits and fills the Findings log.

## Achievements

Achievements are a strong side system: they never gate progress, but they feed meta-progression and give the host material.

- **Trigger:** each achievement is a named condition checked after every turn (kill type, item combo, death cause, silly behavior).
- **Naming:** punny and specific, e.g. "Workplace Safety Violation" (kill 3 enemies with one trap) or "Friendly Fire, Mostly" (kill an ally with an area attack).
- **Reward:** every achievement grants Credits (the meta currency) and a host reaction line; about 1 in 4 also unlocks an item, class perk or ally for future runs.
- **Rarity:** achievements are common, odd or secret. Secret ones show as "[REDACTED]" until earned.
- **Tracking:** an Achievements screen lists earned and visible-but-locked entries across all runs.

The prototype ships 20 achievements: 12 common, 6 odd, 2 secret.

## Meta-progression

Each run is permadeath: you lose your character, gear and allies. What persists is paid for in **Credits**, earned from floors cleared, achievements and notable deaths.

**What carries over**

- **Unlocks:** new races, classes, allies and items enter the pool for future runs.
- **The Intake Desk (upgrade shop):** spend credits on small permanent boosts, such as +1 starting HP, an extra starting consumable slot or a better chance of a safe room.
- **Hall of Eliminations:** a log of past deaths with Chet's elimination reports, shown as a graveyard screen.
- **Starting perks:** choose one unlocked perk before each run.

**Balance rule:** permanent boosts stay small and capped. A run should always be winnable by a new player with no unlocks; meta-progression widens options more than it raises power.

**Storage:** all meta state is saved locally in the browser for the prototype, as a single JSON object.

## Hybrid narrator spec

The host speaks through two channels: fast scripted lines for routine events and live LLM generation for the moments that matter most.

| Event | Source | Example trigger |
| --- | --- | --- |
| Routine actions (hits, misses, pickups, stairs) | Scripted, templated | Attack lands, item picked up |
| Status changes and low HP | Scripted, templated | Poisoned, HP under 25% |
| Achievement earned | Scripted, with LLM variant for rare ones | Any achievement |
| Death | Live LLM | Player dies |
| Boss intro and boss death | Live LLM | Enter boss room, boss killed |
| Ally recruited, betrayed or killed | Live LLM | Party change |
| Free-text improv resolution | Live LLM, parser fallback | Player types an action in the Improvise menu |

**Scripted lines:** a pool of 5 to 10 variants per event, with variables for the player's name, class, item and enemy. A no-repeat rule avoids the same line twice in a row.

**On the map** (user decision), Chet's lines appear in a neon strip at the bottom of the screen with a small hologram portrait of him; each line types out and fades after a few seconds, and the pause screen keeps the recent history.

**LLM moments:** the game sends a compact context object (event type, floor, class and race, last 5 actions, killer, item list, ally names) plus the host's voice rules and a length cap of 60 words. The response replaces the scripted line.

**Fallbacks:** if the call fails, times out after 3 seconds or is rate-limited, the game plays a scripted line for that event instead. The game must be fully playable with the LLM off, which is also the default in local development.

**Safety and cost:** LLM calls only fire on rare events, at most about 10 per run for narration, plus the capped free-text improv calls described under Improvisation. The API key must never ship to the browser, so calls go through a single serverless function (for example a Cloudflare Worker or Vercel function) that holds the key, accepts only the compact context object, enforces the 60-word cap, and rate-limits per player. The game itself stays a static site, and it runs fine without the function.

## Weekend prototype scope

The prototype proves one thing: a single floor is fun to play and the host makes dying enjoyable. Everything else waits.

**In scope**

- Browser game, keyboard controls, simple tile sprites on a canvas: tile-smooth real-time roaming plus a separate turn-based battle screen (free or placeholder art).
- 2 races (Human, Gutterfolk) and 2 classes (Brawler, Hexer).
- 1 floor (The Intake Sewers): procedural layout, 5 enemy types that patrol with vision cones, 2 set pieces, 1 safe room, elites, room bosses and a floor boss, ambush bonuses and 3 hazard types (sludge, spikes, gas vent).
- 3 recruitable allies with stances and loyalty.
- About 30 items, 20 achievements, and Credits with a minimal Intake Desk of 5 unlocks.
- Scripted host lines for routine events (at least 5 variants each).
- Death screen with an elimination report, and local-save meta-progression.
- Optional: the live LLM narrator for deaths only, behind a feature flag.
- Improvise menu: 6 props, 10 item combos, 12 Bad Idea outcomes and a verb-and-noun parser; LLM free-text behind the same flag as the narrator.
- XP and levels 1 to 5: 3 stat points per level and one perk pick at level 3 from 6 perks.

**Out of scope**

- Floors beyond the first, multiple bosses, and the other 4 classes and 2 races.
- Sound, music, animation polish, and mobile or touch controls; real-time action combat on the map (roaming is movement only).
- Accounts, cloud saves, multiplayer, leaderboards.

**Platform and art constraints:** web browser only, no backend required to play. The one server piece is the optional serverless narrator proxy. Tech stack is left open; a roguelike toolkit with built-in field of view, pathfinding and dungeon generation (rot.js is one option) would save the most time.

**Definition of done**

1. A new player can start a run, descend through the floor and fight the floor boss without instructions beyond on-screen House Rules.
2. A run takes 10 to 20 minutes, ending in either death or stairs.
3. Dying grants credits and an elimination report, and the next run reflects an unlock.
4. At least 5 achievements trigger in normal play.
5. The game runs end to end with the LLM narrator disabled.

## Technical architecture

The game is a static single-page app: TypeScript, rot.js for field of view, pathfinding and dungeon generation, and an HTML canvas for tiles. The only server code is one optional serverless function for the narrator. These are defaults, chosen to save time; swap any of them freely.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Types catch most bugs in item and ability data |
| Roguelike toolkit | rot.js | Built-in FOV, A* pathfinding, rooms-and-corridors generator |
| Rendering | Canvas 2D with a tile atlas | No framework needed; simple sprite blitting |
| Build | Vite | Fast dev server, static output deploys anywhere |
| Saves | localStorage, one JSON key | Meta state is small; no accounts |
| Hosting | Any static host plus one serverless function | Narrator proxy only |

**Modules**

| Module | Responsibility |
| --- | --- |
| `game/state` | The single source of truth: run state, floor, entities, RNG seed |
| `battle/turns` | Speed-based battle turn order; resolves one action at a time |
| `game/combat` | Damage, hit rolls, status effects, gore and overkill rules |
| `game/ai` | Enemy and ally decisions: patrol, notice and chase on the map; pick actions in battle; allies follow their stance |
| `gen/floor` | Seeded floor generator plus set-piece template stamping |
| `data/*` | Pure data: races, classes, enemies, items, achievements, host lines |
| `achievements` | Event bus subscribers that check conditions after each turn |
| `host` | Picks a scripted line, or requests an LLM line for rare events, with fallback |
| `meta` | Credits, unlocks, Hall of Eliminations, save and load |
| `ui` | Canvas renderer, message log, inventory, party panel, death screen |
| `world/roam` | Fixed-timestep loop: tile-smooth movement, collision, dash, patrol routes, vision cones, hazard damage |
| `world/encounter` | Detects contact, picks ambush or normal start, gathers nearby enemies, hands off to battle and back |
| `battle/improvise` | Props, verb and tag outcome tables, item combos, Bad Idea table, verb-noun parser, LLM adjudication with validation |

**Design rules**

- Game logic is deterministic given a seed and a list of timestamped inputs, advanced by a fixed-timestep loop, and never touches the DOM. That makes replays, tests and bug reports easy.
- All content lives in data files, not code, so adding an item or achievement is a one-file change.
- Systems talk through a small event bus (for example `entityDied`, `itemPicked`, `floorEntered`); the achievements and host modules only listen.
- Roaming and battle share one set of entity data. Entering a battle snapshots enemy HP, so hazard damage carries in, and leaving it writes deaths, loot and gore back to the map.

**Narrator proxy:** one serverless function takes the event context, calls the model with the host's voice rules, enforces a 60-word cap and a per-player rate limit, and returns text. The browser never sees the API key. Client timeout is 3 seconds, after which the scripted line plays.

## Data models

Core types in TypeScript. Names are suggestions; the shapes are what matter.

```ts
type Stats = { hp: number; maxHp: number; str: number; speed: number; evasion: number; armor: number; charm: number };

type Status = { kind: 'bleed' | 'poison' | 'burning' | 'stunned' | 'charmed'; turnsLeft: number };

type Entity = {
  id: string;
  kind: 'player' | 'ally' | 'enemy';
  defId: string;            // points at data/enemies or data/allies
  pos: { x: number; y: number };   // tile units, fractional while roaming
  facing: number;           // radians, drives enemy vision cones
  patrol?: Patrol;          // enemies only
  stats: Stats;
  statuses: Status[];
  cooldowns: Record<string, number>;   // abilityId -> turns left
  inventory: ItemInstance[];
  loyalty?: number;         // allies only, hidden from the player
  level?: number;           // player and allies
  xp?: number;              // player only
  unspentPoints?: number;   // player only
  perks?: string[];         // player only
  stance?: 'aggressive' | 'defensive' | 'support';
};

type ItemDef = {
  id: string;
  name: string;
  rarity: 'junk' | 'standard' | 'special' | 'cursed' | 'hosts_pick';
  slot?: 'weapon' | 'armor' | 'trinket';
  effects: EffectRef[];     // data-driven, interpreted by combat
  description: string;      // the funny text
};

type ItemInstance = { defId: string; charges?: number; identified: boolean };

type Tile = { terrain: 'floor' | 'wall' | 'stairs' | 'door' | 'hazard'; explored: boolean; gore: GoreMark[] };

type Floor = { index: number; theme: string; seed: number; tiles: Tile[][]; entities: Entity[]; rooms: Room[] };

type RunState = {
  seed: number;
  turn: number;
  race: string;
  cls: string;
  floor: Floor;
  party: Entity[];
  log: LogLine[];
  achievementsThisRun: string[];
};

type MetaState = {
  version: number;
  credits: number;
  unlocks: { races: string[]; classes: string[]; allies: string[]; items: string[]; perks: string[] };
  achievements: Record<string, { earnedAt: number; count: number }>;
  eliminations: EliminationReport[];   // the Hall of Eliminations
  findings: Record<string, { firstSeen: number; count: number }>;   // improv discoveries
  settings: { goreLevel: 0 | 1 | 2; llmNarrator: boolean };
};

type EliminationReport = {
  runSeed: number; floor: number; causeOfDeath: string; partingGift: string;
  hostLine: string; source: 'scripted' | 'llm'; ts: number;
};
```

**Roaming, encounters and battles**

```ts
type Mode = 'roaming' | 'battle' | 'menu' | 'dead';

type Patrol = {
  route: { x: number; y: number }[];   // waypoints, looped
  visionRange: number;                 // tiles
  visionArc: number;                   // radians, centered on facing
  hearingRadius: number;               // tiles
  alert: 'idle' | 'suspicious' | 'chasing';
};

type Hazard = {
  tile: { x: number; y: number };
  kind: 'sludge' | 'spikes' | 'gas_vent';
  damagePerSecond: number;
  avoidedBy: 'none' | 'smart';         // smart enemies route around seen hazards
};

type Encounter = {
  enemyIds: string[];                  // enemies within the join radius, max 4
  start: 'player_ambush' | 'enemy_ambush' | 'normal';
  tile: { x: number; y: number };      // where gore and loot land afterwards
};

type BattleState = {
  encounter: Encounter;
  round: number;
  order: string[];                     // entity ids sorted by Speed each round
  combatants: Entity[];                // snapshot; HP carries in from hazard damage
  log: LogLine[];
};
```

**Mode flow:** the game is a small state machine. Roaming runs on a fixed-timestep loop; touching an enemy builds an `Encounter`, decides the ambush type from facing and alert state, snapshots the enemies' current HP into a `BattleState`, and switches mode. When the battle ends, results are written back to the map and the mode returns to roaming.

**Improvisation**

```ts
type PropTag = 'heavy' | 'flammable' | 'edible' | 'explosive' | 'conductive' | 'slippery' | 'container' | 'sharp';

type Prop = { id: string; defId: string; tile: { x: number; y: number }; tags: PropTag[]; usesLeft: number };

type ImprovVerb = 'shove' | 'kick' | 'throw' | 'eat' | 'hide' | 'ignite' | 'combine' | 'wildcard';

type ImprovRequest = {
  text?: string;                       // free-text channel only
  verb?: ImprovVerb;
  propId?: string;
  itemIds?: [string, string];          // item jank channel
  battle: BattleState;
};

type ImprovOutcome = {
  grade: 'disaster' | 'meh' | 'brilliant' | 'legendary';
  effects: EffectRef[];                // from the game's own effect list, magnitudes clamped
  narration: string;
  source: 'table' | 'parser' | 'llm';
  discoveryKey: string;                // verb+tag pair, item pair or outcome id, for Findings rewards
};
```

**Validation:** every `ImprovOutcome`, whatever its source, passes the same validator before it touches game state: known effects only, clamped magnitudes, no item creation, no instant battle end.

**Versioning:** `MetaState.version` is bumped whenever the shape changes; load runs a small migration so old saves keep working.

## Weekend build plan

Two days, five milestones, each ending in something playable. If a milestone runs over, cut from the top of the cut list rather than starting the next one half-built.

| Milestone | When | Goal | Done when |
| --- | --- | --- | --- |
| M1: Walk and see | Saturday morning | Canvas, tile-smooth player movement with collision, FOV, seeded floor generation | You can walk a generated floor and stairs exist |
| M2: Fight | Saturday afternoon | Patrolling enemies with vision cones, battle screen with Speed-based turns and an Attack, Ability, Item and Flee menu, 5 enemy types, HP and death, message log | You can kill rats and die to them |
| M3: Loot and classes | Saturday evening | Items, inventory, Brawler and Hexer abilities, Human and Gutterfolk traits, Improvise menu (props, item jank, Bad Idea), map hazards (sludge, spikes, gas vent) | Two classes feel different in play |
| M4: Party and host | Sunday morning | 3 recruitable allies with stances and loyalty, scripted host lines, death screen with elimination report, XP and level-up screen | A run ends with a funny report |
| M5: Meta and polish | Sunday afternoon | Credits, Intake Desk with 5 unlocks, 20 achievements, local save, gore pass | The second run differs from the first |

**Cut list (drop from the top first)**

1. Live LLM narrator, LLM free-text improv and the serverless function (the parser stays).
2. Gore intensity setting (ship one level).
3. Secret achievements (ship 18 plain ones).
4. Ally loyalty betrayals (allies leave but never turn).
5. Hazard pre-damage (ambushes stay).
6. Vision cones (enemies notice you by a simple radius instead).
7. Perk picks (ship stat points only).
8. Item jank (ship props and the Bad Idea button).
9. The second set piece.

**Risks**

- **Content volume:** 30 items and 20 achievements is a lot of writing. Write funny names first and tune numbers later.
- **Art:** placeholder tiles are fine; do not pause to make art before M3.
- **Balance:** do not tune until M5. Aim for beatable, not balanced.
- **Two modes:** real-time roaming plus a battle screen roughly doubles the UI and state work. If time runs short, cut the cut-list items before cutting the battle menu or enemy patrols.
- **Improvisation content:** tables of outcomes are a lot of writing. Build the tag rules first so every prop and item works generically, then hand-write the funniest specific combos.

**Testing:** keep the game logic deterministic and write a handful of tests with fixed seeds (combat damage, generator always yields reachable stairs, save migration). A bot that plays 1,000 random runs and reports crashes is cheap insurance.

## Later backlog and open questions

**Backlog (after the prototype)**

- Floors 2 to 15 with their themes, plus a boss every 5th floor.
- The remaining 4 classes and 2 races, and a larger ally roster.
- Direct ally control and ally gear.
- Daily seeded run with a shared leaderboard.
- Sound, music and a text-to-speech voice for the host.
- Mobile and touch controls.
- Optional audience-style mechanic (viewers, sponsors), which was deliberately dropped from v1.
- Skills: a trainable skill system (for example lockpicking, haggling, cooking, scavenging) that levels through use and works both on the map and in battle. To be designed alongside perks so the two do not overlap. **Started (user decision):** the first skill, Read the Room, ships in the prototype. Enemies line up their next move in advance; watching enemies act levels the skill, and each level shows more of an enemy's next move above it in battle (the kind of move, then its name, rough damage, and who it is aimed at).

**Open questions**

- [x] Final title: Subpar Dungeon is the working title; confirm before art or branding.
- [x] Tile art source: the free 0x72 16x16 DungeonTileset II (CC0) for the map; characters hand-drawn for now.
- [ ] Should the live LLM narrator be on by default for players, or an opt-in setting?
- [ ] Gore setting: one toggle, or separate sliders for gibs, blood and body parts?
- [ ] How many floors define "winning" in v1: 5, 10 or 15?
- [ ] Is a run timer or turn limit wanted, or is pacing left entirely to the player?
