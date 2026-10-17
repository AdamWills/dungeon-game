# First prompt for Claude Code

Paste this into a new Claude Code session in an empty project folder, after copying `CLAUDE.md` to the project root and `GDD.md` to `docs/GDD.md`.

---

Read `CLAUDE.md` and `docs/GDD.md` fully. We are building v1 of Subpar Dungeon, the weekend prototype.

Start with milestone **M1: Walk and see**:

1. Scaffold the project: Vite, TypeScript, rot.js and Vitest, with the folder layout from `CLAUDE.md`. Add `npm run dev`, `npm run build` and `npm test` scripts.
2. Set up the deterministic core: a seeded RNG, a `GameState` type, and a fixed-timestep loop (60 updates per second) that never touches the DOM.
3. Generate a seeded floor with rot.js (rooms and corridors, 8 to 12 rooms, stairs placed far from the start) and render it on a canvas with simple placeholder tiles.
4. Add tile-smooth player movement (arrow keys or WASD) with collision against walls, field of view and fog of war (unexplored hidden, seen-but-not-visible dimmed), and an interact key that takes the stairs.
5. Write Vitest tests with fixed seeds: the generator always produces reachable stairs, and the same seed gives the same floor.

When M1 is done: run the game and confirm you can walk a generated floor and stairs exist, commit, and write `docs/PROGRESS.md`. Then stop and tell me what you built, what you decided, and what M2 will involve. Do not start M2 until I say so.

If anything in the GDD is ambiguous or conflicts with itself, ask me instead of guessing.
