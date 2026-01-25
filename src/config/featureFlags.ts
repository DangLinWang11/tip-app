export const readFeatureFlag = (value?: string): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const readDevLocalStorageFlag = (key: string): string | undefined => {
  if (!import.meta.env.DEV) return undefined;
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

export const FOOD_JOURNEY_MAP_V2 = readFeatureFlag(
  readDevLocalStorageFlag('FOOD_JOURNEY_MAP_V2') ?? import.meta.env.VITE_FOOD_JOURNEY_MAP_V2
);
