// Battle props (GDD "Improvisation: Props"): things in the arena you can
// shove, kick, throw, eat, hide in or ignite. Most are placed on the map;
// corpses come from gore and sludge puddles from hazards.

export type PropTag = 'heavy' | 'flammable' | 'edible' | 'explosive' | 'conductive' | 'slippery' | 'container' | 'sharp';

export type PropDef = {
  id: string;
  name: string;
  tags: PropTag[];
  /** Times it can be used in a battle before it is wrecked. */
  uses: number;
  /** Plain description for the menu. */
  help: string;
  /** Placed by the floor generator (corpses and sludge come from elsewhere). */
  placed: boolean;
  weight: number;
};

export const PROPS: Record<string, PropDef> = {
  barrel: {
    id: 'barrel', name: 'Barrel', tags: ['heavy', 'container', 'flammable'], uses: 2,
    help: 'Heavy, flammable, and big enough to hide in.', placed: true, weight: 4,
  },
  vending_machine: {
    id: 'vending_machine', name: 'Vending Machine', tags: ['heavy', 'conductive', 'container'], uses: 1,
    help: 'Very heavy. Full of snacks. Plugged in, somehow.', placed: true, weight: 2,
  },
  fire_extinguisher: {
    id: 'fire_extinguisher', name: 'Fire Extinguisher', tags: ['explosive', 'slippery'], uses: 1,
    help: 'Pressurised. Sprays slippery foam. Does not like fire.', placed: true, weight: 2,
  },
  folding_chair: {
    id: 'folding_chair', name: 'Folding Chair', tags: ['sharp'], uses: 2,
    help: 'Light enough to throw. A classic of televised violence.', placed: true, weight: 3,
  },
  corpse: {
    id: 'corpse', name: 'Remains', tags: ['edible', 'heavy'], uses: 1,
    help: 'What is left of a previous resident. Edible, technically.', placed: false, weight: 0,
  },
  sludge_puddle: {
    id: 'sludge_puddle', name: 'Sludge Puddle', tags: ['slippery', 'flammable'], uses: 1,
    help: 'Slippery and, it turns out, flammable.', placed: false, weight: 0,
  },
};

/** Props per floor, and how far from a fight (tiles) a prop joins the arena. */
export const PROP_RULES = { arenaRadius: 2, arenaMax: 4 };
