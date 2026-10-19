// Damage types and weak spots (user pick: "Weak spots", to make combat more
// than mashing Attack). Every hit has a type; creatures are weak to some and
// shrug off others. You learn which by trying.

export type DamageType = 'blunt' | 'sharp' | 'fire' | 'gross';

export const DAMAGE_TYPES: Record<DamageType, { name: string; color: string }> = {
  blunt: { name: 'Blunt', color: '#c8b890' },
  sharp: { name: 'Sharp', color: '#a8d0f0' },
  fire: { name: 'Fire', color: '#ff8a3a' },
  gross: { name: 'Gross', color: '#9ad050' },
};

/** A weak spot takes this much more and knocks the target off balance (you go again); a resisted hit, this much. */
export const WEAK_SPOTS = { weakMult: 1.5, resistMult: 0.5 };
