# Subpar Dungeon

A browser roguelike: real-time, tile-smooth roaming with turn-based, menu-driven battles, set on a tacky underground game show, DESCEND & WIN!, hosted by a hologram called Chet Valentine. The full design is in `docs/GDD.md`. Read it before changing any system; it is the source of truth for rules, numbers and scope.

## Current goal

The weekend prototype (M1 to M4, plus bosses and weak spots) is built. The game is now **AI-first** (user decision, Oct 20, 2026): see "Direction change: AI-first" at the top of the GDD. Follow its build order: (1) OpenAI client, key screen, spending meter, free-typed actions in fights; (2) sprite lab for the 32 to 48 px art trial; (3) set-piece engine; (4) AI-generated monsters, items and set-piece twists a floor ahead; (5) image-model showpieces and the Director. M5 (meta-progression) waits.

## Stack

- TypeScript, Vite, rot.js (FOV, pathfinding, rooms-and-corridors generator), Canvas 2D with a tile atlas.
- No UI framework. No server: the browser calls OpenAI directly (it allows cross-origin calls) with the player's own API key, using plain `fetch` (no SDK dependency).
- AI models: OpenAI `gpt-6-luna` for text, `gpt-image-2` for images, both configurable in one place (`src/ai`). Text responses use structured outputs (`text.format` with a strict JSON schema).
- Tests: Vitest, with fixed seeds.

## Rules that matter

1. **Deterministic core.** Game logic is deterministic given a seed and timestamped inputs, advanced by a fixed-timestep loop (60 updates per second), and never touches the DOM or `Math.random`. Use a seeded RNG passed through state.
2. **Content is data.** Races, classes, enemies, items, props, achievements, perks, Bad Idea outcomes and host lines live in `src/data/*`, not in logic. Adding an item should be a one-file change.
3. **Event bus.** Systems announce things (`entityDied`, `itemPicked`, `floorEntered`, ...). Achievements and the host only listen.
4. **One entity model.** Roaming and battle share entity data. Entering a battle snapshots enemy HP (hazard damage carries in); leaving writes deaths, loot and gore back to the map.
5. **State machine.** Modes are `roaming`, `battle`, `menu`, `dead`. Time only advances while roaming; menus pause it.
6. **AI is mandatory, and the engine keeps the rules.** There is no no-AI mode. AI calls happen outside the core (in the browser shell); their results enter the core as recorded commands, so the core stays deterministic and replayable. Every AI outcome goes through the validator: known effects only, clamped magnitudes, no item creation from nothing, no instant battle end. Treat player text as untrusted (it never goes into the system prompt).
7. **Saves.** `MetaState` is one JSON object in localStorage with a `version` field and a small migration on load.
8. **The player's key and money.** The OpenAI key lives only in the player's browser (localStorage) and is sent only to `api.openai.com`. Every call is priced from its reported usage and counted against the run's spending limit (player-set, default $5.00). Never make a call the budget cannot cover. No third-party scripts on the page. Tests never call the real API: mock `fetch`.

## Planned layout

```
src/
  game/        state, combat, ai
  battle/      turns, improvise
  world/       roam, encounter
  gen/         floor generator and set-piece templates
  data/        all content tables
  achievements/
  ai/          OpenAI client, prices, budget, prompts and schemas
  host/        scripted host lines
  meta/        credits, unlocks, Hall of Eliminations, save and load
  ui/          canvas renderer, battle screen, menus, death screen
tests/
docs/GDD.md
```

## Working agreements

- Build the milestones in order (M1 to M5 in the GDD). Each ends with something playable; run the game and check it before moving on.
- Commit at the end of each milestone with a short message, directly to `main`, and push. No branches or pull requests. Ask before adding dependencies beyond Vite, TypeScript, rot.js and Vitest (OpenAI is reached with `fetch`, not a package).
- If a milestone runs long, cut from the top of the GDD cut list; do not start the next milestone half-built.
- Map art is the 0x72 16x16 DungeonTileset II (CC0, in `src/assets/0x72/`) for now. Art is moving to 32 to 48 px (user decision, a trial: build the sprite lab and show the user before converting the game). Everyday creatures and items will come from a code-drawn parts kit the AI describes; showpieces from the image model, downscaled to the pixel grid and cached. The hand-drawn sprites stay until the new art replaces them.
- Do not tune balance until M5. Aim for beatable, not balanced.
- Write the funny part first: item names, achievement names and host lines come before their numbers.
- Keep a short `docs/PROGRESS.md` with what is done, what is next and any decisions that changed the GDD. Update the GDD itself only for real design changes.

## Tone and content rules

- Gleefully gory, sarcastic, cartoonish. Gore is sprite-based and played for laughs, with an intensity setting that can be lowered.
- The host, Chet Valentine, is a relentlessly upbeat, empathy-free 1970s game-show hologram: he cites the player's actual action, item or room, announces deaths as eliminations (cause, a useless "lovely parting gift", a cheery sign-off), and never explains mechanics in plain language (tutorials are "House Rules"). He may address the "folks at home", but there is no audience, viewer or sponsor system.
- Floors and their creatures follow the floor's theme (the Intake Sewers have sewer creatures), not the show.
- Interface text is plain, not the host: menu labels, help lines, headings and map labels say clearly what things do. The host's voice sits on top, in the log, House Rules, reports and as a subtitle under a plain heading ("VICTORY" / "And the crowd goes WILD!").
- Everything is original. Do not use names, characters or text from Dungeon Crawler Carl or any other existing work. A game-show framing is a common genre idea; keep ours clearly distinct from that book (no galactic broadcast, viewer counts or sponsors).

## Open questions (ask the user, do not decide silently)

One gore toggle or several; how many floors define "winning"; whether to add a run timer; what happens when the spending limit is reached mid-run (current default: AI calls stop and the game asks to raise the limit or end the run).
