// Damage types and weak spots (user pick: "Weak spots", to make combat more
// than mashing Attack; classic D&D damage types, user decision). Every hit has a type; creatures are weak to some and
// shrug off others. You learn which by trying.

export type DamageType = 'bludgeoning' | 'piercing' | 'slashing' | 'fire' | 'cold' | 'lightning' | 'acid' | 'poison';

export const DAMAGE_TYPES: Record<DamageType, { name: string; color: string }> = {
  bludgeoning: { name: 'Bludgeoning', color: '#c8b890' },
  piercing: { name: 'Piercing', color: '#d0d8e0' },
  slashing: { name: 'Slashing', color: '#a8d0f0' },
  fire: { name: 'Fire', color: '#ff8a3a' },
  cold: { name: 'Cold', color: '#8ad8ff' },
  lightning: { name: 'Lightning', color: '#fff070' },
  acid: { name: 'Acid', color: '#9ad050' },
  poison: { name: 'Poison', color: '#b070e0' },
};

/** A weak spot takes this much more and knocks the target off balance (you go again); a resisted hit, this much. */
export const WEAK_SPOTS = { weakMult: 1.5, resistMult: 0.5 };
