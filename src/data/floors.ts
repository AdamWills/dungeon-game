// Floor themes. Generator settings live here so a new theme is a data change.

export type FloorTheme = {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: { min: number; max: number };
  roomWidth: [number, number];
  roomHeight: [number, number];
  /** Fraction of the map dug out as rooms before rot.js stops adding them. */
  roomDugPercentage: number;
};

export const FLOOR_THEMES: Record<string, FloorTheme> = {
  intake_sewers: {
    id: 'intake_sewers',
    name: 'The Intake Sewers',
    width: 64,
    height: 40,
    rooms: { min: 8, max: 12 },
    roomWidth: [5, 12],
    roomHeight: [4, 8],
    roomDugPercentage: 0.18,
  },
};
