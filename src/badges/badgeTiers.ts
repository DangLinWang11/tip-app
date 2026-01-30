export interface BadgeTier {
  index: number;
  name: string;
  minPoints: number;
}

export interface BadgeTierProgress {
  tierIndex: number;
  tierName: string;
  currentMin: number;
  nextMin: number | null;
  progress: number;
}

export type BadgeBand = 'early' | 'mid' | 'high' | 'endgame';

export interface BadgeBandStyle {
  bg: string;
  text: string;
  border: string;
  ring: string;
}

const BADGE_NAMES = [
  'First Bite',
  'Local Taster',
  'Regular',
  'Curious Foodie',
  'Flavor Scout',
  'Tastemaker',
  'Connoisseur',
  'Seasoned Palate',
  'Plate Master',
  'Food Authority',
  'Culinary Insider',
  'Dining Icon',
  'Flavor Architect',
  'Food Visionary',
  'Elite Gastronomad',
  'Dish Legend',
  'Mythic Palate',
  'Crème de la Crème',
  'Food Ascendant',
  'The Oracle of Flavor'
];

const BADGE_THRESHOLDS = [
  0,
  150,
  400,
  800,
  1400,
  2200,
  3200,
  4600,
  6400,
  8800,
  12000,
  16000,
  21000,
  27000,
  34000,
  42000,
  52000,
  64000,
  78000,
  95000
];

export const BADGE_TIERS: BadgeTier[] = BADGE_NAMES.map((name, i) => ({
  index: i + 1,
  name,
  minPoints: BADGE_THRESHOLDS[i]
}));

const ROMAN_NUMERALS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX'
];

const BADGE_BAND_STYLES: Record<BadgeBand, BadgeBandStyle> = {
  early: {
    bg: 'bg-[#EF2D2E]',
    text: 'text-white',
    border: 'border-[#FFC529]',
    ring: 'ring-[#FFC529]'
  },
  mid: {
    bg: 'bg-sky-400',
    text: 'text-white',
    border: 'border-[#FFC529]',
    ring: 'ring-[#FFC529]'
  },
  high: {
    bg: 'bg-blue-700',
    text: 'text-white',
    border: 'border-[#FFC529]',
    ring: 'ring-[#FFC529]'
  },
  endgame: {
    bg: 'bg-neutral-900',
    text: 'text-white',
    border: 'border-[#FFC529]',
    ring: 'ring-[#FFC529]'
  }
};

export const getRomanNumeral = (tierIndex: number): string => {
  const safeIndex = Math.min(Math.max(1, Math.floor(tierIndex || 1)), 20);
  return ROMAN_NUMERALS[safeIndex - 1] || String(safeIndex);
};

export const getBadgeBand = (tierIndex: number): BadgeBand => {
  if (tierIndex >= 16) return 'endgame';
  if (tierIndex >= 11) return 'high';
  if (tierIndex >= 6) return 'mid';
  return 'early';
};

export const getBadgeBandStyle = (tierIndex: number): BadgeBandStyle => {
  const band = getBadgeBand(tierIndex);
  return BADGE_BAND_STYLES[band];
};

export const getTierFromPoints = (points?: number | null): BadgeTierProgress => {
  const safePoints = Number.isFinite(points as number) ? Math.max(0, points as number) : 0;
  let current = BADGE_TIERS[0];

  for (let i = BADGE_TIERS.length - 1; i >= 0; i -= 1) {
    if (safePoints >= BADGE_TIERS[i].minPoints) {
      current = BADGE_TIERS[i];
      break;
    }
  }

  const next = BADGE_TIERS[current.index] || null;
  const currentMin = current.minPoints;
  const nextMin = next ? next.minPoints : null;
  const progress = nextMin === null
    ? 1
    : Math.min(1, Math.max(0, (safePoints - currentMin) / (nextMin - currentMin)));

  return {
    tierIndex: current.index,
    tierName: current.name,
    currentMin,
    nextMin,
    progress
  };
};
