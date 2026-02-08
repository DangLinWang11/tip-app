import type { TourId } from './types';

const VERSION_KEY = 'tip.tour.version';
const CURRENT_VERSION = '1';
// TEMP: keep tours always available while copy/highlights are being tuned.
// Set to false to restore one-time behavior.
const FORCE_ALWAYS = true;

const keyFor = (tourId: TourId) => `tip.tour.${tourId}.completed`;

const canUseStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

const ensureVersion = (): void => {
  if (!canUseStorage()) return;
  try {
    const stored = window.localStorage.getItem(VERSION_KEY);
    if (stored !== CURRENT_VERSION) {
      window.localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  } catch {
    // ignore storage failures
  }
};

export const getCompleted = (tourId: TourId): boolean => {
  if (FORCE_ALWAYS) return false;
  if (!canUseStorage()) return false;
  try {
    ensureVersion();
    return window.localStorage.getItem(keyFor(tourId)) === '1';
  } catch {
    return false;
  }
};

export const setCompleted = (tourId: TourId): void => {
  if (FORCE_ALWAYS) return;
  if (!canUseStorage()) return;
  try {
    ensureVersion();
    window.localStorage.setItem(keyFor(tourId), '1');
  } catch {
    // ignore storage failures
  }
};

const HOME_FEATURED_HIDE_KEY = 'tip.tour.home.featured.hidden';

export const setHomeFeaturedHidden = (): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(HOME_FEATURED_HIDE_KEY, '1');
  } catch {
    // ignore storage failures
  }
};

export const getHomeFeaturedHidden = (): boolean => {
  if (!canUseStorage()) return false;
  try {
    return window.localStorage.getItem(HOME_FEATURED_HIDE_KEY) === '1';
  } catch {
    return false;
  }
};
