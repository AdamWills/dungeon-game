# Subpar Dungeon

A browser roguelike: real-time, tile-smooth roaming with turn-based, menu-driven battles, run by a sarcastic AI called the Auditor. The full design is in `docs/GDD.md`. Read it before changing any system; it is the source of truth for rules, numbers and scope.

## Current goal

Build **v1: the weekend prototype** described in the GDD ("Weekend prototype scope" and "Weekend build plan"). One floor (The Intake Sewers), 2 races, 2 classes, 3 allies, the Improvise menu, XP and levels 1 to 5, local-save meta-progression. Nothing outside that scope unless the user asks.

## Stack

- TypeScript, Vite, rot.js (FOV, pathfinding, rooms-and-corridors generator), Canvas 2D with a tile atlas.
- No UI framework. No backend needed to play.
- One optional serverless function (Cloudflare Worker or Vercel function) proxies the LLM narrator so the API key never reaches the browser. Build it last; it is the first item on the cut list.
- Tests: Vitest, with fixed seeds.

## Rules that matter

1. **Deterministic core.** Game logic is deterministic given a seed and timestamped inputs, advanced by a fixed-timestep loop (60 updates per second), and never touches the DOM or `Math.random`. Use a seeded RNG passed through state.
2. **Content is data.** Races, classes, enemies, items, props, achievements, perks, Bad Idea outcomes and Auditor lines live in `src/data/*`, not in logic. Adding an item should be a one-file change.
3. **Event bus.** Systems announce things (`entityDied`, `itemPicked`, `floorEntered`, ...). Achievements and the Auditor only listen.
4. **One entity model.** Roaming and battle share entity data. Entering a battle snapshots enemy HP (hazard damage carries in); leaving writes deaths, loot and gore back to the map.
5. **State machine.** Modes are `roaming`, `battle`, `menu`, `dead`. Time only advances while roaming; menus pause it.
6. **LLM is optional.** The game must be fully playable with the narrator and free-text improv off, which is the default in development. Every LLM outcome goes through the same validator as table and parser outcomes: known effects only, clamped magnitudes, no item creation, no instant battle end. Treat player text as untrusted.
7. **Saves.** `MetaState` is one JSON object in localStorage with a `version` field and a small migration on load.

## Planned layout

```
src/
  game/        state, combat, ai
  battle/      turns, improvise
  world/       roam, encounter
  gen/         floor generator and set-piece templates
  data/        all content tables
  achievements/
  auditor/     scripted lines, LLM client with fallback
  meta/        credits, unlocks, incident archive, save and load
  ui/          canvas renderer, battle screen, menus, death screen
tests/
docs/GDD.md
```

## Working agreements

- Build the milestones in order (M1 to M5 in the GDD). Each ends with something playable; run the game and check it before moving on.
- Commit at the end of each milestone with a short message, directly to `main`, and push. No branches or pull requests. Ask before adding dependencies beyond Vite, TypeScript, rot.js and Vitest.
- If a milestone runs long, cut from the top of the GDD cut list; do not start the next milestone half-built.
- Placeholder art is fine. Use simple generated or free tiles; do not stop to make art before M3.
- Do not tune balance until M5. Aim for beatable, not balanced.
- Write the funny part first: item names, achievement names and Auditor lines come before their numbers.
- Keep a short `docs/PROGRESS.md` with what is done, what is next and any decisions that changed the GDD. Update the GDD itself only for real design changes.

## Tone and content rules

- Gleefully gory, sarcastic, cartoonish. Gore is sprite-based and played for laughs, with an intensity setting that can be lowered.
- The Auditor is deadpan, specific and bureaucratic: it cites the player's actual action, item or room, narrates deaths as incident reports (cause, filing code, fake apology), and never explains mechanics in plain language (tutorials are "policy notices").
- Everything is original. Do not use names, characters or text from Dungeon Crawler Carl or any other existing work.

## Open questions (ask the user, do not decide silently)

Tile art source; whether the live LLM narrator is on by default; one gore toggle or several; how many floors define "winning"; whether to add a run timer.
