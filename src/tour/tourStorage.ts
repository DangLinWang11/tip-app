import type { TourId } from './types';

const VERSION_KEY = 'tip.tour.version';
const CURRENT_VERSION = '1';

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
  if (!canUseStorage()) return false;
  try {
    ensureVersion();
    return window.localStorage.getItem(keyFor(tourId)) === '1';
  } catch {
    return false;
  }
};

export const setCompleted = (tourId: TourId): void => {
  if (!canUseStorage()) return;
  try {
    ensureVersion();
    window.localStorage.setItem(keyFor(tourId), '1');
  } catch {
    // ignore storage failures
  }
};
